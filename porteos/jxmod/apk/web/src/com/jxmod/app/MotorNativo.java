package com.jxmod.app;

/**
 * JX Motor (libjxmotor.so, porteos/jxmod/motor/android): el motor de dibujo nativo en Rust. Tiene su propio hilo con EGL
 * y dibuja en la superficie que le pasa MotorJX (atrás del WebView). Todo lo que llega del juego es texto en base64, tal
 * cual sale de la puerta de JavaScript: lo decodifica Rust.
 */
final class MotorNativo {
    static native long crear();
    /** la superficie nueva, o null cuando se destruye (espera a que el hilo de dibujo la suelte) */
    static native void superficie(long m, Object surface);
    static native void recursos(long m, String b64);
    static native void cuadro(long m, String b64);
    static native void vaciar(long m);
    static native void quitar(long m, String b64);
    /** «alto», «celular» o «bajo»; escala de la escena (0: la del perfil) */
    static native void opciones(long m, String perfil, float escala);
    static native String estado(long m);
    static native void soltar(long m);
}
