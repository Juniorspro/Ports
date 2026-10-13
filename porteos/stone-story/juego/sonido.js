// Sonido: los Sfx del juego (id -> clips al azar, con tono al azar) y la musica (Music id), con Web Audio.
// Los clips vienen juntos en sonidos.bin: [largo del indice][indice JSON][clips Opus].
'use strict';
const Sonido = (() => {
  const S = { vol: 1, volMus: 0.6 };
  try { const g = JSON.parse(localStorage.getItem('stonestory.sonido')); if (g) Object.assign(S, g); } catch (e) {}
  S.guardar = () => { try { localStorage.setItem('stonestory.sonido', JSON.stringify({ vol: S.vol, volMus: S.volMus })); } catch (e) {} };
  S.reaplicar = () => { if (musica) musica.g.gain.value = S.volMus; if (amb) amb.g.gain.value = S.volMus * 0.8; };
  let ctx, bin, idx = {}, base = 0;
  const buf = new Map(), sfx = {}, mus = {};
  let musica = null, musId = null, amb = null, ambId = null;

  S.cargar = (ab) => {
    bin = ab;
    const n = new DataView(ab).getUint32(0, true);
    idx = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, n)));
    base = 4 + n;
    for (const e of Object.values(Datos.prefabs)) {
      const c = e.c.find((x) => x._c === 'Sfx' || x._c === 'Music');
      if (!c || !c.id) continue;
      const clips = e.c.filter((x) => x._c === 'AudioSource' && x.clip).map((x) => x.clip);
      (c._c === 'Sfx' ? sfx : mus)[c.id] = { clips, c };
    }
  };
  const abrir = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, abrir, { passive: true }));

  function clip(n) {
    if (buf.has(n)) return buf.get(n);
    const e = idx[n];
    if (!e || !abrir()) return Promise.resolve(null);
    const p = ctx.decodeAudioData(bin.slice(base + e[0], base + e[0] + e[1])).catch(() => null);
    buf.set(n, p);
    return p;
  }

  S.efecto = (id, vol = 1) => {
    const s = sfx[id];
    if (!s || !s.clips.length || !abrir() || !S.vol) return;
    const n = s.clips[Math.floor(Math.random() * s.clips.length)];
    const lo = s.c.rndPitchMin || 1, hi = s.c.rndPitchMax || 1;
    clip(n).then((b) => {
      if (!b) return;
      const f = ctx.createBufferSource(); f.buffer = b; f.playbackRate.value = lo + Math.random() * (hi - lo);
      const g = ctx.createGain(); g.gain.value = vol * S.vol;
      f.connect(g).connect(ctx.destination); f.start();
    });
  };

  S.musica = (id) => {
    if (id === musId) return;
    musId = id;
    if (musica) { const m = musica; m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => m.f.stop(), 2000); musica = null; }
    const s = mus[id];
    if (!s || !s.clips.length || !abrir()) return;
    clip(s.clips[0]).then((b) => {
      if (!b || musId !== id) return;
      const f = ctx.createBufferSource(); f.buffer = b; f.loop = true;
      const g = ctx.createGain(); g.gain.value = S.volMus;
      f.connect(g).connect(ctx.destination); f.start();
      musica = { f, g };
    });
  };
  // ambiente: otra pista en bucle, por debajo de la musica
  S.ambiente = (id) => {
    if (id === ambId) return;
    ambId = id;
    if (amb) { amb.f.stop(); amb = null; }
    const s = mus[id];
    if (!s || !s.clips.length || !abrir()) return;
    clip(s.clips[0]).then((b) => {
      if (!b || ambId !== id) return;
      const f = ctx.createBufferSource(); f.buffer = b; f.loop = true;
      const g = ctx.createGain(); g.gain.value = S.volMus * 0.8;
      f.connect(g).connect(ctx.destination); f.start();
      amb = { f, g };
    });
  };
  S.existe = (id) => !!sfx[id];
  return S;
})();
