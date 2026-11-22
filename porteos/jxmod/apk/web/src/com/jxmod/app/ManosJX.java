package com.jxmod.app;

import android.Manifest;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.ImageFormat;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CameraMetadata;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Range;
import android.util.Size;
import android.util.Base64;
import android.view.Surface;
import android.webkit.JavascriptInterface;
import com.jxapps.jxhand.Motor;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.Collections;

/**
 * Tus manos con la cámara en JXMod, con el motor de manos en Rust nativo (JX Hand Engine, porteos/jxhand). El juego
 * (manos_jx.js) lo usa por el puente «JXManos»: prender, apagar, leer las manos del último cuadro.
 *
 * - La cámara de frente con Camera2 (~640×480, hasta 30 cuadros por segundo) y el motor corren en su propio hilo; el
 *   juego sólo lee el texto del último cuadro (ManosTexto), así no se traba. En el modo VR del juego (vr.js), la de
 *   atrás (prenderTrasera): con el celular en el casco es la que mira para adelante, hacia tus manos.
 * - El motor usa 2 núcleos y el modelo liviano de entrada: el resto del celular queda para el juego.
 * - La biblioteca (libjxhand.so, ARM de 64 bits) va adentro de la APK como archivo (assets/jxhand/), no en lib/: si
 *   fuera en lib/, Android no dejaría instalar JXMod en los celulares de 32 bits. Se copia una vez a la carpeta de la
 *   app y se carga sólo en los de 64 bits; en los otros la opción no aparece y el juego sigue igual.
 * - La cámara se cierra cuando la app va al fondo y se vuelve a abrir al volver (si estaba prendida).
 */
public class ManosJX {
    static final int PEDIR_CAMARA = 19;
    private static final String DIR = "jxhand";

    private final Web web;
    private HandlerThread hilo;
    private Handler h;
    private long motor;
    private CameraDevice dev;
    private CameraCaptureSession ses;
    private ImageReader lector;
    private int rotSensor = 270;
    private volatile boolean abiertaAtras;
    private volatile boolean quiere, adelante = true, liviano = true;
    /** con la cámara de atrás (el modo VR del juego: el celular en el casco mira para adelante con esa) */
    private volatile boolean trasera;
    private volatile String estado = "apagado";
    private volatile String ultimo = "";
    private volatile int cuadro;
    private Boolean disponible;
    private final ByteBuffer salida = ByteBuffer.allocateDirect(4 * (ManosTexto.CABECERA + 2 * ManosTexto.POR_MANO)).order(ByteOrder.nativeOrder());
    private final FloatBuffer fsal = salida.asFloatBuffer();
    private final float[] datos = new float[ManosTexto.CABECERA + 2 * ManosTexto.POR_MANO];
    private final StringBuilder sb = new StringBuilder(4096);
    // para ver qué pasa: la imagen que mira el motor en chiquito y cuántos cuadros llegan
    private ByteBuffer vista;
    private int vw, vh, rotUlt, camW, camH, cuentaCps;
    private long tCps;
    private volatile String miniatura = "", diag = "";
    private volatile float cps;
    private float msRec, msRed, msYuv;
    private static String uno(float v) { return String.valueOf(Math.round(v * 10) / 10f); }

    ManosJX(Web w) { web = w; }

    private static boolean es64() {
        if (Build.VERSION.SDK_INT < 21) return false;
        for (String a : Build.SUPPORTED_ABIS) if ("arm64-v8a".equals(a)) return true;
        return false;
    }

    private synchronized Handler hilo() {
        if (hilo == null) { hilo = new HandlerThread("jxmod-manos"); hilo.start(); h = new Handler(hilo.getLooper()); }
        return h;
    }

    private boolean tienePermiso() { return Build.VERSION.SDK_INT < 23 || web.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED; }

    // ---- el puente del juego (JXManos) ----

