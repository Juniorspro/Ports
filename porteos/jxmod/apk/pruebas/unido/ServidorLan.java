package com.jxmod.app;

import com.sun.net.httpserver.HttpServer;
import java.io.File;
import java.io.FileInputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

// Para las pruebas del juego en Chromium (pruebas/red_lan.mjs): lo mismo que hace la app de Android en la red local
// (Web.java con Lan.java), en la compu. El broker con el juego por HTTP (una carpeta), el anuncio por UDP y su escucha, y el
// puente de 127.0.0.1. Y, para el JXNativo de mentira de la página (la app lo tiene en Java), un control en 127.0.0.1:
// /hostear?n=&s=&m=&du=  /parar  /hosts  /ips  (lo mismo que contestan lanHostear, lanParar, lanHosts y lanIps).
// uso: javac -d X apk/web/src/com/jxmod/app/Lan.java apk/pruebas/unido/ServidorLan.java
//      java -cp X com.jxmod.app.ServidorLan PUERTO CARPETA PUERTO_ANUNCIO PUERTO_PUENTE PUERTO_CONTROL
public class ServidorLan {
    public static void main(String[] a) throws Exception {
        int puerto = Integer.parseInt(a[0]), pa = Integer.parseInt(a[2]), pp = Integer.parseInt(a[3]), pc = Integer.parseInt(a[4]);
        File dir = new File(a[1]).getCanonicalFile();
        Lan.Archivos arch = (ruta) -> { File f = new File(dir, ruta).getCanonicalFile(); return f.isFile() && f.getPath().startsWith(dir.getPath()) ? new Lan.Archivo(new FileInputStream(f), f.length()) : null; };
        Lan.Broker b = new Lan.Broker(puerto, arch); b.iniciar();
        Lan.Anuncio an = new Lan.Anuncio(pa); an.broker = b;
        Lan.Escucha es = new Lan.Escucha(pa); es.iniciar();
        Lan.Puente pu = new Lan.Puente(pp); pu.iniciar();
        HttpServer c = HttpServer.create(new InetSocketAddress("127.0.0.1", pc), 0);
        c.createContext("/", ex -> {
            String r = "{}"; Map<String, String> q = new HashMap<>();
            String qs = ex.getRequestURI().getRawQuery();
            if (qs != null) for (String kv : qs.split("&")) { int i = kv.indexOf('='); if (i > 0) q.put(kv.substring(0, i), URLDecoder.decode(kv.substring(i + 1), "UTF-8")); }
            switch (ex.getRequestURI().getPath()) {
                case "/hostear":
                    b.info = "{\"n\":" + Lan.jsonTexto(q.getOrDefault("n", "")) + ",\"s\":" + Lan.jsonTexto(q.getOrDefault("s", "")) + ",\"m\":" + Lan.jsonTexto(q.getOrDefault("m", ""))
                        + ",\"du\":" + Lan.jsonTexto(q.getOrDefault("du", "")) + ",\"v\":\"prueba\",\"p\":" + puerto + "}";
                    try { an.iniciar(); } catch (Exception e) { /* nada */ }
                    StringBuilder ips = new StringBuilder("["); for (String ip : Lan.ips()) { if (ips.length() > 1) ips.append(','); ips.append(Lan.jsonTexto(ip)); }
                    r = "{\"ok\":true,\"puerto\":" + puerto + ",\"ips\":" + ips + "]}"; break;
                case "/parar": an.parar(); r = "{\"ok\":true}"; break;
                case "/hosts": r = es.lista(); break;
                case "/ips": { StringBuilder s = new StringBuilder("["); for (String ip : Lan.ips()) { if (s.length() > 1) s.append(','); s.append(Lan.jsonTexto(ip)); } r = s.append(']').toString(); break; }
                case "/estado": r = "{\"jugadores\":" + b.jugadores() + ",\"publicados\":" + b.publicados.get() + ",\"descartados\":" + b.descartados.get() + ",\"retenidos\":" + b.retenidos.size() + "}"; break;
                default: break;
            }
            byte[] o = r.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8"); ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            ex.sendResponseHeaders(200, o.length); ex.getResponseBody().write(o); ex.close();
        });
        c.start();
        System.out.println("listo " + Lan.ips());
    }
}
