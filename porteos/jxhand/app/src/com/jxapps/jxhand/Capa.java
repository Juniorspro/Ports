package com.jxapps.jxhand;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;

/**
 * Lo que va encima de la imagen: los números de arriba, una tarjeta por mano y los mensajes. La imagen y la mano en 3D
 * las dibuja el motor de Rust con OpenGL (Pantalla); esto es una vista común, que se redibuja cuando llega cada cuadro.
 */
public class Capa extends View {
    /** lo que se muestra arriba a la izquierda y en las tarjetas */
    public static class Hud {
        public double msMotor, msCuadro, msDibujo, cps; public int hilos; public String modelo = "", estilo = "";
        public float brillo, ganancia = 1; public boolean noche, frente; public long sinManosDesde;
        void copiar(Hud o) { msMotor = o.msMotor; msCuadro = o.msCuadro; msDibujo = o.msDibujo; cps = o.cps; hilos = o.hilos; modelo = o.modelo; estilo = o.estilo;
            brillo = o.brillo; ganancia = o.ganancia; noche = o.noche; frente = o.frente; sinManosDesde = o.sinManosDesde; }
    }

    static final String[] GESTOS = {"Sin gesto", "Abierta", "Puño", "Señalar", "Pinza", "Paz", "Pulgar arriba", "OK", "Cuernos", "Llamame", "Pulgar abajo"};
    static final String[] DEDOS = {"P", "I", "M", "A", "Me"};
    static final int[] COLORES = {0xFFFF4D8D, 0xFFFFB020, 0xFF3DDC97, 0xFF39A0FF, 0xFFA066FF, 0xFFFFFFFF};

    private final float dp;
    public volatile int margenArriba, margenAbajo;
    private final Paint pTexto = new Paint(Paint.ANTI_ALIAS_FLAG), pChico = new Paint(Paint.ANTI_ALIAS_FLAG),
        pCarta = new Paint(Paint.ANTI_ALIAS_FLAG), pBarra = new Paint(Paint.ANTI_ALIAS_FLAG), pFondo = new Paint();
    private final RectF r = new RectF();
    // lo último que llegó del motor (se copia acá desde su hilo)
    private final float[] d = new float[Motor.CABECERA + 2 * Motor.POR_MANO];
    private int n;
    private final Hud hud = new Hud();
    private volatile String msgTitulo, msgDetalle, aviso;
    private volatile long avisoHasta;

    public Capa(Context c) {
        super(c);
        dp = c.getResources().getDisplayMetrics().density;
        pTexto.setColor(Color.WHITE); pTexto.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD)); pTexto.setTextSize(18 * dp);
        pTexto.setShadowLayer(3 * dp, 0, 1 * dp, 0x99000000);
        pChico.setColor(0xDDFFFFFF); pChico.setTextSize(12 * dp); pChico.setShadowLayer(2 * dp, 0, 1 * dp, 0x99000000);
        pCarta.setColor(0x99101018);
        pFondo.setColor(0xFF0B0B10);
    }

    /** un mensaje a pantalla completa (null: se saca) */
    public void mensaje(String titulo, String detalle) { msgTitulo = titulo; msgDetalle = detalle; postInvalidate(); }
    /** un aviso corto en el medio (por ejemplo el estilo elegido) */
    public void avisar(String t) { aviso = t; avisoHasta = System.currentTimeMillis() + 1300; postInvalidate(); postInvalidateDelayed(1350); }

    /** lo que salió del motor en este cuadro (desde el hilo del motor) */
    public void actualizar(float[] datos, int manos, Hud h) {
        synchronized (d) { System.arraycopy(datos, 0, d, 0, Motor.CABECERA + manos * Motor.POR_MANO); n = manos; hud.copiar(h); }
        if (msgTitulo != null) msgTitulo = null;
        postInvalidate();
    }

    @Override protected void onDraw(Canvas c) {
        float W = getWidth(), H = getHeight();
        if (msgTitulo != null) {
            c.drawRect(0, 0, W, H, pFondo);
            pTexto.setTextAlign(Paint.Align.CENTER); pChico.setTextAlign(Paint.Align.CENTER);
            c.drawText(msgTitulo, W / 2, H / 2, pTexto);
            String det = msgDetalle;
            if (det != null) { float y = H / 2 + 26 * dp; for (String l : det.split("\n")) { c.drawText(l, W / 2, y, pChico); y += 18 * dp; } }
            pTexto.setTextAlign(Paint.Align.LEFT); pChico.setTextAlign(Paint.Align.LEFT);
            return;
        }
        synchronized (d) {
            arriba(c, W, hud);
            tarjetas(c, W, H, d, n);
            if (n == 0 && hud.sinManosDesde > 0 && System.nanoTime() - hud.sinManosDesde > 700_000_000L) pista(c, W, H, "Mostrá la mano a la cámara");
        }
        String a = aviso;
        if (a != null && System.currentTimeMillis() < avisoHasta) {
            pTexto.setTextSize(22 * dp);
            float tw = pTexto.measureText(a) + 40 * dp;
            r.set((W - tw) / 2, H * 0.42f - 30 * dp, (W + tw) / 2, H * 0.42f + 16 * dp);
            c.drawRoundRect(r, 22 * dp, 22 * dp, pCarta);
            pTexto.setTextAlign(Paint.Align.CENTER); c.drawText(a, W / 2, H * 0.42f, pTexto); pTexto.setTextAlign(Paint.Align.LEFT);
            pTexto.setTextSize(18 * dp);
        }
    }

    private final String[] lineas = new String[5];

    private void arriba(Canvas c, float W, Hud h) {
        int k = 0;
        lineas[k++] = String.format("%.1f ms por cuadro · %.0f cps", h.msMotor, h.cps);
        lineas[k++] = "Rust nativo · " + h.hilos + " núcleos · " + h.modelo;
        lineas[k++] = String.format("Mano 3D: %s · dibujo %.1f ms", h.estilo, h.msDibujo);
        if (h.ganancia > 1.05f) lineas[k++] = String.format("Poca luz: aclarado ×%.1f", h.ganancia);
        else if (h.noche) lineas[k++] = "Ver de noche";
        // un fondo oscuro detrás del texto: se lee igual sobre una pared blanca
        float ancho = pTexto.measureText("JX Hand");
        for (int i = 0; i < k; i++) ancho = Math.max(ancho, pChico.measureText(lineas[i]));
        // (debajo de la fila de botones de arriba a la derecha: 12 dp de margen, 46 de botón y un poco de aire)
        float x = 16 * dp, y = margenArriba + 12 * dp + 46 * dp + 36 * dp;
        r.set(x - 10 * dp, y - 24 * dp, x + ancho + 12 * dp, y + k * 16 * dp + 10 * dp);
        c.drawRoundRect(r, 14 * dp, 14 * dp, pCarta);
        c.drawText("JX Hand", x, y, pTexto);
        y += 2 * dp;
        for (int i = 0; i < k; i++) { y += 16 * dp; c.drawText(lineas[i], x, y, pChico); }
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

}
