package com.stickerazo.app;

import android.content.Context;
import android.util.Log;
import android.webkit.WebSettings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * El audio para el editor de video (web/video.js): buscar en YouTube y bajar el audio de un video, y el sonido de un
 * TikTok a partir de su enlace. Todo desde el celular (sin pasar por nuestro servidor) y en un hilo aparte: contesta a
 * la página con window.__szAudio(id, json). Lo bajado queda en el caché (audios/) y la página lo lee por /cache/NOMBRE.
 * YouTube: la misma API que usan sus apps (youtubei/v1: search y player); cambia cada tanto y puede dejar de andar.
 * TikTok: la página del video trae en su JSON el sonido (music.playUrl, un MP3) y el video; se baja el sonido.
 */
final class Audios {
    private static final String TAG = "Stickerazo";
    private static final int TOPE = 40 << 20;   // (40 MB: más de media hora de audio)
    private static final String YT = "https://www.youtube.com/youtubei/v1/";

    static File carpeta(Context c) { File d = new File(c.getCacheDir(), "audios"); d.mkdirs(); return d; }

    /** lo que pide la página: tipo ytbuscar (arg: lo que se busca), yt (arg: el id del video) o tt (arg: el enlace) */
    static String atender(Context c, String tipo, String arg) {
        try {
            if ("ytbuscar".equals(tipo)) return ytBuscar(arg).toString();
            if ("yt".equals(tipo)) return ytAudio(c, arg).toString();
            if ("tt".equals(tipo)) return ttAudio(c, arg).toString();
            return error("pedido desconocido");
        } catch (Exception e) {
            Log.w(TAG, "audio " + tipo + ": " + e);
            return error(e instanceof IOException ? "Sin conexión o no respondió" : "No se pudo: " + e.getMessage());
        }
    }
    private static String error(String m) { try { return new JSONObject().put("ok", false).put("error", m).toString(); } catch (Exception e) { return "{\"ok\":false}"; } }

