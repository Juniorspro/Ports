package com.stickerazo.app;

/** Lo que la app le pide a los anuncios (Anuncios.java, con AdMob). Si el APK se armó sin anuncios, no hay. */
interface Publicidad {
    void arrancar();
    /** el banner de abajo: sí o no (no mientras recortás o editás) */
    void banner(boolean si);
    /** una pausa natural (agregaste un pack a WhatsApp, publicaste): un anuncio de pantalla completa, si ya pasó un rato */
    void intersticial();
    /** ¿la ley de su país pide un botón para cambiar el consentimiento de los anuncios? (Europa, Reino Unido…) */
    boolean pideOpciones();
    void opciones();
    void pausa();
    void sigue();
    void fin();
}
