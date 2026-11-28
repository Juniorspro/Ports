package com.jxmod.nativo;

import android.app.Activity;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.PopupWindow;
import java.util.HashMap;

/**
 * La radio y la tele de la nativa (entidades.js y pantalla.js de la web). La radio: una emisora por internet (de Radio
 * Browser, por la tienda) con el reproductor de Android; Rust le pone el volumen de cada oído en cada cuadro —el lado, la
 * distancia y las paredes, como el sonido espacial—. La tele: el reproductor oficial de YouTube (el de la API de iframes)
 * en una ventanita sin tocar encima del juego, que Rust lleva a donde se ve la pantalla de la tele; su volumen sigue a la
 * distancia. Todo por número (el de la entidad o el del objeto).
 */
public class Medios {
    private static final HashMap<Integer, MediaPlayer> radios = new HashMap<Integer, MediaPlayer>();
    private static final HashMap<Integer, String> estado = new HashMap<Integer, String>();
    private static final HashMap<Integer, PopupWindow> teles = new HashMap<Integer, PopupWindow>();
    private static final HashMap<Integer, WebView> webs = new HashMap<Integer, WebView>();

    // —— la radio ——
    /** suena la emisora `url` en la radio `id` (si ya sonaba otra, la cambia) */
    public static synchronized void radioPoner(int id, String url) {
        radioParar(id);
        try {
            final int k = id; MediaPlayer m = new MediaPlayer();
            m.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            m.setDataSource(url); m.setVolume(0f, 0f);
            m.setOnPreparedListener(new MediaPlayer.OnPreparedListener() { @Override public void onPrepared(MediaPlayer mp) { synchronized (Medios.class) { if (radios.get(k) == mp) { mp.start(); estado.put(k, "sonando"); } } } });
            m.setOnErrorListener(new MediaPlayer.OnErrorListener() { @Override public boolean onError(MediaPlayer mp, int a, int b) { synchronized (Medios.class) { if (radios.get(k) == mp) estado.put(k, "error"); } return true; } });
            radios.put(id, m); estado.put(id, "cargando"); m.prepareAsync();
        } catch (Throwable t) { estado.put(id, "error"); }
    }
    /** el volumen de cada oído (0..1) */
    public static synchronized void radioVol(int id, float l, float r) { MediaPlayer m = radios.get(id); if (m != null) try { m.setVolume(Math.max(0f, Math.min(1f, l)), Math.max(0f, Math.min(1f, r))); } catch (Throwable t) { } }
    public static synchronized void radioParar(int id) { MediaPlayer m = radios.remove(id); estado.remove(id); if (m != null) try { m.release(); } catch (Throwable t) { } }
    /** la app se fue a segundo plano: pausar las radios y las teles (al volver, siguen) */
    public static synchronized void pausar() {
        for (MediaPlayer m : radios.values()) try { if (m.isPlaying()) m.pause(); } catch (Throwable t) { }
        for (WebView w : webs.values()) try { w.evaluateJavascript("if(pl&&pl.pauseVideo)pl.pauseVideo()", null); w.onPause(); } catch (Throwable t) { }
    }
    public static synchronized void volver() {
        for (java.util.Map.Entry<Integer, MediaPlayer> e : radios.entrySet()) try { if ("sonando".equals(estado.get(e.getKey()))) e.getValue().start(); } catch (Throwable t) { }
        for (WebView w : webs.values()) try { w.onResume(); w.evaluateJavascript("if(pl&&pl.playVideo)pl.playVideo()", null); } catch (Throwable t) { }
    }
    /** «cargando», «sonando», «error» o "" */
    public static synchronized String radioEstado(int id) { String s = estado.get(id); return s == null ? "" : s; }

    // —— la tele ——
    private static String html(String vid) {
        return "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'><style>html,body,#p{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><div id=p></div>"
            + "<script src='https://www.youtube.com/iframe_api'></script><script>var pl,vv=100;function onYouTubeIframeAPIReady(){pl=new YT.Player('p',{width:'100%',height:'100%',videoId:'" + vid.split(",")[0]
            + "',playerVars:{" + (vid.contains(",") ? "playlist:'" + vid.substring(vid.indexOf(',') + 1) + "',loop:1," : "") + "autoplay:1,controls:0,playsinline:1,rel:0,modestbranding:1,iv_load_policy:3,fs:0,disablekb:1},events:{onReady:function(e){e.target.setVolume(vv);e.target.playVideo();},onStateChange:function(e){if(e.data===0&&!e.target.getPlaylist())e.target.playVideo();},onError:function(e){e.target.nextVideo();}}});}"
            + "function vol(v){vv=v;if(pl&&pl.setVolume)pl.setVolume(v);}</script></body></html>";
    }
    /** pone el video `vid` (11 letras) en la tele `id` (escondida hasta que Rust diga dónde) */
    public static void telePoner(final Activity a, final int id, final String vid) {
        if (vid == null || !vid.matches("[A-Za-z0-9_-]{11}(,[A-Za-z0-9_-]{11}){0,199}")) return;
        a.runOnUiThread(new Runnable() { @Override public void run() {
            teleCerrar(id);
            try {
                WebView w = new WebView(a); w.setBackgroundColor(Color.BLACK);
                WebSettings s = w.getSettings(); s.setJavaScriptEnabled(true); s.setMediaPlaybackRequiresUserGesture(false); s.setDomStorageEnabled(true);
                w.setWebChromeClient(new WebChromeClient());
                w.loadDataWithBaseURL("https://www.youtube-nocookie.com/", html(vid), "text/html", "utf-8", null);
                PopupWindow p = new PopupWindow(w, 2, 2, false); p.setTouchable(false); p.setFocusable(false); p.setClippingEnabled(false);
                View raiz = a.getWindow().getDecorView(); p.showAtLocation(raiz, Gravity.TOP | Gravity.LEFT, -10, -10);
                teles.put(id, p); webs.put(id, w);
            } catch (Throwable t) { }
        } });
    }
    /** dónde se ve la pantalla de la tele (píxeles de la pantalla) y si se ve */
    public static void teleLugar(final Activity a, final int id, final int x, final int y, final int w, final int h, final boolean ve) {
        a.runOnUiThread(new Runnable() { @Override public void run() {
            PopupWindow p = teles.get(id); if (p == null) return;
            try { if (ve && w > 8 && h > 8) p.update(x, y, w, h); else p.update(-4000, -4000, 2, 2); } catch (Throwable t) { }
        } });
    }
    /** el volumen (0..100) */
    public static void teleVol(final Activity a, final int id, final int v) {
        a.runOnUiThread(new Runnable() { @Override public void run() { WebView w = webs.get(id); if (w != null) try { w.evaluateJavascript("vol(" + Math.max(0, Math.min(100, v)) + ")", null); } catch (Throwable t) { } } });
    }
    public static void teleParar(final Activity a, final int id) { a.runOnUiThread(new Runnable() { @Override public void run() { teleCerrar(id); } }); }
    private static void teleCerrar(int id) {
        PopupWindow p = teles.remove(id); WebView w = webs.remove(id);
        try { if (p != null) p.dismiss(); } catch (Throwable t) { }
        try { if (w != null) { w.loadUrl("about:blank"); ViewGroup g = (ViewGroup) w.getParent(); if (g != null) g.removeView(w); w.destroy(); } } catch (Throwable t) { }
    }
}
