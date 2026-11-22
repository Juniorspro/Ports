package com.jxapps.jxhand;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.PixelFormat;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

/**
 * Donde se ve todo. Se dibuja desde el hilo del motor, apenas termina cada cuadro: la imagen que miró el motor (no la
 * cámara «en vivo», que ya iría más adelante) y encima su esqueleto. Así el esqueleto cae justo sobre la mano en cada
 * cuadro, sin el retraso de dibujar los puntos de antes sobre un video que ya avanzó.
 *
 * Con el lienzo por hardware (Android 6 o más nuevo) la imagen se sube como textura y escalarla no le cuesta al
 * procesador.
 */
public class Lienzo extends SurfaceView implements SurfaceHolder.Callback {
    /** lo que se muestra arriba a la izquierda y en las tarjetas */
    public static class Hud {
        public double msMotor, msCuadro, cps; public int hilos; public String modelo = "";
        public float brillo, ganancia = 1; public boolean noche, frente, ver3d; public long sinManosDesde;
    }

    static final String[] GESTOS = {"Sin gesto", "Abierta", "Puño", "Señalar", "Pinza", "Paz", "Pulgar arriba", "OK", "Cuernos", "Llamame", "Pulgar abajo"};
    static final String[] DEDOS = {"P", "I", "M", "A", "Me"};
    /** los huesos (pares de puntos) y de qué dedo es cada uno: 0 pulgar … 4 meñique, 5 palma */
    static final int[][] HUESOS = {{0, 1, 0}, {1, 2, 0}, {2, 3, 0}, {3, 4, 0}, {0, 5, 5}, {5, 9, 5}, {9, 13, 5}, {13, 17, 5}, {0, 17, 5},
        {5, 6, 1}, {6, 7, 1}, {7, 8, 1}, {9, 10, 2}, {10, 11, 2}, {11, 12, 2}, {13, 14, 3}, {14, 15, 3}, {15, 16, 3}, {17, 18, 4}, {18, 19, 4}, {19, 20, 4}};
    static final int[] COLORES = {0xFFFF4D8D, 0xFFFFB020, 0xFF3DDC97, 0xFF39A0FF, 0xFFA066FF, 0xFFFFFFFF};
    static int dedoDe(int punto) { return punto == 0 ? 5 : (punto - 1) / 4; }

    private final Object cerrojo = new Object();
    private boolean listo;
    private final float dp;
    public volatile int margenArriba, margenAbajo;
    private final Paint pImg = new Paint(Paint.FILTER_BITMAP_FLAG), pLinea = new Paint(Paint.ANTI_ALIAS_FLAG), pSombra = new Paint(Paint.ANTI_ALIAS_FLAG),
        pPunto = new Paint(Paint.ANTI_ALIAS_FLAG), pTexto = new Paint(Paint.ANTI_ALIAS_FLAG), pChico = new Paint(Paint.ANTI_ALIAS_FLAG),
        pCarta = new Paint(Paint.ANTI_ALIAS_FLAG), pBarra = new Paint(Paint.ANTI_ALIAS_FLAG), pBrillo = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF r = new RectF(), dst = new RectF();
    private final float[] px = new float[21], py = new float[21], pz = new float[21];

