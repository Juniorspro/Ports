package com.jxmod.app;

/**
 * Lo que sale del motor de manos (JX Hand Engine) pasado a texto para el juego (manos_jx.js lo lee con
 * JXManos.leer()): «cuadro,ms,liviano,float16,manos,» y después los 176 números de cada mano, como los da el motor
 * (com.jxapps.jxhand.Motor: id, derecha, presencia, calibrada, posición, rotación, normal, 21 puntos en la imagen,
 * 21 en metros, ángulos, cierre, pinza, agarre, dedos, gesto, fuerza, cuadrado, ancho y alto). Sin nada de Android:
 * se prueba en la PC con el motor de verdad (pruebas/unido/PruebaManosTexto.java).
 */
public final class ManosTexto {
    public static final int CABECERA = com.jxapps.jxhand.Motor.CABECERA, POR_MANO = com.jxapps.jxhand.Motor.POR_MANO;

    private ManosTexto() {}

    /** un número con hasta 4 decimales (sin pasar por Float.toString: esto corre 30 veces por segundo) */
    static void num(StringBuilder sb, float v) {
        if (Float.isNaN(v) || Float.isInfinite(v)) { sb.append('0'); return; }
        long q = Math.round(v * 10000.0);
        if (q < 0) { sb.append('-'); q = -q; }
        sb.append(q / 10000);
        long r = q % 10000;
        if (r != 0) {
            sb.append('.');
            if (r < 1000) sb.append('0');
            if (r < 100) sb.append('0');
            if (r < 10) sb.append('0');
            while (r % 10 == 0) r /= 10;
            sb.append(r);
        }
    }

    /** `d`: la salida del motor (cabecera + manos); `n`: cuántas manos */
    public static String armar(StringBuilder sb, int cuadro, float[] d, int n, boolean liviano) {
        sb.setLength(0);
        sb.append(cuadro).append(',');
        num(sb, d[3]); sb.append(',');
        sb.append(liviano ? 1 : 0).append(',').append(d[8] > 0.5f ? 1 : 0).append(',').append(n);
        for (int k = 0; k < n; k++) {
            int o = CABECERA + k * POR_MANO;
            for (int i = 0; i < POR_MANO; i++) { sb.append(','); num(sb, d[o + i]); }
        }
        return sb.toString();
    }
}
