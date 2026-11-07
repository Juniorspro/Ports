package com.jxmod.app;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * SteamPipe sin la tienda: lo que el juego necesita para bajar un addon del Workshop que Steam no da como archivo directo
 * (la clave del depósito de los addons de GMod, el código del manifiesto y los servidores del CDN), pedido por la app misma.
 * Es lo mismo que hace la tienda (tienda/steampipe.js): entra anónima por el WebSocket de Steam, como un servidor dedicado
 * de GMod, sin cuenta ni contraseña, pide las dos cosas y se va. Una página no puede hacerlo: Steam sólo deja entrar a su
 * WebSocket sin «Origin» o desde sus sitios (desde la app contesta 403), y la tienda (plan gratis de Cloudflare) llega a
 * su tope de pedidos por día y deja a todos sin mods hasta el día siguiente.
 * Sin nada de Android, para probarlo en la compu contra Steam (apk/pruebas/unido/PruebaSteamPipe.java).
 */
final class SteamPipe {
    private SteamPipe() {}

    static final int APP_GMOD = 4000, DEP_ADDONS = 4000;
    private static final int PROTOCOLO = 65580;
    private static final long ANON = 0x01A0000000000000L;   // (cuenta anónima del universo público, como un servidor dedicado)
    private static final int EM_MULTI = 1, EM_SVC_RESP = 147, EM_SVC_LLAMADA = 151, EM_LOGOFF = 706, EM_LOGON_RESP = 751,
            EM_CLAVE = 5438, EM_CLAVE_RESP = 5439, EM_LOGON = 5514, EM_HOLA = 9805, EM_PICS_INFO = 8903, EM_PICS_INFO_RESP = 8904,
            EM_PICS_TOKEN = 8905, EM_PICS_TOKEN_RESP = 8906;
    static final int APP_SERVIDOR = 4020, DEP_BASE = 4021;   // (el servidor dedicado de GMod: HL2, CS:S y los .vpk de GMod)
    private static final Pattern CM = Pattern.compile("\"(?:endpoint)\"\\s*:\\s*\"([a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.steamserver\\.net):\\d{2,5}\"");
    private static final Pattern CM_WS = Pattern.compile("\"([a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.steamserver\\.net):\\d{2,5}\"");
    private static final Pattern CDN_HOST = Pattern.compile("^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.steamcontent\\.com$");
    private static final String[] CM_RESPALDO = { "cmp1-lax1", "cmp2-lax1", "cmp1-sea1", "cmp2-sea1", "cmp1-dfw2", "cmp2-dfw2", "cmp1-iad1", "cmp2-iad1" };
    private static final String[] CDN_RESPALDO = { "cache1-lax1", "cache2-lax1", "cache5-lax1", "cache2-sea1", "cache3-sea1", "cache5-sea1" };

    // (en memoria: la clave del depósito no cambia; las listas de servidores, una hora; el código de un manifiesto, 4 minutos)
    private static final Map<String, byte[]> claves = new HashMap<>();
    private static final Map<String, String[]> publicos = new HashMap<>();   // (app:dep → {manifiesto, cuándo}: una hora)
    private static List<String> cms, cdns;
    private static long cmsT, cdnsT;
    private static final Map<String, String[]> codigos = new HashMap<>();
    private static final SecureRandom AZAR = new SecureRandom();

    /** Lo que contesta la app en /red/_steam… (Web.java y la prueba usan esto mismo); null si la ruta no es de Steam. */
    static Resp ruta(String p) {
        if (p == null || !p.startsWith("/red/_steam")) return null;
        if (p.startsWith("/red/_steampipe/")) return acceso(p.substring(16));
        if (p.startsWith("/red/_steamdet/")) return detallesJson(p.substring(15));
        if (p.equals("/red/_steambase")) return base();
        if (p.startsWith("/red/_steamreq/")) return requeridos(p.substring(15));
        return new Resp(404, "{\"error\":\"ruta\"}");
    }

