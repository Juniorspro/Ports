// Toques y teclas: se pasan a la escena como celdas de la grilla.
'use strict';
const Entrada = {
  iniciar(lienzo) {
    lienzo.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = lienzo.getBoundingClientRect();
      let px = e.clientX, py = e.clientY;
      // con el telefono parado la pagina esta girada 90 grados
      if (r.width < r.height) { const u = (py - r.top) / r.height, v = 1 - (px - r.left) / r.width; px = u; py = v; }
      else { px = (px - r.left) / r.width; py = (py - r.top) / r.height; }
      const x = Math.floor(px * Pantalla.cols), y = Math.floor(py * Pantalla.filas);
      const esc = Juego.escena;
      if (esc && esc.toque) esc.toque(x, y);
    });
    addEventListener('keydown', (e) => { const esc = Juego.escena; if (esc && esc.tecla) esc.tecla(e.key); });
  },
};
