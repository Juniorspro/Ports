package com.jxmod.nativo;

import android.app.Activity;
import android.content.ContentValues;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.view.Surface;
import java.io.File;
import java.nio.ByteBuffer;
import java.util.ArrayList;

/**
 * Grabar la partida (grabar.js de la web) en el nativo: el video en H.264 desde una Surface del codificador —Rust copia ahí
 * cada cuadro de la pantalla con EGL, sin leerlo a la CPU: casi no cuesta— y el sonido del juego en AAC —Rust le pasa lo que
 * mezcló—, juntos en un MP4. Desde Android 10 va a la Galería (Movies/JXMod); antes, a la carpeta de la app
 * (Android/data/com.jxmod.nativo/files/Movies). Lo que sale de los codificadores lo escribe un hilo aparte.
 */
public class Grabar {
    private static MediaCodec video, audio;
    private static MediaMuxer mux;
    private static Surface sup;
    private static int tv = -1, ta = -1;
    private static boolean empezado;
    private static Thread hilo;
    private static volatile boolean seguir;
    private static Uri uri;
    private static ParcelFileDescriptor pfd;
    private static Activity act;
    private static String nombre, error;
    private static long muestras;
    private static int rate;
    private static final Object lock = new Object();
    /** lo que salió antes de que el muxer tuviera las dos pistas (se escribe al empezar) */
    private static final ArrayList<Object[]> pendientes = new ArrayList<Object[]>();

