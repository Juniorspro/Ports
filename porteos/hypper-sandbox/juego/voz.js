// ---------------- voz por cercanía (como el Hunter) ----------------
// Cada uno que habla le manda su micrófono a los que están cerca con WebRTC (una conexión de ida por par; las señales van
// por la red del juego), y del otro lado la voz sale del lugar del que habla: panner HRTF, distancia, paredes y eco.
const VOZ = { on: false, stream: null, sal: new Map(), ent: new Map(), tRev: 0, quien: new Map() };
const VOZ_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const VOZ_CERCA = 70, VOZ_LEJOS = 90, VOZ_MAX = 10;
function vozBotonPoner(si) {
  let b = $('vozBt');
  if (!b) { b = document.createElement('div'); b.id = 'vozBt'; b.className = 'bt modBt'; b.textContent = '🎤'; b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); audioIniciar(); VOZ.on ? vozApagar() : vozActivar(); }; $('hud').appendChild(b); }
  b.style.display = si ? '' : 'none'; b.classList.toggle('on', VOZ.on);
}
async function vozActivar() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { aviso('Este navegador no deja usar el micrófono', 3); return; }
  try { VOZ.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { aviso('Sin permiso para el micrófono', 3); return; }
  VOZ.on = true; vozBotonPoner(true); aviso('🎤 Micrófono prendido', 2);
}
function vozApagar() {
  VOZ.on = false; if (VOZ.stream) VOZ.stream.getTracks().forEach((t) => t.stop()); VOZ.stream = null;
  for (const [id] of VOZ.sal) vozCerrarSal(id);
  if ($('vozBt')) $('vozBt').classList.remove('on');
}
function vozCerrarSal(id) { const C = VOZ.sal.get(id); if (C) { try { C.pc.close(); } catch (e) {} VOZ.sal.delete(id); publicar('a', { k: 'rtc', to: id, fin: 1 }); } }
function vozCerrarEnt(id) { const C = VOZ.ent.get(id); if (C) { try { C.pc.close(); } catch (e) {} if (C.el) C.el.remove(); try { C.src && C.src.disconnect(); } catch (e) {} VOZ.ent.delete(id); } }
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
  C.F = fuente3D(CAM.pos, 1.6); C.src.connect(C.F.g); C.F.p.panningModel = 'HRTF'; C.F.p.refDistance = 2; C.F.p.rolloffFactor = 1.3;
  C.an = c.createAnalyser(); C.an.fftSize = 256; C.src.connect(C.an); C.nivel = new Uint8Array(C.an.fftSize);
}
// cada cuadro: posición de cada voz, paredes, quién habla, y conectar o cortar según la distancia
function vozPaso(dt) {
  if (!RED.on) return;
  for (const [id, C] of VOZ.ent) {
    const R2 = RED.remotos.get(id); if (!R2) { vozCerrarEnt(id); continue; }
    if (!C.F) continue;
    const p = vadd(R2.P.pos, v3(0, 1.1, 0)); ponerPos(C.F.p, p);
    C.tOcl = (C.tOcl || 0) - dt; if (C.tOcl <= 0) { C.tOcl = 0.3; const t = audioTapado(p); C.F.f.frequency.value = t ? 1100 : 20000; C.F.g.gain.value = t ? 0.9 : 1.6; }
    C.an.getByteTimeDomainData(C.nivel); let m = 0; for (const v of C.nivel) m = Math.max(m, Math.abs(v - 128));
    if (R2.tag) R2.tag.classList.toggle('habla', m > 10);
  }
  VOZ.tRev -= dt; if (VOZ.tRev > 0) return; VOZ.tRev = 0.5;
  if (!VOZ.on || !VOZ.stream) return;
  const cerca = [...RED.remotos.values()].map((R2) => [R2.id, R2.P.pos.distTo(JUG.pos)]).sort((a, b) => a[1] - b[1]);
  cerca.forEach(([id, d], i) => {
    if (!VOZ.sal.has(id) && d < VOZ_CERCA && i < VOZ_MAX) vozLlamar(id).catch(() => VOZ.sal.delete(id));
    else if (VOZ.sal.has(id) && (d > VOZ_LEJOS || i >= VOZ_MAX + 2)) vozCerrarSal(id);
  });
}
