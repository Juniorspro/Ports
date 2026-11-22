package com.jxapps.jxhand;

import android.content.Context;
import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLSurface;
import android.os.Handler;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * La superficie donde dibuja el motor de Rust con OpenGL ES 2.0: la imagen que miró y la mano en 3D encima, apenas
 * termina cada cuadro. El contexto de OpenGL vive en el hilo del motor (el mismo que procesa), así no hay que pasar el
 * cuadro de un hilo a otro: se procesa y se dibuja en el mismo lugar.
 *
 * Pide suavizado de bordes ×4 (multimuestreo) si la placa lo tiene.
 */
public class Pantalla extends SurfaceView implements SurfaceHolder.Callback {
    private final Handler hMotor;
    private EGLDisplay dpy = EGL14.EGL_NO_DISPLAY;
    private EGLContext ctx = EGL14.EGL_NO_CONTEXT;
    private EGLConfig cfg;
    private EGLSurface sup = EGL14.EGL_NO_SURFACE;
    public volatile int ancho, alto;
    /** el motor (para avisarle si el contexto se perdió) */
    public volatile long motor;
    public volatile String error;

    public Pantalla(Context c, Handler hMotor) { super(c); this.hMotor = hMotor; getHolder().addCallback(this); }

    @Override public void surfaceCreated(final SurfaceHolder h) {
        hMotor.post(new Runnable() { public void run() { crearSuperficie(h); } });
    }
    @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int ht) { ancho = w; alto = ht; }
    @Override public void surfaceDestroyed(SurfaceHolder h) {
        // hay que soltar la superficie de EGL antes de que Android la borre: se espera al hilo del motor
        final CountDownLatch listo = new CountDownLatch(1);
        hMotor.post(new Runnable() { public void run() { soltarSuperficie(); listo.countDown(); } });
        try { listo.await(1500, TimeUnit.MILLISECONDS); } catch (InterruptedException e) { }
    }

    // ---- todo lo de abajo, en el hilo del motor ----
    private boolean iniciar() {
        if (ctx != EGL14.EGL_NO_CONTEXT) return true;
        dpy = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);
        int[] v = new int[2];
        if (!EGL14.eglInitialize(dpy, v, 0, v, 1)) { error = "No se pudo iniciar OpenGL"; return false; }
        EGLConfig[] c = new EGLConfig[1]; int[] n = new int[1];
        int[] conMsaa = {EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_DEPTH_SIZE, 16, EGL14.EGL_SAMPLE_BUFFERS, 1, EGL14.EGL_SAMPLES, 4, EGL14.EGL_NONE};
        int[] sinMsaa = {EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_DEPTH_SIZE, 16, EGL14.EGL_NONE};
        if (!EGL14.eglChooseConfig(dpy, conMsaa, 0, c, 0, 1, n, 0) || n[0] == 0) {
            if (!EGL14.eglChooseConfig(dpy, sinMsaa, 0, c, 0, 1, n, 0) || n[0] == 0) { error = "OpenGL ES 2 no disponible"; return false; }
        }
        cfg = c[0];
        ctx = EGL14.eglCreateContext(dpy, cfg, EGL14.EGL_NO_CONTEXT, new int[]{EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE}, 0);
        if (ctx == null || ctx == EGL14.EGL_NO_CONTEXT) { ctx = EGL14.EGL_NO_CONTEXT; error = "No se pudo crear el contexto de OpenGL"; return false; }
        return true;
    }

    private void crearSuperficie(SurfaceHolder h) {
        if (!iniciar()) return;
        soltarSuperficie();
        try {
            sup = EGL14.eglCreateWindowSurface(dpy, cfg, h.getSurface(), new int[]{EGL14.EGL_NONE}, 0);
        } catch (Exception e) { sup = EGL14.EGL_NO_SURFACE; }
        if (sup == null) sup = EGL14.EGL_NO_SURFACE;
        if (sup != EGL14.EGL_NO_SURFACE && EGL14.eglMakeCurrent(dpy, sup, sup, ctx)) {
            // que mostrar un cuadro no espere al refresco de la pantalla (el motor no se frena)
            EGL14.eglSwapInterval(dpy, 0);
        }
    }

    private void soltarSuperficie() {
        if (sup == EGL14.EGL_NO_SURFACE) return;
        EGL14.eglMakeCurrent(dpy, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT);
        EGL14.eglDestroySurface(dpy, sup);
        sup = EGL14.EGL_NO_SURFACE;
    }

    /** deja todo listo para dibujar (true) o avisa que no hay dónde (false) */
    public boolean preparar() {
        if (sup == EGL14.EGL_NO_SURFACE || ctx == EGL14.EGL_NO_CONTEXT) return false;
        if (EGL14.eglMakeCurrent(dpy, sup, sup, ctx)) return true;
        if (EGL14.eglGetError() == EGL14.EGL_CONTEXT_LOST) {
            // el contexto se perdió (pasa en algunos celulares al volver de otra app): se arma de nuevo
            if (motor != 0) Motor.soltarEscena(motor, false);
            EGL14.eglDestroySurface(dpy, sup); sup = EGL14.EGL_NO_SURFACE;
            EGL14.eglDestroyContext(dpy, ctx); ctx = EGL14.EGL_NO_CONTEXT;
            SurfaceHolder h = getHolder();
            if (h.getSurface() != null && h.getSurface().isValid()) crearSuperficie(h);
        }
        return false;
    }

    public void mostrar() { if (sup != EGL14.EGL_NO_SURFACE) EGL14.eglSwapBuffers(dpy, sup); }

    /** al cerrar la app (en el hilo del motor, antes de soltar el motor) */
    public void terminar() {
        if (ctx != EGL14.EGL_NO_CONTEXT && sup != EGL14.EGL_NO_SURFACE && EGL14.eglMakeCurrent(dpy, sup, sup, ctx) && motor != 0) Motor.soltarEscena(motor, true);
        soltarSuperficie();
        if (ctx != EGL14.EGL_NO_CONTEXT) { EGL14.eglDestroyContext(dpy, ctx); ctx = EGL14.EGL_NO_CONTEXT; }
        if (dpy != EGL14.EGL_NO_DISPLAY) { EGL14.eglTerminate(dpy); dpy = EGL14.EGL_NO_DISPLAY; }
    }
}
