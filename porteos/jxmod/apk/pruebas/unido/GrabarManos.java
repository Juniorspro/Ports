import com.jxapps.jxhand.Motor;
import com.jxmod.app.ManosTexto;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.*;
import java.nio.file.*;
import javax.imageio.ImageIO;

/** (uso: java -cp CLASES GrabarManos MODELOS FOTO SALIDA.json CUADROS libjxhand.so —la de la PC: cargo build --release -p jxhand --features jni—)
 *  graba lo que ManosJX.java le pasaría al juego: una mano (foto) que se mueve frente a una cámara de 640×480,
 *  procesada por el motor de verdad (JNI) y pasada a texto con ManosTexto */
public class GrabarManos {
    static ByteBuffer leer(String f) throws Exception { byte[] b = Files.readAllBytes(Paths.get(f)); ByteBuffer d = ByteBuffer.allocateDirect(b.length); d.put(b); d.rewind(); return d; }
    public static void main(String[] a) throws Exception {
        String M = a[0]; BufferedImage foto = ImageIO.read(new File(a[1])); int N = Integer.parseInt(a[3]);
        if (!Motor.cargar(a[4])) { System.out.println("no carga: " + Motor.errorCarga()); return; }
        long m = Motor.crear(leer(M + "/hand_detector.tflite"), leer(M + "/hand_landmarks_detector.tflite"), leer(M + "/hand_landmark_lite.tflite"));
        Motor.config(m, Motor.LIVIANO, 1); Motor.config(m, Motor.PREDICCION_MS, 40);
        int w = 640, h = 480;
        ByteBuffer y = ByteBuffer.allocateDirect(w * h), uv = ByteBuffer.allocateDirect(w * h / 2);
        ByteBuffer sal = ByteBuffer.allocateDirect(4 * (ManosTexto.CABECERA + 2 * ManosTexto.POR_MANO)).order(ByteOrder.nativeOrder());
        FloatBuffer f = sal.asFloatBuffer(); float[] d = new float[ManosTexto.CABECERA + 2 * ManosTexto.POR_MANO];
        StringBuilder sb = new StringBuilder(); PrintWriter out = new PrintWriter(new FileWriter(a[2]));
        out.print("["); int manos = 0;
        for (int k = 0; k < N; k++) {
            // la foto achicada a 400 de alto, en el medio, corriéndose de un lado al otro (y un poco arriba/abajo)
            BufferedImage c = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB); Graphics2D g = c.createGraphics();
            g.setColor(new Color(70, 72, 78)); g.fillRect(0, 0, w, h);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            int fh = 400, fw = foto.getWidth() * fh / foto.getHeight();
            double tt = k / 30.0; int dx = (int) (110 * Math.sin(tt * 1.7)), dy = (int) (25 * Math.sin(tt * 2.3));
            g.drawImage(foto, (w - fw) / 2 + dx, (h - fh) / 2 + dy, fw, fh, null); g.dispose();
            for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) { int p = c.getRGB(i, j); y.put(j * w + i, (byte) Math.round(0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255))); }
            for (int j = 0; j < h / 2; j++) for (int i = 0; i < w / 2; i++) { int p = c.getRGB(i * 2, j * 2); double r = (p >> 16) & 255, gg = (p >> 8) & 255, b = p & 255, yy = 0.299 * r + 0.587 * gg + 0.114 * b;
                uv.put(j * w + i * 2, (byte) Math.round(Math.max(0, Math.min(255, 128 + (b - yy) / 1.772)))); uv.put(j * w + i * 2 + 1, (byte) Math.round(Math.max(0, Math.min(255, 128 + (r - yy) / 1.402)))); }
            uv.position(0); ByteBuffer u = uv.slice(); uv.position(1); ByteBuffer v = uv.slice(); uv.rewind();
            int n = Motor.procesar(m, y, u, v, w, h, w, w, 2, 0, false, k * 33_333_333L, sal, null, false);
            f.position(0); f.get(d, 0, ManosTexto.CABECERA + n * ManosTexto.POR_MANO);
            String t = ManosTexto.armar(sb, k + 1, d, n, true);
            out.print((k > 0 ? "," : "") + "\"" + t + "\""); if (n > 0) manos++;
            if (k == 0) ImageIO.write(c, "png", new File(a[2] + ".png"));
        }
        out.print("]"); out.close();
        System.out.println(N + " cuadros, con mano en " + manos + " · ejemplo: " + sb.substring(0, Math.min(160, sb.length())) + "… (" + sb.length() + " caracteres)");
    }
}
