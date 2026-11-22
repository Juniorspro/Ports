package com.jxapps.jxhand;

import android.content.Context;
import android.graphics.ImageFormat;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CameraMetadata;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Range;
import android.util.Size;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.Collections;

/**
 * La cámara con Camera2: cuadros YUV de ~640×480 directo al motor de Rust, sin pasar por una vista previa ni por
 * JavaScript. Cada cuadro se procesa apenas llega (si el motor está ocupado, el siguiente reemplaza al viejo: siempre
 * el más nuevo) y enseguida se dibuja con su esqueleto.
 *
 * Hilos: los avisos de la cámara van por su hilo; los cuadros, por el hilo del motor (el único que toca el motor).
 */
public class Camara {
    public static final int AUTO = 0, COMPLETO = 1, LIVIANO = 2;

    private final Context ctx;
    private final Capa capa;
    private final Pantalla pantalla;
    private final Handler hMotor;
    private HandlerThread tCam;
    private Handler hCam;
    private CameraManager cm;
    private CameraDevice dev;
    private CameraCaptureSession ses;
    private ImageReader lector;
    private Range<Integer>[] rangos;
    private int rotSensor;
    private boolean frente, hayFlash, afContinuo;
    /** si se cerró mientras la cámara todavía se estaba abriendo: cuando avise que abrió, se la cierra */
    private volatile boolean cerrada = true;

    // lo que elige la persona (lo cambia la pantalla; se lee en los otros hilos)
    public volatile boolean quiereFrente, linterna, noche, rapido = true;
    /** el estilo de la mano en 3D (Motor.ESTILOS) */
    public volatile int estilo;
    public volatile int modelo = AUTO;
    /** el motor de Rust (lo crea y lo suelta Principal, en el hilo del motor) */
    public volatile long motor;

    private final ByteBuffer salida = ByteBuffer.allocateDirect(4 * (Motor.CABECERA + 2 * Motor.POR_MANO)).order(ByteOrder.nativeOrder());
    private final FloatBuffer fsal = salida.asFloatBuffer();
    private final float[] datos = new float[Motor.CABECERA + 2 * Motor.POR_MANO];
    private final Capa.Hud hud = new Capa.Hud();
    private double msDibujo;
    private boolean avisoDibujo;
    private long ultimoT;
    private double cps, ms, msBuscar;
    private long tPerfil;
    private boolean usaLiviano;
    private int cuentaAuto;
    private double emaAuto;

    public Camara(Context ctx, Capa capa, Pantalla pantalla, Handler hMotor) { this.ctx = ctx; this.capa = capa; this.pantalla = pantalla; this.hMotor = hMotor; }

    public boolean hayLinterna() { return hayFlash; }
    public boolean esFrente() { return frente; }

    /** el modelo que usa el motor ahora (lo llama el hilo del motor cuando cambia el ajuste) */
    public void aplicarModelo() {
        if (motor == 0) return;
        boolean liv = modelo == LIVIANO;
        if (modelo == AUTO) { liv = usaLiviano; }
        Motor.config(motor, Motor.LIVIANO, liv ? 1 : 0);
        usaLiviano = liv; cuentaAuto = 0; emaAuto = 0;
    }

