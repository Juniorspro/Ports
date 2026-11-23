package com.jxmod.app;

import android.content.pm.PackageInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * JX Motor en la app (sólo la versión personal; celulares ARM de 64 o 32 bits con GLES 3): una SurfaceView atrás del WebView, que queda
 * transparente, y el motor nativo dibujando el mundo en ella. El juego (gmod_personal.js, jxmCuadroNativo) le manda por
 * la puerta «JXMotor» los recursos nuevos y cada cuadro; WebGL dibuja encima sólo el arma, los efectos y la interfaz.
 */
public final class MotorJX {
    static final String DIR = "jxmotor";
    private final Web web;
    private final FrameLayout raiz;
    private SurfaceView vista;
    private long m;
    private String error = "";
    private Boolean disponible;

    MotorJX(Web w, FrameLayout r) { web = w; raiz = r; }

    /** la carpeta de la biblioteca para este proceso: 64 bits (arm64-v8a) o 32 (armeabi-v7a, los Android Go de 1 GB) */
    private static String abi() {
        if (Build.VERSION.SDK_INT >= 23 && android.os.Process.is64Bit()) return "arm64-v8a";
        for (String a : Build.SUPPORTED_32_BIT_ABIS) if ("armeabi-v7a".equals(a)) return "armeabi-v7a";
        return null;
    }

    /** "ok" si este celular puede, o por qué no (se ve en Ajustes) */
    @JavascriptInterface public synchronized String motivo() {
        try {
            if (!Web.esPersonal(web)) return "sólo en la versión personal";
            String a = abi();
            if (a == null) return "procesador no compatible (" + android.text.TextUtils.join(",", Build.SUPPORTED_ABIS) + ")";
            String[] l = web.getAssets().list(DIR + "/" + a);
            boolean lib = false; if (l != null) for (String x : l) if ("libjxmotor.so".equals(x)) lib = true;
            if (!lib) return "la APK no trae el motor para " + a;
            android.app.ActivityManager am = (android.app.ActivityManager) web.getSystemService(Web.ACTIVITY_SERVICE);
            int gl = am.getDeviceConfigurationInfo().reqGlEsVersion;
            if (gl < 0x30000) return "la placa de video tiene OpenGL ES " + (gl >> 16) + "." + (gl & 0xffff) + " (hace falta 3.0)";
            return "ok";
        } catch (Throwable t) { return "error: " + t; }
    }

    /** si este celular puede: versión personal, 64 o 32 bits de ARM, la APK trae el motor y hay GLES 3 */
    @JavascriptInterface public synchronized boolean disponible() {
        if (disponible == null) disponible = "ok".equals(motivo());
        return disponible;
    }

    /** prende el motor y pone la superficie atrás del juego; "ok" o el error */
    @JavascriptInterface public synchronized String prender() {
        if (!disponible()) return "no disponible";
        if (m != 0) return "ok";
        if (!cargarBiblioteca()) return error;
        m = MotorNativo.crear();
        web.runOnUiThread(this::ponerVista);
        return "ok";
    }

    /** apaga el motor: saca la superficie y el juego vuelve a dibujar todo con WebGL */
    @JavascriptInterface public synchronized void apagar() {
        final long viejo = m; m = 0;
        web.runOnUiThread(() -> {
            if (vista != null) { raiz.removeView(vista); vista = null; }   // (surfaceDestroyed suelta la superficie)
            web.fondoOpaco(true);
            if (viejo != 0) new Thread(() -> MotorNativo.soltar(viejo), "jxmotor-fin").start();
        });
    }

    @JavascriptInterface public void recursos(String b64) { long x = m; if (x != 0) MotorNativo.recursos(x, b64); }
    @JavascriptInterface public void cuadro(String b64) { long x = m; if (x != 0) MotorNativo.cuadro(x, b64); }
    @JavascriptInterface public void recursosBin(String s) { long x = m; if (x != 0) MotorNativo.recursosBin(x, s); }
    @JavascriptInterface public void cuadroBin(String s) { long x = m; if (x != 0) MotorNativo.cuadroBin(x, s); }
    /** la prueba del binario: la misma cuenta que hace el juego (h = h·31 + char, en 32 bits) sobre lo que llegó */
    @JavascriptInterface public int prueba(String s) { int h = s.length(); for (int i = 0; i < s.length(); i++) h = h * 31 + s.charAt(i); return h; }
    @JavascriptInterface public void vaciar() { long x = m; if (x != 0) MotorNativo.vaciar(x); }
    @JavascriptInterface public void quitar(String b64) { long x = m; if (x != 0) MotorNativo.quitar(x, b64); }
    @JavascriptInterface public void opciones(String perfil, float escala) { long x = m; if (x != 0) MotorNativo.opciones(x, perfil, escala); }
    @JavascriptInterface public String estado() { long x = m; return x != 0 ? MotorNativo.estado(x) : (error.isEmpty() ? "apagado" : error); }

    private void ponerVista() {
        if (vista != null || m == 0) return;
        vista = new SurfaceView(web);
        vista.getHolder().setFormat(PixelFormat.RGBX_8888);
        vista.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override public void surfaceCreated(SurfaceHolder h) { long x = m; if (x != 0) MotorNativo.superficie(x, h.getSurface()); }
            @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int hh) { long x = m; if (x != 0) MotorNativo.superficie(x, h.getSurface()); }
            @Override public void surfaceDestroyed(SurfaceHolder h) { long x = m; if (x != 0) MotorNativo.superficie(x, null); }
        });
        // (atrás de todo: la primera vista de la raíz; el WebView, encima y transparente)
        raiz.addView(vista, 0, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        web.fondoOpaco(false);
    }

    void alDestruir() { long x = m; m = 0; if (x != 0) MotorNativo.soltar(x); }

    /** copia la biblioteca a la carpeta de la app (una vez por versión instalada) y la carga */
    private boolean cargarBiblioteca() {
        try {
            File dir = new File(web.getNoBackupFilesDir(), DIR);
            if (!dir.isDirectory() && !dir.mkdirs()) { error = "error: no se pudo crear " + dir; return false; }
            long marca = 0;
            try { PackageInfo pi = web.getPackageManager().getPackageInfo(web.getPackageName(), 0); marca = pi.lastUpdateTime; } catch (Throwable t) { /* nada */ }
            File f = new File(dir, "libjxmotor_" + abi() + "_" + marca + ".so");
            if (!f.isFile()) {
                File tmp = new File(dir, "nueva.tmp");
                InputStream in = web.getAssets().open(DIR + "/" + abi() + "/libjxmotor.so");
                OutputStream out = new FileOutputStream(tmp);
                byte[] b = new byte[1 << 16]; int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                in.close(); out.close();
                if (!tmp.renameTo(f)) { error = "error: no se pudo copiar el motor"; return false; }
                f.setReadOnly();
                File[] viejas = dir.listFiles();
                if (viejas != null) for (File v : viejas) if (!v.equals(f)) v.delete();
            }
            System.load(f.getAbsolutePath());
            return true;
        } catch (Throwable t) { error = "error: " + t; return false; }
    }
}