    /** empieza: la Surface donde van los cuadros (null si no se pudo: el motivo en error()) */
    public static synchronized Surface empezar(Activity a, int w, int h, int fps, int rateAudio) {
        soltar(); act = a; rate = rateAudio; muestras = 0; tv = -1; ta = -1; empezado = false; error = null; pendientes.clear();
        try {
            MediaFormat fv = MediaFormat.createVideoFormat("video/avc", w, h);
            fv.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
            fv.setInteger(MediaFormat.KEY_BIT_RATE, Math.max(2500000, Math.min(16000000, w * h * 8)));
            fv.setInteger(MediaFormat.KEY_FRAME_RATE, fps);
            fv.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);
            video = MediaCodec.createEncoderByType("video/avc");
            video.configure(fv, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            sup = video.createInputSurface();
            video.start();
            MediaFormat fa = MediaFormat.createAudioFormat("audio/mp4a-latm", rate, 2);
            fa.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            fa.setInteger(MediaFormat.KEY_BIT_RATE, 160000);
            fa.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 65536);
            audio = MediaCodec.createEncoderByType("audio/mp4a-latm");
            audio.configure(fa, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            audio.start();
            nombre = "JXMod_" + new java.text.SimpleDateFormat("yyyyMMdd_HHmmss", java.util.Locale.US).format(new java.util.Date()) + ".mp4";
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Video.Media.DISPLAY_NAME, nombre);
                cv.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
                cv.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/JXMod");
                cv.put(MediaStore.Video.Media.IS_PENDING, 1);
                uri = a.getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, cv);
                pfd = a.getContentResolver().openFileDescriptor(uri, "w");
                mux = new MediaMuxer(pfd.getFileDescriptor(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                nombre = "Galería → Movies/JXMod/" + nombre;
            } else {
                File d = a.getExternalFilesDir(Environment.DIRECTORY_MOVIES); if (d == null) d = a.getFilesDir(); d.mkdirs();
                File f = new File(d, nombre); mux = new MediaMuxer(f.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4); nombre = f.getAbsolutePath();
            }
            seguir = true;
            hilo = new Thread(new Runnable() { @Override public void run() { while (seguir) { drenar(video, true, false); drenar(audio, false, false); try { Thread.sleep(4); } catch (InterruptedException e) { return; } } } }, "jxmod-grabar");
            hilo.start();
            return sup;
        } catch (Throwable t) { error = String.valueOf(t); soltar(); return null; }
    }

    /** el sonido del juego: muestras estéreo intercaladas (16 bits) */
    public static void audio(short[] pcm, int n) {
        MediaCodec c = audio; if (c == null || n <= 0) return;
        try {
            int ofs = 0;
            while (ofs < n) {
                int i = c.dequeueInputBuffer(2000); if (i < 0) return;
                ByteBuffer b = c.getInputBuffer(i); b.clear();
                int k = Math.min(n - ofs, b.remaining() / 2);
                for (int j = 0; j < k; j++) b.putShort(pcm[ofs + j]);
                long us = muestras * 1000000L / Math.max(1, rate);
                c.queueInputBuffer(i, 0, k * 2, us, 0);
                muestras += k / 2; ofs += k;
            }
        } catch (Throwable t) { }
    }

    /** lo que salió de un codificador, al muxer (o a la espera si todavía no tiene las dos pistas) */
    private static void drenar(MediaCodec c, boolean esVideo, boolean fin) {
        if (c == null) return;
        MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
        for (int vueltas = 0; vueltas < (fin ? 400 : 64); vueltas++) {
            int i;
            try { i = c.dequeueOutputBuffer(bi, fin ? 10000 : 0); } catch (Throwable t) { return; }
            if (i == MediaCodec.INFO_TRY_AGAIN_LATER) { if (fin) continue; return; }
            if (i == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                synchronized (lock) {
                    if (esVideo) tv = mux.addTrack(c.getOutputFormat()); else ta = mux.addTrack(c.getOutputFormat());
                    if (tv >= 0 && ta >= 0 && !empezado) {
                        mux.start(); empezado = true;
                        for (Object[] p : pendientes) mux.writeSampleData((Boolean) p[0] ? tv : ta, (ByteBuffer) p[1], (MediaCodec.BufferInfo) p[2]);
                        pendientes.clear();
                    }
                }
                continue;
            }
            if (i < 0) continue;
            ByteBuffer b = c.getOutputBuffer(i);
            if ((bi.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) bi.size = 0;
            if (bi.size > 0 && b != null) {
                b.position(bi.offset); b.limit(bi.offset + bi.size);
                synchronized (lock) {
                    if (empezado) mux.writeSampleData(esVideo ? tv : ta, b, bi);
                    else if (pendientes.size() < 600) {
                        ByteBuffer copia = ByteBuffer.allocate(bi.size); copia.put(b); copia.flip();
                        MediaCodec.BufferInfo b2 = new MediaCodec.BufferInfo(); b2.set(0, bi.size, bi.presentationTimeUs, bi.flags);
                        pendientes.add(new Object[] { esVideo, copia, b2 });
                    }
                }
            }
            c.releaseOutputBuffer(i, false);
            if ((bi.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return;
        }
    }

    /** termina y guarda: dónde quedó (o el error, empezando con «!») */
    public static synchronized String terminar() {
        seguir = false;
        try { if (hilo != null) hilo.join(1500); } catch (InterruptedException e) { }
        String r;
        try {
            if (video != null) video.signalEndOfInputStream();
            if (audio != null) { int i = audio.dequeueInputBuffer(10000); if (i >= 0) audio.queueInputBuffer(i, 0, 0, muestras * 1000000L / Math.max(1, rate), MediaCodec.BUFFER_FLAG_END_OF_STREAM); }
            drenar(video, true, true); drenar(audio, false, true);
            if (empezado) { mux.stop(); r = nombre; } else r = "!no llegó ningún cuadro";
        } catch (Throwable t) { r = "!" + t; }
        if (uri != null && act != null) {
            try {
                if (r.startsWith("!")) act.getContentResolver().delete(uri, null, null);
                else { ContentValues cv = new ContentValues(); cv.put(MediaStore.Video.Media.IS_PENDING, 0); act.getContentResolver().update(uri, cv, null, null); }
            } catch (Throwable t) { }
        }
        soltar();
        return r;
    }

    /** el motivo de lo último que salió mal */
    public static String error() { return error == null ? "" : error; }

    private static void soltar() {
        seguir = false;
        try { if (video != null) { video.stop(); video.release(); } } catch (Throwable t) { }
        try { if (audio != null) { audio.stop(); audio.release(); } } catch (Throwable t) { }
        try { if (mux != null) mux.release(); } catch (Throwable t) { }
        try { if (sup != null) sup.release(); } catch (Throwable t) { }
        try { if (pfd != null) pfd.close(); } catch (Throwable t) { }
        video = null; audio = null; mux = null; sup = null; pfd = null; uri = null; hilo = null;
    }
}