    public Lienzo(Context c) {
        super(c);
        dp = c.getResources().getDisplayMetrics().density;
        getHolder().addCallback(this);
        pLinea.setStyle(Paint.Style.STROKE); pLinea.setStrokeCap(Paint.Cap.ROUND);
        pSombra.setStyle(Paint.Style.STROKE); pSombra.setStrokeCap(Paint.Cap.ROUND); pSombra.setColor(0x66000000);
        pBrillo.setStyle(Paint.Style.STROKE); pBrillo.setStrokeCap(Paint.Cap.ROUND);
        getHolder().setFormat(PixelFormat.RGBA_8888);
        pTexto.setColor(Color.WHITE); pTexto.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD)); pTexto.setTextSize(18 * dp);
        pTexto.setShadowLayer(3 * dp, 0, 1 * dp, 0x99000000);
        pChico.setColor(0xDDFFFFFF); pChico.setTextSize(12 * dp); pChico.setShadowLayer(2 * dp, 0, 1 * dp, 0x99000000);
        pCarta.setColor(0x99101018);
    }

    private volatile String msgTitulo, msgDetalle;
    private volatile boolean hayCuadros;

    @Override public void surfaceCreated(SurfaceHolder h) { synchronized (cerrojo) { listo = true; } }
    @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int ht) { if (!hayCuadros && msgTitulo != null) mensaje(msgTitulo, msgDetalle); }
    @Override public void surfaceDestroyed(SurfaceHolder h) { synchronized (cerrojo) { listo = false; } }

    private Canvas abrir(Surface s) {
        try { return Build.VERSION.SDK_INT >= 23 ? s.lockHardwareCanvas() : s.lockCanvas(null); } catch (Exception e) { return null; }
    }

    /** sólo un mensaje (sin cámara todavía, sin permiso, error) */
    public void mensaje(String titulo, String detalle) {
        msgTitulo = titulo; msgDetalle = detalle; hayCuadros = false;
        synchronized (cerrojo) {
            if (!listo) return;
            Surface s = getHolder().getSurface(); Canvas c = abrir(s); if (c == null) return;
            try {
                c.drawColor(0xFF0B0B10);
                float w = c.getWidth(), h = c.getHeight();
                pTexto.setTextAlign(Paint.Align.CENTER); pChico.setTextAlign(Paint.Align.CENTER);
                c.drawText(titulo, w / 2, h / 2, pTexto);
                if (detalle != null) { float y = h / 2 + 26 * dp; for (String l : detalle.split("\n")) { c.drawText(l, w / 2, y, pChico); y += 18 * dp; } }
                pTexto.setTextAlign(Paint.Align.LEFT); pChico.setTextAlign(Paint.Align.LEFT);
            } finally { try { s.unlockCanvasAndPost(c); } catch (Exception e) { } }
        }
    }

    /** dibuja un cuadro: la imagen del motor (bw × bh), las manos (`d`: la salida del motor) y lo de arriba */
    public void dibujar(Bitmap bmp, int bw, int bh, float[] d, int n, Hud hud) {
        hayCuadros = true;
        synchronized (cerrojo) {
            if (!listo) return;
            Surface s = getHolder().getSurface(); Canvas c = abrir(s); if (c == null) return;
            try {
                float W = c.getWidth(), H = c.getHeight();
                // la imagen llena la pantalla (se recorta lo que sobra, sin deformar)
                float esc = Math.max(W / bw, H / bh), ox = (W - bw * esc) / 2, oy = (H - bh * esc) / 2;
                dst.set(ox, oy, ox + bw * esc, oy + bh * esc);
                c.drawColor(Color.BLACK);
                c.drawBitmap(bmp, null, dst, pImg);
                for (int k = 0; k < n; k++) mano(c, d, Motor.CABECERA + k * Motor.POR_MANO, bw, bh, esc, ox, oy);
                arriba(c, W, hud);
                if (hud.ver3d && n > 0) tresD(c, W, d, Motor.CABECERA);
                tarjetas(c, W, H, d, n);
                if (n == 0 && hud.sinManosDesde > 0 && System.nanoTime() - hud.sinManosDesde > 700_000_000L) pista(c, W, H, "Mostrá la mano a la cámara");
            } finally { try { s.unlockCanvasAndPost(c); } catch (Exception e) { } }
        }
    }

    private void mano(Canvas c, float[] d, int o, int bw, int bh, float esc, float ox, float oy) {
        for (int i = 0; i < 21; i++) {
            px[i] = ox + d[o + 14 + i * 3] * bw * esc; py[i] = oy + d[o + 15 + i * 3] * bh * esc; pz[i] = d[o + 16 + i * 3];
        }
        float lado = d[o + 172] * esc;
        float g = Math.max(2.2f * dp, Math.min(6 * dp, lado * 0.011f));
        // primero una sombra (se ve sobre fondos claros), después cada hueso del color de su dedo
        pSombra.setStrokeWidth(g * 2.1f);
        for (int[] h : HUESOS) c.drawLine(px[h[0]], py[h[0]], px[h[1]], py[h[1]], pSombra);
        pLinea.setStrokeWidth(g);
        for (int[] h : HUESOS) { pLinea.setColor(h[2] == 5 ? 0xE6FFFFFF : COLORES[h[2]]); c.drawLine(px[h[0]], py[h[0]], px[h[1]], py[h[1]], pLinea); }
        // las articulaciones: las puntas más grandes, y más grandes cuanto más cerca de la cámara
        for (int i = 0; i < 21; i++) {
            boolean punta = i > 0 && i % 4 == 0;
            float cerca = Math.max(0.75f, Math.min(1.45f, 1f - pz[i] * 3f));
            float rad = (punta ? g * 1.35f : g * 0.85f) * cerca;
            pPunto.setColor(0x99000000); c.drawCircle(px[i], py[i], rad + g * 0.45f, pPunto);
            pPunto.setColor(punta ? COLORES[dedoDe(i)] : Color.WHITE); c.drawCircle(px[i], py[i], rad, pPunto);
        }
        // la pinza: una línea que se enciende cuando el pulgar y el índice se tocan
        float pinza = d[o + 165];
        if (pinza > 0.7f) {
            int a = (int) (255 * Math.min(1f, (pinza - 0.7f) / 0.25f));
            // el brillo: líneas anchas y transparentes debajo (el desenfoque no existe en el lienzo por hardware)
            pBrillo.setStrokeWidth(g * 4.5f); pBrillo.setColor(((a * 50 / 255) << 24) | 0xFF3E8A); c.drawLine(px[4], py[4], px[8], py[8], pBrillo);
            pBrillo.setStrokeWidth(g * 2.6f); pBrillo.setColor(((a * 120 / 255) << 24) | 0xFF3E8A); c.drawLine(px[4], py[4], px[8], py[8], pBrillo);
            pLinea.setStrokeWidth(g * 0.9f); pLinea.setColor((a << 24) | 0xFFFFFF);
            c.drawLine(px[4], py[4], px[8], py[8], pLinea);
        }
    }

    private final String[] lineas = new String[4];

    private void arriba(Canvas c, float W, Hud h) {
        int n = 0;
        lineas[n++] = String.format("%.1f ms por cuadro · %.0f cps", h.msMotor, h.cps);
        lineas[n++] = "Rust nativo · " + h.hilos + " núcleos · " + h.modelo;
        if (h.ganancia > 1.05f) lineas[n++] = String.format("Poca luz: aclarado ×%.1f", h.ganancia);
        else if (h.noche) lineas[n++] = "Ver de noche";
        // un fondo oscuro detrás del texto: se lee igual sobre una pared blanca
        float ancho = pTexto.measureText("JX Hand");
        for (int i = 0; i < n; i++) ancho = Math.max(ancho, pChico.measureText(lineas[i]));
        float x = 16 * dp, y = margenArriba + 30 * dp;
        r.set(x - 10 * dp, y - 24 * dp, x + ancho + 12 * dp, y + n * 16 * dp + 10 * dp);
        c.drawRoundRect(r, 14 * dp, 14 * dp, pCarta);
        c.drawText("JX Hand", x, y, pTexto);
        y += 2 * dp;
        for (int i = 0; i < n; i++) { y += 16 * dp; c.drawText(lineas[i], x, y, pChico); }
    }

    private void pista(Canvas c, float W, float H, String t) {
        float tw = pChico.measureText(t) + 28 * dp, y = H - margenAbajo - 40 * dp;
        r.set((W - tw) / 2, y - 18 * dp, (W + tw) / 2, y + 12 * dp);
        c.drawRoundRect(r, 15 * dp, 15 * dp, pCarta);
        pChico.setTextAlign(Paint.Align.CENTER); c.drawText(t, W / 2, y + 1 * dp, pChico); pChico.setTextAlign(Paint.Align.LEFT);
    }

    private void tarjetas(Canvas c, float W, float H, float[] d, int n) {
        if (n <= 0) return;
        float m = 12 * dp, ch = 118 * dp, cw = n >= 2 ? (W - 3 * m) / 2 : Math.min(W - 2 * m, 360 * dp);
        float y0 = H - margenAbajo - m - ch;
        for (int k = 0; k < Math.min(n, 2); k++) {
            int o = Motor.CABECERA + k * Motor.POR_MANO;
            float x0 = n >= 2 ? m + k * (cw + m) : (W - cw) / 2;
            r.set(x0, y0, x0 + cw, y0 + ch); c.drawRoundRect(r, 18 * dp, 18 * dp, pCarta);
            float x = x0 + 14 * dp, y = y0 + 24 * dp;
            boolean der = d[o + 1] > 0.5f;
            pTexto.setTextSize(15 * dp);
            c.drawText(der ? "Derecha" : "Izquierda", x, y, pTexto);
            float dist = d[o + 6] * 100;
            String cm = dist > 1 ? String.format("%.0f cm", dist) : "";
            pChico.setTextAlign(Paint.Align.RIGHT); c.drawText(cm, x0 + cw - 14 * dp, y, pChico); pChico.setTextAlign(Paint.Align.LEFT);
            // el gesto con su fuerza
            int gi = (int) d[o + 168]; float gf = d[o + 169];
            y += 22 * dp;
            pTexto.setTextSize(14 * dp);
            c.drawText(gi >= 0 && gi < GESTOS.length ? GESTOS[gi] : "", x, y, pTexto);
            pTexto.setTextSize(18 * dp);
            barra(c, x, y + 7 * dp, cw - 28 * dp, 4 * dp, gi > 0 ? gf : 0, true);
            // cuánto se estira cada dedo
            float bx = x, by = y + 22 * dp, bwid = (cw - 28 * dp - 4 * 8 * dp) / 5, bh = 34 * dp;
            for (int f = 0; f < 5; f++) {
                float estira = 1f - Math.max(0, Math.min(1, d[o + 160 + f]));
                float xx = bx + f * (bwid + 8 * dp);
                r.set(xx, by, xx + bwid, by + bh); pBarra.setShader(null); pBarra.setColor(0x33FFFFFF); c.drawRoundRect(r, 4 * dp, 4 * dp, pBarra);
                r.set(xx, by + bh * (1 - estira), xx + bwid, by + bh); pBarra.setColor(COLORES[f]); c.drawRoundRect(r, 4 * dp, 4 * dp, pBarra);
                pChico.setTextAlign(Paint.Align.CENTER); c.drawText(DEDOS[f], xx + bwid / 2, by + bh + 13 * dp, pChico); pChico.setTextAlign(Paint.Align.LEFT);
            }
        }
    }

    private void barra(Canvas c, float x, float y, float w, float h, float v, boolean degrade) {
        r.set(x, y, x + w, y + h); pBarra.setShader(null); pBarra.setColor(0x33FFFFFF); c.drawRoundRect(r, h / 2, h / 2, pBarra);
        if (v <= 0) return;
        r.set(x, y, x + w * Math.min(1, v), y + h);
        if (degrade) pBarra.setShader(new LinearGradient(x, 0, x + w, 0, 0xFF7A3CFF, 0xFFFF3E8A, Shader.TileMode.CLAMP));
        c.drawRoundRect(r, h / 2, h / 2, pBarra); pBarra.setShader(null);
    }

    /** la primera mano en 3D (en metros, armada con el esqueleto), girando despacio */
    private void tresD(Canvas c, float W, float[] d, int o) {
        float lado = 132 * dp, x0 = W - lado - 12 * dp, y0 = margenArriba + 76 * dp;
        r.set(x0, y0, x0 + lado, y0 + lado); c.drawRoundRect(r, 18 * dp, 18 * dp, pCarta);
        double a = (System.nanoTime() / 1e9) * 0.7;
        float ca = (float) Math.cos(a), sa = (float) Math.sin(a);
        float mx = 0, my = 0, mz = 0;
        for (int i = 0; i < 21; i++) { mx += d[o + 77 + i * 3]; my += d[o + 78 + i * 3]; mz += d[o + 79 + i * 3]; }
        mx /= 21; my /= 21; mz /= 21;
        float s = lado / 0.24f, cx = x0 + lado / 2, cy = y0 + lado / 2;
        for (int i = 0; i < 21; i++) {
            float x = d[o + 77 + i * 3] - mx, y = d[o + 78 + i * 3] - my, z = d[o + 79 + i * 3] - mz;
            px[i] = cx + (x * ca - z * sa) * s; py[i] = cy + y * s; pz[i] = x * sa + z * ca;
        }
        pLinea.setStrokeWidth(2.4f * dp);
        for (int[] h : HUESOS) { pLinea.setColor(h[2] == 5 ? 0xCCFFFFFF : COLORES[h[2]]); c.drawLine(px[h[0]], py[h[0]], px[h[1]], py[h[1]], pLinea); }
        for (int i = 0; i < 21; i++) { pPunto.setColor(i > 0 && i % 4 == 0 ? COLORES[dedoDe(i)] : Color.WHITE); c.drawCircle(px[i], py[i], (i % 4 == 0 ? 3.2f : 2.2f) * dp, pPunto); }
    }
}
