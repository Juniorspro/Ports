// El evento del termo: el termo en 3D (modelo hecho con IA —Higgsfield, Tripo— y mostrado con Three.js, con reflejos de
// metal) que gira con los stickers de los 5 elegidos pegados alrededor, en curva, sin tapar la manija. Antes del sorteo
// son signos de pregunta y abajo va el avance. Si el celu no tiene WebGL, queda el termo de CSS (un cilindro de tiras).
const CARAS = 30;
function cilindro(clase, radio, alto, color, brillo) {
  // (cada tira tiene su luz según hacia dónde mira: así parece metal redondo)
  let h = `<div class="${clase}" style="height:${alto}px">`;
  const ancho = (2 * Math.PI * radio) / CARAS + 0.6;
  for (let i = 0; i < CARAS; i++) {
    const a = (360 / CARAS) * i, luz = Math.cos(((a - 35) * Math.PI) / 180), l = Math.round(14 + 34 * Math.max(0, luz) + 22 * brillo * Math.pow(Math.max(0, luz), 14));
    h += `<i style="width:${ancho}px;height:${alto}px;margin-left:${-ancho / 2}px;transform:rotateY(${a}deg) translateZ(${radio}px);background:hsl(${color} ${l}%)"></i>`;
  }
  return h + '</div>';
}
export function abrirTermo({ ev, media, al, X }) {
  const el = document.createElement('div'); el.className = 'termoEv';
  const hechos = !!ev.sorteado, falta = Math.max(0, ev.meta - ev.cuentas), pct = Math.min(100, Math.round((ev.cuentas / ev.meta) * 100));
  const pegados = hechos ? ev.elegidos : Array.from({ length: 5 }, () => null);
  const stickers = pegados.map((x, k) => `<div class="tPegado" style="transform:rotateY(${k * 72}deg) translateZ(84px) translateY(${[-30, 40, -6, 52, 6][k]}px) rotate(${[-8, 6, -4, 9, -6][k]}deg)">${x ? `<img src="${media({ id: x.pack.id, v: x.pack.v }, x.pack.sticker)}" alt="">` : '<b>?</b>'}</div>`).join('');
  el.innerHTML = `<button class="mpCerrar" aria-label="Cerrar">✕</button>
    <div class="tArriba"><small>Primer evento</small><h2>El termo de los <em>elegidos</em></h2>
      <p>${hechos ? 'El termo ya eligió: estos 5 son los que les recomendamos a todos los que bajan la app.' : `Cuando <b>${ev.meta} cuentas</b> publiquen stickers, el termo elige <b>5</b> al azar. Sus stickers van a girar acá y se los vamos a recomendar a todos los que bajen la app.`}</p></div>
    <div class="tEscena"><div class="tPiso"></div><canvas class="t3d"></canvas><div class="tTermo oc">
      ${cilindro('tCuerpo', 70, 250, '150 48%', 1)}${cilindro('tAnillo', 71.5, 18, '150 30%', 0.4)}${cilindro('tAnillo2', 71.5, 10, '150 30%', 0.4)}${cilindro('tTapa', 54, 56, '150 34%', 1.2)}${cilindro('tPico', 24, 30, '40 6%', 1.6)}
      <div class="tFranja"></div>${stickers}</div></div>
    <div class="tAbajo">${hechos
      ? `<div class="tElegidos">${ev.elegidos.map((x) => `<button class="tEl" data-u="${X.h(x.autor.nombre)}"><span class="avG" style="background:${X.h(x.autor.avatar.c)}">${X.h(x.autor.avatar.e)}</span><small>@${X.h(x.autor.nombre)}</small></button>`).join('')}</div>`
      : `<div class="tBarra"><i style="width:${pct}%"></i></div><b class="tCuenta"><span data-n="${ev.cuentas}">0</span> de ${ev.meta} cuentas</b><small>${falta ? `Faltan ${falta}. Publicá un pack y sumate 🧉` : '¡Ya están! El sorteo sale en un ratito'}</small>`}
      <button class="grande tBoton">${hechos ? 'Ver sus packs' : 'Publicar mi pack'}</button></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('entra'));
  // (el número sube de a poco)
  const n = el.querySelector('[data-n]'); if (n) { const fin = +n.dataset.n, t0 = performance.now(); const paso = (t) => { const k = Math.min(1, (t - t0) / 1200); n.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(paso); }; requestAnimationFrame(paso); }
  // (arrastrar con el dedo lo gira más rápido; vel en grados por cuadro)
  const termo = el.querySelector('.tTermo'), esc = el.querySelector('.tEscena'); let giro = 0, vel = 0.4, x0 = null, vivo = true, en3d = null;
  // (vel en grados por cuadro de 60 fps: se multiplica por el tiempo que pasó, así gira igual en un celu lento)
  let antes = performance.now();
  const anim = (ahora) => { if (!vivo) return; const f = Math.min(6, (ahora - antes) / 16.7); antes = ahora; giro += vel * f; vel += (0.5 - vel) * Math.min(1, 0.02 * f); termo.style.setProperty('--giro', giro + 'deg'); if (en3d) en3d(giro); requestAnimationFrame(anim); }; requestAnimationFrame(anim);
  esc.addEventListener('pointerdown', (e) => { x0 = e.clientX; esc.setPointerCapture(e.pointerId); });
  esc.addEventListener('pointermove', (e) => { if (x0 == null) return; vel = (e.clientX - x0) * 0.5; x0 = e.clientX; });
  esc.addEventListener('pointerup', () => { x0 = null; });
  let soltar = () => {};
  montar3D(el.querySelector('.t3d'), pegados.map((x) => (x ? media({ id: x.pack.id, v: x.pack.v }, x.pack.sticker) : null)))
    .then((r) => { if (!vivo) return r.soltar(); en3d = r.dibujar; soltar = r.soltar; })
    .catch((e) => { console.warn('termo 3D:', e); el.querySelector('.t3d').remove(); termo.classList.remove('oc'); });
  const cerrar = () => { vivo = false; soltar(); el.classList.add('chau'); setTimeout(() => el.remove(), 380); };
  el.querySelector('.mpCerrar').onclick = cerrar;
  el.querySelector('.tBoton').onclick = () => { cerrar(); al(hechos ? 'ver' : 'publicar'); };
  el.querySelectorAll('.tEl').forEach((b) => (b.onclick = () => { cerrar(); al('usuario', b.dataset.u); }));
  return { cerrar };
}

// ---- el termo de verdad (Three.js) ----
// (el sticker de signo de pregunta, para antes del sorteo)
function pregunta(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(24, 24, 208, 208, 46); g.fill();
  g.fillStyle = '#1f5c45'; g.font = '400 170px LuckiestGuy, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 128, 146);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
async function montar3D(cv, urls) {
  const THREE = await import('./lib/three.module.min.js'), { GLTFLoader } = await import('./lib/GLTFLoader.js'), { RoomEnvironment } = await import('./lib/RoomEnvironment.js');
  const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
  ren.setPixelRatio(Math.min(2, devicePixelRatio || 1)); ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
  const esc = new THREE.Scene(), pm = new THREE.PMREMGenerator(ren); esc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50); cam.position.set(0, 0.45, 5.4); cam.lookAt(0, 0, 0);
  const luz = new THREE.DirectionalLight(0xffffff, 2.2); luz.position.set(2.5, 3, 3); esc.add(luz);
  const borde = new THREE.DirectionalLight(0x7dffb2, 2.4); borde.position.set(-3, 1.5, -2.5); esc.add(borde);
  esc.add(new THREE.HemisphereLight(0xffffff, 0x1f5c45, 0.5));
  const glb = await new GLTFLoader().loadAsync('termo/termo.glb'), modelo = glb.scene;
  // a 2 de alto, centrado
  let caja = new THREE.Box3().setFromObject(modelo); const k = 2 / caja.getSize(new THREE.Vector3()).y; modelo.scale.setScalar(k);
  caja = new THREE.Box3().setFromObject(modelo); modelo.position.sub(caja.getCenter(new THREE.Vector3()));
  modelo.updateMatrixWorld(true);
  // el cuerpo: el centro sale de la base (redonda, sin manija); el radio, del lado de la mitad que no tiene nada pegado; la
  // manija, del punto de la mitad que más sobresale
  const base = [], medio = []; modelo.traverse((o) => { if (!o.isMesh) return; const pos = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y > -0.88 && v.y < -0.62) base.push([v.x, v.z]); else if (v.y > -0.35 && v.y < 0.25) medio.push([v.x, v.z]); } });
  const rango = (l, k) => l.reduce((r, p) => [Math.min(r[0], p[k]), Math.max(r[1], p[k])], [Infinity, -Infinity]);
  const [bx0, bx1] = rango(base, 0), [bz0, bz1] = rango(base, 1), cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  const [mx0, mx1] = rango(medio, 0), [mz0, mz1] = rango(medio, 1), R = Math.min(cx - mx0, mx1 - cx, cz - mz0, mz1 - cz);
  let lejos = medio[0]; for (const p of medio) if (Math.hypot(p[0] - cx, p[1] - cz) > Math.hypot(lejos[0] - cx, lejos[1] - cz)) lejos = p;
  // (ángulo como CylinderGeometry: x = R·sen θ, z = R·cos θ)
  const manija = Math.atan2(lejos[0] - cx, lejos[1] - cz);
  const giro = new THREE.Group(); giro.add(modelo); esc.add(giro); modelo.position.x -= cx; modelo.position.z -= cz;
  // los stickers: un pedazo de cilindro apenas más grande que el cuerpo, en curva, lejos de la manija
  const carga = new THREE.TextureLoader(); carga.setCrossOrigin('anonymous');
  const alto = 0.4, ancho = alto / R, alturas = [0.12, -0.3, 0.02, -0.42, -0.12];
  urls.forEach((u, i) => {
    const a = manija + (Math.PI / 3) * (i + 1), tex = u ? carga.load(u) : pregunta(THREE); if (u) tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CylinderGeometry(R * 1.035, R * 1.035, alto, 24, 1, true, a - ancho / 2, ancho);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.08, roughness: 0.42, metalness: 0, side: THREE.FrontSide }));
    m.position.y = alturas[i]; giro.add(m);
  });
  const medir = () => { const w = cv.clientWidth || 1, h = cv.clientHeight || 1; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  medir(); const ro = new ResizeObserver(medir); ro.observe(cv);
  const t0 = performance.now();
  return {
    dibujar: (grados) => { const t = (performance.now() - t0) / 1000; giro.rotation.y = (grados * Math.PI) / 180; giro.rotation.x = -0.08 + Math.sin(t * 0.7) * 0.03; giro.position.y = Math.sin(t * 1.7) * 0.06; ren.render(esc, cam); },
    soltar: () => { ro.disconnect(); ren.dispose(); pm.dispose(); },
  };
}
