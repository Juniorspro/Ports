package com.jxapps.jxhand;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;

/** Los botones redondos de arriba, con íconos propios dibujados a mano (nada de emojis ni de íconos de terceros). */
public class Icono extends View {
    public static final int GIRAR = 0, LINTERNA = 1, LUNA = 2, AJUSTES = 3, CERRAR = 4, MANO = 5;
    private final int tipo;
    private boolean activo, deshabilitado;
    private final Paint fondo = new Paint(Paint.ANTI_ALIAS_FLAG), trazo = new Paint(Paint.ANTI_ALIAS_FLAG), relleno = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path p = new Path();
    private final RectF r = new RectF();

    public Icono(Context c, int tipo) {
        super(c);
        this.tipo = tipo;
        trazo.setStyle(Paint.Style.STROKE); trazo.setStrokeCap(Paint.Cap.ROUND); trazo.setStrokeJoin(Paint.Join.ROUND);
        relleno.setStyle(Paint.Style.FILL);
        setClickable(true);
    }

    public void activo(boolean a) { if (a != activo) { activo = a; invalidate(); } }
    public boolean activo() { return activo; }
    public void deshabilitado(boolean d) { deshabilitado = d; setAlpha(d ? 0.35f : 1f); invalidate(); }

    @Override protected void onDraw(Canvas c) {
        float w = getWidth(), h = getHeight(), s = Math.min(w, h), cx = w / 2, cy = h / 2;
        // el fondo: vidrio oscuro; prendido, el degradé de JXApps
        if (activo) fondo.setShader(new LinearGradient(0, 0, w, h, 0xFF7A3CFF, 0xFFFF3E8A, Shader.TileMode.CLAMP));
        else { fondo.setShader(null); fondo.setColor(isPressed() ? 0x88FFFFFF : 0x55000000); }
        c.drawCircle(cx, cy, s / 2 - 1, fondo);
        int color = Color.WHITE;
        trazo.setColor(color); relleno.setColor(color);
        trazo.setStrokeWidth(s * 0.075f);
        float u = s / 24f; // el ícono se dibuja en una grilla de 24 × 24 centrada
        c.save(); c.translate(cx - 12 * u, cy - 12 * u);
        p.reset();
        switch (tipo) {
            case GIRAR: {
                // una cámara con dos flechas que giran
                r.set(5 * u, 8 * u, 19 * u, 18 * u); c.drawRoundRect(r, 2 * u, 2 * u, trazo);
                p.moveTo(9 * u, 8 * u); p.lineTo(10 * u, 6 * u); p.lineTo(14 * u, 6 * u); p.lineTo(15 * u, 8 * u); c.drawPath(p, trazo);
                p.reset(); r.set(9 * u, 10 * u, 15 * u, 16 * u); p.arcTo(r, 200, 250); c.drawPath(p, trazo);
                p.reset(); p.moveTo(14.6f * u, 9.4f * u); p.lineTo(15.6f * u, 11.4f * u); p.lineTo(13.4f * u, 11.6f * u); c.drawPath(p, trazo);
                break;
            }
            case LINTERNA: {
                // la linterna: cabeza, cuerpo y rayos si está prendida
                p.moveTo(8 * u, 7 * u); p.lineTo(16 * u, 7 * u); p.lineTo(14 * u, 11 * u); p.lineTo(14 * u, 20 * u); p.lineTo(10 * u, 20 * u); p.lineTo(10 * u, 11 * u); p.close();
                c.drawPath(p, trazo);
                c.drawLine(10 * u, 13 * u, 14 * u, 13 * u, trazo);
                if (activo) { c.drawLine(12 * u, 4.5f * u, 12 * u, 2.5f * u, trazo); c.drawLine(7 * u, 5 * u, 5.6f * u, 3.6f * u, trazo); c.drawLine(17 * u, 5 * u, 18.4f * u, 3.6f * u, trazo); }
                break;
            }
            case LUNA: {
                // media luna (dos arcos) y una estrellita
                r.set(5 * u, 5 * u, 19 * u, 19 * u);
                p.addArc(r, 60, 260);
                RectF r2 = new RectF(9 * u, 3.5f * u, 21 * u, 15.5f * u);
                p.arcTo(r2, 250, -200);
                c.drawPath(p, trazo);
                c.drawCircle(18.5f * u, 17.5f * u, 1.1f * u, relleno);
                break;
            }
            case AJUSTES: {
                // tres reguladores
                float[] ys = {7 * u, 12 * u, 17 * u}, xs = {9 * u, 15 * u, 11 * u};
                for (int i = 0; i < 3; i++) {
                    c.drawLine(5 * u, ys[i], 19 * u, ys[i], trazo);
                    fondo.setShader(null); fondo.setColor(activo ? 0xFFB050FF : 0xFF202028);
                    c.drawCircle(xs[i], ys[i], 2.2f * u, fondo);
                    c.drawCircle(xs[i], ys[i], 2.2f * u, trazo);
                }
                break;
            }
            case MANO: {
                // una mano: la palma y cuatro dedos redondeados, y el pulgar
                r.set(7 * u, 11 * u, 17 * u, 20 * u); c.drawRoundRect(r, 3 * u, 3 * u, trazo);
                float[] xs = {8.3f, 11f, 13.7f, 16.2f}, ys = {6f, 4f, 4.6f, 7f};
                for (int k = 0; k < 4; k++) c.drawLine(xs[k] * u, 11 * u, xs[k] * u, ys[k] * u, trazo);
                p.moveTo(7 * u, 15 * u); p.lineTo(4.5f * u, 11.5f * u); c.drawPath(p, trazo);
                break;
            }
            case CERRAR: {
                c.drawLine(7 * u, 7 * u, 17 * u, 17 * u, trazo); c.drawLine(17 * u, 7 * u, 7 * u, 17 * u, trazo);
                break;
            }
        }
        c.restore();
    }

    @Override protected void drawableStateChanged() { super.drawableStateChanged(); invalidate(); }
}
