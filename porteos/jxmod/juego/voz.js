// ---------------- voz por cercanía (como el Hunter) ----------------
// Cada uno que habla le manda su micrófono a los que están cerca con WebRTC (una conexión de ida por par; las señales van
// por la red del juego), y del otro lado la voz sale del lugar del que habla: panner HRTF, distancia, paredes y eco.
const VOZ = { on: false, stream: null, sal: new Map(), ent: new Map(), tRev: 0, quien: new Map() };
const VOZ_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const VOZ_CERCA = 70, VOZ_LEJOS = 90, VOZ_MAX = 10;
// (el botón del micrófono está en modmenu.js, arriba con los demás)
async function vozActivar() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { aviso('Este navegador no deja usar el micrófono', 3); return; }
  try { VOZ.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { aviso('Sin permiso para el micrófono', 3); return; }
  VOZ.on = true; vozBotonPoner(true); aviso('Micrófono prendido', 2);
  vozMiNivelIniciar();
}
function vozApagar() {
  VOZ.on = false; if (VOZ.stream) VOZ.stream.getTracks().forEach((t) => t.stop()); VOZ.stream = null;
  for (const [id] of VOZ.sal) vozCerrarSal(id);
  if ($('vozBt')) $('vozBt').classList.remove('on');
  vozMiNivelIniciar(); vozHablaFin('yo');
}
// el nivel de mi micrófono (para mostrarme en el panel de quién habla mientras mando voz): un analizador suelto, sin salida
function vozMiNivelIniciar() {
  try { if (VOZ.miSrc) VOZ.miSrc.disconnect(); } catch (e) {}
  VOZ.miSrc = VOZ.miAn = null;
  if (!VOZ.on || !VOZ.stream) return;
  audioIniciar(); if (!AUD.ctx) return;
  try { VOZ.miSrc = AUD.ctx.createMediaStreamSource(VOZ.stream); VOZ.miAn = AUD.ctx.createAnalyser(); VOZ.miAn.fftSize = 1024; VOZ.miSrc.connect(VOZ.miAn); VOZ.miNivel = new Uint8Array(VOZ.miAn.fftSize); } catch (e) { VOZ.miSrc = VOZ.miAn = null; }
}
// el pico de la señal de un analizador (0 a 128)
function vozPico(an, buf) { an.getByteTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) { const v = buf[i] > 128 ? buf[i] - 128 : 128 - buf[i]; if (v > m) m = v; } return m; }
// silenciar (o no) las voces de todos los demás: se guarda y vale enseguida
function vocesMudar(si) {
  PREFS.vocesMudas = !!si; guardarPrefs(); aviso(T(si ? 'voz.mudas' : 'voz.activas'), 2);
  for (const C of VOZ.ent.values()) if (C.F) { C.F.g.gain.value = si ? 0 : 1.6; C.tOcl = 0; }
  vozBotonPoner($('vozBt') && $('vozBt').style.display !== 'none');
}
function vozCerrarSal(id) { const C = VOZ.sal.get(id); if (C) { try { C.pc.close(); } catch (e) {} VOZ.sal.delete(id); publicar('a', { k: 'rtc', to: id, fin: 1 }); } }
function vozCerrarEnt(id) { const C = VOZ.ent.get(id); if (C) { try { C.pc.close(); } catch (e) {} if (C.el) C.el.remove(); try { C.src && C.src.disconnect(); } catch (e) {} VOZ.ent.delete(id); } vozHablaFin(id); }
function vozCerrar(id) { vozCerrarSal(id); vozCerrarEnt(id); }
// salida: yo hablo → le mando la oferta al que está cerca
async function vozLlamar(id) {
  const pc = new RTCPeerConnection({ iceServers: VOZ_ICE }), C = { pc }; VOZ.sal.set(id, C);
  VOZ.stream.getTracks().forEach((t) => pc.addTrack(t, VOZ.stream));
  pc.onicecandidate = (e) => { if (e.candidate) publicar('a', { k: 'rtc', to: id, dir: 'sal', ice: e.candidate.toJSON() }); };
  const of = await pc.createOffer(); await pc.setLocalDescription(of);
  publicar('a', { k: 'rtc', to: id, dir: 'sal', sdp: pc.localDescription.toJSON() });
}
// señales que llegan por la red (d.i = quién manda)
async function vozSenal(d) {
  try {
    if (d.fin) { vozCerrarEnt(d.i); return; }
    if (d.dir === 'sal') { // el otro habla: soy el que escucha
      let C = VOZ.ent.get(d.i);
      if (d.sdp && d.sdp.type === 'offer') {
        vozCerrarEnt(d.i);
        const pc = new RTCPeerConnection({ iceServers: VOZ_ICE }); C = { pc }; VOZ.ent.set(d.i, C);
        pc.onicecandidate = (e) => { if (e.candidate) publicar('a', { k: 'rtc', to: d.i, dir: 'ent', ice: e.candidate.toJSON() }); };
        pc.ontrack = (e) => vozRecibir(d.i, C, e.streams[0] || new MediaStream([e.track]));
        await pc.setRemoteDescription(d.sdp); const r = await pc.createAnswer(); await pc.setLocalDescription(r);
        publicar('a', { k: 'rtc', to: d.i, dir: 'ent', sdp: pc.localDescription.toJSON() });
      } else if (d.ice && C) await C.pc.addIceCandidate(d.ice);
    } else if (d.dir === 'ent') { // respuesta del que me escucha
      const C = VOZ.sal.get(d.i); if (!C) return;
      if (d.sdp && d.sdp.type === 'answer') await C.pc.setRemoteDescription(d.sdp); else if (d.ice) await C.pc.addIceCandidate(d.ice);
    }
  } catch (e) { console.warn('voz', e); }
}
function vozRecibir(id, C, st) {
  audioIniciar(); if (!AUD.ctx) return;
  // Chrome sólo hace correr el audio remoto si está en un elemento (callado: el sonido sale por el panner)
  C.el = document.createElement('audio'); C.el.muted = true; C.el.srcObject = st; C.el.play().catch(() => {}); C.el.style.display = 'none'; document.body.appendChild(C.el);
  const c = AUD.ctx; C.src = c.createMediaStreamSource(st);
  C.F = fuente3D(CAM.pos, PREFS.vocesMudas ? 0 : 1.6); C.src.connect(C.F.g); C.F.p.panningModel = 'HRTF'; C.F.p.refDistance = 2; C.F.p.rolloffFactor = 1.3;
  // (21 ms de señal por cuadro: con 5 ms se perdían sílabas entre cuadro y cuadro)
  C.an = c.createAnalyser(); C.an.fftSize = 1024; C.src.connect(C.an); C.nivel = new Uint8Array(C.an.fftSize);
}
// cada cuadro: posición de cada voz, paredes, quién habla, y conectar o cortar según la distancia
function vozPaso(dt) {
  if (!RED.on) { if (VOZH.est.size) vozHablaTodosFin(); return; }
  for (const [id, C] of VOZ.ent) {
    const R2 = RED.remotos.get(id); if (!R2) { vozCerrarEnt(id); continue; }
    if (!C.F) continue;
    const p = vadd(R2.P.pos, v3(0, 1.1, 0)); ponerPos(C.F.p, p);
    C.tOcl = (C.tOcl || 0) - dt; if (C.tOcl <= 0) { C.tOcl = 0.3; const t = audioTapado(p); C.F.f.frequency.value = t ? 1100 : audioAbierto(); C.F.g.gain.value = PREFS.vocesMudas ? 0 : t ? 0.9 : 1.6; }
    // (si las voces están silenciadas no se oye a nadie: tampoco se muestra que habla)
    vozHablaNivel(id, PREFS.vocesMudas ? 0 : vozPico(C.an, C.nivel), R2);
  }
  // yo, mientras mi micrófono manda voz
  if (VOZ.miAn) vozHablaNivel('yo', vozPico(VOZ.miAn, VOZ.miNivel), null);
  vozHablaPaso();
  VOZ.tRev -= dt; if (VOZ.tRev > 0) return; VOZ.tRev = 0.5;
  if (!VOZ.on || !VOZ.stream) return;
  const cerca = [...RED.remotos.values()].map((R2) => [R2.id, R2.P.pos.distTo(JUG.pos)]).sort((a, b) => a[1] - b[1]);
  cerca.forEach(([id, d], i) => {
    if (!VOZ.sal.has(id) && d < VOZ_CERCA && i < VOZ_MAX) vozLlamar(id).catch(() => VOZ.sal.delete(id));
    else if (VOZ.sal.has(id) && (d > VOZ_LEJOS || i >= VOZ_MAX + 2)) vozCerrarSal(id);
  });
}

