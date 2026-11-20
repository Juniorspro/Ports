package com.stickerazo.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.net.Uri;

import java.util.ArrayList;
import java.util.List;

/** Hablar con WhatsApp (el normal y el Business), como dice su ejemplo oficial de stickers. */
final class WhatsApp {
    static final String NORMAL = "com.whatsapp", NEGOCIOS = "com.whatsapp.w4b";
    static final String AGREGAR = "com.whatsapp.intent.action.ENABLE_STICKER_PACK";

    private WhatsApp() {}

    static List<String> instalados(PackageManager pm) {
        List<String> r = new ArrayList<String>();
        for (String p : new String[] { NORMAL, NEGOCIOS }) {
            try {
                ApplicationInfo i = pm.getApplicationInfo(p, 0);
                if (i.enabled) r.add(p);
            } catch (PackageManager.NameNotFoundException e) { /* no está */ }
        }
        return r;
    }

    /** el pedido para agregar un pack (WhatsApp contesta con el resultado: OK, o cancelado con «validation_error») */
    static Intent agregar(String id, String nombre) {
        Intent i = new Intent(AGREGAR);
        i.putExtra("sticker_pack_id", id);
        i.putExtra("sticker_pack_authority", Stickers.AUTORIDAD);
        i.putExtra("sticker_pack_name", nombre);
        return i;
    }

    /** ¿ya está el pack en todos los WhatsApp instalados? */
    static boolean agregado(Context c, String id) {
        List<String> ps = instalados(c.getPackageManager());
        if (ps.isEmpty()) return false;
        for (String p : ps) if (!enLista(c, p, id)) return false;
        return true;
    }

    private static boolean enLista(Context c, String paquete, String id) {
        String aut = paquete + ".provider.sticker_whitelist_check";
        ProviderInfo pi = c.getPackageManager().resolveContentProvider(aut, PackageManager.GET_META_DATA);
        if (pi == null) return false;
        Uri q = new Uri.Builder().scheme("content").authority(aut).appendPath("is_whitelisted")
                .appendQueryParameter("authority", Stickers.AUTORIDAD).appendQueryParameter("identifier", id).build();
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(q, null, null, null, null);
            return cur != null && cur.moveToFirst() && cur.getInt(cur.getColumnIndexOrThrow("result")) == 1;
        } catch (RuntimeException e) {
            return false;
        } finally { if (cur != null) cur.close(); }
    }
}