    // ---------------------------------------------------------------- YouTube ----------------------------------------------------------------
    private static JSONObject cliente(String nombre, String version) throws Exception {
        JSONObject c = new JSONObject().put("clientName", nombre).put("clientVersion", version).put("hl", "es").put("gl", "AR");
        return new JSONObject().put("client", c);
    }
    /** buscar videos: título, canal, duración y la miniatura de cada uno (los primeros 20) */
    static JSONObject ytBuscar(String q) throws Exception {
        JSONObject cuerpo = new JSONObject().put("context", cliente("WEB", "2.20251120.01.00")).put("query", q).put("params", "EgIQAQ==");
        JSONObject r = new JSONObject(texto(post(YT + "search?prettyPrint=false", cuerpo.toString(), null, null)));
        List<JSONObject> vs = new ArrayList<JSONObject>(); juntar(r, "videoRenderer", vs, 20);
        JSONArray lista = new JSONArray();
        for (JSONObject v : vs) {
            String id = v.optString("videoId"); if (id.isEmpty()) continue;
            JSONArray minis = v.optJSONObject("thumbnail") != null ? v.optJSONObject("thumbnail").optJSONArray("thumbnails") : null;
            lista.put(new JSONObject().put("id", id).put("titulo", corrido(v.optJSONObject("title"))).put("canal", corrido(v.optJSONObject("ownerText")))
                .put("dur", v.optJSONObject("lengthText") != null ? v.optJSONObject("lengthText").optString("simpleText") : "")
                .put("mini", minis != null && minis.length() > 0 ? minis.getJSONObject(0).optString("url") : ""));
        }
        return new JSONObject().put("ok", true).put("lista", lista);
    }
    private static String corrido(JSONObject t) {
        if (t == null) return ""; if (t.has("simpleText")) return t.optString("simpleText");
        JSONArray rs = t.optJSONArray("runs"); StringBuilder b = new StringBuilder(); if (rs != null) for (int i = 0; i < rs.length(); i++) b.append(rs.optJSONObject(i).optString("text")); return b.toString();
    }
    /** los objetos que están bajo la clave `k` en todo el árbol (la respuesta de búsqueda cambia de forma seguido) */
    private static void juntar(Object o, String k, List<JSONObject> out, int max) {
        if (out.size() >= max) return;
        if (o instanceof JSONObject) { JSONObject j = (JSONObject) o; java.util.Iterator<String> it = j.keys(); while (it.hasNext()) { String x = it.next(); Object v = j.opt(x); if (x.equals(k) && v instanceof JSONObject) out.add((JSONObject) v); else juntar(v, k, out, max); } }
        else if (o instanceof JSONArray) { JSONArray a = (JSONArray) o; for (int i = 0; i < a.length() && out.size() < max; i++) juntar(a.opt(i), k, out, max); }
    }
    /** el audio de un video: se prueba con los clientes que dan las direcciones directas, y se baja de a pedazos */
    static JSONObject ytAudio(Context c, String id) throws Exception {
        if (!id.matches("[A-Za-z0-9_-]{11}")) return new JSONObject().put("ok", false).put("error", "Ese video no es válido");
        String[][] clientes = {
            { "ANDROID_VR", "1.60.19", "28", "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip" },
            { "IOS", "20.10.4", "5", "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)" },
        };
        String ultimo = "YouTube no dio el audio";
        for (String[] cl : clientes) {
            JSONObject ctx = cliente(cl[0], cl[1]);
            if (cl[0].equals("ANDROID_VR")) ctx.getJSONObject("client").put("deviceMake", "Oculus").put("deviceModel", "Quest 3").put("androidSdkVersion", 32).put("osName", "Android").put("osVersion", "12L");
            else ctx.getJSONObject("client").put("deviceMake", "Apple").put("deviceModel", "iPhone16,2").put("osName", "iPhone").put("osVersion", "18.3.2.22D82");
            JSONObject cuerpo = new JSONObject().put("context", ctx).put("videoId", id).put("contentCheckOk", true).put("racyCheckOk", true);
            JSONObject r;
            try { r = new JSONObject(texto(post(YT + "player?prettyPrint=false", cuerpo.toString(), cl[3], new String[] { "X-YouTube-Client-Name", cl[2], "X-YouTube-Client-Version", cl[1] }))); }
            catch (IOException e) { ultimo = "Sin conexión con YouTube"; continue; }
            JSONObject pl = r.optJSONObject("playabilityStatus");
            if (pl != null && !"OK".equals(pl.optString("status"))) { ultimo = pl.optString("reason", "YouTube no deja bajar ese video"); continue; }
            JSONObject sd = r.optJSONObject("streamingData"); JSONArray fs = sd != null ? sd.optJSONArray("adaptiveFormats") : null; if (fs == null) continue;
            JSONObject mejor = null; int puntos = -1;
            for (int i = 0; i < fs.length(); i++) {
                JSONObject f = fs.getJSONObject(i); String mt = f.optString("mimeType"); if (!mt.startsWith("audio/") || !f.has("url")) continue;
                int p = (mt.startsWith("audio/mp4") ? 2000000 : 1000000) + Math.min(f.optInt("bitrate"), 999999);
                if (p > puntos) { puntos = p; mejor = f; }
            }
            if (mejor == null) continue;
            String ext = mejor.optString("mimeType").startsWith("audio/mp4") ? "m4a" : "webm";
            long largo = mejor.optLong("contentLength", 0);
            File f = new File(carpeta(c), "yt_" + id + "." + ext);
            if (!f.isFile() || f.length() == 0) bajarPorRangos(mejor.getString("url"), largo, f, cl[3]);
            JSONObject vd = r.optJSONObject("videoDetails");
            return new JSONObject().put("ok", true).put("url", "/cache/" + f.getName()).put("titulo", vd != null ? vd.optString("title") : "");
        }
        return new JSONObject().put("ok", false).put("error", ultimo);
    }
    /** (YouTube baja lento si se pide de una: se piden pedazos de 9 MB) */
    private static void bajarPorRangos(String url, long largo, File f, String ua) throws IOException {
        if (largo > TOPE) throw new IOException("muy largo");
        File tmp = new File(f.getPath() + ".parte");
        OutputStream o = new FileOutputStream(tmp);
        try {
            long hecho = 0, paso = 9 << 20;
            while (true) {
                long hasta = hecho + paso - 1; if (largo > 0) hasta = Math.min(hasta, largo - 1);
                HttpURLConnection c = (HttpURLConnection) new URL(url + "&range=" + hecho + "-" + hasta).openConnection();
                c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setRequestProperty("User-Agent", ua);
                int cod = c.getResponseCode(); if (cod >= 400) throw new IOException("HTTP " + cod);
                long n = copiar(c.getInputStream(), o, TOPE - hecho); c.disconnect();
                hecho += n; if (n == 0 || (largo > 0 && hecho >= largo) || (largo <= 0 && n < paso)) break;
            }
        } finally { o.close(); }
        if (!tmp.renameTo(f)) throw new IOException("no se pudo guardar");
    }

