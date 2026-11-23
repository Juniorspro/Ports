package com.jxmod.nativo;

import android.app.NativeActivity;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

/**
 * JXMod nativo: el juego entero es la biblioteca de Rust (libjxmod.so, NativeActivity). Esta clase sólo pide la pantalla
 * completa de verdad (sin las barras de Android, también debajo del recorte de la cámara), cosa que desde el hilo del
 * juego no se puede: Android exige hacerlo en el hilo de la interfaz.
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

    @SuppressWarnings("deprecation")
    private void completa() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
}
