package com.jxapps.jxhand;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Process;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.CompoundButton;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;

/**
 * JX Hand: la cámara (trasera de entrada) con el motor de manos en Rust nativo. Sin vista web: Java sólo abre la
 * cámara, le pasa los cuadros al motor y dibuja.
 */
public class Principal extends Activity {
    static final int PEDIR_CAMARA = 1;
    private Lienzo lienzo;
    private Camara camara;
    private HandlerThread tMotor;
    private Handler hMotor;
    private SharedPreferences prefs;
    private Icono bLinterna, bNoche, bGirar, bAjustes;
    private LinearLayout barra;
    private FrameLayout panel;
    private float dp;
    private boolean pidiendo, negado;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        dp = getResources().getDisplayMetrics().density;
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        prefs = getSharedPreferences("jxhand", MODE_PRIVATE);

        // el hilo del motor: con prioridad alta (como el de la pantalla), es el único que toca el motor
        tMotor = new HandlerThread("jxhand-motor", Process.THREAD_PRIORITY_URGENT_DISPLAY); tMotor.start();
        hMotor = new Handler(tMotor.getLooper());

        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(0xFF0B0B10);
        lienzo = new Lienzo(this);
        raiz.addView(lienzo, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        lienzo.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            if (panel.getVisibility() == View.VISIBLE) mostrarPanel(false);
            else if (!tienePermiso()) pedirPermiso();
        } });

        camara = new Camara(this, lienzo, hMotor);
        camara.quiereFrente = prefs.getBoolean("frente", false);
        camara.noche = prefs.getBoolean("noche", false);
        camara.rapido = prefs.getBoolean("rapido", true);
        camara.ver3d = prefs.getBoolean("ver3d", false);
        camara.modelo = prefs.getInt("modelo", Camara.AUTO);

        // los botones de arriba a la derecha
        barra = new LinearLayout(this); barra.setOrientation(LinearLayout.HORIZONTAL);
        bLinterna = boton(Icono.LINTERNA, new View.OnClickListener() { public void onClick(View v) {
            if (!camara.hayLinterna()) return;
            camara.linterna = !camara.linterna; bLinterna.activo(camara.linterna); camara.actualizar();
        } });
        bNoche = boton(Icono.LUNA, new View.OnClickListener() { public void onClick(View v) {
            camara.noche = !camara.noche; bNoche.activo(camara.noche); prefs.edit().putBoolean("noche", camara.noche).apply(); camara.actualizar();
            if (panel.getVisibility() == View.VISIBLE) armarPanel();
        } });
        bGirar = boton(Icono.GIRAR, new View.OnClickListener() { public void onClick(View v) {
            camara.girar(); prefs.edit().putBoolean("frente", camara.quiereFrente).apply();
            bLinterna.activo(false); actualizarBotones();
            hMotor.post(new Runnable() { public void run() { if (camara.motor != 0) Motor.config(camara.motor, Motor.REINICIAR, 1); } });
        } });
        bAjustes = boton(Icono.AJUSTES, new View.OnClickListener() { public void onClick(View v) { mostrarPanel(panel.getVisibility() != View.VISIBLE); } });
        bNoche.activo(camara.noche);
        FrameLayout.LayoutParams lb = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END);
        lb.topMargin = (int) (16 * dp); lb.rightMargin = (int) (10 * dp);
        raiz.addView(barra, lb);

        // el panel de ajustes (abajo, se abre con el botón)
        panel = new FrameLayout(this); panel.setVisibility(View.GONE);
        FrameLayout.LayoutParams lpn = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        raiz.addView(panel, lpn);

        // los márgenes de la pantalla (muesca de la cámara, barras del sistema)
        raiz.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                int arriba = in.getSystemWindowInsetTop(), abajo = in.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= 28 && in.getDisplayCutout() != null) { arriba = Math.max(arriba, in.getDisplayCutout().getSafeInsetTop()); abajo = Math.max(abajo, in.getDisplayCutout().getSafeInsetBottom()); }
                lienzo.margenArriba = arriba; lienzo.margenAbajo = abajo;
                FrameLayout.LayoutParams l = (FrameLayout.LayoutParams) barra.getLayoutParams();
                l.topMargin = arriba + (int) (12 * dp); barra.setLayoutParams(l);
                panel.setPadding(0, 0, 0, abajo);
                return in;
            }
        });
        setContentView(raiz);
        pantallaCompleta();
        actualizarBotones();

        // el motor: los modelos se leen de la APK y se cargan en el hilo del motor
        hMotor.post(new Runnable() { public void run() {
            lienzo.mensaje("Cargando el motor…", null);
            try {
                long m = Motor.crear(leer("modelos/hand_detector.tflite"), leer("modelos/hand_landmarks_detector.tflite"), leer("modelos/hand_landmark_lite.tflite"));
                if (m == 0) { lienzo.mensaje("El motor no arrancó", Motor.error()); return; }
                camara.motor = m;
                aplicarAjustes();
            } catch (Throwable t) { lienzo.mensaje("El motor no arrancó", String.valueOf(t.getMessage())); }
        } });
    }

    private ByteBuffer leer(String nombre) throws Exception {
        InputStream in = getAssets().open(nombre);
        ByteArrayOutputStream o = new ByteArrayOutputStream(1 << 20);
        byte[] b = new byte[1 << 16]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        in.close();
        byte[] t = o.toByteArray();
        ByteBuffer d = ByteBuffer.allocateDirect(t.length); d.put(t); d.rewind();
        return d;
    }

    /** pasa los ajustes guardados al motor (en su hilo) */
    private void aplicarAjustes() {
        hMotor.post(new Runnable() { public void run() {
            long m = camara.motor; if (m == 0) return;
            Motor.config(m, Motor.MAX_MANOS, prefs.getInt("manos", 2));
            Motor.config(m, Motor.PREDICCION_MS, prefs.getInt("adelantar", 0));
            Motor.config(m, Motor.POCA_LUZ, prefs.getBoolean("realce", true) ? 1 : 0);
            camara.aplicarModelo();
        } });
    }

    private Icono boton(int tipo, View.OnClickListener l) {
        Icono i = new Icono(this, tipo);
        int t = (int) (46 * dp);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(t, t); lp.leftMargin = (int) (8 * dp);
        barra.addView(i, lp);
        i.setOnClickListener(l);
        return i;
    }

    private void actualizarBotones() {
        // la linterna sólo existe en la cámara de atrás (se sabe cuando la cámara ya abrió)
        lienzo.postDelayed(new Runnable() { public void run() { bLinterna.deshabilitado(!camara.hayLinterna()); bLinterna.activo(camara.linterna); } }, 600);
    }

    private void pantallaCompleta() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) pantallaCompleta(); }

    private boolean tienePermiso() { return Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED; }
    private void pedirPermiso() {
        if (Build.VERSION.SDK_INT < 23 || pidiendo) return;
        // si ya lo negaron con «no volver a preguntar», Android no muestra el cartel: se abren los ajustes de la app
        if (negado && !shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
            try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception e) { }
            return;
        }
        pidiendo = true; requestPermissions(new String[]{Manifest.permission.CAMERA}, PEDIR_CAMARA);
    }

    @Override protected void onResume() {
        super.onResume();
        if (tienePermiso()) { camara.abrir(); actualizarBotones(); } else if (!negado) pedirPermiso();
    }

    @Override protected void onPause() { camara.cerrar(); camara.linterna = false; bLinterna.activo(false); super.onPause(); }

    @Override public void onRequestPermissionsResult(int pedido, String[] permisos, int[] resultados) {
        pidiendo = false;
        if (pedido != PEDIR_CAMARA) return;
        if (resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED) { camara.abrir(); actualizarBotones(); }
        else { negado = true; lienzo.postDelayed(new Runnable() { public void run() { lienzo.mensaje("Hace falta la cámara para ver tus manos", "Tocá la pantalla para dar el permiso"); } }, 200); }
    }

    @Override protected void onDestroy() {
        final long m = camara.motor; camara.motor = 0;
        hMotor.post(new Runnable() { public void run() { if (m != 0) Motor.soltar(m); tMotor.quitSafely(); } });
        super.onDestroy();
    }

    @Override public void onBackPressed() { if (panel.getVisibility() == View.VISIBLE) mostrarPanel(false); else super.onBackPressed(); }

    // ---- el panel de ajustes ----
    private void mostrarPanel(boolean si) {
        bAjustes.activo(si);
        if (si) { armarPanel(); panel.setVisibility(View.VISIBLE); panel.setTranslationY(400 * dp); panel.animate().translationY(0).setDuration(220).start(); }
        else panel.animate().translationY(panel.getHeight() + 40 * dp).setDuration(180).withEndAction(new Runnable() { public void run() { panel.setVisibility(View.GONE); } }).start();
    }

    private void armarPanel() {
        panel.removeAllViews();
        ScrollView sv = new ScrollView(this);
        LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * dp); l.setPadding(pad, (int) (18 * dp), pad, (int) (24 * dp));
        GradientDrawable fondo = new GradientDrawable(); fondo.setColor(0xF2121218); float rr = 26 * dp;
        fondo.setCornerRadii(new float[]{rr, rr, rr, rr, 0, 0, 0, 0}); sv.setBackground(fondo);
        sv.addView(l);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        panel.addView(sv, lp);
        sv.getLayoutParams().height = Math.min((int) (getResources().getDisplayMetrics().heightPixels * 0.62f), (int) (560 * dp));

        TextView t = texto("Ajustes", 20, true); l.addView(t);

        seccion(l, "Modelo de los puntos");
        segmentos(l, new String[]{"Auto", "Completo", "Liviano"}, camara.modelo, new Elegir() { public void elegir(int i) {
            camara.modelo = i; prefs.edit().putInt("modelo", i).apply();
            hMotor.post(new Runnable() { public void run() { camara.aplicarModelo(); } });
        } });
        nota(l, "Auto usa el completo (más preciso) y pasa al liviano si en tu celular tarda más de 5 ms por cuadro.");

        seccion(l, "Manos");
        segmentos(l, new String[]{"1", "2"}, prefs.getInt("manos", 2) - 1, new Elegir() { public void elegir(int i) {
            prefs.edit().putInt("manos", i + 1).apply(); aplicarAjustes();
        } });

        seccion(l, "Adelantar los puntos");
        final TextView valor = texto(prefs.getInt("adelantar", 0) + " ms", 14, true);
        l.addView(valor);
        SeekBar sb = new SeekBar(this); sb.setMax(100); sb.setProgress(prefs.getInt("adelantar", 0));
        sb.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar s, int p, boolean u) { valor.setText(p + " ms"); }
            public void onStartTrackingTouch(SeekBar s) { }
            public void onStopTrackingTouch(SeekBar s) { prefs.edit().putInt("adelantar", s.getProgress()).apply(); aplicarAjustes(); }
        });
        l.addView(sb);
        nota(l, "0: el esqueleto queda pegado a la mano en la imagen. Para usar las manos como control, de 30 a 60 ms compensan lo que tarda la cámara.");

        interruptor(l, "Ver de noche", "Aclara la imagen y deja que la cámara junte más luz (puede bajar a menos cuadros por segundo). También en el botón de la luna.",
            camara.noche, new CompoundButton.OnCheckedChangeListener() { public void onCheckedChanged(CompoundButton c, boolean v) {
                camara.noche = v; bNoche.activo(v); prefs.edit().putBoolean("noche", v).apply(); camara.actualizar();
            } });
        interruptor(l, "Realce para poca luz", "Cuando está oscuro, el motor aclara y limpia el recorte de la mano antes de mirarlo (así la sigue con mucha menos luz).",
            prefs.getBoolean("realce", true), new CompoundButton.OnCheckedChangeListener() { public void onCheckedChanged(CompoundButton c, boolean v) {
                prefs.edit().putBoolean("realce", v).apply(); aplicarAjustes();
            } });
        interruptor(l, "Cámara rápida", "Pide 60 cuadros por segundo si la cámara los da: menos espera entre que te movés y lo que ves.",
            camara.rapido, new CompoundButton.OnCheckedChangeListener() { public void onCheckedChanged(CompoundButton c, boolean v) {
                camara.rapido = v; prefs.edit().putBoolean("rapido", v).apply(); camara.actualizar();
            } });
        interruptor(l, "Mano en 3D", "Muestra la primera mano en metros, girando, arriba a la derecha.",
            camara.ver3d, new CompoundButton.OnCheckedChangeListener() { public void onCheckedChanged(CompoundButton c, boolean v) {
                camara.ver3d = v; prefs.edit().putBoolean("ver3d", v).apply();
            } });

        TextView pie = texto("JX Hand Engine · Rust nativo con NEON en los núcleos grandes\nModelos de MediaPipe Hands (Google, Apache 2.0)", 11, false);
        pie.setAlpha(0.6f); pie.setPadding(0, (int) (18 * dp), 0, 0);
        l.addView(pie);
    }

    interface Elegir { void elegir(int i); }

    private TextView texto(String s, int sp, boolean negrita) {
        TextView t = new TextView(this); t.setText(s); t.setTextColor(Color.WHITE); t.setTextSize(sp);
        if (negrita) t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        return t;
    }
    private void seccion(LinearLayout l, String s) { TextView t = texto(s, 14, true); t.setPadding(0, (int) (18 * dp), 0, (int) (8 * dp)); t.setAlpha(0.9f); l.addView(t); }
    private void nota(LinearLayout l, String s) { TextView t = texto(s, 12, false); t.setAlpha(0.6f); t.setPadding(0, (int) (6 * dp), 0, 0); l.addView(t); }

    private void segmentos(LinearLayout l, final String[] ops, int sel, final Elegir e) {
        final LinearLayout fila = new LinearLayout(this); fila.setOrientation(LinearLayout.HORIZONTAL);
        GradientDrawable fondo = new GradientDrawable(); fondo.setColor(0x22FFFFFF); fondo.setCornerRadius(14 * dp); fila.setBackground(fondo);
        fila.setPadding((int) (3 * dp), (int) (3 * dp), (int) (3 * dp), (int) (3 * dp));
        for (int i = 0; i < ops.length; i++) {
            final int k = i;
            final TextView b = texto(ops[i], 14, true); b.setGravity(Gravity.CENTER); b.setPadding(0, (int) (9 * dp), 0, (int) (9 * dp));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            fila.addView(b, lp);
            b.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { marcar(fila, k); e.elegir(k); } });
        }
        marcar(fila, sel);
        l.addView(fila);
    }
    private void marcar(LinearLayout fila, int sel) {
        for (int i = 0; i < fila.getChildCount(); i++) {
            View v = fila.getChildAt(i);
            if (i == sel) { GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{0xFF7A3CFF, 0xFFFF3E8A}); g.setCornerRadius(11 * dp); v.setBackground(g); v.setAlpha(1f); }
            else { v.setBackground(null); v.setAlpha(0.75f); }
        }
    }
    private void interruptor(LinearLayout l, String titulo, String nota, boolean valor, CompoundButton.OnCheckedChangeListener c) {
        Switch s = new Switch(this); s.setText(titulo); s.setTextColor(Color.WHITE); s.setTextSize(15); s.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        s.setChecked(valor); s.setOnCheckedChangeListener(c); s.setPadding(0, (int) (16 * dp), 0, 0);
        l.addView(s);
        nota(l, nota);
    }
}