    /** si se puede usar en este celular: 64 bits, la APK trae el motor y hay una cámara (de frente o de atrás) */
    @JavascriptInterface public synchronized boolean disponible() {
        if (disponible == null) {
            boolean ok = false;
            try {
                if (es64()) {
                    String[] l = web.getAssets().list(DIR + "/arm64-v8a");
                    boolean lib = false; if (l != null) for (String x : l) if ("libjxhand.so".equals(x)) lib = true;
                    CameraManager cm = (CameraManager) web.getSystemService(Web.CAMERA_SERVICE);
                    ok = lib && (camara(cm, false) != null || camara(cm, true) != null);
                }
            } catch (Throwable t) { ok = false; }
            disponible = ok;
        }
        return disponible;
    }

    /** prende la cámara de frente y el motor (pide el permiso la primera vez); `livianoModelo`: el modelo liviano de los puntos */
    @JavascriptInterface public String prender(boolean livianoModelo) { return prenderCon(livianoModelo, false); }

    /** lo mismo con la cámara de atrás (el modo VR: el celular en el casco) */
    @JavascriptInterface public String prenderTrasera(boolean livianoModelo) { return prenderCon(livianoModelo, true); }

    private String prenderCon(boolean livianoModelo, boolean deAtras) {
        if (!disponible()) { estado = "no disponible"; return estado; }
        // (si estaba abierta la otra cámara, se cierra y se abre la pedida)
        final boolean cambia = deAtras != trasera;
        quiere = true; liviano = livianoModelo; trasera = deAtras;
        if (cambia) hilo().post(this::cerrarCamara);
        if (!tienePermiso()) {
            estado = "permiso";
            web.runOnUiThread(() -> { try { web.requestPermissions(new String[]{Manifest.permission.CAMERA}, PEDIR_CAMARA); } catch (Throwable t) { estado = "sin permiso"; } });
            return estado;
        }
        hilo().post(this::iniciar);
        return "ok";
    }

    @JavascriptInterface public void apagar() {
        quiere = false; ultimo = ""; estado = "apagado";
        hilo().post(() -> { cerrarCamara(); soltarMotor(); });
    }

    /** las manos del último cuadro como texto (ManosTexto), o "" si no hay uno más nuevo que `visto` */
    @JavascriptInterface public String leer(int visto) { return cuadro == visto ? "" : ultimo; }

    @JavascriptInterface public String estado() { return estado; }

    /** la imagen que mira el motor, chiquita: «ancho,alto,RGB en base64» (cada 15 cuadros), o "" */
    @JavascriptInterface public String miniatura() { return miniatura; }

    /** «cuadros por segundo,giro,ancho×alto de la cámara,brillo,ms de YUV,ms del recorte,ms de la red,ms del detector,hilos,
     *  núcleos grandes,núcleos chicos,producto punto (1/0)» */
    @JavascriptInterface public String diagnostico() { return diag; }

    /** un ajuste del motor (las claves de com.jxapps.jxhand.Motor) */
    @JavascriptInterface public void config(final int clave, final float valor) {
        hilo().post(() -> { if (motor != 0) Motor.config(motor, clave, valor); if (clave == Motor.LIVIANO) liviano = valor > 0.5f; });
    }

    // ---- lo que le avisa la app (Web.java) ----

    void permiso(boolean ok) {
        if (!quiere) return;
        if (ok) hilo().post(this::iniciar); else { estado = "sin permiso"; quiere = false; }
    }
    void alPausar() { adelante = false; if (h != null) h.post(this::cerrarCamara); }
    void alVolver() { adelante = true; if (quiere && tienePermiso()) hilo().post(this::iniciar); }
    void alDestruir() {
        quiere = false;
        if (h != null) h.post(() -> { cerrarCamara(); soltarMotor(); hilo.quitSafely(); });
    }

    // ---- todo lo de abajo, en el hilo de las manos ----

