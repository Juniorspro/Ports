// Fondos y frentes de los lugares (Background): capas por profundidad z, piso y rocas que se repiten
// con paralaje, nubes que se mueven solas, cielo quieto.
'use strict';
const Fondo = (() => {
  const F = {};
  const ESTACION = /^(halloween|winter|spring|summer|anniversary|christmas)/i;

  // lista plana de sprites dibujables con su posicion y profundidad
  F.crear = (ruta) => {
    const raiz = Obj.desdeRuta(ruta);
    if (!raiz) return null;
    Obj.iniciarAnim(raiz);
    const capas = [];
    const juntar = (o, dentroEstacional) => {
      if (!o.activo) return;
      if (dentroEstacional && ESTACION.test(o.n)) return;
      const s = Obj.sprite(o);
      if (s) capas.push({ o, s, par: Obj.comp(o, 'ParallaxLayer') });
      const est = !!Obj.comp(o, 'SeasonalSprite');
      for (const h of o.hijos) juntar(h, dentroEstacional || est);
    };
    juntar(raiz, false);
    for (const c of capas) c.w = Obj.mundo(c.o);
    capas.sort((a, b) => b.w[2] - a.w[2]);
    return { raiz, capas };
  };

  F.paso = (f) => { if (f) Obj.paso(f.raiz, 1 / TICS); };

  // camX: x del mundo en la columna 0. zDesde/zHasta: que capas dibujar (fondo: z>0, frente: z<0)
  F.dibujar = (f, camX, filtro) => {
    if (!f) return;
    for (const c of f.capas) {
      if (filtro && !filtro(c.w[2])) continue;
      if (!c.o.activo) continue;
      let x = Math.round(c.w[0]), y = Math.round(c.w[1]);
      if (c.par || c.s._c === 'TilingAsciiSprite' || c.s._c === 'CloudSprite') {
        const k = c.par ? (c.par.parallaxScaleX || 0) : 0;
        c.s._scrollX = Math.floor(camX * k) + Math.floor(c.s._fx || 0);
      }
      Obj.dibujarSprite(c.s, x, y);
    }
  };
  return F;
})();
