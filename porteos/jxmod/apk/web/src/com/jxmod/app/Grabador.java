package com.jxmod.app;

import java.io.Closeable;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayDeque;

/**
 * El modo grabación del juego (grabar.js): el video llega de la página por pedazos en base64 mientras se graba (uno por
 * medio segundo o por segundo) y se escribe en orden en un hilo aparte, así la página no espera al disco y el video entero
 * nunca está en memoria: lo único guardado es lo que espera en la cola, que la página no deja pasar de unos 8 MB (mira
 * {@link #pendiente()} antes de mandar más). Al final llegan los parches —la duración en la cabecera, que Chrome deja en
 * cero— y se escriben en su lugar. Java puro (Web.java le da la salida: un archivo de la galería); lo prueba
 * apk/pruebas/unido/PruebaGrabador.java sin teléfono.
 */
final class Grabador {
    /** Adónde va: en orden, y los parches en su posición. */
    interface Salida {
        void escribir(byte[] b, int n) throws IOException;
        void escribirEn(long pos, byte[] b, int n) throws IOException;
        void cerrar() throws IOException;
    }
    /** Lo que pasa al terminar (en el hilo del grabador): ok, bytes escritos y el error, si hubo. */
    interface Listo { void listo(boolean ok, long bytes, String error); }

    private static final class Parche { final long pos; final String b64; Parche(long p, String b) { pos = p; b64 = b; } }
    private static final Object FIN = new Object(), CANCELAR = new Object();

    private final Salida sal;
    private final ArrayDeque<Object> cola = new ArrayDeque<>();
    private long pendiente, escritos;
    private volatile String error;
    private boolean cerrado;
    private Listo listo;
    private byte[] buf = new byte[64 * 1024];

    Grabador(Salida s) {
        sal = s;
        Thread t = new Thread(this::correr, "JXGrabar");
        t.setDaemon(true);
        t.start();
    }

    /** Un pedazo (base64). Devuelve los bytes que esperan en la cola, o -1 si hubo un error o ya se cerró. */
    synchronized long escribir(String b64) {
        if (error != null || cerrado || b64 == null) return -1;
        cola.add(b64);
        pendiente += b64.length() / 4L * 3;
        notifyAll();
        return pendiente;
    }
    /** Lo que espera en la cola (bytes), o -1 si hubo un error. */
    synchronized long pendiente() { return error != null ? -1 : pendiente; }
    synchronized long escritos() { return escritos; }
    String error() { return error; }
    /** Unos bytes en una posición ya escrita (la duración en la cabecera): va en la cola, después de lo anterior. */
    synchronized boolean parche(long pos, String b64) {
        if (error != null || cerrado || b64 == null || pos < 0) return false;
        cola.add(new Parche(pos, b64));
        notifyAll();
        return true;
    }
    /** Escribe lo que queda, cierra y avisa. */
    synchronized void terminar(Listo l) {
        if (cerrado) return;
        cerrado = true; listo = l;
        cola.add(FIN);
        notifyAll();
    }
    /** Tira lo que queda, cierra y avisa (ok = false). */
    synchronized void cancelar(Listo l) {
        if (cerrado && listo != null && cola.isEmpty()) return;
        cerrado = true; listo = l;
        cola.clear(); pendiente = 0;
        cola.add(CANCELAR);
        notifyAll();
    }

    private void correr() {
        while (true) {
            Object x;
            synchronized (this) {
                while (cola.isEmpty()) { try { wait(); } catch (InterruptedException e) { return; } }
                x = cola.poll();
            }
            if (x == FIN || x == CANCELAR) {
                try { sal.cerrar(); } catch (IOException e) { if (error == null) error = "cerrar: " + e.getMessage(); }
                Listo l; long n;
                synchronized (this) { l = listo; n = escritos; }
                if (l != null) l.listo(x == FIN && error == null, n, error);
                return;
            }
            if (error != null) continue;   // (después de un error, lo que queda se descarta)
            try {
                if (x instanceof String) {
                    String s = (String) x;
                    int n = decodificar(s);
                    sal.escribir(buf, n);
                    synchronized (this) { escritos += n; pendiente -= s.length() / 4L * 3; if (pendiente < 0) pendiente = 0; }
                } else {
                    Parche p = (Parche) x;
                    int n = decodificar(p.b64);
                    sal.escribirEn(p.pos, buf, n);
                }
            } catch (Exception e) {
                error = e.getClass().getSimpleName() + ": " + e.getMessage();
                synchronized (this) { pendiente = 0; }
            }
        }
    }

    private static final byte[] TABLA = new byte[256];
    static {
        java.util.Arrays.fill(TABLA, (byte) -1);
        String a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (int i = 0; i < 64; i++) TABLA[a.charAt(i)] = (byte) i;
        TABLA['-'] = 62; TABLA['_'] = 63;   // (también el de las direcciones)
    }
    /** base64 → buf, que se agranda sólo si hace falta: un búfer por grabación, no una copia nueva por pedazo. */
    int decodificar(String s) throws IOException {
        int L = s.length(), max = L / 4 * 3 + 3;
        if (buf.length < max) buf = new byte[Math.max(max, buf.length * 2)];
        return decodificar(s, buf);
    }
    /** base64 → b. Devuelve cuántos bytes; ignora espacios y saltos; los «=» del final cierran. */
    static int decodificar(String s, byte[] b) throws IOException {
        int L = s.length(), n = 0, acc = 0, k = 0;
        for (int i = 0; i < L; i++) {
            char c = s.charAt(i);
            if (c == '=') break;
            if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
            int v = c < 256 ? TABLA[c] : -1;
            if (v < 0) throw new IOException("base64: carácter " + (int) c + " en " + i);
            acc = (acc << 6) | v;
            if (++k == 4) { b[n++] = (byte) (acc >> 16); b[n++] = (byte) (acc >> 8); b[n++] = (byte) acc; acc = 0; k = 0; }
        }
        if (k == 2) b[n++] = (byte) (acc >> 4);
        else if (k == 3) { b[n++] = (byte) (acc >> 10); b[n++] = (byte) (acc >> 2); }
        else if (k == 1) throw new IOException("base64 cortado");
        return n;
    }

    /** La salida de siempre: un FileChannel (el de la galería o el de un archivo), y lo que haya que cerrar con él. */
    static Salida canal(final FileChannel ch, final Closeable... ademas) {
        return new Salida() {
            @Override public void escribir(byte[] b, int n) throws IOException {
                ByteBuffer bb = ByteBuffer.wrap(b, 0, n);
                while (bb.hasRemaining()) ch.write(bb);
            }
            @Override public void escribirEn(long pos, byte[] b, int n) throws IOException {
                ByteBuffer bb = ByteBuffer.wrap(b, 0, n);
                long p = pos;
                while (bb.hasRemaining()) p += ch.write(bb, p);
            }
            @Override public void cerrar() throws IOException {
                try { ch.force(false); } catch (IOException e) { /* (algunos no saben: igual se cierra) */ }
                try { ch.close(); }
                finally { for (Closeable c : ademas) { try { if (c != null) c.close(); } catch (IOException e) { /* nada */ } } }
            }
        };
    }
}
