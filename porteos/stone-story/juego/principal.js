// Arranque: carga datos y atlas, bucle a 30 pasos por segundo, escenas.
'use strict';
const Juego = {
  escena: null,
  t: 0,
  async iniciar() {
    window.prueba = {};
    const lienzo = document.getElementById('pantalla');
    await Datos.cargar(await (await fetch(window.DATOS_URL || 'datos.json.gz')).arrayBuffer());
    try { Sonido.cargar(await (await fetch(window.SONIDOS_URL || 'sonidos.bin')).arrayBuffer()); } catch (e) { console.warn('sin sonidos', e); }
    const img = new Image();
    img.src = window.ATLAS_URL || 'atlas.png';
    await img.decode();
    Pantalla.iniciar(lienzo, img);
    Idioma.cargar();
    Entrada.iniciar(lienzo);
    addEventListener('resize', () => Pantalla.medir());
    Juego.cambiar(window.ESCENA_INICIAL ? window.ESCENA_INICIAL() : Escenas.titulo());
    let previo = performance.now(), acum = 0;
    const bucle = (ahora) => {
      acum += Math.min(250, ahora - previo); previo = ahora;
      while (acum >= 1000 / TICS) { acum -= 1000 / TICS; Juego.t++; Juego.escena && Juego.escena.paso && Juego.escena.paso(); }
      Pantalla.limpiar();
      Juego.escena && Juego.escena.dibujar();
      Pantalla.presentar();
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
    window.prueba = window.prueba || {}; Object.assign(window.prueba, { listo: true, juego: Juego });
    try { parent.postMessage({ type: 'game:ready' }, '*'); } catch (e) {}
  },
  cambiar(e) { Juego.escena = e; e.entrar && e.entrar(); },
};
addEventListener('load', () => Juego.iniciar().catch((e) => { document.body.textContent = 'Error: ' + e.message; console.error(e); }));
