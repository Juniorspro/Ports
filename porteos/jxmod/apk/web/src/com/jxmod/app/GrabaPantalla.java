package com.jxmod.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.DisplayMetrics;
import android.view.Surface;
import android.view.WindowManager;

import java.nio.ByteBuffer;

/**
 * La grabación «pantalla del celular» (Android 10 o más nuevo): lo que se ve —también el video de YouTube de la tele y los
 * botones— y lo que suena en la app —el juego y YouTube—, con la captura de pantalla del sistema (MediaProjection: Android
 * pregunta antes) y la captura del sonido propio (AudioPlaybackCapture). Discord, el dueño: «la grabación no graba el audio
 * de YouTube ni lo que se ve en la tele, y anda mal optimizada». La grabación del juego (grabar.js) copia el lienzo cuadro
 * por cuadro en la página y no puede tocar a YouTube (es otro sitio); ésta la hace el sistema, con el codificador de video
 * del aparato y sin pasar por la página.
 * La pantalla va a una pantalla virtual cuya superficie es la entrada del codificador H.264; el sonido, de AudioRecord al
 * codificador AAC; los dos van a un MP4 (MediaMuxer) que se escribe directo en la galería (Movies/JXMod, pendiente hasta
 * que termina). Android 14+: el servicio pasa a primer plano —tipo mediaProjection— recién después del permiso del usuario
 * y antes de pedir la proyección, que se usa una sola vez.
 */
public final class GrabaPantalla extends Service {
    static final String CANAL = "jx_grabar_pantalla", PARAR = "com.jxmod.app.PANT_PARAR";
    private static final int NOTIF = 7302, MUESTREO = 44100;
    static volatile boolean grabando;

    private MediaProjection proy;
    private VirtualDisplay vd;
    private MediaCodec cv, ca;
    private AudioRecord ar;
    private Surface sup;
    private MediaMuxer mux;
    private ParcelFileDescriptor pfd;
    private Uri uri;
    private final Object candado = new Object();
    private int pistaV = -1, pistaA = -1;
    private boolean muxOn, conAudio;
    private long base = -1;
    private volatile boolean parar, terminado;
    private Thread hv, ha;

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public int onStartCommand(Intent i, int flags, int id) {
        if (i == null) { stopSelf(); return START_NOT_STICKY; }
        if (PARAR.equals(i.getAction())) { terminar(); return START_NOT_STICKY; }
        if (grabando) return START_NOT_STICKY;
        try { primerPlano(); } catch (Throwable e) { Web.pantAviso("error", "servicio: " + e); stopSelf(); return START_NOT_STICKY; }
        int rc = i.getIntExtra("rc", 0); Intent datos = i.getParcelableExtra("datos");
        try {
            empezar(rc, datos, i.getIntExtra("alto", 720), i.getIntExtra("fps", 30), i.getStringExtra("nombre"));
            grabando = true; Web.pantAviso("on", conAudio ? "audio" : "sinAudio");
        } catch (Throwable e) {
            Web.pantAviso("error", String.valueOf(e)); limpiar(false); stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void primerPlano() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) nm.createNotificationChannel(new NotificationChannel(CANAL, "Grabación de pantalla", NotificationManager.IMPORTANCE_LOW));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        PendingIntent pi = PendingIntent.getService(this, 1, new Intent(this, GrabaPantalla.class).setAction(PARAR), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        b.setContentTitle("JXMod").setContentText("Grabando la pantalla — tocá para terminar").setSmallIcon(android.R.drawable.presence_video_online).setOngoing(true).setContentIntent(pi);
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION); else startForeground(NOTIF, n);
    }

