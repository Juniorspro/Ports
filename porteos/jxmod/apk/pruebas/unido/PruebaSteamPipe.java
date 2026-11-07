import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

// SteamPipe.java contra Steam de verdad: la app entra anónima al WebSocket de Steam, pide la clave del depósito de los
// addons de GMod y el código del manifiesto, y con eso baja el manifiesto y un pedazo del CDN y los descifra (si la clave
// o el código estuvieran mal, el CDN contesta 401/403 o el descifrado da basura). Sin la tienda.
// uso: javac -d X apk/web/src/com/jxmod/app/SteamPipe.java PruebaSteamPipe.java && java -cp X PruebaSteamPipe
public class PruebaSteamPipe {
    static int ok = 0, mal = 0;
    static void ver(String n, boolean c, String d) { if (c) ok++; else mal++; System.out.println((c ? "OK    " : "FALLA ") + n + (d != null ? " · " + d : "")); }

    public static void main(String[] a) throws Exception {
        Class<?> S = Class.forName("com.jxmod.app.SteamPipe");
        Method acceso = S.getDeclaredMethod("acceso", String.class), det = S.getDeclaredMethod("detallesJson", String.class);
        acceso.setAccessible(true); det.setAccessible(true);
        Class<?> R = Class.forName("com.jxmod.app.SteamPipe$Resp");
        Field fe = R.getDeclaredField("estado"), fc = R.getDeclaredField("cuerpo"); fe.setAccessible(true); fc.setAccessible(true);

        // ---- lo que no tiene que llegar a Steam ----
        for (String x : new String[] { null, "", "abc", "12", "1234567890123", "1560118657/../x", "-1" }) {
            Object r = acceso.invoke(null, x);
            ver("no deja el id " + x, fe.getInt(r) == 400, null);
        }
        for (String x : new String[] { null, "", "1,", ",1", "1560118657;x", "1560118657, 2817418767" }) {
            Object r = det.invoke(null, x);
            ver("no deja los ids «" + x + "»", fe.getInt(r) == 400, null);
        }

        // ---- un addon que existe: DrGBase (el que no se podía bajar), y otro más chico ----
        String[] ids = a.length > 0 ? a : new String[] { "1560118657", "131759821" };
        for (String wid : ids) {
            long t0 = System.nanoTime();
            Object r = acceso.invoke(null, wid);
            int st = fe.getInt(r); String j = (String) fc.get(r);
            long ms = (System.nanoTime() - t0) / 1000000;
            ver("acceso " + wid + " contesta 200", st == 200, "HTTP " + st + " en " + ms + " ms" + (st != 200 ? " · " + j : ""));
            if (st != 200) continue;
            String clave = campo(j, "clave"), codigo = campo(j, "codigo"), man = campo(j, "man");
            ver("la clave del depósito son 32 bytes en hex", clave != null && clave.matches("[0-9a-f]{64}"), clave == null ? null : clave.substring(0, 6) + "…");
            ver("el código del manifiesto es un número", codigo != null && codigo.matches("\\d{1,20}"), codigo == null ? null : "(" + codigo.length() + " cifras)");
            ver("manifiesto y depósito", man != null && man.matches("\\d{5,20}") && j.contains("\"dep\":4000") && j.contains("\"app\":1"), "man " + man);
            List<String> cdn = new ArrayList<>(); Matcher m = Pattern.compile("\"([a-z0-9.-]+\\.steamcontent\\.com)\"").matcher(j); while (m.find()) cdn.add(m.group(1));
            ver("servidores del CDN", !cdn.isEmpty(), cdn.size() + " (" + (cdn.isEmpty() ? "" : cdn.get(0)) + ")");
            if (clave == null || codigo == null || cdn.isEmpty()) continue;

            // el manifiesto con el código (sin código, o con uno malo, el CDN no lo da)
            byte[] zip = null; String host = null; int stm = 0;
            for (String h : cdn) { host = h; HttpURLConnection c = (HttpURLConnection) new URL("https://" + h + "/depot/4000/manifest/" + man + "/5" + ("0".equals(codigo) ? "" : "/" + codigo)).openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(30000); stm = c.getResponseCode(); if (stm == 200) { zip = leer(c.getInputStream()); break; } }
            ver("el CDN da el manifiesto con ese código", zip != null && zip.length > 30 && zip[0] == 'P' && zip[1] == 'K', "HTTP " + stm + " de " + host + (zip != null ? ", " + zip.length + " bytes" : ""));
            if (zip == null) continue;
            byte[] K = hexA(clave), b = unzip(zip);
            // (la carga: magia 0x71F617D0; los metadatos: 0x1F4812BE —campo 4: nombres cifrados—)
            byte[] carga = null, meta = null;
            for (int i = 0; i + 8 <= b.length;) { int mg = le32(b, i), n = le32(b, i + 4); if (mg == 0x32c415ab || n < 0 || i + 8 + n > b.length) break; byte[] d = new byte[n]; System.arraycopy(b, i + 8, d, 0, n); if (mg == 0x71f617d0) carga = d; else if (mg == 0x1f4812be) meta = d; i += 8 + n; }
            ver("el manifiesto trae los archivos", carga != null, carga == null ? null : carga.length + " bytes");
            if (carga == null) continue;
            boolean cifrados = meta != null && pb(meta).containsKey(4) && ((Long) pb(meta).get(4).get(0)) != 0;
            String mejor = null; long tam = -1; List<byte[]> pedazos = null;
            for (Object o : pb(carga).getOrDefault(1, new ArrayList<>())) {
                Map<Integer, List<Object>> f = pb((byte[]) o);
                String nom = new String((byte[]) f.get(1).get(0), "UTF-8");
                if (cifrados) { byte[] e = b64(nom.replaceAll("\\s+", "")); nom = new String(descifrar(K, e), "UTF-8").replaceAll("\0+$", ""); }
                long t = f.containsKey(2) ? (Long) f.get(2).get(0) : 0;
                if (f.containsKey(6) && t > tam) { tam = t; mejor = nom; pedazos = new ArrayList<>(); for (Object c : f.get(6)) pedazos.add((byte[]) c); }
            }
            ver("con la clave, los nombres se leen (" + (cifrados ? "venían cifrados" : "no venían cifrados") + ")", mejor != null && mejor.toLowerCase().endsWith(".gma"), mejor + ", " + tam + " bytes, " + (pedazos == null ? 0 : pedazos.size()) + " pedazos");
            if (pedazos == null || pedazos.isEmpty()) continue;
            // un pedazo: el SHA-1 de su contenido es su nombre
            Map<Integer, List<Object>> P = pb(pedazos.get(0));
            String sha = hex((byte[]) P.get(1).get(0));
            HttpURLConnection c = (HttpURLConnection) new URL("https://" + host + "/depot/4000/chunk/" + sha).openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(30000);
            int stc = c.getResponseCode(); byte[] enc = stc == 200 ? leer(c.getInputStream()) : null;
            byte[] dec = enc != null ? descifrar(K, enc) : null;
            String mag = dec == null || dec.length < 4 ? "?" : new String(dec, 0, 4, "ISO-8859-1");
            ver("un pedazo bajado y descifrado con la clave", dec != null && (mag.startsWith("VZa") || mag.equals("VSZa") || mag.startsWith("PK")), "HTTP " + stc + ", " + (enc == null ? 0 : enc.length) + " bytes, empieza con «" + mag.replaceAll("[^\\x20-\\x7e]", ".") + "»");
        }

        // ---- un addon que no existe y los detalles ----
        Object r = acceso.invoke(null, "1");
        ver("un id que no existe", fe.getInt(r) == 400 || fe.getInt(r) == 404, "HTTP " + fe.getInt(r));
        r = acceso.invoke(null, "999999999999");
        ver("un addon que no existe → 404 noExiste", fe.getInt(r) == 404 && ((String) fc.get(r)).contains("noExiste"), "HTTP " + fe.getInt(r) + " · " + fc.get(r));
        r = det.invoke(null, String.join(",", ids));
        String dj = (String) fc.get(r);
        int n = 0; int pi = dj.indexOf("\"publishedfiledetails\""); Matcher mm = Pattern.compile("\"result\"\\s*:\\s*1\\b").matcher(pi < 0 ? "" : dj.substring(pi)); while (mm.find()) n++;
        ver("detalles de " + ids.length + " addons", fe.getInt(r) == 200 && n == ids.length && dj.contains("\"title\""), "HTTP " + fe.getInt(r) + ", " + n + " con result 1, " + dj.length() + " bytes");

        // ---- el contenido base (HL2, CS:S, GMod): el manifiesto público de la app 4020 (PICS) y su índice del .vpk de GMod ----
        Method base = S.getDeclaredMethod("base"); base.setAccessible(true);
        long tb = System.nanoTime(); r = base.invoke(null);
        String bj = (String) fc.get(r);
        ver("contenido base: manifiesto, clave y código", fe.getInt(r) == 200 && campo(bj, "man") != null && campo(bj, "man").matches("\\d{5,20}") && campo(bj, "clave").matches("[0-9a-f]{64}"), "HTTP " + fe.getInt(r) + " en " + (System.nanoTime() - tb) / 1000000 + " ms, man " + campo(bj, "man") + (fe.getInt(r) != 200 ? " · " + bj : ""));
        if (fe.getInt(r) == 200) {
            List<String> cdn = new ArrayList<>(); Matcher m = Pattern.compile("\"([a-z0-9.-]+\\.steamcontent\\.com)\"").matcher(bj); while (m.find()) cdn.add(m.group(1));
            String cod = campo(bj, "codigo"); byte[] zip = null; int stm = 0;
            for (String h : cdn) { HttpURLConnection c = (HttpURLConnection) new URL("https://" + h + "/depot/4021/manifest/" + campo(bj, "man") + "/5" + ("0".equals(cod) ? "" : "/" + cod)).openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(60000); stm = c.getResponseCode(); if (stm == 200) { zip = leer(c.getInputStream()); break; } }
            byte[] K = hexA(campo(bj, "clave")); int nVpk = 0, nArch = 0;
            if (zip != null) {
                byte[] b = unzip(zip); byte[] carga = null;
                for (int i = 0; i + 8 <= b.length;) { int mg = le32(b, i), n2 = le32(b, i + 4); if (mg == 0x32c415ab || n2 < 0 || i + 8 + n2 > b.length) break; if (mg == 0x71f617d0) { carga = new byte[n2]; System.arraycopy(b, i + 8, carga, 0, n2); } i += 8 + n2; }
                if (carga != null) for (Object o : pb(carga).getOrDefault(1, new ArrayList<>())) {
                    Map<Integer, List<Object>> f = pb((byte[]) o); nArch++;
                    String nom = new String((byte[]) f.get(1).get(0), "UTF-8");
                    try { nom = new String(descifrar(K, b64(nom.replaceAll("\\s+", ""))), "UTF-8").replaceAll("\0+$", ""); } catch (Exception e) { /* sin cifrar */ }
                    if (nom.replace('\\', '/').toLowerCase().matches("(garrysmod/garrysmod|sourceengine/hl2_textures)_dir\\.vpk")) nVpk++;
                }
            }
            ver("el manifiesto del contenido base se baja y se lee con la clave", zip != null && nVpk == 2, "HTTP " + stm + ", " + nArch + " archivos, " + nVpk + "/2 índices de .vpk encontrados");
        }

        // ---- los «Required items» de un addon (de su página del Workshop) ----
        Method req = S.getDeclaredMethod("requeridos", String.class); req.setAccessible(true);
        r = req.invoke(null, "2958478574");   // (un nextbot de DrGBase: pide la base)
        String rj = (String) fc.get(r);
        ver("Required items de la página", fe.getInt(r) == 200 && rj.startsWith("{\"ids\":["), "HTTP " + fe.getInt(r) + " · " + rj);
        ver("no deja un id malo en requeridos", fe.getInt(req.invoke(null, "x")) == 400, null);

        // ---- la segunda vez no vuelve a entrar a Steam (el código queda 4 minutos) ----
        long t0 = System.nanoTime(); r = acceso.invoke(null, ids[0]);
        long ms = (System.nanoTime() - t0) / 1000000;
        ver("la segunda vez usa lo guardado (sin WebSocket)", fe.getInt(r) == 200 && ms < 5000, ms + " ms");

        System.out.println("\n" + ok + " bien, " + mal + " mal");
        System.exit(mal == 0 ? 0 : 1);
    }

