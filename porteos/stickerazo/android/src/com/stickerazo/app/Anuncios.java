package com.stickerazo.app;

import android.app.Activity;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentForm;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.FormError;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Los anuncios de Google (AdMob), sin molestar:
 *  <ul><li>primero el aviso de consentimiento de Google (UMP), sólo donde la ley lo pide (Europa, Reino Unido…); sin
 *  consentimiento no se piden anuncios;</li>
 *  <li>un banner abajo de todo, debajo de la página (no tapa nada), que se esconde mientras recortás o editás;</li>
 *  <li>uno de pantalla completa sólo en pausas naturales (agregaste un pack a WhatsApp, publicaste), nunca en el primer
 *  minuto y medio y como mucho uno cada 4 minutos.</li></ul>
 *  Los ID salen de assets/anuncios.json (android/anuncios.json; los de prueba de Google hasta tener la cuenta). Si algo
 *  falla, la app sigue igual, sin anuncios. */
final class Anuncios implements Publicidad {
    private static final String TAG = "Stickerazo";
    private static final long ENTRE = 4 * 60_000L, AL_EMPEZAR = 90_000L;
    private final Activity a;
    private final FrameLayout caja;
    private String idBanner, idInter;
    private ConsentInformation consent;
    private volatile boolean iniciado;
    private AdView vista;
    private InterstitialAd inter;
    private boolean cargado, quiere = true, cargandoInter;
    private long ultimo;
    private final long desde = System.currentTimeMillis();

    Anuncios(Activity a, FrameLayout caja) {
        this.a = a; this.caja = caja;
        try {
            InputStream in = a.getAssets().open("anuncios.json");
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] t = new byte[4096];
            try { for (int k; (k = in.read(t)) > 0; ) b.write(t, 0, k); } finally { in.close(); }
            JSONObject j = new JSONObject(b.toString("UTF-8"));
            idBanner = j.optString("banner", null); idInter = j.optString("intersticial", null);
        } catch (Exception e) { Log.w(TAG, "anuncios: sin configuración", e); }
    }

    @Override public void arrancar() {
        if (idBanner == null) return;
        try {
            consent = UserMessagingPlatform.getConsentInformation(a);
            consent.requestConsentInfoUpdate(a, new ConsentRequestParameters.Builder().build(),
                new ConsentInformation.OnConsentInfoUpdateSuccessListener() {
                    @Override public void onConsentInfoUpdateSuccess() {
                        UserMessagingPlatform.loadAndShowConsentFormIfRequired(a, new ConsentForm.OnConsentFormDismissedListener() {
                            @Override public void onConsentFormDismissed(FormError e) { iniciar(); }
                        });
                    }
                },
                new ConsentInformation.OnConsentInfoUpdateFailureListener() {
                    @Override public void onConsentInfoUpdateFailure(FormError e) { iniciar(); }
                });
            iniciar();   // (si ya lo había aceptado otra vez, no hace falta esperar)
        } catch (Throwable t) { Log.w(TAG, "anuncios", t); }
    }

    private void iniciar() {
        if (iniciado || consent == null || !consent.canRequestAds()) return;
        iniciado = true;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    MobileAds.initialize(a, new OnInitializationCompleteListener() {
                        @Override public void onInitializationComplete(InitializationStatus s) {
                            a.runOnUiThread(new Runnable() { @Override public void run() { cargarBanner(); cargarInter(); } });
                        }
                    });
                } catch (Throwable t) { Log.w(TAG, "anuncios", t); }
            }
        }, "anuncios").start();
    }

    private void cargarBanner() {
        try {
            DisplayMetrics dm = a.getResources().getDisplayMetrics();
            int ancho = (int) ((caja.getWidth() > 0 ? caja.getWidth() : dm.widthPixels) / dm.density);
            vista = new AdView(a);
            vista.setAdUnitId(idBanner);
            vista.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(a, ancho));
            vista.setAdListener(new AdListener() {
                @Override public void onAdLoaded() { cargado = true; mostrar(); }
                @Override public void onAdFailedToLoad(LoadAdError e) { cargado = false; mostrar(); }
            });
            caja.removeAllViews();
            caja.addView(vista, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
            vista.loadAd(new AdRequest.Builder().build());
        } catch (Throwable t) { Log.w(TAG, "banner", t); }
    }

    @Override public void banner(boolean si) { quiere = si; mostrar(); }
    private void mostrar() { caja.setVisibility(quiere && cargado ? View.VISIBLE : View.GONE); }

    private void cargarInter() {
        if (cargandoInter || inter != null || idInter == null) return;
        cargandoInter = true;
        try {
            InterstitialAd.load(a, idInter, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(InterstitialAd ad) { inter = ad; cargandoInter = false; }
                @Override public void onAdFailedToLoad(LoadAdError e) { inter = null; cargandoInter = false; }
            });
        } catch (Throwable t) { cargandoInter = false; Log.w(TAG, "intersticial", t); }
    }

    @Override public void intersticial() {
        long ahora = System.currentTimeMillis();
        if (!iniciado) return;
        if (inter == null) { cargarInter(); return; }
        if (ahora - desde < AL_EMPEZAR || ahora - ultimo < ENTRE) return;
        InterstitialAd i = inter; inter = null; ultimo = ahora;
        i.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { cargarInter(); }
            @Override public void onAdFailedToShowFullScreenContent(AdError e) { cargarInter(); }
        });
        try { i.show(a); } catch (Throwable t) { Log.w(TAG, "intersticial", t); }
    }

    @Override public boolean pideOpciones() {
        return consent != null && consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }
    @Override public void opciones() {
        UserMessagingPlatform.showPrivacyOptionsForm(a, new ConsentForm.OnConsentFormDismissedListener() {
            @Override public void onConsentFormDismissed(FormError e) { iniciar(); }
        });
    }
    @Override public void pausa() { if (vista != null) vista.pause(); }
    @Override public void sigue() { if (vista != null) vista.resume(); }
    @Override public void fin() { if (vista != null) vista.destroy(); }
}