    private void empezar(int rc, Intent datos, int alto, int fps, String nombre) throws Exception {
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        proy = mpm.getMediaProjection(rc, datos);
        if (proy == null) throw new IllegalStateException("sin permiso de captura");
        proy.registerCallback(new MediaProjection.Callback() { @Override public void onStop() { terminar(); } }, new Handler(Looper.getMainLooper()));
        // el tamaño: el lado corto pedido (720 o 1080) y el otro con la forma de la pantalla, en múltiplos de 16
        DisplayMetrics real = new DisplayMetrics();
        ((WindowManager) getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(real);
        int sw = real.widthPixels, sh = real.heightPixels;
        double k = Math.min(1.0, Math.max(240, alto) / (double) Math.min(sw, sh));
        int w = Math.max(16, (int) Math.round(sw * k / 16.0) * 16), h = Math.max(16, (int) Math.round(sh * k / 16.0) * 16);
        fps = fps >= 60 ? 60 : 30;
        // el video: H.264 con la superficie como entrada (la placa de video copia la pantalla directo al codificador)
        MediaFormat fv = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w, h);
        fv.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
        fv.setInteger(MediaFormat.KEY_BIT_RATE, (int) Math.min(16e6, Math.max(2e6, w * (double) h * fps * (fps > 30 ? 0.11 : 0.15))));
        fv.setInteger(MediaFormat.KEY_FRAME_RATE, fps);
        fv.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2);
        cv = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
        cv.configure(fv, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        sup = cv.createInputSurface(); cv.start();
        // el sonido de la app (el juego y YouTube): hace falta el permiso del micrófono aunque no se grabe el micrófono; sin
        // él (o si el aparato no deja), el video sale sin sonido
        conAudio = false;
        if (Build.VERSION.SDK_INT >= 29 && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            try {
                AudioPlaybackCaptureConfiguration cfg = new AudioPlaybackCaptureConfiguration.Builder(proy)
                    .addMatchingUsage(AudioAttributes.USAGE_MEDIA).addMatchingUsage(AudioAttributes.USAGE_GAME).addMatchingUsage(AudioAttributes.USAGE_UNKNOWN).build();
                AudioFormat af = new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(MUESTREO).setChannelMask(AudioFormat.CHANNEL_IN_STEREO).build();
                int min = AudioRecord.getMinBufferSize(MUESTREO, AudioFormat.CHANNEL_IN_STEREO, AudioFormat.ENCODING_PCM_16BIT);
                ar = new AudioRecord.Builder().setAudioFormat(af).setBufferSizeInBytes(Math.max(min * 2, 16384)).setAudioPlaybackCaptureConfig(cfg).build();
                if (ar.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("AudioRecord");
                MediaFormat fa = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, MUESTREO, 2);
                fa.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
                fa.setInteger(MediaFormat.KEY_BIT_RATE, 128000);
                fa.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);
                ca = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
                ca.configure(fa, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE); ca.start();
                conAudio = true;
            } catch (Throwable e) {
                if (ar != null) { try { ar.release(); } catch (Throwable x) { /* nada */ } ar = null; }
                if (ca != null) { try { ca.release(); } catch (Throwable x) { /* nada */ } ca = null; }
            }
        }
        // la salida: el MP4 directo en la galería, pendiente (no se ve en la galería) hasta que se cierra
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre == null || nombre.isEmpty() ? "JXMod.mp4" : nombre);
        v.put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Movies/JXMod");
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        uri = getContentResolver().insert(MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), v);
        if (uri == null) throw new IllegalStateException("galería");
        pfd = getContentResolver().openFileDescriptor(uri, "rw");
        mux = new MediaMuxer(pfd.getFileDescriptor(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        vd = proy.createVirtualDisplay("JXMod", w, h, real.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, sup, null, null);
        hv = new Thread(this::bucleVideo, "JXPantVideo"); hv.start();
        if (conAudio) { ar.startRecording(); ha = new Thread(this::bucleAudio, "JXPantAudio"); ha.start(); }
    }

    // el muxer arranca cuando están todas las pistas; recién ahí se pide un cuadro entero (lo de antes se descarta)
    private void pistaLista() {
        if (muxOn || pistaV < 0 || (conAudio && pistaA < 0)) return;
        mux.start(); muxOn = true;
        try { Bundle b = new Bundle(); b.putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0); cv.setParameters(b); } catch (Throwable e) { /* nada */ }
    }
    private void escribir(int pista, ByteBuffer b, MediaCodec.BufferInfo bi, boolean video) {
        synchronized (candado) {
            if (!muxOn || bi.size <= 0) return;
            // (el primer video que entra es un cuadro entero; las horas de las dos pistas, desde el primero que se escribe)
            if (base < 0) { if (video && (bi.flags & MediaCodec.BUFFER_FLAG_KEY_FRAME) == 0) return; base = bi.presentationTimeUs; }
            long t = bi.presentationTimeUs - base; if (t < 0) return;
            MediaCodec.BufferInfo o = new MediaCodec.BufferInfo(); o.set(bi.offset, bi.size, t, bi.flags);
            b.position(bi.offset); b.limit(bi.offset + bi.size);
            try { mux.writeSampleData(pista, b, o); } catch (Throwable e) { /* un pedazo roto no corta la grabación */ }
        }
    }

    private void bucleVideo() {
        MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
        boolean finPedido = false; int vacias = 0;
        while (true) {
            if (parar && !finPedido) { try { cv.signalEndOfInputStream(); } catch (Throwable e) { /* nada */ } finPedido = true; }
            int ix;
            try { ix = cv.dequeueOutputBuffer(bi, 10000); } catch (Throwable e) { break; }
            if (ix == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { synchronized (candado) { pistaV = mux.addTrack(cv.getOutputFormat()); pistaLista(); } continue; }
            if (ix < 0) { if (finPedido && ++vacias > 150) break; continue; }
            vacias = 0;
            ByteBuffer b = cv.getOutputBuffer(ix);
            if ((bi.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && b != null) escribir(pistaV, b, bi, true);
            cv.releaseOutputBuffer(ix, false);
            if ((bi.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break;
        }
    }

    private void bucleAudio() {
        byte[] pcm = new byte[4096];
        MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
        long t0 = -1, muestras = 0; boolean finEnviado = false; int vacias = 0;
        while (true) {
            if (!parar) {
                int n = ar.read(pcm, 0, pcm.length);
                if (n > 0) {
                    if (t0 < 0) t0 = System.nanoTime() / 1000 - n / 4 * 1000000L / MUESTREO;
                    int ix = ca.dequeueInputBuffer(10000);
                    if (ix >= 0) { ByteBuffer ib = ca.getInputBuffer(ix); ib.clear(); ib.put(pcm, 0, n); ca.queueInputBuffer(ix, 0, n, t0 + muestras * 1000000L / MUESTREO, 0); }
                    muestras += n / 4;
                }
            } else if (!finEnviado) {
                int ix = ca.dequeueInputBuffer(10000);
                if (ix >= 0) { ca.queueInputBuffer(ix, 0, 0, Math.max(0, t0) + muestras * 1000000L / MUESTREO, MediaCodec.BUFFER_FLAG_END_OF_STREAM); finEnviado = true; }
            }
            boolean fin = false;
            while (true) {
                int ox;
                try { ox = ca.dequeueOutputBuffer(bi, parar ? 10000 : 0); } catch (Throwable e) { fin = true; break; }
                if (ox == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { synchronized (candado) { pistaA = mux.addTrack(ca.getOutputFormat()); pistaLista(); } continue; }
                if (ox < 0) { if (finEnviado && ++vacias > 150) fin = true; break; }
                vacias = 0;
                ByteBuffer b = ca.getOutputBuffer(ox);
                if ((bi.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && b != null) escribir(pistaA, b, bi, false);
                ca.releaseOutputBuffer(ox, false);
                if ((bi.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) { fin = true; break; }
            }
            if (fin) break;
        }
    }

    // terminar: los dos hilos cierran sus pistas y el archivo pasa a la galería (en un hilo aparte: no se espera en la pantalla)
    void terminar() {
        if (terminado) return; terminado = true; parar = true;
        new Thread(() -> {
            try { if (hv != null) hv.join(4000); } catch (InterruptedException e) { /* nada */ }
            try { if (ha != null) ha.join(4000); } catch (InterruptedException e) { /* nada */ }
            boolean ok = muxOn && base >= 0;
            limpiar(ok);
            Web.pantAviso(ok ? "fin" : "error", ok && uri != null ? uri.toString() : "vacío");
            grabando = false;
            new Handler(Looper.getMainLooper()).post(() -> { if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true); stopSelf(); });
        }, "JXPantFin").start();
    }

    private void limpiar(boolean ok) {
        try { if (vd != null) vd.release(); } catch (Throwable e) { /* nada */ }
        try { if (ar != null) { ar.stop(); ar.release(); } } catch (Throwable e) { /* nada */ }
        try { if (cv != null) { cv.stop(); cv.release(); } } catch (Throwable e) { /* nada */ }
        try { if (ca != null) { ca.stop(); ca.release(); } } catch (Throwable e) { /* nada */ }
        try { if (sup != null) sup.release(); } catch (Throwable e) { /* nada */ }
        synchronized (candado) { try { if (mux != null) { if (muxOn) mux.stop(); mux.release(); } } catch (Throwable e) { ok = false; } }
        try { if (pfd != null) pfd.close(); } catch (Throwable e) { /* nada */ }
        try { if (proy != null) proy.stop(); } catch (Throwable e) { /* nada */ }
        if (uri != null) {
            try {
                if (ok) { ContentValues v = new ContentValues(); v.put(MediaStore.MediaColumns.IS_PENDING, 0); getContentResolver().update(uri, v, null, null); }
                else getContentResolver().delete(uri, null, null);
            } catch (Throwable e) { /* nada */ }
        }
        vd = null; ar = null; cv = null; ca = null; sup = null; mux = null; pfd = null; proy = null;
    }

    @Override public void onDestroy() { if (grabando && !terminado) terminar(); super.onDestroy(); }
}
