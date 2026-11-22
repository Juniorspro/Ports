package com.jxapps.jxhand;

import java.nio.ByteBuffer;

/**
 * El motor de manos en Rust (libjxhand.so, motor/src/android.rs). Lo usan la app JX Hand y JXMod (por eso está en
 * porteos/jxhand/java/, aparte: los dos armados lo compilan). Todo lo pesado pasa ahí: el cuadro de la cámara
 * entra tal cual (los tres planos YUV, sin copiar) y sale la imagen derecha para mostrar y los datos de cada mano.
 *
 * Salida (floats, orden nativo): 10 de cabecera [manos, corrió el detector, inferencias, ms del motor, ms de pasar el
 * cuadro, brillo medio, cuánto se aclaró, hilos, cuentas en float16 (1/0), libre] y después POR_MANO por mano:
 *   0 id · 1 derecha (1/0) · 2 presencia · 3 calibrada · 4..7 posición (m) · 7..11 rotación (cuaternión) · 11..14 normal
 *   · 14..77 puntos en la imagen (21 × x, y en 0..1, z) · 77..140 puntos en metros (21 × 3) · 140..160 ángulos (5 dedos ×
 *   base, apertura, media, punta) · 160..165 cierre de cada dedo · 165 pinza · 166 agarre · 167 dedos estirados
 *   · 168 gesto · 169 fuerza del gesto · 170..174 cuadrado (cx, cy, lado, ángulo) · 174, 175 ancho y alto de la imagen
 */
public final class Motor {
    private static boolean cargada;
    private static String errorCarga = "";

    /**
     * carga libjxhand.so una vez: con `ruta` null, la de la APK (lib/<abi>/, la app JX Hand); con una ruta, ese archivo
     * (JXMod la lleva adentro de la APK como archivo y la carga sólo en los celulares de 64 bits). Devuelve si quedó
     * cargada; si no, errorCarga() dice por qué.
     */
    public static synchronized boolean cargar(String ruta) {
        if (cargada) return true;
        try {
            if (ruta == null) System.loadLibrary("jxhand"); else System.load(ruta);
            cargada = true;
        } catch (Throwable t) { errorCarga = String.valueOf(t); }
        return cargada;
    }
    public static synchronized boolean cargada() { return cargada; }
    public static synchronized String errorCarga() { return errorCarga; }

    /**
     * la cabecera de la salida: manos, corrió el detector en el cuadro, inferencias, ms del motor, ms de YUV, brillo,
     * ganancia, hilos, float16, núcleos grandes, ms del recorte, ms de la red de puntos, ms del detector, núcleos chicos,
     * producto punto de 8 bits, 0
     */
    public static final int CABECERA = 16, POR_MANO = 176;
    /** HILOS_MENOS: los núcleos grandes menos éstos (entre 2 y 3), para dejarle núcleos a un juego */
    public static final int MAX_MANOS = 0, PRESENCIA = 1, PALMA = 2, BUSCAR_MS = 3, PREDICCION_MS = 4, FOV = 5,
        IMG_MIN_CORTE = 6, IMG_BETA = 7, ANG_MIN_CORTE = 8, ANG_BETA = 9, LIVIANO = 10, POCA_LUZ = 11, HILOS = 12, REINICIAR = 13, FLOAT16 = 14, HILOS_MENOS = 15, PERFIL = 16, BUSCAR_CADA = 17;

    /** carga los modelos (ByteBuffers directos); 0 si falló (ver error()) */
    public static native long crear(ByteBuffer detector, ByteBuffer completo, ByteBuffer liviano);
    public static native String error();
    /** con PERFIL prendido: lo que tarda cada tipo de capa de la red de los puntos desde la última vez («red 2.1 ms: c1x1 1.30 · …»), o "" */
    public static native String perfil(long m);
    public static native void soltar(long m);
    public static native void config(long m, int clave, float valor);
    /**
     * procesa un cuadro: los planos de Camera2 (YUV_420_888), cuánto girarlo (grados, horario) y si espejarlo; deja la
     * salida en `salida` y, si `vista` no es null, la imagen RGBA derecha (la misma que miró el motor), aclarada si
     * `noche`. Devuelve cuántas manos hay (−1 si el cuadro venía mal).
     */
    public static native int procesar(long m, ByteBuffer y, ByteBuffer u, ByteBuffer v, int ancho, int alto, int filaY, int filaUV, int pasoUV,
                                      int rotacion, boolean espejo, long tiempoNs, ByteBuffer salida, ByteBuffer vista, boolean noche);
    /**
     * dibuja el último cuadro con OpenGL ES (con el contexto activo en este hilo): la imagen y la mano en 3D que recubre
     * cada mano. estilo: 0 cristal · 1 piel · 2 robot · 3 esqueleto. Devuelve −1 si no se pudo (ver error()).
     */
    public static native int dibujar(long m, int ancho, int alto, int estilo, float grosor, float tiempo);
    /** el contexto de OpenGL se va (borrar = true si todavía está activo) */
    public static native void soltarEscena(long m, boolean borrar);
    public static final String[] ESTILOS = {"Cristal", "Piel", "Robot", "Esqueleto"};
}
