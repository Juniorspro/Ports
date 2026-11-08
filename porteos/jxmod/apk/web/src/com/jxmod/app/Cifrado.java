package com.jxmod.app;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.security.MessageDigest;

import javax.crypto.Cipher;
import javax.crypto.CipherInputStream;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

// Descifra los activos del APK (index.html y pk.bin) que herramientas/cifrar_apk.py cifró al armar. La llave NO es una
// cadena guardada: sale de la firma del APK + un secreto partido en Llave.java (compilado al .dex):
//   llave = SHA-256( ETIQUETA || SHA-256(certificado de firma) || Llave.secreto() )
// Si alguien modifica el APK y lo vuelve a firmar, la huella del certificado cambia, la llave cambia y los activos ya no
// se descifran: el juego no abre. Es lo mismo que calcula cifrar_apk.py (Python) y PruebaCifrado.java (prueba).
final class Cifrado {
    private static final byte[] MAGIA = {'J', 'X', 'E', 'N', 'C', '1', 0, 0};   // 8 bytes; después: iv (16) + cifrado
    private static final byte[] ETIQUETA = {'J', 'X', 'M', 'O', 'D', '-', 'A', 'N', 'D', 'R', 'O', 'I', 'D', '-', 'W', 'W', 'W', '-', 'v', '1'};
    private static byte[] llave;          // se calcula una vez
    private static byte[] firmaReal;      // la huella de la firma de esta copia (para avisar si es trucha)

    private Cifrado() {}

    /** SHA-256 del certificado de firma del APK (la misma huella que usa cifrar_apk.py). */
    static synchronized byte[] firma(Context ctx) {
        if (firmaReal != null) return firmaReal;
        try {
            PackageManager pm = ctx.getPackageManager();
            String pkg = ctx.getPackageName();
            Signature[] sigs;
            if (Build.VERSION.SDK_INT >= 28) {
                PackageInfo pi = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES);
                sigs = pi.signingInfo != null ? pi.signingInfo.getApkContentsSigners() : null;
            } else {
                PackageInfo pi = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES);
                sigs = pi.signatures;
            }
            if (sigs == null || sigs.length == 0) return (firmaReal = new byte[32]);
            firmaReal = MessageDigest.getInstance("SHA-256").digest(sigs[0].toByteArray());
        } catch (Exception e) {
            firmaReal = new byte[32];
        }
        return firmaReal;
    }

    /** La llave AES-256 de los activos del APK. */
    static synchronized byte[] clave(Context ctx) {
        if (llave != null) return llave;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(ETIQUETA);
            md.update(firma(ctx));
            md.update(Llave.secreto());
            llave = md.digest();
        } catch (Exception e) {
            llave = new byte[32];
        }
        return llave;
    }

    /** ¿La firma de esta copia es la oficial (la que armó el juego)? Para avisar «copia no oficial» con cara linda. */
    static boolean oficial(Context ctx) {
        return MessageDigest.isEqual(firma(ctx), Llave.FIRMA);
    }

    /** Envuelve el flujo de un activo: si está cifrado (empieza con la marca) lo descifra al vuelo; si no, lo deja igual. */
    static InputStream abrir(InputStream in, byte[] key) throws IOException {
        byte[] cab = new byte[24];
        int n = 0;
        while (n < 24) { int r = in.read(cab, n, 24 - n); if (r < 0) break; n += r; }
        boolean cif = n >= 24;
        if (cif) for (int i = 0; i < 8; i++) if (cab[i] != MAGIA[i]) { cif = false; break; }
        if (cif) {
            try {
                Cipher c = Cipher.getInstance("AES/CTR/NoPadding");
                c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(cab, 8, 16));
                return new CipherInputStream(in, c);   // 'in' ya quedó justo después de la cabecera (24 bytes)
            } catch (Exception e) {
                throw new IOException("descifrado", e);
            }
        }
        // no estaba cifrado: devolver los bytes que ya leímos y después el resto
        return new SequenceInputStream(new ByteArrayInputStream(cab, 0, Math.max(n, 0)), in);
    }
}
