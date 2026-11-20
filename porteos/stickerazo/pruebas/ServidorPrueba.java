package com.stickerazo.app;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Hace de celular para probar la página con el Java de verdad (sin teléfono):
 *  <ul><li>sirve web/ como la WebView sirve assets/www, y /archivos/&lt;pack&gt;/&lt;archivo&gt; desde el almacén (Inicio.Cliente);</li>
 *  <li>/szn/&lt;método&gt;: lo que hace Puente con el Almacen real (la página lo llama sincrónico, como a window.SZN);</li>
 *  <li>/whatsapp/…: lo que contesta el proveedor Stickers (metadata, stickers y cada archivo), para revisarlo.</li></ul>
 *  uso: java -cp CLASES com.stickerazo.app.ServidorPrueba PUERTO CARPETA_WEB CARPETA_DATOS */
public final class ServidorPrueba {
    private static final Charset U8 = Charset.forName("UTF-8");
    private static Almacen almacen;
    private static File web;
    private static final Set<String> enWhatsApp = new HashSet<String>();

    public static void main(String[] a) throws Exception {
        web = new File(a[1]).getCanonicalFile();
        almacen = new Almacen(new File(a[2]));
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", Integer.parseInt(a[0])), 0);
        s.createContext("/", new HttpHandler() { public void handle(HttpExchange x) { try { atender(x); } catch (Exception e) { e.printStackTrace(); try { enviar(x, 500, "text/plain", e.toString().getBytes(U8)); } catch (IOException e2) { /* */ } } } });
        s.start();
        System.out.println("listo " + a[0]);
    }

    private static void atender(HttpExchange x) throws IOException {
        String p = x.getRequestURI().getPath();
        if (p.startsWith("/szn/")) { szn(x, p.substring(5)); return; }
        if (p.startsWith("/whatsapp/")) { whatsapp(x, p.substring(10).split("/")); return; }
        if (p.startsWith("/archivos/")) {
            String[] s = p.substring(10).split("/");
            File f = s.length == 2 ? almacen.archivo(s[0], s[1]) : null;
            if (f == null || !f.isFile()) { enviar(x, 404, "text/plain", new byte[0]); return; }
            enviar(x, 200, tipo(f.getName()), Files.readAllBytes(f.toPath()));
            return;
        }
        if (p.equals("/")) p = "/index.html";
        File f = new File(web, p).getCanonicalFile();
        if (!f.getPath().startsWith(web.getPath()) || !f.isFile()) { enviar(x, 404, "text/plain", new byte[0]); return; }
        enviar(x, 200, tipo(f.getName()), Files.readAllBytes(f.toPath()));
    }

    // lo mismo que Puente.java (la página llama con los argumentos en una lista JSON)
    private static void szn(HttpExchange x, String metodo) throws IOException {
        List<?> args = (List<?>) Json.leer(new String(leerTodo(x.getRequestBody()), U8));
        String arg0 = args.size() > 0 ? (String) args.get(0) : null, arg1 = args.size() > 1 ? (String) args.get(1) : null;
        Object r;
        if (metodo.equals("leerPacks")) r = almacen.leerPacks();
        else if (metodo.equals("guardarPacks")) r = almacen.guardarPacks(arg0);
        else if (metodo.equals("guardarArchivo")) {
            byte[] d;
            try { d = Base64.getDecoder().decode((String) args.get(2)); } catch (IllegalArgumentException e) { d = null; }
            r = d != null && almacen.guardarArchivo(arg0, arg1, d);
        } else if (metodo.equals("borrarArchivo")) r = almacen.borrarArchivo(arg0, arg1);
        else if (metodo.equals("borrarPack")) r = almacen.borrarPack(arg0);
        else if (metodo.equals("agregar")) { enWhatsApp.add(arg0); r = true; }
        else if (metodo.equals("estaEnWhatsApp")) r = enWhatsApp.contains(arg0);
        else { enviar(x, 404, "text/plain", new byte[0]); return; }
        enviar(x, 200, "application/json", (r instanceof String ? cita((String) r) : String.valueOf(r)).getBytes(U8));
    }

    // lo mismo que Stickers.java (el proveedor que lee WhatsApp), en JSON
    private static void whatsapp(HttpExchange x, String[] s) throws IOException {
        if (s[0].equals("metadata")) {
            List<Object[]> filas = new ArrayList<Object[]>();
            for (Almacen.Pack p : almacen.packs()) if (s.length == 1 || p.id.equals(s[1])) filas.add(Almacen.filaPack(p, Almacen.TIENDA, Almacen.POLITICA));
            enviar(x, 200, "application/json", tabla(Almacen.COLUMNAS_PACK, filas).getBytes(U8));
        } else if (s[0].equals("stickers") && s.length == 2) {
            List<Object[]> filas = new ArrayList<Object[]>();
            Almacen.Pack p = almacen.pack(s[1]);
            if (p != null) for (Almacen.Sticker st : p.stickers) filas.add(Almacen.filaSticker(st));
            enviar(x, 200, "application/json", tabla(Almacen.COLUMNAS_STICKER, filas).getBytes(U8));
        } else if (s[0].equals("stickers_asset") && s.length == 3) {
            File f = almacen.archivo(s[1], s[2]);
            if (f == null || !f.isFile()) enviar(x, 404, "text/plain", new byte[0]);
            else enviar(x, 200, s[2].endsWith(".png") ? "image/png" : "image/webp", Files.readAllBytes(f.toPath()));
        } else enviar(x, 404, "text/plain", new byte[0]);
    }

    private static String tabla(String[] cols, List<Object[]> filas) {
        StringBuilder b = new StringBuilder("{\"columnas\":[");
        for (int i = 0; i < cols.length; i++) b.append(i > 0 ? "," : "").append(cita(cols[i]));
        b.append("],\"filas\":[");
        for (int k = 0; k < filas.size(); k++) {
            b.append(k > 0 ? "," : "").append('[');
            Object[] f = filas.get(k);
            for (int i = 0; i < f.length; i++) b.append(i > 0 ? "," : "").append(f[i] instanceof String ? cita((String) f[i]) : String.valueOf(f[i]));
            b.append(']');
        }
        return b.append("]}").toString();
    }

    private static String cita(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    private static String tipo(String n) {
        String e = n.substring(n.lastIndexOf('.') + 1).toLowerCase();
        if (e.equals("html")) return "text/html; charset=utf-8";
        if (e.equals("js") || e.equals("mjs")) return "text/javascript; charset=utf-8";
        if (e.equals("css")) return "text/css; charset=utf-8";
        if (e.equals("wasm")) return "application/wasm";
        if (e.equals("ttf")) return "font/ttf";
        if (e.equals("png")) return "image/png";
        if (e.equals("webp")) return "image/webp";
        if (e.equals("jpg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private static byte[] leerTodo(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] t = new byte[65536];
        for (int n; (n = in.read(t)) > 0; ) b.write(t, 0, n);
        return b.toByteArray();
    }

    private static void enviar(HttpExchange x, int cod, String tipo, byte[] d) throws IOException {
        x.getResponseHeaders().set("Content-Type", tipo);
        x.getResponseHeaders().set("Cache-Control", "no-store");
        x.sendResponseHeaders(cod, d.length == 0 ? -1 : d.length);
        if (d.length > 0) { OutputStream o = x.getResponseBody(); o.write(d); o.close(); }
        x.close();
    }
}