    static String campo(String j, String k) { Matcher m = Pattern.compile("\"" + k + "\"\\s*:\\s*\"?([^\",}]*)\"?").matcher(j); return m.find() ? m.group(1) : null; }
    static byte[] leer(InputStream in) throws Exception { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int k; while ((k = in.read(b)) > 0) o.write(b, 0, k); in.close(); return o.toByteArray(); }
    static byte[] unzip(byte[] z) throws Exception { try (ZipInputStream zi = new ZipInputStream(new ByteArrayInputStream(z))) { ZipEntry e = zi.getNextEntry(); if (e == null) throw new Exception("zip vacío"); return leer(zi); } }
    static int le32(byte[] b, int i) { return (b[i] & 0xff) | ((b[i + 1] & 0xff) << 8) | ((b[i + 2] & 0xff) << 16) | ((b[i + 3] & 0xff) << 24); }
    static byte[] hexA(String s) { byte[] o = new byte[s.length() / 2]; for (int i = 0; i < o.length; i++) o[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16); return o; }
    static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x & 0xff)); return s.toString(); }
    static byte[] b64(String s) { return java.util.Base64.getDecoder().decode(s); }
    // (el IV, cifrado en ECB en los primeros 16 bytes; el resto en CBC con PKCS7)
    static byte[] descifrar(byte[] K, byte[] b) throws Exception {
        SecretKeySpec k = new SecretKeySpec(K, "AES");
        Cipher e = Cipher.getInstance("AES/ECB/NoPadding"); e.init(Cipher.DECRYPT_MODE, k);
        byte[] iv = e.doFinal(b, 0, 16);
        Cipher c = Cipher.getInstance("AES/CBC/PKCS5Padding"); c.init(Cipher.DECRYPT_MODE, k, new IvParameterSpec(iv));
        return c.doFinal(b, 16, b.length - 16);
    }
    // protobuf: campo → lista de valores (varint/fixed como Long, bytes como byte[])
    static Map<Integer, List<Object>> pb(byte[] b) {
        Map<Integer, List<Object>> m = new HashMap<>(); int[] i = { 0 };
        while (i[0] < b.length) {
            long k = var(b, i); int f = (int) (k >>> 3), t = (int) (k & 7); Object v;
            if (t == 0) v = var(b, i);
            else if (t == 1) { long x = 0; for (int j = 7; j >= 0; j--) x = (x << 8) | (b[i[0] + j] & 0xffL); i[0] += 8; v = x; }
            else if (t == 2) { int n = (int) var(b, i); byte[] c = new byte[n]; System.arraycopy(b, i[0], c, 0, n); i[0] += n; v = c; }
            else if (t == 5) { v = (long) le32(b, i[0]) & 0xffffffffL; i[0] += 4; }
            else break;
            m.computeIfAbsent(f, x -> new ArrayList<>()).add(v);
        }
        return m;
    }
    static long var(byte[] b, int[] i) { long r = 0; int s = 0; while (i[0] < b.length) { int x = b[i[0]++] & 0xff; r |= (long) (x & 0x7f) << s; if ((x & 0x80) == 0) return r; s += 7; } return r; }
}