    /** copia la biblioteca a la carpeta de la app (una vez por versión instalada) y la carga */
    private boolean cargarBiblioteca() {
        if (Motor.cargada()) return true;
        try {
            File dir = new File(web.getNoBackupFilesDir(), DIR);
            if (!dir.isDirectory() && !dir.mkdirs()) { estado = "error: no se pudo crear " + dir; return false; }
            long marca = 0;
            try { PackageInfo pi = web.getPackageManager().getPackageInfo(web.getPackageName(), 0); marca = pi.lastUpdateTime; } catch (Throwable t) { /* nada */ }
            File f = new File(dir, "libjxhand_" + marca + ".so");
            if (!f.isFile()) {
                File tmp = new File(dir, "nueva.tmp");
                InputStream in = web.getAssets().open(DIR + "/arm64-v8a/libjxhand.so");
                OutputStream out = new FileOutputStream(tmp);
                byte[] b = new byte[1 << 16]; int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                in.close(); out.close();
                if (!tmp.renameTo(f)) { estado = "error: no se pudo copiar el motor"; return false; }
                f.setReadOnly();
                // (las de versiones anteriores, afuera)
                File[] viejas = dir.listFiles();
                if (viejas != null) for (File v : viejas) if (!v.equals(f)) v.delete();
            }
            if (!Motor.cargar(f.getAbsolutePath())) { estado = "error: " + Motor.errorCarga(); return false; }
            return true;
        } catch (Throwable t) { estado = "error: " + t; return false; }
    }

    private ByteBuffer leerActivo(String nombre) throws Exception {
        InputStream in = web.getAssets().open(DIR + "/" + nombre);
        ByteArrayOutputStream o = new ByteArrayOutputStream(1 << 20);
        byte[] b = new byte[1 << 16]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        in.close();
        byte[] t = o.toByteArray();
        ByteBuffer d = ByteBuffer.allocateDirect(t.length); d.put(t); d.rewind();
        return d;
    }

    private void iniciar() {
        if (!quiere || !adelante) return;
        if (motor == 0) {
            estado = "cargando";
            if (!cargarBiblioteca()) return;
            try {
                motor = Motor.crear(leerActivo("hand_detector.tflite"), leerActivo("hand_landmarks_detector.tflite"), leerActivo("hand_landmark_lite.tflite"));
            } catch (Throwable t) { estado = "error: " + t; return; }
            if (motor == 0) { estado = "error: " + Motor.error(); return; }
            // 2 núcleos (el resto, para el juego), un poco de adelanto (el juego dibuja después del cuadro de la cámara),
            // las dos manos y el realce para poca luz
            // (los núcleos grandes menos uno, entre 2 y 3: el que queda es para el juego. Antes eran 2 fijos)
            Motor.config(motor, Motor.HILOS_MENOS, 1);
            // (sin mano a la vista, el detector —lo más pesado— 1 de cada 2 cuadros: no le saca tanto al juego)
            Motor.config(motor, Motor.BUSCAR_CADA, 2);
            Motor.config(motor, Motor.PREDICCION_MS, 40);
            Motor.config(motor, Motor.MAX_MANOS, 2);
            Motor.config(motor, Motor.POCA_LUZ, 1);
        }
        Motor.config(motor, Motor.LIVIANO, liviano ? 1 : 0);
        abrirCamara();
    }

    private void soltarMotor() { if (motor != 0) { Motor.soltar(motor); motor = 0; } }

