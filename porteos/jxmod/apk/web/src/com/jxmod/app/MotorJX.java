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
 * JX Motor en la app (sólo la versión personal y en celulares de 64 bits): una SurfaceView atrás del WebView, que queda
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

    private static boolean es64() {
        if (Build.VERSION.SDK_INT < 21) return false;
        for (String a : Build.SUPPORTED_ABIS) if ("arm64-v8a".equals(a)) return true;
        return false;
    }

    /** si este celular puede: versión personal, 64 bits, la APK trae el motor y hay GLES 3 */
    @JavascriptInterface public synchronized boolean disponible() {
        if (disponible == null) {
            boolean ok = false;
            try {
                if (Web.esPersonal(web) && es64()) {
                    String[] l = web.getAssets().list(DIR + "/arm64-v8a");
                    if (l != null) for (String x : l) if ("libjxmotor.so".equals(x)) ok = true;
                    android.app.ActivityManager am = (android.app.ActivityManager) web.getSystemService(Web.ACTIVITY_SERVICE);
                    ok = ok && am.getDeviceConfigurationInfo().reqGlEsVersion >= 0x30000;
                }
            } catch (Throwable t) { ok = false; }
            disponible = ok;
        }
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
            File f = new File(dir, "libjxmotor_" + marca + ".so");
            if (!f.isFile()) {
                File tmp = new File(dir, "nueva.tmp");
                InputStream in = web.getAssets().open(DIR + "/arm64-v8a/libjxmotor.so");
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