    // ---------------------------------------------------------------- TikTok ----------------------------------------------------------------
    private static final Pattern DATOS = Pattern.compile("<script id=\"__UNIVERSAL_DATA_FOR_REHYDRATION__\"[^>]*>(.*?)</script>", Pattern.DOTALL);
    static JSONObject ttAudio(Context c, String enlace) throws Exception {
        if (!enlace.matches("https?://([a-z0-9-]+\\.)*tiktok\\.com/\\S+")) return new JSONObject().put("ok", false).put("error", "Ese enlace no es de TikTok");
        String ua = WebSettings.getDefaultUserAgent(c);
        HttpURLConnection h = (HttpURLConnection) new URL(enlace).openConnection();
        h.setInstanceFollowRedirects(true); h.setConnectTimeout(12000); h.setReadTimeout(20000); h.setRequestProperty("User-Agent", ua); h.setRequestProperty("Accept-Language", "es");
        String html = texto(leer(h.getInputStream(), 6 << 20));
        StringBuilder galletas = new StringBuilder();
        List<String> sc = h.getHeaderFields().get("Set-Cookie"); if (sc != null) for (String s : sc) { if (galletas.length() > 0) galletas.append("; "); galletas.append(s.split(";", 2)[0]); }
        Matcher m = DATOS.matcher(html);
        if (!m.find()) return new JSONObject().put("ok", false).put("error", "TikTok no mostró ese video (¿es privado?)");
        JSONObject d = new JSONObject(m.group(1)).optJSONObject("__DEFAULT_SCOPE__");
        JSONObject it = d != null && d.optJSONObject("webapp.video-detail") != null ? d.optJSONObject("webapp.video-detail").optJSONObject("itemInfo") : null;
        it = it != null ? it.optJSONObject("itemStruct") : null;
        if (it == null) return new JSONObject().put("ok", false).put("error", "TikTok no dio los datos del video");
        JSONObject mu = it.optJSONObject("music"), vi = it.optJSONObject("video");
        String url = mu != null ? mu.optString("playUrl") : "", ext = "mp3";
        if (url.isEmpty() && vi != null) { url = vi.optString("playAddr"); ext = "mp4"; }
        if (url.isEmpty()) return new JSONObject().put("ok", false).put("error", "Ese TikTok no tiene un audio para bajar");
        String titulo = mu != null ? (mu.optString("title") + (mu.optString("authorName").isEmpty() ? "" : " · " + mu.optString("authorName"))) : it.optString("desc");
        File f = new File(carpeta(c), "tt_" + Integer.toHexString(url.hashCode()) + "." + ext);
        if (!f.isFile() || f.length() == 0) {
            HttpURLConnection b = (HttpURLConnection) new URL(url).openConnection();
            b.setConnectTimeout(12000); b.setReadTimeout(30000); b.setRequestProperty("User-Agent", ua); b.setRequestProperty("Referer", "https://www.tiktok.com/");
            if (galletas.length() > 0) b.setRequestProperty("Cookie", galletas.toString());
            if (b.getResponseCode() >= 400) return new JSONObject().put("ok", false).put("error", "TikTok no dejó bajar el audio");
            File tmp = new File(f.getPath() + ".parte"); OutputStream o = new FileOutputStream(tmp);
            try { copiar(b.getInputStream(), o, TOPE); } finally { o.close(); b.disconnect(); }
            if (!tmp.renameTo(f)) throw new IOException("no se pudo guardar");
        }
        return new JSONObject().put("ok", true).put("url", "/cache/" + f.getName()).put("titulo", titulo.trim().isEmpty() ? "TikTok" : titulo.trim());
    }

    // ---------------------------------------------------------------- de a poco ----------------------------------------------------------------
    private static byte[] post(String url, String cuerpo, String ua, String[] cab) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setDoOutput(true); c.setRequestMethod("POST");
        c.setRequestProperty("Content-Type", "application/json"); if (ua != null) c.setRequestProperty("User-Agent", ua);
        if (cab != null) for (int i = 0; i + 1 < cab.length; i += 2) c.setRequestProperty(cab[i], cab[i + 1]);
        OutputStream o = c.getOutputStream(); o.write(cuerpo.getBytes("UTF-8")); o.close();
        int cod = c.getResponseCode(); InputStream in = cod >= 400 ? c.getErrorStream() : c.getInputStream();
        byte[] r = in != null ? leer(in, 8 << 20) : new byte[0]; c.disconnect();
        if (cod >= 400) throw new IOException("HTTP " + cod);
        return r;
    }
    private static String texto(byte[] b) throws IOException { return new String(b, "UTF-8"); }
    private static byte[] leer(InputStream in, int max) throws IOException { ByteArrayOutputStream o = new ByteArrayOutputStream(); copiar(in, o, max); return o.toByteArray(); }
    private static long copiar(InputStream in, OutputStream o, long max) throws IOException {
        byte[] b = new byte[64 << 10]; long n = 0; int k;
        try { while ((k = in.read(b)) > 0) { n += k; if (n > max) throw new IOException("muy largo"); o.write(b, 0, k); } } finally { in.close(); }
        return n;
    }
}
