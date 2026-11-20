package com.stickerazo.app;

import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** La foto elegida, lista para la página: derecha (según la orientación que guardó la cámara), achicada a 1600 px de
 *  lado como mucho y en JPEG (o PNG si tiene transparencia). Así la página abre cualquier cosa que abra Android
 *  (HEIC de los iPhone y Samsung, por ejemplo, que el navegador no abre). */
final class Imagen {
    static final int MAX = 1600;

    private Imagen() {}

    /** convierte y devuelve el nombre del archivo (en Fotos.carpeta) */
    static String preparar(ContentResolver cr, Uri origen, File carpeta, String base) throws IOException {
        Bitmap b = Build.VERSION.SDK_INT >= 28 ? conDecoder(cr, origen) : conFactory(cr, origen);
        if (b == null) throw new IOException("no se pudo leer la imagen");
        boolean png = b.hasAlpha();
        String nombre = base + (png ? ".png" : ".jpg");
        File f = new File(carpeta, nombre), t = new File(carpeta, nombre + ".tmp");
        FileOutputStream o = new FileOutputStream(t);
        try { b.compress(png ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG, 92, o); } finally { o.close(); b.recycle(); }
        if (!t.renameTo(f)) { f.delete(); if (!t.renameTo(f)) throw new IOException("no se pudo guardar"); }
        return nombre;
    }

    // Android 9+: ImageDecoder ya la pone derecha y lee HEIC
    private static Bitmap conDecoder(ContentResolver cr, Uri origen) throws IOException {
        ImageDecoder.Source s = ImageDecoder.createSource(cr, origen);
        return ImageDecoder.decodeBitmap(s, new ImageDecoder.OnHeaderDecodedListener() {
            @Override public void onHeaderDecoded(ImageDecoder d, ImageDecoder.ImageInfo info, ImageDecoder.Source src) {
                int w = info.getSize().getWidth(), h = info.getSize().getHeight();
                float k = Math.min(1f, MAX / (float) Math.max(w, h));
                if (k < 1f) d.setTargetSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
                d.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            }
        });
    }

    // Android 7 y 8: BitmapFactory (achicando de a potencias de 2) y la orientación a mano
    private static Bitmap conFactory(ContentResolver cr, Uri origen) throws IOException {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        InputStream in = cr.openInputStream(origen);
        try { BitmapFactory.decodeStream(in, null, o); } finally { if (in != null) in.close(); }
        if (o.outWidth <= 0 || o.outHeight <= 0) return null;
        int lado = Math.max(o.outWidth, o.outHeight), paso = 1;
        while (lado / (paso * 2) >= MAX) paso *= 2;
        o = new BitmapFactory.Options();
        o.inSampleSize = paso;
        in = cr.openInputStream(origen);
        Bitmap b;
        try { b = BitmapFactory.decodeStream(in, null, o); } finally { if (in != null) in.close(); }
        if (b == null) return null;
        int giro = 0;
        boolean espejo = false;
        in = cr.openInputStream(origen);
        try {
            switch (new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                case ExifInterface.ORIENTATION_ROTATE_90: giro = 90; break;
                case ExifInterface.ORIENTATION_ROTATE_180: giro = 180; break;
                case ExifInterface.ORIENTATION_ROTATE_270: giro = 270; break;
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: espejo = true; break;
                case ExifInterface.ORIENTATION_TRANSPOSE: giro = 90; espejo = true; break;
                case ExifInterface.ORIENTATION_TRANSVERSE: giro = 270; espejo = true; break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: giro = 180; espejo = true; break;
                default: break;
            }
        } catch (IOException | RuntimeException e) { /* sin datos de orientación */ } finally { if (in != null) in.close(); }
        float k = Math.min(1f, MAX / (float) Math.max(b.getWidth(), b.getHeight()));
        if (giro == 0 && !espejo && k >= 1f) return b;
        Matrix m = new Matrix();
        if (k < 1f) m.postScale(k, k);
        if (espejo) m.postScale(-1, 1);
        if (giro != 0) m.postRotate(giro);
        Bitmap r = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), m, true);
        if (r != b) b.recycle();
        return r;
    }
}
