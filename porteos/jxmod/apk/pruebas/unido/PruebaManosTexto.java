import com.jxmod.app.ManosTexto;

/** ManosTexto: los números (hasta 4 decimales, sin Float.toString) y el texto de un cuadro, como lo lee manos_jx.js */
public class PruebaManosTexto {
    static int ok = 0, total = 0;
    static void ver(String que, String a, String b) { total++; boolean bien = a.equals(b); if (bien) ok++; System.out.println((bien ? "OK    " : "FALLA ") + que + ": " + a + (bien ? "" : " (esperaba " + b + ")")); }
    static String n(float v) { StringBuilder sb = new StringBuilder(); java.lang.reflect.Method m; try { m = ManosTexto.class.getDeclaredMethod("num", StringBuilder.class, float.class); m.setAccessible(true); m.invoke(null, sb, v); } catch (Exception e) { throw new RuntimeException(e); } return sb.toString(); }
    public static void main(String[] a) {
        ver("cero", n(0f), "0"); ver("casi cero negativo", n(-0.00001f), "0"); ver("1,5", n(1.5f), "1.5"); ver("−2,25", n(-2.25f), "-2.25");
        ver("0,0001", n(0.0001f), "0.0001"); ver("0,05", n(0.05f), "0.05"); ver("redondeo", n(123.45678f), "123.4568"); ver("NaN", n(Float.NaN), "0"); ver("infinito", n(Float.POSITIVE_INFINITY), "0");
        float[] d = new float[ManosTexto.CABECERA + 2 * ManosTexto.POR_MANO]; d[3] = 6.25f; d[8] = 1;
        for (int i = 0; i < ManosTexto.POR_MANO; i++) d[ManosTexto.CABECERA + i] = i * 0.5f;
        String t = ManosTexto.armar(new StringBuilder(), 7, d, 1, true);
        String[] p = t.split(",");
        ver("cabecera (cuadro, ms, liviano, float16, manos)", p[0] + "," + p[1] + "," + p[2] + "," + p[3] + "," + p[4], "7,6.25,1,1,1");
        ver("176 números por mano", String.valueOf(p.length - 5), "176");
        ver("el último número de la mano", p[p.length - 1], "87.5");
        System.out.println("RESUMEN " + ok + "/" + total);
    }
}