    /** la primera cámara de frente (o de atrás) */
    private static String camara(CameraManager cm, boolean deAtras) throws Exception {
        int quiero = deAtras ? CameraCharacteristics.LENS_FACING_BACK : CameraCharacteristics.LENS_FACING_FRONT;
        for (String id : cm.getCameraIdList()) {
            Integer l = cm.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);
            if (l != null && l == quiero) return id;
        }
        return null;
    }

    private void abrirCamara() {
        if (dev != null || lector != null) return;
        try {
            CameraManager cm = (CameraManager) web.getSystemService(Web.CAMERA_SERVICE);
            final boolean deAtras = trasera;
            String id = camara(cm, deAtras);
            if (id == null) { estado = "sin cámara"; return; }
            CameraCharacteristics ch = cm.getCameraCharacteristics(id);
            Integer so = ch.get(CameraCharacteristics.SENSOR_ORIENTATION); rotSensor = so == null ? (deAtras ? 90 : 270) : so;
            abiertaAtras = deAtras;
            StreamConfigurationMap mapa = ch.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Size t = tamano(mapa.getOutputSizes(ImageFormat.YUV_420_888));
            final Range<Integer> rango = rango(ch.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES));
            lector = ImageReader.newInstance(t.getWidth(), t.getHeight(), ImageFormat.YUV_420_888, 2);
            camW = t.getWidth(); camH = t.getHeight(); tCps = 0; cuentaCps = 0;
            lector.setOnImageAvailableListener(this::alLlegar, h);
            estado = "cámara";
            cm.openCamera(id, new CameraDevice.StateCallback() {
                @Override public void onOpened(CameraDevice d) {
                    if (!quiere || !adelante || lector == null) { d.close(); return; }
                    dev = d;
                    try {
                        d.createCaptureSession(Collections.singletonList(lector.getSurface()), new CameraCaptureSession.StateCallback() {
                            @Override public void onConfigured(CameraCaptureSession s) {
                                if (dev == null) { s.close(); return; }
                                ses = s;
                                try {
                                    CaptureRequest.Builder b = dev.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                                    b.addTarget(lector.getSurface());
                                    b.set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO);
                                    b.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE, CameraMetadata.CONTROL_VIDEO_STABILIZATION_MODE_OFF);
                                    if (rango != null) b.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, rango);
                                    s.setRepeatingRequest(b.build(), null, h);
                                } catch (Throwable e) { estado = "error: " + e; }
                            }
                            @Override public void onConfigureFailed(CameraCaptureSession s) { estado = "error: la cámara no arrancó"; }
                        }, h);
                    } catch (Throwable e) { estado = "error: " + e; }
                }
                @Override public void onDisconnected(CameraDevice d) { d.close(); if (dev == d) dev = null; }
                @Override public void onError(CameraDevice d, int e) { d.close(); if (dev == d) dev = null; estado = "error: cámara " + e + " (¿otra app la usa?)"; }
            }, h);
        } catch (SecurityException e) {
            estado = "sin permiso";
        } catch (Throwable e) { estado = "error: " + e; cerrarCamara(); }
    }

    private void cerrarCamara() {
        try { if (ses != null) ses.close(); } catch (Throwable e) { /* nada */ }
        try { if (dev != null) dev.close(); } catch (Throwable e) { /* nada */ }
        try { if (lector != null) lector.close(); } catch (Throwable e) { /* nada */ }
        ses = null; dev = null; lector = null;
    }

    /** el tamaño más cercano a 640×480: sobra para las manos y deja tiempo al juego */
    private static Size tamano(Size[] ts) {
        Size mejor = ts[0]; double pm = 1e9;
        for (Size s : ts) {
            double p = Math.abs(Math.log((double) s.getWidth() * s.getHeight() / (640.0 * 480.0))) + 2 * Math.abs((double) s.getWidth() / s.getHeight() - 4.0 / 3.0) + (s.getHeight() < 360 ? 3 : 0);
            if (p < pm) { pm = p; mejor = s; }
        }
        return mejor;
    }

    /** hasta 30 cuadros por segundo, lo más parejo posible */
    private static Range<Integer> rango(Range<Integer>[] rs) {
        if (rs == null || rs.length == 0) return null;
        Range<Integer> m = null;
        for (Range<Integer> r : rs) {
            if (r.getUpper() > 30) continue;
            if (m == null || r.getUpper() > m.getUpper() || (r.getUpper().equals(m.getUpper()) && r.getLower() > m.getLower())) m = r;
        }
        return m;
    }

    /** cuánto girar el cuadro para que quede derecho con la pantalla como está ahora (la de frente: sensor + pantalla; la
     *  de atrás: sensor − pantalla) */
    private int rotacion() {
        int r = 0;
        try {
            switch (web.getWindowManager().getDefaultDisplay().getRotation()) {
                case Surface.ROTATION_90: r = 90; break;
                case Surface.ROTATION_180: r = 180; break;
                case Surface.ROTATION_270: r = 270; break;
                default: r = 0;
            }
        } catch (Throwable t) { /* nada */ }
        return abiertaAtras ? (rotSensor - r + 360) % 360 : (rotSensor + r) % 360;
    }

    private void alLlegar(ImageReader r) {
        Image im;
        try { im = r.acquireLatestImage(); } catch (Throwable t) { return; }
        if (im == null) return;
        int n = -1;
        // (la imagen chiquita para la vista del juego, cada 15 cuadros: copiar el cuadro entero cuesta)
        boolean conVista = (cuadro % 15) == 0;
        try {
            if (motor != 0) {
                Image.Plane[] p = im.getPlanes();
                int rot = rotacion(); rotUlt = rot;
                int ow = rot % 180 == 90 ? im.getHeight() : im.getWidth(), oh = rot % 180 == 90 ? im.getWidth() : im.getHeight();
                if (conVista && (vista == null || vw != ow || vh != oh)) { vista = ByteBuffer.allocateDirect(ow * oh * 4); vw = ow; vh = oh; }
                // (sin espejar: el juego da vuelta lo que hace falta, manos_jx.js)
                n = Motor.procesar(motor, p[0].getBuffer(), p[1].getBuffer(), p[2].getBuffer(), im.getWidth(), im.getHeight(), p[0].getRowStride(), p[1].getRowStride(), p[1].getPixelStride(),
                    rot, false, im.getTimestamp(), salida, conVista ? vista : null, false);
            }
        } catch (Throwable t) { estado = "error: " + t; } finally { im.close(); }
        if (n < 0) return;
        // cuadros por segundo (cada segundo) y la imagen chiquita (cada 15 cuadros)
        long ahora = System.nanoTime(); cuentaCps++;
        if (tCps == 0) tCps = ahora;
        else if (ahora - tCps > 1_000_000_000L) { cps = cuentaCps * 1e9f / (ahora - tCps); cuentaCps = 0; tCps = ahora; }
        if (conVista && vista != null) {
            int tw = 96, th = Math.max(1, Math.round(96f * vh / vw));
            byte[] rgb = new byte[tw * th * 3];
            for (int y = 0; y < th; y++) for (int x = 0; x < tw; x++) {
                int o = ((y * vh / th) * vw + (x * vw / tw)) * 4, d = (y * tw + x) * 3;
                rgb[d] = vista.get(o); rgb[d + 1] = vista.get(o + 1); rgb[d + 2] = vista.get(o + 2);
            }
            miniatura = tw + "," + th + "," + Base64.encodeToString(rgb, Base64.NO_WRAP);
        }
        fsal.position(0); fsal.get(datos, 0, ManosTexto.CABECERA + n * ManosTexto.POR_MANO);
        // (y de qué se componen los ms: YUV, recorte, red y detector; hilos, núcleos grandes y chicos, producto punto)
        msRec = msRec == 0 ? datos[10] : msRec * 0.9f + datos[10] * 0.1f; msRed = msRed == 0 ? datos[11] : msRed * 0.9f + datos[11] * 0.1f; msYuv = msYuv == 0 ? datos[4] : msYuv * 0.9f + datos[4] * 0.1f;
        diag = Math.round(cps) + "," + rotUlt + "," + camW + "x" + camH + "," + Math.round(datos[5] * 100) + "," + uno(msYuv) + "," + uno(msRec) + "," + uno(msRed) + "," + uno(datos[12])
            + "," + (int) datos[7] + "," + (int) datos[9] + "," + (int) datos[13] + "," + (datos[14] > 0.5f ? 1 : 0);
        ultimo = ManosTexto.armar(sb, cuadro + 1, datos, n, liviano);
        cuadro++;
        estado = "listo";
    }
}
