package com.jxapps.jxhand;

import java.nio.ByteBuffer;

/**
 * El motor de manos en Rust (libjxhand.so, motor/src/android.rs). Todo lo pesado pasa ahí: el cuadro de la cámara
 * entra tal cual (los tres planos YUV, sin copiar) y sale la imagen derecha para mostrar y los datos de cada mano.
 *
 * Salida (floats, orden nativo): 8 de cabecera [manos, corrió el detector, inferencias, ms del motor, ms de pasar el
 * cuadro, brillo medio, cuánto se aclaró, hilos] y después POR_MANO por mano:
 *   0 id · 1 derecha (1/0) · 2 presencia · 3 calibrada · 4..7 posición (m) · 7..11 rotación (cuaternión) · 11..14 normal
 *   · 14..77 puntos en la imagen (21 × x, y en 0..1, z) · 77..140 puntos en metros (21 × 3) · 140..160 ángulos (5 dedos ×
 *   base, apertura, media, punta) · 160..165 cierre de cada dedo · 165 pinza · 166 agarre · 167 dedos estirados
 *   · 168 gesto · 169 fuerza del gesto · 170..174 cuadrado (cx, cy, lado, ángulo) · 174, 175 ancho y alto de la imagen
 */
public final class Motor {
    static { System.loadLibrary("jxhand"); }

    public static final int CABECERA = 8, POR_MANO = 176;
    public static final int MAX_MANOS = 0, PRESENCIA = 1, PALMA = 2, BUSCAR_MS = 3, PREDICCION_MS = 4, FOV = 5,
        IMG_MIN_CORTE = 6, IMG_BETA = 7, ANG_MIN_CORTE = 8, ANG_BETA = 9, LIVIANO = 10, POCA_LUZ = 11, HILOS = 12, REINICIAR = 13;

    /** carga los modelos (ByteBuffers directos); 0 si falló (ver error()) */
    public static native long crear(ByteBuffer detector, ByteBuffer completo, ByteBuffer liviano);
    public static native String error();
    public static native void soltar(long m);
    public static native void config(long m, int clave, float valor);
    /**
     * procesa un cuadro: los planos de Camera2 (YUV_420_888), cuánto girarlo (grados, horario) y si espejarlo; deja la
     * salida en `salida` y, si `vista` no es null, la imagen RGBA derecha (la misma que miró el motor), aclarada si
     * `noche`. Devuelve cuántas manos hay (−1 si el cuadro venía mal).
     */
    public static native int procesar(long m, ByteBuffer y, ByteBuffer u, ByteBuffer v, int ancho, int alto, int filaY, int filaUV, int pasoUV,
                                      int rotacion, boolean espejo, long tiempoNs, ByteBuffer salida, ByteBuffer vista, boolean noche);
}
