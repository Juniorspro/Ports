package com.stickerazo.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.regex.Pattern;

/** Las fotos de paso (en la caché): la que saca la cámara (le damos permiso de escribir esta dirección) y la que ya
 *  convertimos para la página (JPEG o PNG derecho y achicado). No es pública: sólo se presta con permiso por foto. */
public final class Fotos extends ContentProvider {
    static final String AUTORIDAD = "com.stickerazo.app.fotos";
    private static final Pattern NOMBRE = Pattern.compile("[a-z0-9_]{1,48}\\.(jpg|png|mp4|webm)");

    static File carpeta(Context c) {
        File d = new File(c.getCacheDir(), "fotos");
        d.mkdirs();
        return d;
    }

    static Uri uri(String nombre) { return new Uri.Builder().scheme("content").authority(AUTORIDAD).appendPath(nombre).build(); }

    private File archivo(Uri uri) throws FileNotFoundException {
        String n = uri.getLastPathSegment();
        if (n == null || !NOMBRE.matcher(n).matches() || uri.getPathSegments().size() != 1) throw new FileNotFoundException(String.valueOf(uri));
        return new File(carpeta(getContext()), n);
    }

    @Override public boolean onCreate() { return true; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String modo) throws FileNotFoundException {
        File f = archivo(uri);
        int m = modo.contains("w") ? ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE
                                   : ParcelFileDescriptor.MODE_READ_ONLY;
        return ParcelFileDescriptor.open(f, m);
    }

    @Override public Cursor query(Uri uri, String[] proyeccion, String sel, String[] args, String orden) {
        File f;
        try { f = archivo(uri); } catch (FileNotFoundException e) { return null; }
        MatrixCursor c = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
        c.addRow(new Object[] { f.getName(), f.length() });
        return c;
    }

    @Override public String getType(Uri uri) {
        String n = uri.getLastPathSegment();
        if (n != null && n.endsWith(".mp4")) return "video/mp4";
        if (n != null && n.endsWith(".webm")) return "video/webm";
        return n != null && n.endsWith(".png") ? "image/png" : "image/jpeg";
    }

    @Override public Uri insert(Uri uri, ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String sel, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues v, String sel, String[] args) { throw new UnsupportedOperationException(); }
}