    /** Lo que el juego pide en /red/_steampipe/ID: el mismo JSON que da la tienda en /api/gmod/pipe/ID. */
    static Resp acceso(String wid) {
        if (wid == null || !wid.matches("\\d{3,12}")) return new Resp(400, "{\"error\":\"id\"}");
        String det;
        try { det = detalles(wid); } catch (Exception e) { return new Resp(502, json("error", "Steam: " + msg(e))); }
        if (!Pattern.compile("\"result\"\\s*:\\s*1\\b").matcher(cortarItem(det)).find()) return new Resp(404, "{\"error\":\"no existe\",\"noExiste\":true}");
        String item = cortarItem(det), man = campo(item, "hcontent_file");
        if (man == null || !man.matches("[1-9]\\d{4,19}")) return new Resp(409, "{\"error\":\"sin archivo\",\"sinArchivo\":true}");
        String tam = campo(item, "file_size");
        try {
            String[] cc;
            synchronized (codigos) { cc = codigos.get(man); }
            if (cc == null || System.currentTimeMillis() - Long.parseLong(cc[2]) > 240000) {
                String[] k = claveYCodigo(APP_GMOD, DEP_ADDONS, man);
                cc = new String[] { k[0], k[1], String.valueOf(System.currentTimeMillis()) };
                synchronized (codigos) { codigos.put(man, cc); }
            }
            StringBuilder s = new StringBuilder("{\"id\":\"").append(wid).append("\",\"dep\":").append(DEP_ADDONS).append(",\"man\":\"").append(man)
                    .append("\",\"clave\":\"").append(cc[0]).append("\",\"codigo\":\"").append(cc[1]).append("\",\"cdn\":[");
            List<String> l = servidoresCDN();
            for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append('"').append(l.get(i)).append('"');
            s.append("],\"tam\":").append(tam != null && tam.matches("\\d{1,15}") ? tam : "0").append(",\"app\":1}");
            return new Resp(200, s.toString());
        } catch (Exception e) { return new Resp(502, json("error", msg(e))); }
    }

    /** Los detalles de unos addons (como GetPublishedFileDetails): para /red/_steamdet/ID,ID,… (el juego, sin la tienda). */
    static Resp detallesJson(String ids) {
        if (ids == null || !ids.matches("\\d{3,12}(,\\d{3,12}){0,99}")) return new Resp(400, "{\"error\":\"ids\"}");
        try { return new Resp(200, detalles(ids.split(","))); } catch (Exception e) { return new Resp(502, json("error", "Steam: " + msg(e))); }
    }

    /** El contenido base (/red/_steambase): como /api/gmod/base de la tienda —el depósito 4021 del servidor dedicado de GMod,
     *  que Steam da a cualquiera sin cuenta—: su manifiesto público de ahora, la clave, el código y los servidores del CDN. */
    static Resp base() {
        try {
            String[] k = claveYCodigo(APP_SERVIDOR, DEP_BASE, null);
            StringBuilder s = new StringBuilder("{\"app\":").append(APP_SERVIDOR).append(",\"dep\":").append(DEP_BASE).append(",\"man\":\"").append(k[2])
                    .append("\",\"clave\":\"").append(k[0]).append("\",\"codigo\":\"").append(k[1]).append("\",\"cdn\":[");
            List<String> l = servidoresCDN();
            for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append('"').append(l.get(i)).append('"');
            return new Resp(200, s.append("]}").toString());
        } catch (Exception e) { return new Resp(502, json("error", msg(e))); }
    }

