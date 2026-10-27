// ---------------------------------------------------------------------------------------------------------
// Anfitrión (la pestaña Host del menú del juego): hora del día y ciclo, PvP, Nextbots, topes de props y de
// vehículos, desactivar el spawn de objetos para los demás, echar jugadores y limpiar el mapa. En una sala la
// controla quien la creó y llega a todos (mensaje retenido "cfg"); solo, se aplica en el momento.
// ---------------------------------------------------------------------------------------------------------
const HOST = { ds: false, ultCfg: 0 };
function soyAnfitrion() { return typeof SALA === 'undefined' || !SALA || (!SALA.of && !!SALA.du && SALA.du === RED.ID); }
function hostCfg() { return { h: +DIA.hora.toFixed(3), c: DIA.ciclo ? 1 : 0, pvp: SALA ? SALA.pvp : 1, nb: SALA ? SALA.nb : 1, mp: SALA ? SALA.mp : 1000, mv: SALA ? SALA.mv : 40, ds: HOST.ds ? 1 : 0 }; }
function hostPublicar() {
  if (typeof SALA === 'undefined' || !SALA || SALA.of || !soyAnfitrion() || typeof publicar !== 'function') return;
  HOST.ultCfg = TIEMPO.t; publicar('cfg', hostCfg(), true); if (typeof presencia === 'function') presencia();
}
function recibirCfg(d) {
  if (!SALA || SALA.of || d.i !== SALA.du) return;
  DIA.hora = num(d.h, 0, 24, 12); DIA.ciclo = !!d.c; DIA.aplicada = -1;
  SALA.pvp = d.pvp ? 1 : 0; SALA.nb = d.nb ? 1 : 0; SALA.mp = num(d.mp, 0, 5000, 1000) | 0; SALA.mv = num(d.mv, 0, 200, 40) | 0; HOST.ds = !!d.ds;
  if (UI.abierto === 'spawn' && DATA.menu[UI.tab] && DATA.menu[UI.tab].n === 'Host') spawnDibujar();
}
// el anfitrión vuelve a mandar la configuración cada tanto (así la hora del ciclo no se desfasa)
function hostPaso() { if (SALA && !SALA.of && soyAnfitrion() && RED.on && TIEMPO.t - HOST.ultCfg > 20) hostPublicar(); }
function hostHecho(d) {
  if (!SALA || d.i !== SALA.du) return false;
  if (d.k === 'kick' && d.to === RED.ID) { irMenuPrincipal(); setTimeout(() => menuAviso(Lc('Kicked', 'You were kicked from the game')), 300); return true; }
  if (d.k === 'limpiar') { for (const o of OBJS.filter((x) => !x.remoto)) borrarObjeto(o); aviso('El anfitrión limpió el mapa', 2); return true; }
  return false;
}
// el panel dentro del menú de spawn
function hostDibujar(gr) {
  const multi = typeof SALA !== 'undefined' && SALA, yo = soyAnfitrion(), puede = yo && !(multi && SALA.of);
  const hh = (h) => { const H = Math.floor(h) % 24, M = Math.floor((h % 1) * 60); return (H < 10 ? '0' : '') + H + ':' + (M < 10 ? '0' : '') + M; };
  gr.innerHTML = `<div class="host">
    <h4>${Lc('Day', 'Day')} · <span id="hHoraV">${hh(DIA.hora)}</span></h4>
    <div class="hFila">${[['Amanecer', 7], ['Día', 12], ['Atardecer', 17.5], ['Noche', 0]].map(([n, h]) => `<button class="boton chico" data-h="${h}">${n}</button>`).join('')}</div>
    <div class="hFila"><input type="range" id="hHora" min="0" max="24" step="0.1" value="${DIA.hora}"><label><input type="checkbox" id="hCiclo" ${DIA.ciclo ? 'checked' : ''}> Ciclo</label></div>
    ${multi ? `<h4>${Lc('Host', 'Host')}${yo ? '' : ' · solo el anfitrión cambia esto'}</h4>
    <div class="hFila"><label><input type="checkbox" id="hPvp" ${SALA.pvp ? 'checked' : ''} ${puede ? '' : 'disabled'}> PvP</label>
      <label><input type="checkbox" id="hNb" ${SALA.nb ? 'checked' : ''} ${puede ? '' : 'disabled'}> Nextbots</label>
      <label><input type="checkbox" id="hDs" ${HOST.ds ? 'checked' : ''} ${puede ? '' : 'disabled'}> ${Lc('DisableSpawnObjects', 'Disable Spawn Objects')}</label></div>
    <div class="hFila">${Lc('MaxProps', 'Max props:')} <input type="number" id="hMp" min="0" max="5000" value="${SALA.mp}" ${puede ? '' : 'disabled'}>
      ${Lc('MaxVehicles', 'Max vehicles:')} <input type="number" id="hMv" min="0" max="200" value="${SALA.mv}" ${puede ? '' : 'disabled'}></div>
    <h4>${Lc('Players', 'Players')}</h4><div id="hJug"></div>` : ''}
    <div class="hFila"><button class="boton gris" id="hLimpiar">${multi && puede ? 'Limpiar el mapa de todos' : 'Limpiar mis cosas'}</button></div>
  </div>`;
  const cambiar = () => { DIA.aplicada = -1; diaAplicar(); $('hHoraV').textContent = hh(DIA.hora); hostPublicar(); };
  gr.querySelectorAll('[data-h]').forEach((b) => (b.onclick = () => { if (multi && !yo) return aviso('Solo el anfitrión', 1.2); DIA.hora = +b.dataset.h; $('hHora').value = DIA.hora; cambiar(); }));
  $('hHora').oninput = () => { if (multi && !yo) { $('hHora').value = DIA.hora; return; } DIA.hora = +$('hHora').value; cambiar(); };
  $('hCiclo').onchange = () => { if (multi && !yo) { $('hCiclo').checked = DIA.ciclo; return; } DIA.ciclo = $('hCiclo').checked; cambiar(); };
  if (multi && puede) {
    $('hPvp').onchange = () => { SALA.pvp = $('hPvp').checked ? 1 : 0; hostPublicar(); };
    $('hNb').onchange = () => { SALA.nb = $('hNb').checked ? 1 : 0; hostPublicar(); };
    $('hDs').onchange = () => { HOST.ds = $('hDs').checked; hostPublicar(); };
    $('hMp').onchange = () => { SALA.mp = num(+$('hMp').value, 0, 5000, 1000) | 0; hostPublicar(); };
    $('hMv').onchange = () => { SALA.mv = num(+$('hMv').value, 0, 200, 40) | 0; hostPublicar(); };
  }
  if (multi) {
    const L = $('hJug'); L.innerHTML = '';
    const yoFila = document.createElement('div'); yoFila.className = 'hJ'; yoFila.textContent = PREFS.nombre + (yo ? ' (' + Lc('Owner', 'Owner') + ')' : ''); L.appendChild(yoFila);
    for (const R2 of RED.remotos.values()) {
      const f = document.createElement('div'); f.className = 'hJ'; f.textContent = R2.nombre + (R2.id === SALA.du ? ' (' + Lc('Owner', 'Owner') + ')' : '');
      if (puede) { const b = document.createElement('button'); b.className = 'boton chico'; b.textContent = 'Echar'; b.onclick = () => { publicar('a', { k: 'kick', to: R2.id }); aviso(R2.nombre + ' fuera', 1.5); }; f.appendChild(b); }
      L.appendChild(f);
    }
  }
  $('hLimpiar').onclick = () => {
    for (const o of OBJS.filter((x) => !x.remoto)) borrarObjeto(o);
    if (multi && puede) publicar('a', { k: 'limpiar' });
    cerrarPaneles(); aviso('Listo: mapa limpio');
  };
}
