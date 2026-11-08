package com.jxmod.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

// La partida en la red local (Lan.java) en la compu, sin Android: el broker MQTT sobre WebSocket con un cliente hecho a
// mano (CONNECT, SUBSCRIBE con comodines, PUBLISH, retenidos, testamento al cortarse y al vencer el keepalive, DISCONNECT
// sin testamento), el juego por HTTP y /lan.json, el puente de 127.0.0.1 (y que no deje ir afuera de la red local), el
// anuncio por UDP y su escucha, y 5000 mensajes seguidos.
// uso: javac -d X apk/web/src/com/jxmod/app/Lan.java apk/pruebas/unido/PruebaLan.java && java -cp X com.jxmod.app.PruebaLan
public class PruebaLan {
    static int ok = 0, mal = 0;
    static void ver(String n, boolean c, Object d) { if (c) ok++; else mal++; System.out.println((c ? "OK    " : "FALLA ") + n + (d != null ? " · " + d : "")); }

    /** Un cliente MQTT sobre WebSocket mínimo, para probar. */
    static final class Cli {
        final Socket s; final InputStream in; final OutputStream out; final List<Object[]> llegados = new ArrayList<>(); final SecureRandom rnd = new SecureRandom();
        String proto;
        Cli(int puerto, String ruta) throws IOException {
            s = new Socket(); s.connect(new InetSocketAddress("127.0.0.1", puerto), 3000); s.setSoTimeout(4000); in = s.getInputStream(); out = s.getOutputStream();
            out.write(("GET " + ruta + " HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: mqtt\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
            String l = Lan.Pedido.linea(in); if (l == null || !l.contains(" 101 ")) throw new IOException("sin 101: " + l);
            for (String h; (h = Lan.Pedido.linea(in)) != null && !h.isEmpty(); ) {
                if (h.toLowerCase().startsWith("sec-websocket-accept:") && !h.substring(21).trim().equals("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")) throw new IOException("accept mal: " + h);
                if (h.toLowerCase().startsWith("sec-websocket-protocol:")) proto = h.substring(23).trim();
            }
        }
        void marco(byte[] d) throws IOException {
            ByteArrayOutputStream o = new ByteArrayOutputStream(); o.write(0x82);
            if (d.length < 126) o.write(0x80 | d.length); else if (d.length < 65536) { o.write(0x80 | 126); o.write(d.length >> 8); o.write(d.length); } else { o.write(0x80 | 127); for (int i = 7; i >= 0; i--) o.write((int) ((long) d.length >> (8 * i))); }
            byte[] m = new byte[4]; rnd.nextBytes(m); o.write(m); for (int i = 0; i < d.length; i++) o.write(d[i] ^ m[i & 3]);
            out.write(o.toByteArray()); out.flush();
        }
        static byte[] cadena(String s) { byte[] b = s.getBytes(StandardCharsets.UTF_8); byte[] r = new byte[b.length + 2]; r[0] = (byte) (b.length >> 8); r[1] = (byte) b.length; System.arraycopy(b, 0, r, 2, b.length); return r; }
        static byte[] paquete(int h, byte[]... partes) { ByteArrayOutputStream c = new ByteArrayOutputStream(); for (byte[] p : partes) c.write(p, 0, p.length); ByteArrayOutputStream o = new ByteArrayOutputStream(); o.write(h); Lan.largoMqtt(o, c.size()); o.write(c.toByteArray(), 0, c.size()); return o.toByteArray(); }
        void conectar(String id, int ka, String willTema, String willMsg, boolean willRet) throws IOException {
            int fl = 2 | (willTema != null ? 4 | (willRet ? 32 : 0) : 0);
            ByteArrayOutputStream v = new ByteArrayOutputStream(); v.write(cadena("MQTT"), 0, 6); v.write(4); v.write(fl); v.write(ka >> 8); v.write(ka);
            byte[] cuerpo = willTema != null ? concat(v.toByteArray(), cadena(id), cadena(willTema), cadena(willMsg)) : concat(v.toByteArray(), cadena(id));
            marco(paquete(0x10, cuerpo));
            int[] r = siguiente(); if (r == null || r[0] != 2) throw new IOException("sin CONNACK");
        }
        void suscribir(int pid, String f) throws IOException { marco(paquete(0x82, new byte[] { (byte) (pid >> 8), (byte) pid }, cadena(f), new byte[] { 0 })); }
        void desuscribir(int pid, String f) throws IOException { marco(paquete(0xA2, new byte[] { (byte) (pid >> 8), (byte) pid }, cadena(f))); }
        void publicar(String t, String m, boolean ret) throws IOException { marco(paquete(0x30 | (ret ? 1 : 0), cadena(t), m.getBytes(StandardCharsets.UTF_8))); }
        void desconectar() throws IOException { marco(new byte[] { (byte) 0xE0, 0 }); }
        // (lo que llega: marcos del servidor, sin máscara; pueden traer varios paquetes MQTT)
        private byte[] pend = new byte[0];
        int[] siguiente() throws IOException {
            while (true) {
                if (pend.length >= 2) {
                    int largo = 0, mult = 1, i = 1, c; boolean comp = true;
                    do { if (i >= pend.length) { comp = false; break; } c = pend[i++] & 0xFF; largo += (c & 127) * mult; mult *= 128; } while ((c & 128) != 0);
                    if (comp && pend.length >= i + largo) {
                        int tipo = (pend[0] & 0xFF) >> 4, fl = pend[0] & 15; byte[] p = java.util.Arrays.copyOfRange(pend, i, i + largo); pend = java.util.Arrays.copyOfRange(pend, i + largo, pend.length);
                        if (tipo == 3) { int tl = Lan.u16(p, 0); llegados.add(new Object[] { new String(p, 2, tl, StandardCharsets.UTF_8), new String(p, 2 + tl, p.length - 2 - tl, StandardCharsets.UTF_8), (fl & 1) == 1 }); }
                        return new int[] { tipo, fl };
                    }
                }
                int b0 = in.read(); if (b0 < 0) return null; int b1 = in.read(); long n = b1 & 127;
                if (n == 126) n = (in.read() << 8) | in.read(); else if (n == 127) { n = 0; for (int i = 0; i < 8; i++) n = (n << 8) | in.read(); }
                byte[] d = new byte[(int) n]; for (int o = 0; o < n; ) { int k = in.read(d, o, (int) n - o); if (k < 0) return null; o += k; }
                if ((b0 & 15) == 8) return null;
                pend = concat(pend, d);
            }
        }
        /** Espera hasta que llegue un PUBLISH de ese tema (o ms); devuelve [tema, carga, retenido] o null. */
        Object[] esperar(String tema, int ms) throws IOException {
            long fin = System.currentTimeMillis() + ms;
            while (System.currentTimeMillis() < fin) {
                for (Object[] x : llegados) if (x[0].equals(tema)) { llegados.remove(x); return x; }
                s.setSoTimeout((int) Math.max(1, fin - System.currentTimeMillis()));
                try { if (siguiente() == null) return null; } catch (java.net.SocketTimeoutException e) { break; }
            }
            for (Object[] x : llegados) if (x[0].equals(tema)) { llegados.remove(x); return x; }
            return null;
        }
        void cortar() { try { s.close(); } catch (IOException e) { /* nada */ } }
    }
    static byte[] concat(byte[]... a) { ByteArrayOutputStream o = new ByteArrayOutputStream(); for (byte[] x : a) o.write(x, 0, x.length); return o.toByteArray(); }
    static int libre() throws IOException { try (ServerSocket s = new ServerSocket(0)) { return s.getLocalPort(); } }
    static String get(String url) throws IOException { HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection(); c.setConnectTimeout(3000); c.setReadTimeout(3000); int st = c.getResponseCode(); InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream(); ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; for (int n; in != null && (n = in.read(b)) > 0; ) o.write(b, 0, n); return st + " " + new String(o.toByteArray(), StandardCharsets.UTF_8); }

    public static void main(String[] a) throws Exception {
        // ---- lo que no necesita red ----
        ver("acepta del WebSocket como en el RFC 6455", Lan.base64(java.security.MessageDigest.getInstance("SHA-1").digest("dGhlIHNhbXBsZSBub25jZQ==258EAFA5-E914-47DA-95CA-C5AB0DC85B11".getBytes(StandardCharsets.ISO_8859_1))).equals("s3pPLMBiTxaQ9kYGzzhZRbK+xOo="), null);
        ver("comodines de MQTT", Lan.coincide("a/#", "a") && Lan.coincide("a/#", "a/b/c") && Lan.coincide("jxmod_v1_l/+", "jxmod_v1_l/abc") && !Lan.coincide("jxmod_v1_l/+", "jxmod_v1_l/abc/d") && !Lan.coincide("+/x", "$SYS/x") && Lan.coincide("r/+/e", "r/1/e") && !Lan.coincide("r/x", "r/y"), null);
        ver("filtros válidos e inválidos", Lan.filtroValido("a/#") && Lan.filtroValido("+/b/+") && !Lan.filtroValido("a/#/b") && !Lan.filtroValido("a+/b") && !Lan.filtroValido(""), null);
        ver("red local: sí 192.168.1.5, 10.0.0.2, 172.20.1.1, 100.64.3.4, 127.0.0.1; no 8.8.8.8, 172.32.0.1, 1.2.3", Lan.redPrivada("192.168.1.5") && Lan.redPrivada("10.0.0.2") && Lan.redPrivada("172.20.1.1") && Lan.redPrivada("100.64.3.4") && Lan.redPrivada("127.0.0.1") && !Lan.redPrivada("8.8.8.8") && !Lan.redPrivada("172.32.0.1") && !Lan.redPrivada("1.2.3") && !Lan.redPrivada("192.168.1.300"), null);

        // ---- el broker con una carpeta del juego ----
        File dir = Files.createTempDirectory("lanweb").toFile();
        Files.write(new File(dir, "index.html").toPath(), "<!doctype html><title>JXMod</title>".getBytes(StandardCharsets.UTF_8));
        Lan.Archivos arch = (ruta) -> { File f = new File(dir, ruta); return f.isFile() && f.getCanonicalPath().startsWith(dir.getCanonicalPath()) ? new Lan.Archivo(new FileInputStream(f), f.length()) : null; };
        int P = libre(); Lan.Broker B = new Lan.Broker(P, arch); B.info = "{\"n\":\"Ana\",\"s\":\"Casa de Ana\",\"m\":\"FlatGrass\"}"; B.iniciar();
        String idx = get("http://127.0.0.1:" + P + "/"), js = get("http://127.0.0.1:" + P + "/lan.json"), no = get("http://127.0.0.1:" + P + "/no.html"), fuera = get("http://127.0.0.1:" + P + "/%2e%2e/etc/passwd");
        ver("HTTP: el juego en /, /lan.json con los datos y los jugadores, 404 y nada fuera de la carpeta", idx.startsWith("200 ") && idx.contains("<title>JXMod") && js.equals("200 {\"n\":\"Ana\",\"s\":\"Casa de Ana\",\"m\":\"FlatGrass\",\"j\":0}") && no.startsWith("404") && fuera.startsWith("400"), idx.length() + " · " + js + " · " + no + " · " + fuera);

        Cli A = new Cli(P, "/mqtt"), Bc = new Cli(P, "/mqtt");
        ver("WebSocket: 101 con el subprotocolo mqtt", "mqtt".equals(A.proto), A.proto);
        A.conectar("jxmod_v1_ana", 30, "jxmod_v1_r_x/w/ana", "", true); Bc.conectar("jxmod_v1_beto", 30, null, null, false);
        A.suscribir(1, "jxmod_v1_r_x/#"); int[] sa = A.siguiente(); Bc.suscribir(2, "jxmod_v1_r_x/#"); Bc.siguiente();
        ver("CONNECT → CONNACK y SUBSCRIBE → SUBACK", sa != null && sa[0] == 9, sa == null ? null : sa[0]);
        Thread.sleep(100);
        ver("/lan.json cuenta los 2 jugadores de la sala", get("http://127.0.0.1:" + P + "/lan.json").contains("\"j\":2"), null);
        Bc.publicar("jxmod_v1_r_x/e", "{\"n\":\"Beto\"}", false);
        Object[] r1 = A.esperar("jxmod_v1_r_x/e", 2000);
        ver("un mensaje de Beto le llega a Ana (y no con la marca de retenido)", r1 != null && r1[1].equals("{\"n\":\"Beto\"}") && !(Boolean) r1[2], r1 == null ? null : r1[1]);
        // retenidos: el mundo de Beto queda para el que entra después
        Bc.publicar("jxmod_v1_r_x/w/beto", "{\"o\":[1]}", true); A.esperar("jxmod_v1_r_x/w/beto", 2000);
        Cli C = new Cli(P, "/mqtt"); C.conectar("jxmod_v1_caro", 30, null, null, false); C.suscribir(3, "jxmod_v1_r_x/#");
        Object[] r2 = C.esperar("jxmod_v1_r_x/w/beto", 2000);
        ver("el que entra después recibe el mundo retenido (con la marca de retenido)", r2 != null && r2[1].equals("{\"o\":[1]}") && (Boolean) r2[2], r2 == null ? null : r2[1]);
        // volver a suscribirse manda los retenidos otra vez (la lista de servers lo usa para pedirlos de nuevo)
        C.desuscribir(4, "jxmod_v1_r_x/#"); C.siguiente(); C.suscribir(5, "jxmod_v1_r_x/#");
        ver("al volver a suscribirse llegan otra vez los retenidos", C.esperar("jxmod_v1_r_x/w/beto", 2000) != null, null);
        Bc.publicar("jxmod_v1_r_x/w/beto", "", true); Thread.sleep(200);
        Cli D = new Cli(P, "/mqtt"); D.conectar("jxmod_v1_dani", 30, null, null, false); D.suscribir(6, "jxmod_v1_r_x/#");
        ver("un retenido vacío lo borra", D.esperar("jxmod_v1_r_x/w/beto", 700) == null && !B.retenidos.containsKey("jxmod_v1_r_x/w/beto"), null);
        // comodín de un nivel (la lista de servers: jxmod_v1_l/+)
        D.suscribir(7, "jxmod_v1_l/+"); D.siguiente(); A.publicar("jxmod_v1_l/ana", "{\"s\":1}", true); A.publicar("jxmod_v1_l/ana/x", "no", false);
        ver("+ abarca un nivel y no dos", D.esperar("jxmod_v1_l/ana", 2000) != null && D.esperar("jxmod_v1_l/ana/x", 500) == null, null);
        // testamento: Ana se corta sin DISCONNECT → a los demás les llega su retenido vacío
        A.cortar();
        Object[] w = Bc.esperar("jxmod_v1_r_x/w/ana", 3000);
        ver("Ana se corta de golpe: llega su testamento (retenido vacío) a los demás", w != null && "".equals(w[1]), w == null ? null : "«" + w[1] + "»");
        // DISCONNECT: se va bien, sin testamento
        Cli E = new Cli(P, "/mqtt"); E.conectar("jxmod_v1_eli", 30, "jxmod_v1_r_x/w/eli", "", true); Thread.sleep(100); E.desconectar(); Thread.sleep(300); E.cortar();
        ver("con DISCONNECT no sale el testamento", Bc.esperar("jxmod_v1_r_x/w/eli", 800) == null, null);
        // keepalive vencido (1 s → a los 1,5 s sin nada se lo da por cortado)
        Cli F = new Cli(P, "/mqtt"); F.conectar("jxmod_v1_fede", 1, "jxmod_v1_r_x/w/fede", "", true);
        long t0 = System.currentTimeMillis(); Object[] wf = Bc.esperar("jxmod_v1_r_x/w/fede", 4000); long dt = System.currentTimeMillis() - t0;
        ver("sin noticias en 1,5× el keepalive: testamento", wf != null && dt >= 1200 && dt < 3500, dt + " ms");
        // muchos mensajes seguidos (10 por segundo de cada jugador es poco: acá 5000 de una)
        int N = 5000; for (int i = 0; i < N; i++) C.publicar("jxmod_v1_r_x/m", "{\"l\":[" + i + "]}", false);
        int n = 0; long t1 = System.currentTimeMillis(); Bc.s.setSoTimeout(3000);
        while (n < N && System.currentTimeMillis() - t1 < 8000) { int[] r = Bc.siguiente(); if (r == null) break; if (r[0] == 3) { Object[] x = Bc.llegados.remove(Bc.llegados.size() - 1); if (x[0].equals("jxmod_v1_r_x/m")) n++; } }
        ver("5000 mensajes seguidos llegan todos y en orden", n == N, n + " en " + (System.currentTimeMillis() - t1) + " ms");

        // ---- el puente de 127.0.0.1: sólo a la red local ----
        int PP = libre(); Lan.Puente pu = new Lan.Puente(PP); pu.iniciar();
        Cli G = new Cli(PP, "/lan/127.0.0.1:" + P + "/mqtt"); G.conectar("jxmod_v1_gabi", 30, null, null, false); G.suscribir(8, "jxmod_v1_r_x/#"); G.siguiente();
        Bc.publicar("jxmod_v1_r_x/c", "{\"t\":\"hola\"}", false);
        ver("por el puente: WebSocket y MQTT hasta el anfitrión", G.esperar("jxmod_v1_r_x/c", 2000) != null, null);
        boolean afuera; try { new Cli(PP, "/lan/8.8.8.8:8765/mqtt"); afuera = true; } catch (IOException e) { afuera = false; }
        ver("el puente no deja ir afuera de la red local", !afuera, null);
        ver("de la red local: las de rango privado y las de la subred propia; no una de internet", Lan.enMiRed("192.168.0.9") && !Lan.enMiRed("8.8.8.8") && !Lan.enMiRed("example.com") && (Lan.ips().isEmpty() || Lan.enMiRed(Lan.ips().get(0))), Lan.ips());

        // ---- el anuncio por UDP y su escucha ----
        int PU = libre(); Lan.Escucha es = new Lan.Escucha(PU); es.iniciar(); Lan.Anuncio an = new Lan.Anuncio(PU); an.datos = "{\"n\":\"Ana\",\"p\":" + P + "}"; an.iniciar();
        String lista = "[]"; for (int i = 0; i < 30 && lista.equals("[]"); i++) { Thread.sleep(150); lista = es.lista(); }
        ver("la escucha oye el anuncio del anfitrión (broadcast a la red)", lista.contains("\\\"n\\\":\\\"Ana\\\"") && lista.contains("\"ip\":"), lista + " · broadcasts " + Lan.broadcasts() + " · IPs " + Lan.ips());
        an.parar(); es.parar(); pu.parar(); B.parar();
        ver("al parar, el puerto queda libre", puertoLibre(P), null);
        System.out.println("RESUMEN " + ok + "/" + (ok + mal));
        System.exit(mal == 0 ? 0 : 1);
    }
    static boolean puertoLibre(int p) { try (ServerSocket s = new ServerSocket()) { s.setReuseAddress(true); s.bind(new InetSocketAddress(p)); return true; } catch (IOException e) { return false; } }
}