    /** Los «Required items» de un addon (lo que el autor marcó que hace falta), de su página del Workshop: /red/_steamreq/ID. */
    static Resp requeridos(String wid) {
        if (wid == null || !wid.matches("\\d{3,12}")) return new Resp(400, "{\"error\":\"id\"}");
        synchronized (reqs) { String[] c = reqs.get(wid); if (c != null && System.currentTimeMillis() - Long.parseLong(c[1]) < 86400000L) return new Resp(200, c[0]); }
        try {
            HttpURLConnection c = (HttpURLConnection) new URL("https://steamcommunity.com/sharedfiles/filedetails/?id=" + wid).openConnection();
            c.setConnectTimeout(12000); c.setReadTimeout(15000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
            c.setRequestProperty("Accept-Language", "en-US,en;q=0.8");
            if (c.getResponseCode() != 200) return new Resp(502, json("error", "Steam " + c.getResponseCode()));
            String h = new String(leerTodo(c.getInputStream()), StandardCharsets.UTF_8);
            int i = h.indexOf("id=\"RequiredItems\"");
            String t = i < 0 ? "" : h.substring(i, Math.min(h.length(), i + 8000));
            int f = t.indexOf("<!--"); if (f > 0) t = t.substring(0, f);
            LinkedHashSet<String> ids = new LinkedHashSet<>();
            Matcher m = Pattern.compile("filedetails/\\?id=(\\d{3,12})").matcher(t);
            while (m.find() && ids.size() < 20) if (!m.group(1).equals(wid)) ids.add(m.group(1));
            StringBuilder s = new StringBuilder("{\"ids\":[");
            int n = 0; for (String x : ids) s.append(n++ > 0 ? "," : "").append('"').append(x).append('"');
            String j = s.append("]}").toString();
            synchronized (reqs) { if (reqs.size() > 200) reqs.clear(); reqs.put(wid, new String[] { j, String.valueOf(System.currentTimeMillis()) }); }
            return new Resp(200, j);
        } catch (Exception e) { return new Resp(502, json("error", "Steam: " + msg(e))); }
    }
    private static final Map<String, String[]> reqs = new HashMap<>();

    static final class Resp {
        final int estado; final String cuerpo;
        Resp(int e, String c) { estado = e; cuerpo = c; }
    }

    // ---------------- la API web de Steam (por HTTP: la app no tiene el problema del permiso de otros sitios) ----------------
    private static String detalles(String... ids) throws IOException {
        StringBuilder b = new StringBuilder("itemcount=").append(ids.length);
        for (int i = 0; i < ids.length; i++) b.append("&publishedfileids[").append(i).append("]=").append(ids[i]);
        HttpURLConnection c = (HttpURLConnection) new URL("https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/").openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(20000); c.setDoOutput(true); c.setRequestMethod("POST");
        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        try (OutputStream o = c.getOutputStream()) { o.write(b.toString().getBytes(StandardCharsets.UTF_8)); }
        if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
        return new String(leerTodo(c.getInputStream()), StandardCharsets.UTF_8);
    }
    private static String get(String u) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        c.setConnectTimeout(12000); c.setReadTimeout(15000);
        if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
        return new String(leerTodo(c.getInputStream()), StandardCharsets.UTF_8);
    }
    private static byte[] getB(String u) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        c.setConnectTimeout(12000); c.setReadTimeout(20000);
        if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
        return leerTodo(c.getInputStream());
    }
    // ---- KeyValues de texto de Valve («"clave" "valor"» y «"clave" { … }») a mapas; con tope de profundidad ----
    static Map<String, Object> vdf(String t) { return vdfBloque(t, new int[] { 0 }, 0); }
    private static Map<String, Object> vdfBloque(String t, int[] i, int prof) {
        Map<String, Object> o = new HashMap<>();
        while (true) {
            vdfEsp(t, i);
            if (i[0] >= t.length()) return o;
            if (t.charAt(i[0]) == '}') { i[0]++; return o; }
            String k = vdfTok(t, i); vdfEsp(t, i);
            if (i[0] < t.length() && t.charAt(i[0]) == '{') { i[0]++; if (prof > 48) return o; o.put(k.toLowerCase(java.util.Locale.ROOT), vdfBloque(t, i, prof + 1)); }
            else o.put(k.toLowerCase(java.util.Locale.ROOT), vdfTok(t, i));
        }
    }
    private static void vdfEsp(String t, int[] i) {
        while (i[0] < t.length()) {
            char c = t.charAt(i[0]);
            if (Character.isWhitespace(c) || c == 0) i[0]++;
            else if (c == '/' && i[0] + 1 < t.length() && t.charAt(i[0] + 1) == '/') { while (i[0] < t.length() && t.charAt(i[0]) != '\n') i[0]++; }
            else return;
        }
    }
    private static String vdfTok(String t, int[] i) {
        StringBuilder o = new StringBuilder();
        if (i[0] < t.length() && t.charAt(i[0]) == '"') {
            i[0]++;
            while (i[0] < t.length() && t.charAt(i[0]) != '"') { char c = t.charAt(i[0]); if (c == '\\' && i[0] + 1 < t.length()) { c = t.charAt(++i[0]); if (c == 'n') c = '\n'; } o.append(c); i[0]++; }
            i[0]++;
            return o.toString();
        }
        while (i[0] < t.length() && "{}\"".indexOf(t.charAt(i[0])) < 0 && !Character.isWhitespace(t.charAt(i[0]))) o.append(t.charAt(i[0]++));
        return o.toString();
    }
    static Object vdfBuscar(Map<String, Object> m, String... ruta) {
        Object x = m.containsKey("appinfo") ? m.get("appinfo") : m;
        for (String k : ruta) { if (!(x instanceof Map)) return null; x = ((Map<?, ?>) x).get(k.toLowerCase(java.util.Locale.ROOT)); }
        return x;
    }
    // (el primer elemento de publishedfiledetails: lo que hay entre sus llaves; los detalles no traen objetos adentro salvo tags)
    private static String cortarItem(String j) {
        int i = j.indexOf("\"publishedfiledetails\""); if (i < 0) return "";
        int a = j.indexOf('{', i); if (a < 0) return "";
        int prof = 0;
        for (int k = a; k < j.length(); k++) {
            char ch = j.charAt(k);
            if (ch == '"') { k++; while (k < j.length() && j.charAt(k) != '"') { if (j.charAt(k) == '\\') k++; k++; } continue; }
            if (ch == '{') prof++;
            else if (ch == '}' && --prof == 0) return j.substring(a, k + 1);
        }
        return "";
    }
    private static String campo(String obj, String nombre) {
        Matcher m = Pattern.compile("\"" + nombre + "\"\\s*:\\s*\"?([^\",}]*)\"?").matcher(obj);
        return m.find() ? m.group(1) : null;
    }
    static synchronized List<String> servidoresCM() {
        if (cms != null && System.currentTimeMillis() - cmsT < 3600000) return cms;
        LinkedHashSet<String> l = new LinkedHashSet<>();
        try {
            String j = get("https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0&cmtype=websockets&maxcount=60");
            Matcher m = CM.matcher(j); while (m.find()) l.add(m.group(1));
            if (l.isEmpty()) { m = CM_WS.matcher(j); while (m.find()) l.add(m.group(1)); }
        } catch (Exception e) { /* la lista de respaldo */ }
        if (l.isEmpty()) { for (String h : CM_RESPALDO) l.add(h + ".steamserver.net"); cmsT = System.currentTimeMillis() - 3300000; }
        else cmsT = System.currentTimeMillis();
        cms = new ArrayList<>(l);
        return cms;
    }
    static synchronized List<String> servidoresCDN() {
        if (cdns != null && System.currentTimeMillis() - cdnsT < 3600000) return cdns;
        List<String> l = new ArrayList<>();
        try {
            String j = get("https://api.steampowered.com/IContentServerDirectoryService/GetServersForSteamPipe/v1/?cell_id=0&max_servers=30");
            Matcher m = Pattern.compile("\\{[^{}]*\\}").matcher(j);
            while (m.find() && l.size() < 8) {
                String o = m.group(), vh = campo(o, "vhost"), hs = campo(o, "https_support");
                if (vh != null && CDN_HOST.matcher(vh).matches() && !"unavailable".equals(hs) && !l.contains(vh)) l.add(vh);
            }
        } catch (Exception e) { /* respaldo */ }
        if (l.isEmpty()) { for (String h : CDN_RESPALDO) l.add(h + ".steamcontent.com"); cdnsT = System.currentTimeMillis() - 3300000; }
        else cdnsT = System.currentTimeMillis();
        cdns = l;
        return cdns;
    }

    // ---------------- la sesión anónima de Steam por WebSocket ----------------
    /** La clave del depósito (hex), el código del manifiesto y el manifiesto (si man es null: el público de ahora, por la
     *  información de la app); prueba hasta en 3 servidores. */
    static String[] claveYCodigo(int app, int dep, String man) throws IOException {
        List<String> l = servidoresCM();
        IOException ult = null;
        int base = AZAR.nextInt(Math.min(4, l.size()));
        String ck = app + ":" + dep;
        for (int i = 0; i < Math.min(3, l.size()); i++) {
            String cm = l.get((base + i) % l.size());
            Sesion s = null;
            try {
                s = new Sesion(cm);
                s.entrar();
                String m = man;
                if (m == null) {
                    synchronized (publicos) { String[] p = publicos.get(ck); if (p != null && System.currentTimeMillis() - Long.parseLong(p[1]) < 3600000) m = p[0]; }
                    if (m == null) { m = s.manifiestoPublico(app, dep); synchronized (publicos) { publicos.put(ck, new String[] { m, String.valueOf(System.currentTimeMillis()) }); } }
                }
                byte[] k;
                synchronized (claves) { k = claves.get(ck); }
                if (k == null) { k = s.claveDeposito(app, dep); synchronized (claves) { claves.put(ck, k); } }
                long codigo = s.codigoManifiesto(app, dep, Long.parseUnsignedLong(m));
                return new String[] { hex(k), Long.toUnsignedString(codigo), m };
            } catch (IOException e) { ult = e; }
            catch (RuntimeException e) { ult = new IOException(msg(e)); }
            finally { if (s != null) s.salir(); }
        }
        throw ult != null ? ult : new IOException("Steam no responde");
    }

    static final class Sesion {
        private final Socket sock; private final InputStream in; private final OutputStream out;
        private long sid = ANON; private int ses = 0; private long job = 1;
        private final List<Msj> pendientes = new ArrayList<>();

        Sesion(String host) throws IOException {
            sock = abrir(host, 443);
            sock.setSoTimeout(15000);
            in = sock.getInputStream(); out = sock.getOutputStream();
            // el apretón de manos del WebSocket, sin «Origin» (con uno que no es de Steam, contesta 403)
            byte[] k = new byte[16]; AZAR.nextBytes(k);
            String pedido = "GET /cmsocket/ HTTP/1.1\r\nHost: " + host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + b64(k)
                    + "\r\nSec-WebSocket-Version: 13\r\nUser-Agent: JXMod\r\n\r\n";
            out.write(pedido.getBytes(StandardCharsets.ISO_8859_1)); out.flush();
            String st = linea(in);
            if (st == null || !st.matches("HTTP/1\\.[01] 101.*")) throw new IOException("Steam no abrió el WebSocket (" + st + ")");
            for (String h = linea(in); h != null && !h.isEmpty(); h = linea(in)) { /* cabeceras */ }
        }
        void entrar() throws IOException {
            enviarCrudo(mensaje(EM_HOLA, new Pb().f64(1, 0).v(2, 0).bytes(), new Pb().v(1, PROTOCOLO).bytes()));
            enviar(EM_LOGON, new Pb().v(1, PROTOCOLO).v(3, 0).v(5, 1771).s(6, "english").v(7, 16).bytes(), null);
            Msj r = esperar(EM_LOGON_RESP, -1);
            long er = r.cuerpo.v(1, 2);
            if (er != 1) throw new IOException("Steam no dejó entrar (EResult " + er + ")");
            sid = r.cab.f(1, sid); ses = (int) r.cab.v(2, 0);
        }
        byte[] claveDeposito(int app, int dep) throws IOException {
            long j = job++;
            enviar(EM_CLAVE, new Pb().v(1, dep).v(2, app).bytes(), new Pb().f64(10, j));
            Msj r = esperar(EM_CLAVE_RESP, j);
            long er = r.cuerpo.v(1, 2); byte[] k = r.cuerpo.b(3);
            if (er != 1 || k == null || k.length != 32) throw new IOException("Steam no dio la clave del depósito (EResult " + er + ")");
            return k;
        }
        long codigoManifiesto(int app, int dep, long man) throws IOException {
            long j = job++;
            enviar(EM_SVC_LLAMADA, new Pb().v(1, app).v(2, dep).v(3, man).s(4, "public").bytes(), new Pb().f64(10, j).s(12, "ContentServerDirectory.GetManifestRequestCode#1"));
            try {
                Msj r = esperar(EM_SVC_RESP, j);
                if (r.cab.v(13, 1) != 1) return 0;
                return r.cuerpo.v(1, 0);
            } catch (IOException e) { return 0; }   // (sin código: algunos manifiestos viejos bajan igual)
        }
        /** El manifiesto público de un depósito, de la información de la app (PICS: primero el permiso de la app, que para
         *  las gratis es 0, y después la información; la grande viene aparte por HTTP). */
        String manifiestoPublico(int app, int dep) throws IOException {
            long j = job++;
            enviar(EM_PICS_TOKEN, new Pb().v(2, app).bytes(), new Pb().f64(10, j));
            Msj t = esperar(EM_PICS_TOKEN_RESP, j);
            long tok = 0; byte[] at = t.cuerpo.b(3);
            if (at != null) { PbL x = new PbL(at, 0, at.length); if (x.v(1, -1) == app) tok = x.v(2, 0); }
            j = job++;
            enviar(EM_PICS_INFO, new Pb().b(2, new Pb().v(1, app).v(2, tok).bytes()).bytes(), new Pb().f64(10, j));
            Msj r = esperar(EM_PICS_INFO_RESP, j);
            byte[] a = r.cuerpo.b(1); if (a == null) throw new IOException("Steam no dio la app " + app);
            PbL A = new PbL(a, 0, a.length);
            byte[] buf = A.b(5);
            if (buf == null || buf.length == 0) {
                byte[] host = r.cuerpo.b(8), sha = A.b(4);
                if (host == null || sha == null) throw new IOException("sin la información de la app " + app);
                String hs = new String(host, StandardCharsets.UTF_8);
                if (!hs.matches("[a-z0-9.-]{4,80}")) throw new IOException("servidor raro");
                buf = gunzip(getB("https://" + hs + "/appinfo/" + app + "/sha/" + hex(sha) + ".txt.gz"));
            }
            Object dps = vdfBuscar(vdf(new String(buf, StandardCharsets.UTF_8)), "depots", String.valueOf(dep), "manifests", "public");
            if (dps instanceof Map) dps = ((Map<?, ?>) dps).get("gid");
            if (!(dps instanceof String) || !((String) dps).matches("\\d{5,20}")) throw new IOException("sin manifiesto para " + dep);
            return (String) dps;
        }
        void salir() {
            try { enviar(EM_LOGOFF, new byte[0], null); } catch (Exception e) { /* nada */ }
            try { escribirMarco(0x8, new byte[] { 0x03, (byte) 0xe8 }); } catch (Exception e) { /* nada */ }
            try { sock.close(); } catch (Exception e) { /* nada */ }
        }

        private void enviar(int emsg, byte[] cuerpo, Pb extra) throws IOException {
            Pb cab = new Pb().f64(1, sid).v(2, ses & 0xffffffffL);
            if (extra != null) cab.raw(extra.bytes());
            enviarCrudo(mensaje(emsg, cab.bytes(), cuerpo));
        }
        private void enviarCrudo(byte[] m) throws IOException { escribirMarco(0x2, m); }
        // (un mensaje con el emsg pedido y, si se da, la respuesta a ese trabajo; los que llegan antes quedan guardados)
        private Msj esperar(int emsg, long jobid) throws IOException {
            long fin = System.currentTimeMillis() + 15000;
            while (true) {
                for (int i = 0; i < pendientes.size(); i++) {
                    Msj m = pendientes.get(i);
                    if (m.emsg == emsg && (jobid < 0 || m.cab.f(11, -1) == jobid)) { pendientes.remove(i); return m; }
                }
                if (System.currentTimeMillis() > fin) throw new IOException("Steam no contestó");
                byte[] d = leerMensajeWS();
                if (d == null) throw new IOException("Steam cortó");
                recibir(d);
            }
        }
        private void recibir(byte[] b) throws IOException {
            if (b.length < 8) return;
            int cr = le32(b, 0), emsg = cr & 0x7fffffff;
            if ((cr & 0x80000000) == 0) return;
            int hl = le32(b, 4);
            if (hl < 0 || 8 + hl > b.length) return;
            PbL cab = new PbL(b, 8, 8 + hl), cuerpo = new PbL(b, 8 + hl, b.length);
            if (emsg == EM_MULTI) {
                byte[] d = cuerpo.b(2); if (d == null) return;
                if (cuerpo.v(1, 0) > 0) d = gunzip(d);
                for (int i = 0; i + 4 <= d.length;) {
                    int n = le32(d, i); if (n < 0 || i + 4 + n > d.length) break;
                    byte[] sub = new byte[n]; System.arraycopy(d, i + 4, sub, 0, n); recibir(sub); i += 4 + n;
                }
                return;
            }
            pendientes.add(new Msj(emsg, cab, cuerpo));
            if (pendientes.size() > 64) pendientes.remove(0);
        }
        // ---- marcos del WebSocket (los del cliente van enmascarados) ----
        private void escribirMarco(int op, byte[] p) throws IOException {
            ByteArrayOutputStream o = new ByteArrayOutputStream(p.length + 14);
            o.write(0x80 | op);
            if (p.length < 126) o.write(0x80 | p.length);
            else if (p.length < 65536) { o.write(0x80 | 126); o.write(p.length >>> 8); o.write(p.length & 0xff); }
            else { o.write(0x80 | 127); for (int i = 7; i >= 0; i--) o.write((int) (((long) p.length >>> (8 * i)) & 0xff)); }
            byte[] mk = new byte[4]; AZAR.nextBytes(mk); o.write(mk, 0, 4);
            byte[] e = new byte[p.length]; for (int i = 0; i < p.length; i++) e[i] = (byte) (p[i] ^ mk[i & 3]);
            o.write(e, 0, e.length);
            synchronized (out) { out.write(o.toByteArray()); out.flush(); }
        }
        private byte[] leerMensajeWS() throws IOException {
            ByteArrayOutputStream msg = new ByteArrayOutputStream();
            while (true) {
                int b0 = in.read(), b1 = in.read();
                if (b0 < 0 || b1 < 0) return null;
                int op = b0 & 0x0f; long n = b1 & 0x7f;
                if (n == 126) n = (leer1() << 8) | leer1();
                else if (n == 127) { n = 0; for (int i = 0; i < 8; i++) n = (n << 8) | leer1(); }
                if (n > 64L * 1024 * 1024) throw new IOException("mensaje de Steam demasiado grande");
                byte[] mk = null; if ((b1 & 0x80) != 0) { mk = new byte[4]; leerJusto(mk); }
                byte[] p = new byte[(int) n]; leerJusto(p);
                if (mk != null) for (int i = 0; i < p.length; i++) p[i] ^= mk[i & 3];
                if (op == 0x8) return null;
                if (op == 0x9) { escribirMarco(0xA, p); continue; }
                if (op == 0xA) continue;
                msg.write(p, 0, p.length);
                if ((b0 & 0x80) != 0) return msg.toByteArray();
            }
        }
        private int leer1() throws IOException { int x = in.read(); if (x < 0) throw new IOException("Steam cortó"); return x; }
        private void leerJusto(byte[] b) throws IOException { int o = 0; while (o < b.length) { int k = in.read(b, o, b.length - o); if (k < 0) throw new IOException("Steam cortó"); o += k; } }
    }

    // la conexión TLS (y, si la máquina usa un proxy de HTTPS —en la compu de prueba—, por un túnel CONNECT)
    private static Socket abrir(String host, int puerto) throws IOException {
        String ph = System.getProperty("https.proxyHost"), pp = System.getProperty("https.proxyPort");
        SSLSocketFactory f = (SSLSocketFactory) SSLSocketFactory.getDefault();
        if (ph != null && !ph.isEmpty()) {
            Socket t = new Socket();
            t.connect(new InetSocketAddress(ph, pp != null && pp.matches("\\d{1,5}") ? Integer.parseInt(pp) : 3128), 15000);
            t.setSoTimeout(15000);
            OutputStream o = t.getOutputStream();
            o.write(("CONNECT " + host + ":" + puerto + " HTTP/1.1\r\nHost: " + host + ":" + puerto + "\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1)); o.flush();
            InputStream i = t.getInputStream(); String st = linea(i);
            if (st == null || !st.matches("HTTP/1\\.[01] 200.*")) { t.close(); throw new IOException("proxy: " + st); }
            for (String h = linea(i); h != null && !h.isEmpty(); h = linea(i)) { /* cabeceras */ }
            SSLSocket s = (SSLSocket) f.createSocket(t, host, puerto, true);
            s.startHandshake();
            return s;
        }
        Socket s = f.createSocket();
        s.connect(new InetSocketAddress(host, puerto), 15000);
        SSLSocket ss = (SSLSocket) s; ss.startHandshake();
        return ss;
    }
    private static String linea(InputStream in) throws IOException {
        StringBuilder s = new StringBuilder();
        for (int c = in.read(); c >= 0; c = in.read()) { if (c == '\n') return s.toString().replace("\r", ""); s.append((char) c); if (s.length() > 8192) throw new IOException("línea larga"); }
        return s.length() > 0 ? s.toString() : null;
    }

    // ---------------- protobuf mínimo ----------------
    static final class Pb {
        private final ByteArrayOutputStream o = new ByteArrayOutputStream();
        private void var(long n) { while ((n & ~0x7fL) != 0) { o.write((int) ((n & 0x7f) | 0x80)); n >>>= 7; } o.write((int) n); }
        Pb v(int f, long x) { var((long) f << 3); var(x); return this; }
        Pb f64(int f, long x) { var(((long) f << 3) | 1); for (int i = 0; i < 8; i++) o.write((int) ((x >>> (8 * i)) & 0xff)); return this; }
        Pb s(int f, String x) { return b(f, x.getBytes(StandardCharsets.UTF_8)); }
        Pb b(int f, byte[] x) { var(((long) f << 3) | 2); var(x.length); o.write(x, 0, x.length); return this; }
        Pb raw(byte[] x) { o.write(x, 0, x.length); return this; }
        byte[] bytes() { return o.toByteArray(); }
    }
    // (lectura: campo → primer valor; varint y fixed64 como long, los bytes como copia)
    static final class PbL {
        private final Map<Integer, Object> m = new HashMap<>();
        PbL(byte[] b, int a, int z) {
            int[] i = { a };
            while (i[0] < z) {
                long k = var(b, i, z); int f = (int) (k >>> 3), t = (int) (k & 7); Object val;
                if (t == 0) val = var(b, i, z);
                else if (t == 1) { if (i[0] + 8 > z) break; long x = 0; for (int j = 7; j >= 0; j--) x = (x << 8) | (b[i[0] + j] & 0xffL); i[0] += 8; val = x; }
                else if (t == 2) { long n = var(b, i, z); if (n < 0 || i[0] + n > z) break; byte[] c = new byte[(int) n]; System.arraycopy(b, i[0], c, 0, (int) n); i[0] += (int) n; val = c; }
                else if (t == 5) { if (i[0] + 4 > z) break; val = (long) le32(b, i[0]) & 0xffffffffL; i[0] += 4; }
                else break;
                if (!m.containsKey(f)) m.put(f, val);
            }
        }
        private static long var(byte[] b, int[] i, int z) { long r = 0; int s = 0; while (i[0] < z) { int x = b[i[0]++] & 0xff; r |= (long) (x & 0x7f) << s; if ((x & 0x80) == 0) return r; s += 7; if (s > 63) break; } return r; }
        long v(int f, long def) { Object x = m.get(f); return x instanceof Long ? (Long) x : def; }
        long f(int f, long def) { return v(f, def); }
        byte[] b(int f) { Object x = m.get(f); return x instanceof byte[] ? (byte[]) x : null; }
    }
    static final class Msj { final int emsg; final PbL cab, cuerpo; Msj(int e, PbL c, PbL b) { emsg = e; cab = c; cuerpo = b; } }

    private static byte[] mensaje(int emsg, byte[] cab, byte[] cuerpo) {
        byte[] o = new byte[8 + cab.length + cuerpo.length];
        int e = emsg | 0x80000000;
        for (int i = 0; i < 4; i++) { o[i] = (byte) (e >>> (8 * i)); o[4 + i] = (byte) (cab.length >>> (8 * i)); }
        System.arraycopy(cab, 0, o, 8, cab.length); System.arraycopy(cuerpo, 0, o, 8 + cab.length, cuerpo.length);
        return o;
    }
    private static int le32(byte[] b, int i) { return (b[i] & 0xff) | ((b[i + 1] & 0xff) << 8) | ((b[i + 2] & 0xff) << 16) | ((b[i + 3] & 0xff) << 24); }
    private static byte[] gunzip(byte[] d) throws IOException { try (GZIPInputStream g = new GZIPInputStream(new ByteArrayInputStream(d))) { return leerTodo(g); } }
    static byte[] leerTodo(InputStream in) throws IOException { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int k; while ((k = in.read(b)) > 0) o.write(b, 0, k); in.close(); return o.toByteArray(); }
    private static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x & 0xff)); return s.toString(); }
    private static final char[] B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();
    // (java.util.Base64 es de Android 8: la app anda desde el 7)
    static String b64(byte[] b) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < b.length; i += 3) {
            int n = (b[i] & 0xff) << 16 | (i + 1 < b.length ? (b[i + 1] & 0xff) << 8 : 0) | (i + 2 < b.length ? b[i + 2] & 0xff : 0);
            s.append(B64[n >>> 18 & 63]).append(B64[n >>> 12 & 63]).append(i + 1 < b.length ? B64[n >>> 6 & 63] : '=').append(i + 2 < b.length ? B64[n & 63] : '=');
        }
        return s.toString();
    }
    private static String msg(Throwable e) { String m = e.getMessage(); return m != null ? m : e.getClass().getSimpleName(); }
    private static String json(String k, String v) { return "{\"" + k + "\":\"" + v.replace("\\", "\\\\").replace("\"", "\\\"").replaceAll("[\\x00-\\x1f]", " ") + "\"}"; }
}
