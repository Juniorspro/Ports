// JX Hand Engine en el navegador (y en la vista web de la APK): carga el motor en WebAssembly (Rust, motor/src/wasm.rs)
// y los dos modelos, y procesa cuadros RGBA. Sin dependencias. Uso:
//   const jx = await JXHand.crear({ wasm: 'jxhand.wasm', detector: 'hand_detector.tflite', puntos: 'hand_landmarks_detector.tflite' });
//   const manos = jx.procesar(imageData.data, w, h, performance.now(), true);   // true: la imagen viene espejada (selfie)
// Cada mano: { id, derecha, presencia, calibrada, posicion[3], rotacion[4], normal[3], img[21][3], mundo[21][3],
//   angulos[5]{flex, abre, medio, punta}, cierre[5], pinza, agarre, dedos, gesto, gestoNombre, gestoFuerza, roi }
(function (raiz) {
  'use strict';
  const POR_MANO = 176;
  const GESTOS = ['nada', 'abierta', 'puno', 'senalar', 'pinza', 'paz', 'pulgar_arriba', 'ok', 'cuernos', 'llamame', 'pulgar_abajo'];
  const CONFIG = { maxManos: 0, minPresencia: 1, minPalma: 2, cadaBusquedaMs: 3, prediccionMs: 4, fov: 5, imgMinCorte: 6, imgBeta: 7, angMinCorte: 8, angBeta: 9 };
  const traer = async (x) => (x instanceof ArrayBuffer ? x : x && x.buffer instanceof ArrayBuffer ? x.buffer : await (await fetch(x)).arrayBuffer());

  class JXHand {
    static async crear({ wasm, detector, puntos }) {
      const [bw, bd, bp] = await Promise.all([traer(wasm), traer(detector), traer(puntos)]);
      const { instance } = await WebAssembly.instantiate(bw, {});
      const jx = new JXHand(instance.exports);
      const copiar = (b) => { const u = new Uint8Array(b); const p = jx.e.jx_reservar(u.length); new Uint8Array(jx.e.memory.buffer, p, u.length).set(u); return [p, u.length]; };
      const [pd, nd] = copiar(bd), [pp, np] = copiar(bp);
      const r = jx.e.jx_crear(pd, nd, pp, np);
      jx.e.jx_liberar(pd, nd); jx.e.jx_liberar(pp, np);
      if (r !== 0) throw new Error('JX Hand Engine: ' + jx.error());
      return jx;
    }
    constructor(e) { this.e = e; this.corrioDetector = false; this.inferencias = 0; }
    error() { const n = this.e.jx_error_largo(); return new TextDecoder().decode(new Uint8Array(this.e.memory.buffer, this.e.jx_error(), n)); }
    config(clave, valor) { const k = typeof clave === 'number' ? clave : CONFIG[clave]; if (k != null) this.e.jx_config(k, valor); }
    reiniciar() { this.e.jx_reiniciar(); }
    // copia el cuadro (sin procesar): para medir velocidad con banco()
    cargar(rgba, w, h) { const p = this.e.jx_imagen(w, h); new Uint8Array(this.e.memory.buffer, p, w * h * 4).set(rgba); }
    procesar(rgba, w, h, tMs, espejada) {
      this.cargar(rgba, w, h);
      const n = this.e.jx_procesar(w, h, tMs, espejada ? 1 : 0);
      const s = new Float32Array(this.e.memory.buffer, this.e.jx_salida(), 4 + n * POR_MANO);
      this.corrioDetector = s[1] > 0; this.inferencias = s[2];
      const manos = [];
      for (let k = 0; k < n; k++) {
        const o = 4 + k * POR_MANO, p3 = (b) => { const r = []; for (let i = 0; i < 21; i++) r.push([s[b + i * 3], s[b + i * 3 + 1], s[b + i * 3 + 2]]); return r; };
        const ang = []; for (let d = 0; d < 5; d++) { const b = o + 140 + d * 4; ang.push({ flex: s[b], abre: s[b + 1], medio: s[b + 2], punta: s[b + 3] }); }
        manos.push({
          id: s[o], derecha: s[o + 1] > 0, presencia: s[o + 2], calibrada: s[o + 3] > 0,
          posicion: [s[o + 4], s[o + 5], s[o + 6]], rotacion: [s[o + 7], s[o + 8], s[o + 9], s[o + 10]], normal: [s[o + 11], s[o + 12], s[o + 13]],
          img: p3(o + 14), mundo: p3(o + 77), angulos: ang, cierre: Array.from(s.subarray(o + 160, o + 165)),
          pinza: s[o + 165], agarre: s[o + 166], dedos: s[o + 167], gesto: s[o + 168], gestoNombre: GESTOS[s[o + 168]] || 'nada', gestoFuerza: s[o + 169],
          roi: { cx: s[o + 170], cy: s[o + 171], lado: s[o + 172], ang: s[o + 173] },
        });
      }
      return manos;
    }
    // milisegundos por corrida de cada modelo (sobre el cuadro cargado)
    banco(w, h, veces = 10) {
      const t0 = performance.now(); this.e.jx_banco_puntos(w, h, veces); const t1 = performance.now(); this.e.jx_banco_detector(w, h, veces); const t2 = performance.now();
      return { puntos: (t1 - t0) / veces, detector: (t2 - t1) / veces };
    }
  }
  // la mejor versión del motor para esta vista web: con FMA (relaxed SIMD) si se puede; si no, con SIMD de siempre
  const PRUEBA_RELAXED = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 61, 1, 59, 0,
    253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 133, 2, 11]);
  const PRUEBA_SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  JXHand.version = () => (WebAssembly.validate(PRUEBA_RELAXED) ? 'relaxed' : WebAssembly.validate(PRUEBA_SIMD) ? 'simd' : null);
  JXHand.GESTOS = GESTOS;
  raiz.JXHand = JXHand;
})(typeof self !== 'undefined' ? self : this);
