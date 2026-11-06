package com.jxmod.app;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Lo que la app pide por su cuenta (/red/<sitio>/<ruta>, lo sirve Web.java): adónde va cada pedido. Sin nada de Android,
 * para probarlo en la compu (apk/pruebas/unido/PruebaRed.java).
 * El servidor de la tienda del juego (plan gratis de Cloudflare) tiene un tope de pedidos por día; al pasarlo, todo se corta
 * hasta el día siguiente. Los pedazos de los addons de Steam (cientos por addon) y la búsqueda de YouTube no necesitan la
 * tienda: la página no los puede pedir directo (el navegador no deja leer otros sitios sin su permiso), pero la app sí.
 * Sólo estos sitios (y de YouTube, sólo la página de resultados): no es un paso abierto a cualquier lado.
 */
final class Red {
    private Red() {}
    static final Pattern SITIOS = Pattern.compile("^(?:[a-z0-9-]+\\.steamcontent\\.com|[a-z0-9-]+\\.api\\.radio-browser\\.info|www\\.youtube\\.com)$");
    static final String UA_PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    /** Adónde va un pedido /red/<sitio>/<ruta> (la ruta y la consulta como vinieron, codificadas), o null si no se deja. */
    static String destino(String rutaCodificada, String consulta) {
        if (rutaCodificada == null || !rutaCodificada.startsWith("/red/") || rutaCodificada.length() < 6) return null;
        String resto = rutaCodificada.substring(5);
        int i = resto.indexOf('/');
        if (i <= 0) return null;
        String sitio = resto.substring(0, i).toLowerCase(Locale.ROOT), ruta = resto.substring(i);
        String r = ruta.toLowerCase(Locale.ROOT);
        if (!SITIOS.matcher(sitio).matches() || r.contains("..") || r.contains("%2e") || r.contains("%2f") || r.contains("@") || r.contains("\\")) return null;
        if (sitio.equals("www.youtube.com") && !ruta.equals("/results")) return null;
        return "https://" + sitio + ruta + (consulta != null && !consulta.isEmpty() ? "?" + consulta : "");
    }
}
