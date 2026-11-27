package com.jxmod.nativo;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AutomaticGainControl;
import android.media.audiofx.NoiseSuppressor;
import android.os.Build;

/**
 * El micrófono de la voz por cercanía (voz.js de la web, a la manera de la nativa): 16 kHz mono, con la fuente de voz
 * (cancelación de eco, ruido y ganancia del celular cuando las tiene) y sin poner al celular en modo llamada —así el
 * sonido del juego sigue siendo sonido normal y los grabadores de pantalla lo graban—. Un hilo lee de a 20 ms y lo deja
 * en un anillo de 2 s; Rust lo lleva en cada cuadro (leer), lo comprime y lo manda por la red del juego.
 */
public class Voz {
    private static final int HZ = 16000;
    private static final short[] anillo = new short[HZ * 2];
    private static int esc, lei, vez;
    private static boolean on, pedido;

    /** 1: prendido; 0: esperando el permiso (se pidió); -1: no se pudo */
    public static int prender(final Activity a) {
        synchronized (Voz.class) { if (on) return 1; }
        if (Build.VERSION.SDK_INT >= 23 && a.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            synchronized (Voz.class) {
                if (!pedido) { pedido = true; a.runOnUiThread(new Runnable() { @Override public void run() { try { a.requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, 77); } catch (Throwable t) { } } }); }
            }
            return 0;
        }
        AudioRecord r = null;
        try {
            int min = AudioRecord.getMinBufferSize(HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            int tam = Math.max(min, HZ * 2 / 5);
            try { r = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, tam); } catch (Throwable t) { r = null; }
            if (r == null || r.getState() != AudioRecord.STATE_INITIALIZED) {
                if (r != null) r.release();
                r = new AudioRecord(MediaRecorder.AudioSource.MIC, HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, tam);
            }
            if (r.getState() != AudioRecord.STATE_INITIALIZED) { r.release(); return -1; }
            final int s = r.getAudioSessionId();
            final AcousticEchoCanceler aec = efectoE(s); final NoiseSuppressor ns = (NoiseSuppressor) efectoN(s); final AutomaticGainControl agc = (AutomaticGainControl) efectoG(s);
            r.startRecording();
            final AudioRecord rr = r; final int mia;
            synchronized (Voz.class) { on = true; pedido = false; esc = lei = 0; mia = ++vez; }
            Thread h = new Thread(new Runnable() { @Override public void run() {
                short[] b = new short[HZ / 50];
                try {
                    while (true) {
                        synchronized (Voz.class) { if (!on || vez != mia) break; }
                        int n = rr.read(b, 0, b.length);
                        if (n <= 0) { try { Thread.sleep(10); } catch (InterruptedException e) { break; } continue; }
                        synchronized (Voz.class) {
                            if (vez != mia) break;
                            for (int i = 0; i < n; i++) { anillo[esc] = b[i]; esc = (esc + 1) % anillo.length; if (esc == lei) lei = (lei + 1) % anillo.length; }
                        }
                    }
                } catch (Throwable t) { }
                try { rr.stop(); } catch (Throwable t) { }
                try { rr.release(); } catch (Throwable t) { }
                try { if (aec != null) aec.release(); } catch (Throwable t) { }
                try { if (ns != null) ns.release(); } catch (Throwable t) { }
                try { if (agc != null) agc.release(); } catch (Throwable t) { }
            } }, "jx-voz");
            h.setPriority(Thread.MAX_PRIORITY); h.start();
            return 1;
        } catch (Throwable t) { try { if (r != null) r.release(); } catch (Throwable t2) { } return -1; }
    }
    private static AcousticEchoCanceler efectoE(int s) { try { if (AcousticEchoCanceler.isAvailable()) { AcousticEchoCanceler e = AcousticEchoCanceler.create(s); if (e != null) e.setEnabled(true); return e; } } catch (Throwable t) { } return null; }
    private static Object efectoN(int s) { try { if (NoiseSuppressor.isAvailable()) { NoiseSuppressor e = NoiseSuppressor.create(s); if (e != null) e.setEnabled(true); return e; } } catch (Throwable t) { } return null; }
    private static Object efectoG(int s) { try { if (AutomaticGainControl.isAvailable()) { AutomaticGainControl e = AutomaticGainControl.create(s); if (e != null) e.setEnabled(true); return e; } } catch (Throwable t) { } return null; }

    private static boolean seguir;
    /** la app se fue a segundo plano: soltar el micrófono y acordarse de volver a abrirlo */
    public static synchronized void pausar() { if (on) { seguir = true; apagar(); } }
    public static void volver(Activity a) { boolean s; synchronized (Voz.class) { s = seguir; seguir = false; } if (s) prender(a); }
    /** soltar el micrófono (el hilo lo cierra al terminar de leer) */
    public static synchronized void apagar() { on = false; vez++; esc = lei = 0; }
    /** (el botón: soltarlo del todo, sin volver) */
    public static synchronized void soltar() { seguir = false; apagar(); }

    /** lo que grabó desde la vez anterior (null: nada) */
    public static synchronized short[] leer() {
        if (!on || esc == lei) return null;
        int n = (esc - lei + anillo.length) % anillo.length; short[] o = new short[n];
        for (int i = 0; i < n; i++) { o[i] = anillo[lei]; lei = (lei + 1) % anillo.length; }
        return o;
    }
}
