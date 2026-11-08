// Prueba que el cifrado del APK (herramientas/cifrar_apk.py, Python) y el descifrado del juego (Cifrado.java, Java) usan la
// misma llave y el mismo AES-256-CTR: Java descifra un bloque que cifró Python y tiene que dar el texto original, y la
// llave que deriva Java tiene que ser la misma que la de Python. No necesita Android (replica la fórmula de Cifrado.java).
// uso: java PruebaCifrado cert_sha_hex secreto_hex blob.bin plano.bin
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class PruebaCifrado {
    static final byte[] ETIQUETA = "JXMOD-ANDROID-WWW-v1".getBytes();
    static final byte[] MAGIA = {'J', 'X', 'E', 'N', 'C', '1', 0, 0};

    static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
        return b;
    }
    static String hex(byte[] b) {
        StringBuilder s = new StringBuilder();
        for (byte x : b) s.append(String.format("%02x", x & 255));
        return s.toString();
    }

    public static void main(String[] a) throws Exception {
        byte[] certSha = hex(a[0]), secreto = hex(a[1]);
        byte[] blob = Files.readAllBytes(Paths.get(a[2])), plano = Files.readAllBytes(Paths.get(a[3]));
        // 1) la llave: SHA-256(ETIQUETA || huella de la firma || secreto) — igual que cifrar_apk.clave_aes y Cifrado.clave
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        md.update(ETIQUETA); md.update(certSha); md.update(secreto);
        byte[] key = md.digest();
        // 2) descifrar el bloque cifrado por Python (magia 8 + iv 16 + cifrado)
        for (int i = 0; i < 8; i++) if (blob[i] != MAGIA[i]) { System.out.println("FALLA: sin la marca JXENC1"); System.exit(1); }
        Cipher c = Cipher.getInstance("AES/CTR/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(blob, 8, 16));
        byte[] claro = c.doFinal(Arrays.copyOfRange(blob, 24, blob.length));
        if (!Arrays.equals(claro, plano)) { System.out.println("FALLA: el descifrado no coincide (" + claro.length + " vs " + plano.length + ")"); System.exit(1); }
        System.out.println("OK clave=" + hex(key) + " · descifrado " + claro.length + " bytes igual al original");
    }
}
