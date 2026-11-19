// Las actualizaciones por partes: lo que publica herramientas/ota.py (Python) es lo que acepta la app (Ota.java): la misma
// llave para descifrar, el mismo HMAC, el mismo formato. Además un archivo tocado (un byte) no pasa el HMAC. Sin Android:
// replica la cuenta de Ota.derivar (ETIQUETA || huella de la firma || secreto fijo de las actualizaciones).
// uso: java PruebaOta cert_sha_hex secreto_ota_hex carpeta_ota carpeta_www
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class PruebaOta {
    static byte[] hex(String s) { byte[] b = new byte[s.length() / 2]; for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16); return b; }
    static byte[] derivar(String et, byte[] cert, byte[] sec) throws Exception { MessageDigest md = MessageDigest.getInstance("SHA-256"); md.update(et.getBytes("US-ASCII")); md.update(cert); md.update(sec); return md.digest(); }
    static byte[] hmac(byte[] k, byte[] d) throws Exception { Mac m = Mac.getInstance("HmacSHA256"); m.init(new SecretKeySpec(k, "HmacSHA256")); return m.doFinal(d); }
    public static void main(String[] a) throws Exception {
        byte[] cert = hex(a[0]), sec = hex(a[1]);
        byte[] kc = derivar("JXMOD-ANDROID-OTA-v1", cert, sec), km = derivar("JXMOD-ANDROID-OTA-MAC-v1", cert, sec);
        String man = new String(Files.readAllBytes(Paths.get(a[2], "ota.json")), "UTF-8");
        Matcher m = Pattern.compile("\"n\":\\s*\"([^\"]+)\",\\s*\"h\":\\s*\"([0-9a-f]+)\",\\s*\"t\":\\s*(\\d+),\\s*\"u\":\\s*\"ota/([^\"]+)\",\\s*\"mac\":\\s*\"([0-9a-f]+)\"").matcher(man);
        int bien = 0, mal = 0, n = 0;
        while (m.find()) {
            n++;
            byte[] blob = Files.readAllBytes(Paths.get(a[2], m.group(4))), plano = Files.readAllBytes(Paths.get(a[3], m.group(1)));
            boolean macOk = MessageDigest.isEqual(hmac(km, blob), hex(m.group(5))) && blob.length == Long.parseLong(m.group(3));
            Cipher c = Cipher.getInstance("AES/CTR/NoPadding"); c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(kc, "AES"), new IvParameterSpec(blob, 8, 16));
            byte[] d = c.doFinal(blob, 24, blob.length - 24);
            boolean igual = Arrays.equals(d, plano) && toHex(MessageDigest.getInstance("SHA-256").digest(d)).equals(m.group(2));
            byte[] roto = blob.clone(); roto[roto.length / 2] ^= 1;
            boolean detecta = !MessageDigest.isEqual(hmac(km, roto), hex(m.group(5)));
            boolean ok = macOk && igual && detecta; if (ok) bien++; else mal++;
            System.out.println((ok ? "OK    " : "FALLA ") + m.group(1) + " · HMAC " + macOk + " · descifrado igual " + igual + " · un byte tocado se detecta " + detecta);
        }
        System.out.println("RESUMEN ota " + bien + "/" + n);
        if (mal > 0 || n == 0) System.exit(1);
    }
    static String toHex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x & 255)); return s.toString(); }
}