// ---------------- quién habla: el panel de voz (como el de GMod o el de Discord) ----------------
// Cada uno que está hablando por la voz de cercanía aparece con su foto y su nombre, con un anillo verde que late; al
// callarse se apaga solo. Vos también aparecés mientras tu micrófono manda voz. La foto: la tuya de Google si entraste
// con tu cuenta (sólo la ves vos: las fotos de las cuentas no se mandan a la sala); la de los demás, el retrato de su
// personaje (el mismo que usa Social para el perfil); con un modelo de GMod u otro sin retrato, sus iniciales.
// El nivel se mira en cada cuadro (aparece en el cuadro en que llega la voz), pero la página sólo se toca cuando alguien
// empieza o deja de hablar, y el panel va en su propia capa: nada de volver a pintar los controles en cada cuadro (red.js,
// etiquetaMover: el A15 a 0 fps). En la compu va a la derecha, debajo de los botones de arriba (como en GMod); en el
// celular, arriba al medio, en el hueco entre los botones de la izquierda y los de la derecha (hud.js lo vuelve a ubicar
// cuando cambian los botones). Se apaga en Ajustes → Controles y audio.
const VOZH = { est: new Map(), el: null, mas: null, ancho: 0 };   // (ancho: el de la fila del celular; 0 en la columna de la compu)
const VOZH_SI = 10, VOZH_NO = 5, VOZH_ESPERA = 450, VOZH_SALE = 350, VOZH_MAX = 5;   // nivel para empezar y para seguir (0-128), ms de silencio antes de irse, ms del fundido, cuántos a la vista
// el nivel de uno (id del jugador, o 'yo'): empieza a hablar con un pico de VOZH_SI; sigue mientras no pase VOZH_ESPERA sin
// llegar a VOZH_NO (entre sílabas el nivel baja un momento)
function vozHablaNivel(id, m, R2) {
  const ahora = performance.now(); let E = VOZH.est.get(id);
  if (m >= VOZH_SI) { if (!E) { E = { id, hab: false, ult: ahora, sale: 0, el: null }; VOZH.est.set(id, E); } E.ult = ahora; if (!E.hab) vozHablaEmpieza(E, R2); }
  else if (E && E.hab && m >= VOZH_NO) E.ult = ahora;
}
// cada cuadro: los que se callaron se van (con su fundido)
function vozHablaPaso() {
  if (!VOZH.est.size) return;
  const ahora = performance.now();
  for (const E of [...VOZH.est.values()]) {
    if (E.hab && ahora - E.ult > VOZH_ESPERA) vozHablaCalla(E);
    else if (!E.hab && ahora >= E.sale) { if (E.el) E.el.remove(); VOZH.est.delete(E.id); vozHudOrden(); }
  }
}
function vozHablaEmpieza(E, R2) {
  E.hab = true; E.sale = 0; E.t0 = performance.now();
  const R = E.id === 'yo' ? null : R2 || RED.remotos.get(E.id); if (R && R.tag) R.tag.classList.add('habla');
  if (PREFS.vozHud === false || !vozHudEl()) return;
  if (!E.el) { E.el = vozFicha(E.id, R); VOZH.el.insertBefore(E.el, VOZH.mas); }
  E.el.classList.remove('sale'); E.el.classList.add('hab'); vozHudOrden();
}
function vozHablaCalla(E) {
  E.hab = false; E.sale = performance.now() + VOZH_SALE;
  const R = E.id === 'yo' ? null : RED.remotos.get(E.id); if (R && R.tag) R.tag.classList.remove('habla');
  if (E.el) { E.el.classList.remove('hab'); E.el.classList.add('sale'); }
}
// alguien que se fue de la sala o cortó la voz: se va ya (con el fundido)
function vozHablaFin(id) { const E = VOZH.est.get(id); if (E && E.hab) vozHablaCalla(E); }
function vozHablaTodosFin() { for (const E of VOZH.est.values()) if (E.el) E.el.remove(); VOZH.est.clear(); vozHudOrden(); }
// el panel (dentro de la HUD, en su propia capa)
function vozHudEl() {
  if (VOZH.el && VOZH.el.isConnected) return VOZH.el;
  const h = $('hud'); if (!h) return null;
  const P = document.createElement('div'); P.id = 'vozHud'; P.setAttribute('aria-live', 'polite');
  const m = document.createElement('div'); m.className = 'vozF vozMas oc'; P.appendChild(m);
  h.appendChild(P); VOZH.el = P; VOZH.mas = m; vozHudUbicar(); return P;
}
// a la vista: los primeros VOZH_MAX en hablar; el resto suma en «+N»
function vozHudOrden() {
  if (!VOZH.el) return;
  let n = 0, extra = 0;
  for (const E of VOZH.est.values()) { if (!E.el) continue; const ve = n < VOZH_MAX; if (E.el.classList.contains('oc') === ve) E.el.classList.toggle('oc', !ve); if (ve) n++; else if (E.hab) extra++; }
  const t = '+' + extra; if (VOZH.mas.textContent !== t) VOZH.mas.textContent = t; VOZH.mas.classList.toggle('oc', !extra);
  // (en la fila del celular: si no entran los nombres —menos de 90 px por ficha—, sólo las fotos; si no, quedaban «J…»)
  if (VOZH.ancho) VOZH.el.classList.toggle('compacto', VOZH.ancho / Math.max(1, n + (extra ? 1 : 0)) < 90);
}
// la ficha de uno: foto (o iniciales), nombre y, si sos vos, el micrófono
function vozFicha(id, R2) {
  const yo = id === 'yo', nom = yo ? censurar(limpio(PREFS.nombre)) : (R2 && R2.nombre) || '?', skin = yo ? JUG.skinRol || JUG.skinMod || PREFS.skin : R2 && (R2.skinReal || R2.skin);
  let foto = yo && typeof cuDentro === 'function' && cuDentro() && typeof CU !== 'undefined' && CU.u && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(CU.u.foto || '') ? CU.u.foto : '';
  if (!foto && skin && typeof retrato === 'function') { const r = retrato(skin); if (r && r !== RETRATO_SIL) foto = r; }
  const F = document.createElement('div'); F.className = 'vozF'; F.dataset.v = id; F.setAttribute('role', 'status'); F.setAttribute('aria-label', T('voz.habla').replace('{n}', nom));
  const ini = vozIniciales(nom), col = 'hsl(' + (parseInt(hashTxt('v' + id).slice(0, 4), 36) % 360) + ' 45% 38%)';
  F.innerHTML = `<span class="vozAv${foto ? '' : ' ini'}"${foto ? '' : ` style="background:${col}"`}>${foto ? `<img alt="" src="${esc(foto)}" referrerpolicy="no-referrer">` : esc(ini)}</span><b dir="auto">${esc(nom)}</b>${yo ? glifo('micro') : ''}`;
  // (si la foto no carga, las iniciales)
  const img = F.querySelector('img'); if (img) img.onerror = () => { const a = F.querySelector('.vozAv'); a.classList.add('ini'); a.style.background = col; a.textContent = ini; };
  return F;
}
function vozIniciales(n) {
  const p = String(n || '?').trim().split(/[\s_.-]+/).filter(Boolean), l = (s) => Array.from(s)[0] || '';
  return ((p.length > 1 ? l(p[0]) + l(p[1]) : Array.from(p[0] || '?').slice(0, 2).join('')) || '?').toUpperCase();
}
// dónde va: en la compu, una columna a la derecha debajo de los botones de arriba; en el celular, una fila arriba al medio
// en el hueco libre entre los botones de cada lado (sólo con los que se ven), debajo del texto de la sala. Se llama cuando
// cambia la disposición (hudDisponer), no en cada cuadro
function vozHudUbicar() {
  const P = VOZH.el; if (!P) return;
  const tactil = document.body.classList.contains('tactil'), W = VW(), s = P.style;
  P.classList.toggle('fila', tactil); P.classList.toggle('col', !tactil);
  if (!tactil) {
    const d = $('arribaDe'), r = d && d.getBoundingClientRect(), y = r && r.height ? r.bottom : 70;
    Object.assign(s, { left: 'auto', right: '12px', top: Math.round(y + 16) + 'px', width: 'auto', maxWidth: '240px' }); VOZH.ancho = 0; P.classList.remove('compacto'); return;
  }
  const rs = [...document.querySelectorAll('#hud .bt, #hud .bt-t, #hud .redondo, #hud #redEst')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  const est = $('redEst'), re = est && est.getBoundingClientRect(), y0 = Math.round(Math.max(20, re && re.height ? re.bottom + 4 : 20)), alto = 34;
  let L = 8, R = W - 8;
  for (const r of rs) { if (r.bottom < y0 || r.top > y0 + alto) continue; const c = (r.left + r.right) / 2; if (c < W / 2) L = Math.max(L, r.right + 8); else R = Math.min(R, r.left - 8); }
  VOZH.ancho = Math.max(40, Math.round(R - L));
  Object.assign(s, { left: Math.round(L) + 'px', right: 'auto', top: y0 + 'px', width: VOZH.ancho + 'px', maxWidth: '' });
  vozHudOrden();   // (y si no entran los nombres, sólo las fotos)
}
// prender o apagar el panel (Ajustes)
function vozHudAjuste() {
  for (const E of VOZH.est.values()) {
    if (PREFS.vozHud === false) { if (E.el) { E.el.remove(); E.el = null; } }
    else if (E.hab && !E.el && vozHudEl()) { E.el = vozFicha(E.id, E.id === 'yo' ? null : RED.remotos.get(E.id)); E.el.classList.add('hab'); VOZH.el.insertBefore(E.el, VOZH.mas); }
  }
  vozHudOrden();
}
Object.assign(IDI3, {
  'aj.vozHud': ['Mostrar quién habla (chat de voz)', 'Show who is talking (voice chat)', 'Mostrar quem está falando (chat de voz)', 'Tampilkan siapa yang bicara (obrolan suara)', 'Tunjukkan siapa yang bercakap (sembang suara)', 'Ipakita kung sino ang nagsasalita (voice chat)', '話している人を表示（ボイスチャット）', 'แสดงคนที่กำลังพูด (แชทเสียง)', 'Kimin konuştuğunu göster (sesli sohbet)', 'إظهار من يتحدث (الدردشة الصوتية)', 'Показывать, кто говорит (голосовой чат)', 'Показувати, хто говорить (голосовий чат)', 'Afficher qui parle (chat vocal)', 'Anzeigen, wer spricht (Sprachchat)'],
  'voz.habla': ['{n} está hablando', '{n} is talking', '{n} está falando', '{n} sedang bicara', '{n} sedang bercakap', 'Nagsasalita si {n}', '{n}が話しています', '{n} กำลังพูด', '{n} konuşuyor', '{n} يتحدث', '{n} говорит', '{n} говорить', '{n} parle', '{n} spricht'],
});
