package com.stickerazo.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;

/** Lo que lee WhatsApp para agregar un pack (el contrato de su ejemplo oficial de stickers):
 *  <ul><li>{@code metadata}: todos los packs; {@code metadata/<id>}: uno.</li>
 *  <li>{@code stickers/<id>}: los stickers del pack (archivo y emojis).</li>
 *  <li>{@code stickers_asset/<id>/<archivo>}: cada WebP y el ícono.</li></ul>
 *  Sólo WhatsApp lo puede leer (permiso com.whatsapp.sticker.READ en el manifiesto). Corre aunque la app esté cerrada. */
public final class Stickers extends ContentProvider {
    public static final String AUTORIDAD = "com.stickerazo.app.stickers";
    private Almacen almacen;

    @Override public boolean onCreate() {
        almacen = new Almacen(getContext().getFilesDir());
        return true;
    }

    @Override public Cursor query(Uri uri, String[] proyeccion, String seleccion, String[] args, String orden) {
        List<String> s = uri.getPathSegments();
        if (!s.isEmpty() && "metadata".equals(s.get(0)) && s.size() <= 2) {
            MatrixCursor c = new MatrixCursor(Almacen.COLUMNAS_PACK);
            for (Almacen.Pack p : almacen.packs()) if (s.size() == 1 || p.id.equals(s.get(1))) c.addRow(Almacen.filaPack(p, Almacen.TIENDA, Almacen.POLITICA));
            c.setNotificationUri(getContext().getContentResolver(), uri);
            return c;
        }
        if (s.size() == 2 && "stickers".equals(s.get(0))) {
            MatrixCursor c = new MatrixCursor(Almacen.COLUMNAS_STICKER);
            Almacen.Pack p = almacen.pack(s.get(1));
            if (p != null) for (Almacen.Sticker st : p.stickers) c.addRow(Almacen.filaSticker(st));
            c.setNotificationUri(getContext().getContentResolver(), uri);
            return c;
        }
        throw new IllegalArgumentException("dirección desconocida: " + uri);
    }

    @Override public AssetFileDescriptor openAssetFile(Uri uri, String modo) throws FileNotFoundException {
        List<String> s = uri.getPathSegments();
        if (s.size() != 3 || !"stickers_asset".equals(s.get(0))) throw new IllegalArgumentException("dirección desconocida: " + uri);
        File f = almacen.archivo(s.get(1), s.get(2));
        if (f == null || !f.isFile()) throw new FileNotFoundException(uri.toString());
        return new AssetFileDescriptor(ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY), 0, AssetFileDescriptor.UNKNOWN_LENGTH);
    }

    @Override public String getType(Uri uri) {
        List<String> s = uri.getPathSegments();
        if (s.size() == 1 && "metadata".equals(s.get(0))) return "vnd.android.cursor.dir/vnd." + AUTORIDAD + ".metadata";
        if (s.size() == 2 && "metadata".equals(s.get(0))) return "vnd.android.cursor.item/vnd." + AUTORIDAD + ".metadata";
        if (s.size() == 2 && "stickers".equals(s.get(0))) return "vnd.android.cursor.dir/vnd." + AUTORIDAD + ".stickers";
        if (s.size() == 3 && "stickers_asset".equals(s.get(0))) return s.get(2).endsWith(".png") ? "image/png" : "image/webp";
        return null;
    }

    @Override public Uri insert(Uri uri, ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String sel, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues v, String sel, String[] args) { throw new UnsupportedOperationException(); }
}
