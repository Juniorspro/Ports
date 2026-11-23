package com.jxmod.nativo;

import android.app.AlertDialog;
import android.app.NativeActivity;
import android.content.DialogInterface;
import android.os.Build;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.TextView;

/**
 * JXMod nativo: el juego entero es la biblioteca de Rust (libjxmod.so, NativeActivity). Esta clase sólo pide la pantalla
 * completa de verdad (sin las barras de Android, también debajo del recorte de la cámara), cosa que desde el hilo del
 * juego no se puede: Android exige hacerlo en el hilo de la interfaz. Y el cuadro para escribir (el chat, la contraseña de
 * una sala, el nombre, la actitud de un NPC): un diálogo con un EditText, que anda con cualquier teclado (una NativeActivity
 * sola no recibe bien el texto de los teclados de pantalla). Lo pide Rust por JNI (pedirTexto) y lo levanta cada cuadro
 * (tomarEscrito).
 */
public class Juego extends NativeActivity {
    @Override protected void onCreate(Bundle b) {
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        super.onCreate(b);
        completa();
    }

    @Override public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        if (foco) completa();
    }

    /** lo último que se escribió: "id\n1texto" (aceptado) o "id\n0" (cancelado); null si no hay nada */
    private static String escrito = null;
    private static synchronized void entregar(int id, String t) { escrito = id + "\n" + (t == null ? "0" : "1" + t); }
    /** (Rust, cada cuadro mientras espera) lo escrito, una vez */
    public static synchronized String tomarEscrito() { String t = escrito; escrito = null; return t; }

    /** (Rust) el cuadro para escribir: título, lo que ya hay, hasta cuántas letras y si es una contraseña */
    public void pedirTexto(final int id, final String titulo, final String inicial, final int max, final boolean clave) {
        runOnUiThread(new Runnable() { @Override public void run() {
            final EditText e = new EditText(Juego.this);
            e.setSingleLine(true); e.setText(inicial); e.setSelection(inicial.length());
            e.setFilters(new InputFilter[] { new InputFilter.LengthFilter(Math.max(1, max)) });
            e.setInputType(clave ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            e.setImeOptions(EditorInfo.IME_ACTION_DONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
            final boolean[] listo = { false };
            final AlertDialog d = new AlertDialog.Builder(Juego.this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle(titulo).setView(e)
                .setPositiveButton("Listo", new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface x, int w) { if (!listo[0]) { listo[0] = true; entregar(id, e.getText().toString()); } } })
                .setNegativeButton("Cancelar", new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface x, int w) { if (!listo[0]) { listo[0] = true; entregar(id, null); } } })
                .create();
            d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface x) { if (!listo[0]) { listo[0] = true; entregar(id, null); } completa(); } });
            // (el «listo» del teclado acepta)
            e.setOnEditorActionListener(new TextView.OnEditorActionListener() { @Override public boolean onEditorAction(TextView v, int a, KeyEvent k) {
                if (a == EditorInfo.IME_ACTION_DONE || (k != null && k.getKeyCode() == KeyEvent.KEYCODE_ENTER)) { if (!listo[0]) { listo[0] = true; entregar(id, e.getText().toString()); } d.dismiss(); return true; }
                return false; } });
            Window w = d.getWindow(); if (w != null) w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
            d.show(); e.requestFocus();
        } });
    }

    @SuppressWarnings("deprecation")
    private void completa() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
}
