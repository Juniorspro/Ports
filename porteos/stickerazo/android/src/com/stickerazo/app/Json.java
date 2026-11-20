package com.stickerazo.app;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Lector de JSON chico (Java puro, para que el almacén se pruebe sin teléfono). Devuelve Map, List, String, Double,
 *  Boolean o null; ante algo mal formado tira IllegalArgumentException. Sólo lee: el JSON lo escribe la página. */
final class Json {
    private static final int HONDO = 64;
    private final String s;
    private int i, hondo;

    private Json(String s) { this.s = s; }

    static Object leer(String s) {
        if (s == null) throw new IllegalArgumentException("vacío");
        Json j = new Json(s);
        j.espacios();
        Object o = j.valor();
        j.espacios();
        if (j.i != s.length()) throw j.mal("sobra algo");
        return o;
    }

    private IllegalArgumentException mal(String que) { return new IllegalArgumentException(que + " en " + i); }

    private void espacios() { while (i < s.length() && " \t\r\n".indexOf(s.charAt(i)) >= 0) i++; }

    private Object valor() {
        if (i >= s.length()) throw mal("terminó antes");
        char c = s.charAt(i);
        if (c == '{') return objeto();
        if (c == '[') return lista();
        if (c == '"') return cadena();
        if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
        if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
        if (s.startsWith("null", i)) { i += 4; return null; }
        return numero();
    }

    private Map<String, Object> objeto() {
        if (++hondo > HONDO) throw mal("demasiado anidado");
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        i++;
        espacios();
        if (i < s.length() && s.charAt(i) == '}') { i++; hondo--; return m; }
        while (true) {
            espacios();
            if (i >= s.length() || s.charAt(i) != '"') throw mal("se esperaba un nombre");
            String k = cadena();
            espacios();
            if (i >= s.length() || s.charAt(i) != ':') throw mal("se esperaba ':'");
            i++;
            espacios();
            m.put(k, valor());
            espacios();
            if (i >= s.length()) throw mal("terminó antes");
            char c = s.charAt(i++);
            if (c == '}') break;
            if (c != ',') throw mal("se esperaba ',' o '}'");
        }
        hondo--;
        return m;
    }

    private List<Object> lista() {
        if (++hondo > HONDO) throw mal("demasiado anidado");
        List<Object> l = new ArrayList<Object>();
        i++;
        espacios();
        if (i < s.length() && s.charAt(i) == ']') { i++; hondo--; return l; }
        while (true) {
            espacios();
            l.add(valor());
            espacios();
            if (i >= s.length()) throw mal("terminó antes");
            char c = s.charAt(i++);
            if (c == ']') break;
            if (c != ',') throw mal("se esperaba ',' o ']'");
        }
        hondo--;
        return l;
    }

    private String cadena() {
        StringBuilder b = new StringBuilder();
        i++;
        while (true) {
            if (i >= s.length()) throw mal("texto sin cerrar");
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c < 0x20) throw mal("carácter de control en un texto");
            if (c != '\\') { b.append(c); continue; }
            if (i >= s.length()) throw mal("texto sin cerrar");
            char e = s.charAt(i++);
            switch (e) {
                case '"': b.append('"'); break;
                case '\\': b.append('\\'); break;
                case '/': b.append('/'); break;
                case 'b': b.append('\b'); break;
                case 'f': b.append('\f'); break;
                case 'n': b.append('\n'); break;
                case 'r': b.append('\r'); break;
                case 't': b.append('\t'); break;
                case 'u':
                    if (i + 4 > s.length()) throw mal("\\u cortado");
                    try { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); } catch (NumberFormatException x) { throw mal("\\u mal"); }
                    i += 4;
                    break;
                default: throw mal("escape desconocido");
            }
        }
    }

    private Double numero() {
        int a = i;
        while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        if (a == i) throw mal("valor desconocido");
        try { return Double.valueOf(s.substring(a, i)); } catch (NumberFormatException x) { throw mal("número mal"); }
    }
}
