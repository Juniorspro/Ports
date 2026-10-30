// ---------------------------------------------------------------------------------------------------------
// Tool Gun: las 20 herramientas del juego con sus parámetros (los del inspector original).
// Las que ponen una cosa (Button, LogicGate, Timer, Spawner, Remover, Repulsor, Nextbot, Monitor, Mover,
// LocalRotator, LocalMover, Trigger, Lamp, PasswordPanel, SpawnPoint) la dejan congelada donde apuntás;
// Wire une la salida de una con la entrada de otra; Remove borra; Duplicate copia.
// Señales: Button, Timer, Trigger, PasswordPanel y LogicGate dan verdadero/falso; lo demás se activa con eso.
// ---------------------------------------------------------------------------------------------------------
const HER = { sel: 0, params: {}, cable: null, ents: [] };
const PREFAB_HER = { SimpleNextbot: 'Nextbot', Nextbot: 'Nextbot' };
function equiparHerramienta(i) {
  HER.sel = i; const k = ARM.lista.indexOf('ToolBaton'); if (k >= 0) elegirArma(k); else darArma('ToolBaton');
  const h = DATA.herr[i]; if (!HER.params[h.n]) { HER.params[h.n] = {}; for (const p of h.p) HER.params[h.n][p.n] = p.t === 'String[]' ? p.o[0] : p.t === 'Boolean' ? false : p.t === 'Single' ? (/Speed/.test(p.n) ? 2 : /Distance|Size|Range/.test(p.n) ? 4 : /Force/.test(p.n) ? 20 : /Degree/.test(p.n) ? 90 : /Time|Delete/.test(p.n) ? 1 : 1) : p.t === 'Int32' ? 0 : p.n === 'Prop name' ? 'Crate' : p.n === 'Password' ? '1234' : ''; }
  HER.cable = null;
  aviso('Tool Gun: ' + h.n, 1.5);
}
function inspectorHerramienta(el) {
  const h = DATA.herr[HER.sel]; el.classList.remove('oc');
  let s = `<h4>${h.n}</h4>`;
  for (const p of h.p) {
    const v = HER.params[h.n][p.n], id = 'hp_' + p.n.replace(/\W/g, '');
    if (p.t === 'String[]') s += `<label>${p.n}</label><select id="${id}">${p.o.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    else if (p.t === 'Boolean') s += `<label><input type="checkbox" id="${id}" ${v ? 'checked' : ''} style="width:auto"> ${p.n}</label>`;
    else s += `<label>${p.n}</label><input id="${id}" value="${String(v).replace(/"/g, '')}" ${p.t === 'Single' || p.t === 'Int32' ? 'type="number" step="any"' : ''}>`;
  }
  const ayuda = { Remove: 'Clic: borra lo que apuntás.', Duplicate: 'Clic: copia lo que apuntás.', Wire: 'Clic en lo que da la señal y después en lo que la recibe.', Mover: 'Prop Id 0 = se mueve él mismo. El ID de cada cosa se ve al apuntarla con la Tool Gun.' };
  if (ayuda[h.n]) s += `<p style="color:#aaa;font-size:11px">${ayuda[h.n]}</p>`;
  el.innerHTML = s;
  for (const p of h.p) { const e = $('hp_' + p.n.replace(/\W/g, '')); if (!e) continue; e.onchange = e.oninput = () => { HER.params[h.n][p.n] = p.t === 'Boolean' ? e.checked : p.t === 'Single' || p.t === 'Int32' ? +e.value : e.value; }; }
}
function herramientaUsar(alt) {
  const h = DATA.herr[HER.sel]; if (!h) return;
  const r = raycast(CAM.pos, CAM.fwd, 80, null);
  efectoTraza(vistaPuntaMundo() || CAM.pos, r ? r.p : vadd(CAM.pos, vscale(CAM.fwd, 80)));
  sonar('Click', null, 0.5, 1.4);
  const o = r && r.body && r.body.obj;
  if (h.n === 'Remove') { if (o) { efectoChispas(o.b.pos); borrarObjeto(o); } return; }
  if (h.n === 'Duplicate') { if (o) { const n = crearObjeto(o.nombre, vadd(o.b.pos, v3(0, (o.b.aabb.y1 - o.b.aabb.y0) + 0.05, 0)), o.b.q.clone(), { exacto: true, congelado: o.b.frozen }); if (n) { if (o.logica) n.logica = Object.assign({}, o.logica, { params: Object.assign({}, o.logica.params), entradas: [] }); DESHACER.push(n); redObjeto(); } } return; }
  if (h.n === 'Wire') {
    if (!o || !o.logica) { HER.cable = null; aviso('Apuntá a una de las cosas de la Tool Gun', 1.5); return; }
    if (!HER.cable) { HER.cable = o; aviso('Ahora elegí a dónde llega la señal', 1.5); return; }
    if (HER.cable !== o) { if (!o.logica.entradas.includes(HER.cable)) o.logica.entradas.push(HER.cable); aviso('Conectado: ' + HER.cable.logica.tipo + ' → ' + o.logica.tipo, 1.5); }
    HER.cable = null; return;
  }
  if (alt) { // clic derecho: cambiar el estado de un botón o leer el ID
    if (o && o.logica && o.logica.tipo === 'Button') pulsarBoton(o);
    else if (o) aviso('ID: ' + o.id + ' · ' + o.nombre, 2);
    return;
  }
  // las demás ponen su cosa donde apuntás
  if (!r) return;
  const nombre = PREFAB_HER[h.n] || h.n;
  if (!DATA.pfPorNombre[nombre]) { aviso('No hay modelo para ' + h.n, 1.5); return; }
  const q = qSobre(r.n, JUG.yaw);
  const n = crearObjeto(nombre, r.p, q, { congelado: !/Nextbot/.test(h.n) });
  if (!n) return;
  n.logica = { tipo: h.n, params: Object.assign({}, HER.params[h.n]), entradas: [], salida: false, t: 0, base: n.b.pos.clone(), qbase: n.b.q.clone() };
  if (/Nextbot/.test(h.n)) nextbotNuevo(n);
  DESHACER.push(n); HER.ents.push(n); redObjeto();
}
// orientación apoyada sobre una superficie (arriba = la normal)
function qSobre(n, yaw) {
  const qy = Quat.axis(0, 1, 0, yaw + Math.PI); const up = v3(0, 1, 0), d = vdot(up, n);
  if (d > 0.999) return qy;
  const ax = vcross(up, n).norm(); return Quat.axis(ax.x, ax.y, ax.z, Math.acos(clamp(d, -1, 1))).mul(qy);
}
function efectoChispas(p) { for (let i = 0; i < 10; i++) particula(p, v3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), 0.5, 0.1, [1, 1, 1, 1], 'fog', 0.5); }
function pulsarBoton(o) { o.logica.salida = !o.logica.salida; sonar('Click', o.b.pos, 0.8); if (DATA.an.clips.ButtonDown) {} }
// ¿la entrada está activa? (sin cables = siempre)
function entradaActiva(L) {
  if (!L.entradas.length) return true;
  return L.entradas.some((e) => OBJS.includes(e) && e.logica && e.logica.salida);
}
const _hEje = (s) => (s === 'X' ? v3(1, 0, 0) : s === 'Z' ? v3(0, 0, 1) : v3(0, 1, 0));
function herramientasPaso(dt) {
  // mira de la Tool Gun: mostrar el ID de lo que apunta
  const enTool = ARM.lista[ARM.i] === 'ToolBaton' && !UI.abierto;
  let txt = '';
  if (enTool) { const r = raycast(CAM.pos, CAM.fwd, 30, null); if (r && r.body && r.body.obj) txt = `${r.body.obj.nombre} · ID ${r.body.obj.id}`; }
  else { const r = raycast(CAM.pos, CAM.fwd, 4.5, null); if (r && r.body && r.body.ent) txt = 'E: ' + T('ent.' + r.body.ent.t); else if (r && r.body && r.body.obj) { const o = r.body.obj; if (o.veh) txt = 'E: subir'; else if (o.tipo === 'arma') txt = 'E: agarrar ' + o.nombre; else if (o.logica && (o.logica.tipo === 'Button' || o.logica.tipo === 'PasswordPanel')) txt = 'E: usar'; } }
  if (!txt && !enTool) txt = nocheApunta(); // (los botones de la oficina de la pizzería)
  if (herramientasPaso.txt !== txt) { herramientasPaso.txt = txt; $('usarTxt').textContent = txt; }
  const arma = ARM.lista[ARM.i];
  if (PREFS.contorno !== false && !UI.abierto && (arma === 'PhysicsGun' || arma === 'ToolBaton' || arma === 'GravityGun')) {
    const A = ARM.agarre && ARM.agarre.b.obj, r = A ? null : raycast(CAM.pos, CAM.fwd, arma === 'GravityGun' ? 25 : 50, null), o = A || (r && r.body && r.body.obj);
    if (o && !o.remoto) o.md.resaltar = TIEMPO.t;
  }
  for (let k = HER.ents.length - 1; k >= 0; k--) {
    const o = HER.ents[k]; if (!OBJS.includes(o)) { if (o.logica.tag) o.logica.tag.remove(); HER.ents.splice(k, 1); continue; }
    const L = o.logica, P = L.params, on = entradaActiva(L);
    L.t += dt;
    switch (L.tipo) {
      case 'LogicGate': {
        const v = L.entradas.filter((e) => OBJS.includes(e) && e.logica).map((e) => !!e.logica.salida), n = v.filter(Boolean).length;
        const m = P.Mode, r = m === 'AND' ? v.length > 0 && n === v.length : m === 'OR' ? n > 0 : m === 'XOR' ? n % 2 === 1 : m === 'NAND' ? !(v.length > 0 && n === v.length) : m === 'NOR' ? n === 0 : n % 2 === 0;
        L.salida = r; break;
      }
      case 'Timer': { const T = Math.max(0.1, P.Time || 1); if (on) { if (L.t >= T) { L.t = 0; L.salida = !L.salida; } } else { L.salida = false; L.t = 0; } break; }
      case 'Trigger': {
        const s = Math.max(0.5, P.Size || 2), c = o.b.pos; let hay = false;
        if ((P.Mode === 'Everything' || P.Mode === 'Player') && JUG.pos.distTo(c) < s) hay = true;
        if (!hay && P.Mode !== 'Player') for (const x of OBJS) { if (x === o || x.logica) continue; if (P.Mode === 'Vehicle' && !x.veh) continue; if (P['Object name'] && x.nombre !== P['Object name']) continue; if (x.b.pos.distTo(c) < s) { hay = true; break; } }
        L.salida = hay; break;
      }
      case 'Lamp': L.luz = on; o.md.extra = { em: on ? [1.2, 1.1, 0.7] : [0, 0, 0] }; break;
      case 'Mover': case 'LocalMover': case 'LocalRotator': {
        const obj = P['Prop Id'] ? OBJS.find((x) => x.id === (P['Prop Id'] | 0)) : o; if (!obj) break;
        if (!obj.logBase) { obj.logBase = obj.b.pos.clone(); obj.logQ = obj.b.q.clone(); obj.logT = 0; }
        if (!on) break;
        obj.logT += dt * (P.Speed || 1);
        const ax = L.tipo === 'LocalRotator' || L.tipo === 'LocalMover' ? obj.logQ.rot(_hEje(P.Direction)) : _hEje(P.Direction);
        obj.b.frozen = true; obj.b.wake();
        if (L.tipo === 'LocalRotator') { const deg = P.Degree || 0, ang = deg ? Math.sin(obj.logT) * deg * Math.PI / 180 : obj.logT; obj.b.q.copy(Quat.axis(ax.x, ax.y, ax.z, ang).mul(obj.logQ)); }
        else if (L.tipo === 'LocalMover') { const R2 = P.Range || 2; obj.b.pos.copy(obj.logBase).addS(ax, Math.sin(obj.logT) * R2); }
        else { const a = P['Position A'] || 0, b = P['Position B'] || 4, k = (Math.sin(obj.logT) + 1) / 2; obj.b.pos.copy(obj.logBase).addS(ax, a + (b - a) * k); }
        obj.b.updateWorld(); obj.md.sucio = true; obj.dibujado = false;
        break;
      }
      case 'Spawner': {
        const T = Math.max(0.3, P['Delete after'] || 1);
        if (on && L.t > 1.0) {
          L.t = 0; const n = crearObjeto(P['Prop name'] || 'Crate', vadd(o.b.pos, o.b.q.rot(v3(0, P.Distance || 1, 0))), new Quat(), { congelado: !!P.Kinematic });
          if (n) { n.borrarEn = TIEMPO.t + Math.max(T, 1) * 5; HER.spawned = HER.spawned || []; HER.spawned.push(n); }
        }
        break;
      }
      case 'Remover': if (on) for (const x of OBJS.slice()) { if (x === o || x.logica || x.veh) continue; if (x.b.pos.distTo(o.b.pos) < (P.Distance || 3)) { efectoChispas(x.b.pos); borrarObjeto(x); } } break;
      case 'Repulsor': if (on) for (const b of PH.bodies) { if (!b.dynamic || b === o.b) continue; const d = vsub(b.pos, o.b.pos), L2 = d.len(); if (L2 < (P.Distance || 4) && L2 > 0.01) { b.wake(); b.vel.addS(d.scale(1 / L2), (P.Force || 20) * dt * 3); } } break;
      case 'MonitorController': L.salida = on; break;
      case 'Monitor': { const c = L.entradas.find((e) => OBJS.includes(e) && e.logica && e.logica.tipo === 'MonitorController'); L.texto = c && c.logica.salida ? c.logica.params.Text : ''; L.color = c ? c.logica.params['Background color'] : 'Black'; break; }
      case 'SpawnPoint': MUNDO.spawnJug = o.b.pos.clone(); break;
      case 'SimpleNextbot': case 'Nextbot': nextbotPaso(o, dt); break;
    }
  }
  if (HER.spawned) for (let i = HER.spawned.length - 1; i >= 0; i--) { const n = HER.spawned[i]; if (!OBJS.includes(n)) { HER.spawned.splice(i, 1); continue; } if (TIEMPO.t > n.borrarEn) { borrarObjeto(n); HER.spawned.splice(i, 1); } }
}
// usar con E sobre un botón o el panel de contraseña
function usarLogica(o) {
  const L = o.logica;
  if (L.tipo === 'Button') { pulsarBoton(o); return true; }
  if (L.tipo === 'PasswordPanel') { soltarPuntero(); const t = prompt('Contraseña'); if (t !== null) { const ok = t === String(L.params.Password); L.salida = ok; sonar(ok ? 'Click' : 'BODY_Fart_mono', o.b.pos, 0.8); aviso(ok ? 'Correcta' : 'Incorrecta', 1.5); if (ok) setTimeout(() => (L.salida = false), 5000); } return true; }
  return false;
}
// cables y textos de monitores
function dibujarHerramientas() {
  for (const o of HER.ents) {
    for (const e of o.logica.entradas) if (OBJS.includes(e)) linea(e.b.pos, o.b.pos, e.logica && e.logica.salida ? [0.3, 1, 0.4, 0.9] : [0.2, 0.7, 1, 0.7]);
    if (o.nb) dibujarNextbot(o);
    if (o.logica.tipo === 'Monitor') {
      const L = o.logica; if (!L.tag) { L.tag = document.createElement('div'); L.tag.className = 'etiqueta monitor'; $('hud').appendChild(L.tag); }
      const cl = L.texto ? clipDe(vadd(o.b.pos, o.b.q.rot(v3(0, 0.5, 0)))) : null;
      if (cl && o.b.pos.distTo(CAM.pos) < 30) { const col = { Black: '#000', Red: '#b00', Blue: '#03a', Violet: '#606', Orange: '#c60', Pink: '#c4a', Green: '#080' }[L.color] || '#000';
        L.tag.style.display = ''; L.tag.style.background = col; L.tag.textContent = L.texto; L.tag.style.transform = `translate(${cl.x}px,${cl.y}px) translate(-50%,-50%)`; } else L.tag.style.display = 'none';
    }
  }
  if (HER.cable && OBJS.includes(HER.cable)) { const r = raycast(CAM.pos, CAM.fwd, 60, null); linea(HER.cable.b.pos, r ? r.p : vadd(CAM.pos, vscale(CAM.fwd, 10)), [1, 1, 0.3, 0.9]); }
}
// ---------------- Nextbot: una imagen que persigue al jugador ----------------
function nextbotNuevo(o) {
  const P = o.logica.params, img = new Image();
  const fuentes = { '#Obunga': 'nextbot', '#Toilet': 'Toilet', '#Scream': 'death-skull' };
  img.crossOrigin = 'anonymous';
  img.src = P['Image URL'] ? P['Image URL'] : icono(fuentes[P.Type] || 'nextbot');
  o.nb = { img, tex: null, tam: P['Image size'] === 'Big' ? 4 : P['Image size'] === 'Small' ? 1.4 : 2.4, vel: 7.5, golpeT: 0 };
  o.b.frozen = false; o.b.noGrab = false;
  img.onload = () => {
    const gl = R.gl, t = gl.createTexture(); let src = img; try { src = texAjustar(img, 1024); } catch (e) {}
    gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, src === img); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) {} gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D); o.nb.tex = t;
  };
}
function nextbotPaso(o, dt) {
  const N = o.nb; if (!N) return; const b = o.b;
  b.frozen = false; b.wake();
  const d = vsub(JUG.pos, b.pos); d.y = 0; const L = d.len();
  if (L > 0.5 && JUG.vivo) { d.scale(1 / L); b.vel.x += (d.x * N.vel - b.vel.x) * Math.min(1, dt * 3); b.vel.z += (d.z * N.vel - b.vel.z) * Math.min(1, dt * 3); }
  b.ang.set(0, 0, 0); b.q.set(0, 0, 0, 1);
  N.golpeT -= dt;
  if (L < 1.4 && N.golpeT <= 0 && JUG.vivo) { N.golpeT = 0.8; danarJugador(40, b.pos); JUG.vel.addS(vscale(d, 1), 10); JUG.vel.y += 4; sonar('GORE_Splat_Hit_Bubbles_mono', b.pos, 1); }
  if (Math.random() < dt * 0.4) sonar('BODY_Fart_mono', b.pos, 0.6, 0.6);
}
function dibujarNextbot(o) {
  const N = o.nb; if (!N.tex) return;
  const s = N.tam / 2, p = vadd(o.b.pos, v3(0, s, 0)), c = [1, 1, 1, 1];
  PART.extra = PART.extra || [];
  PART.extra.push({ p, s, tex: N.tex });
}