    public void abrir() {
        // (si ya está abierta o abriéndose, nada: al volver de pedir el permiso se llama dos veces)
        if (!cerrada) return;
        cerrada = false;
        if (tCam == null) { tCam = new HandlerThread("jxhand-camara"); tCam.start(); hCam = new Handler(tCam.getLooper()); }
        cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        try {
            String id = elegir(quiereFrente);
            if (id == null) { capa.mensaje("No se encontró una cámara", null); return; }
            CameraCharacteristics ch = cm.getCameraCharacteristics(id);
            Integer so = ch.get(CameraCharacteristics.SENSOR_ORIENTATION); rotSensor = so == null ? 90 : so;
            Integer lado = ch.get(CameraCharacteristics.LENS_FACING); frente = lado != null && lado == CameraCharacteristics.LENS_FACING_FRONT;
            Boolean fl = ch.get(CameraCharacteristics.FLASH_INFO_AVAILABLE); hayFlash = fl != null && fl;
            int[] af = ch.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES); afContinuo = false;
            if (af != null) for (int m : af) if (m == CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_VIDEO) afContinuo = true;
            rangos = ch.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);
            StreamConfigurationMap mapa = ch.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Size t = tamano(mapa.getOutputSizes(ImageFormat.YUV_420_888));
            lector = ImageReader.newInstance(t.getWidth(), t.getHeight(), ImageFormat.YUV_420_888, 3);
            lector.setOnImageAvailableListener(alLlegar, hMotor);
            cm.openCamera(id, estado, hCam);
        } catch (SecurityException e) {
            capa.mensaje("Hace falta el permiso de la cámara", "Tocá la pantalla para pedirlo de nuevo");
        } catch (Exception e) {
            capa.mensaje("No se pudo abrir la cámara", String.valueOf(e.getMessage()));
        }
    }

    public void cerrar() {
        cerrada = true;
        try { if (ses != null) ses.close(); } catch (Exception e) { }
        try { if (dev != null) dev.close(); } catch (Exception e) { }
        ses = null; dev = null;
        // el lector se cierra en el hilo del motor: así no puede cerrarse mientras el motor lee un cuadro suyo
        final ImageReader l = lector; lector = null;
        if (l != null) hMotor.post(new Runnable() { public void run() { try { l.close(); } catch (Exception e) { } } });
    }

    public void girar() { quiereFrente = !quiereFrente; linterna = false; cerrar(); abrir(); }

    /** vuelve a mandar el pedido a la cámara (después de prender la linterna o cambiar «ver de noche») */
    public void actualizar() {
        if (hCam == null) return;
        hCam.post(new Runnable() { public void run() { pedir(); } });
    }

    private String elegir(boolean deFrente) throws CameraAccessException {
        String otra = null;
        for (String id : cm.getCameraIdList()) {
            Integer l = cm.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);
            if (l == null) continue;
            if ((l == CameraCharacteristics.LENS_FACING_FRONT) == deFrente) return id;
            if (otra == null) otra = id;
        }
        return otra;
    }

    /** el tamaño más cercano a 640×480 (4:3): sobra para el motor y pasa rápido */
    private static Size tamano(Size[] ts) {
        Size mejor = ts[0]; double pm = 1e9;
        for (Size s : ts) {
            double area = Math.abs(Math.log((double) s.getWidth() * s.getHeight() / (640.0 * 480.0)));
            double forma = Math.abs((double) s.getWidth() / s.getHeight() - 4.0 / 3.0);
            double p = area + 2 * forma + (s.getHeight() < 360 ? 3 : 0);
            if (p < pm) { pm = p; mejor = s; }
        }
        return mejor;
    }

    /** cuadros por segundo: rápido = el tope más alto y fijo; ver de noche = dejar que baje (más tiempo de exposición) */
    private Range<Integer> rango() {
        if (rangos == null || rangos.length == 0) return null;
        Range<Integer> m = null;
        for (Range<Integer> r : rangos) {
            if (m == null) { m = r; continue; }
            int tope = rapido && !noche ? 60 : 30;
            int a = Math.min(r.getUpper(), tope), b = Math.min(m.getUpper(), tope);
            if (a > b) m = r;
            else if (a == b) {
                // con el mismo tope: rápido prefiere el piso más alto (cuadros parejos); de noche, el más bajo
                if (noche ? r.getLower() < m.getLower() : r.getLower() > m.getLower()) m = r;
            }
        }
        return m;
    }

    private void pedir() {
        if (dev == null || ses == null || lector == null) return;
        try {
            CaptureRequest.Builder b = dev.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            b.addTarget(lector.getSurface());
            b.set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO);
            b.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON);
            if (afContinuo) b.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
            // la estabilización por software guarda cuadros para suavizar: agrega retraso
            b.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE, CameraMetadata.CONTROL_VIDEO_STABILIZATION_MODE_OFF);
            Range<Integer> r = rango(); if (r != null) b.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, r);
            b.set(CaptureRequest.FLASH_MODE, linterna && hayFlash ? CameraMetadata.FLASH_MODE_TORCH : CameraMetadata.FLASH_MODE_OFF);
            ses.setRepeatingRequest(b.build(), null, hCam);
        } catch (Exception e) { }
    }

    private final CameraDevice.StateCallback estado = new CameraDevice.StateCallback() {
        @Override public void onOpened(CameraDevice d) {
            final ImageReader l = lector;
            if (cerrada || l == null) { d.close(); return; }
            dev = d;
            try {
                d.createCaptureSession(Collections.singletonList(l.getSurface()), new CameraCaptureSession.StateCallback() {
                    @Override public void onConfigured(CameraCaptureSession s) { if (cerrada) { s.close(); return; } ses = s; pedir(); }
                    @Override public void onConfigureFailed(CameraCaptureSession s) { capa.mensaje("La cámara no quiso arrancar", "Probá cerrar y abrir la app"); }
                }, hCam);
            } catch (Exception e) { capa.mensaje("La cámara no quiso arrancar", String.valueOf(e.getMessage())); }
        }
        @Override public void onDisconnected(CameraDevice d) { d.close(); if (dev == d) dev = null; }
        @Override public void onError(CameraDevice d, int error) {
            d.close(); if (dev == d) dev = null;
            capa.mensaje("La cámara se cerró (error " + error + ")", "Puede que otra app la esté usando");
        }
    };

    private final ImageReader.OnImageAvailableListener alLlegar = new ImageReader.OnImageAvailableListener() {
        @Override public void onImageAvailable(ImageReader r) {
            Image im;
            try { im = r.acquireLatestImage(); } catch (Exception e) { return; }
            if (im == null) return;
            // el cuadro se devuelve a la cámara apenas el motor lo pasó a su imagen; recién después se dibuja
            int n = -1;
            try { n = procesar(im); } catch (Throwable t) { } finally { im.close(); }
            if (n >= 0) try { despues(n); } catch (Throwable t) { }
        }
    };

    private long tCuadro;

    private int procesar(Image im) {
        long m = motor;
        if (m == 0) return -1;
        int w = im.getWidth(), h = im.getHeight(), rot = rotSensor;
        boolean espejo = frente;
        Image.Plane[] p = im.getPlanes();
        int n = Motor.procesar(m, p[0].getBuffer(), p[1].getBuffer(), p[2].getBuffer(), w, h, p[0].getRowStride(), p[1].getRowStride(), p[1].getPixelStride(),
            rot, espejo, im.getTimestamp(), salida, null, noche);
        if (n < 0) return -1;
        fsal.position(0); fsal.get(datos, 0, Motor.CABECERA + n * Motor.POR_MANO);
        tCuadro = im.getTimestamp();
        return n;
    }

    private void despues(int n) {
        long m = motor;
        if (m == 0) return;
        // se dibuja enseguida, en este mismo hilo: la imagen que miró el motor y la mano en 3D encima
        if (pantalla.ancho > 0 && pantalla.preparar()) {
            long t0 = System.nanoTime();
            int r = Motor.dibujar(m, pantalla.ancho, pantalla.alto, estilo, 1f, (System.nanoTime() % 1_000_000_000_000L) / 1e9f);
            if (r < 0) {
                // (no debería pasar: OpenGL ES 2 está en todos los celulares; si pasa, el mensaje queda fijo con el porqué)
                if (!avisoDibujo) { avisoDibujo = true; capa.mensaje("No se pudo dibujar en 3D", Motor.error()); }
                return;
            }
            pantalla.mostrar();
            double md = (System.nanoTime() - t0) / 1e6; msDibujo = msDibujo == 0 ? md : msDibujo * 0.9 + md * 0.1;
        }
        // lo de arriba: cuadros por segundo de la cámara y lo que tarda el motor (promedios cortos)
        long t = tCuadro;
        if (ultimoT > 0 && t > ultimoT) { double c = 1e9 / (t - ultimoT); cps = cps == 0 ? c : cps * 0.9 + c * 0.1; }
        ultimoT = t;
        // (seguir la mano y buscarla, aparte: sin mano, el detector corre en cada cuadro y tarda más; mezclado, el número
        // de arriba no decía lo que tarda seguir la mano, que es lo que se siente)
        boolean busco = datos[1] > 0.5f;
        if (busco) msBuscar = msBuscar == 0 ? datos[3] : msBuscar * 0.8 + datos[3] * 0.2;
        else if (n > 0) ms = ms == 0 ? datos[3] : ms * 0.9 + datos[3] * 0.1;
        hud.msBuscar = msBuscar; hud.buscando = n == 0;
        // (con «Medir cada capa»: lo medido, una vez por segundo)
        if (t - tPerfil > 1_000_000_000L) { tPerfil = t; String pf = Motor.perfil(m); if (pf != null && !pf.equals("-")) hud.perfil = pf; }
        hud.msMotor = ms; hud.msCuadro = datos[4]; hud.cps = cps; hud.hilos = (int) datos[7];
        hud.msRecorte = hud.msRecorte == 0 ? datos[10] : hud.msRecorte * 0.9 + datos[10] * 0.1; hud.msRed = hud.msRed == 0 ? datos[11] : hud.msRed * 0.9 + datos[11] * 0.1;
        hud.msDet = datos[12]; hud.grandes = (int) datos[9]; hud.chicos = (int) datos[13]; hud.dot = datos[14] > 0.5f; hud.auto = Math.round(datos[15]);
        hud.brillo = datos[5]; hud.ganancia = datos[6]; hud.noche = noche; hud.frente = frente; hud.msDibujo = msDibujo; hud.estilo = Motor.ESTILOS[Math.max(0, Math.min(3, estilo))];
        hud.modelo = (usaLiviano ? "liviano" : "completo") + (modelo == AUTO ? " (auto)" : "") + (datos[8] > 0.5f ? " · float16" : "");
        if (n == 0) { if (hud.sinManosDesde == 0) hud.sinManosDesde = System.nanoTime(); } else hud.sinManosDesde = 0;
        // Auto: si el modelo completo tarda más de 5 ms en este celular, pasa al liviano (una vez)
        if (modelo == AUTO && !usaLiviano && n > 0 && datos[1] < 0.5f) {
            emaAuto = cuentaAuto == 0 ? datos[3] : emaAuto * 0.92 + datos[3] * 0.08;
            if (++cuentaAuto > 45 && emaAuto > 5.0) { Motor.config(m, Motor.LIVIANO, 1); usaLiviano = true; }
        }
        capa.actualizar(datos, n, hud);
    }
}
