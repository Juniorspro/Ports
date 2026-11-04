// ---------------- render targets y pasadas de pantalla de los addons (como el material system de Source) ----------------
// Los addons de efectos (cámaras VHS, filtros, visión nocturna) dibujan en texturas propias (GetRenderTargetEx), copian la
// pantalla (render.UpdateScreenEffectTexture), pasan cuadros de pantalla completa con un material (render.DrawScreenQuad)
// —muchas veces "screenspace_general" con su pixel shader de DirectX 9, que traduce gmod_dx9.js— y leen píxeles para
// saber si su shader anda (render.CapturePixels + ReadPixel). Todo eso, de verdad, en WebGL 2.
// Coordenadas como en Source: (0,0) arriba a la izquierda, en píxeles del destino (la pantalla o el render target).
const GRT = { rts: new Map(), pila: [], act: null, vp: null, progs: new Map(), vao: null, cap: null, blend: null, colorW: null, filtro: [], pant: null, simple: null, dc: [255, 255, 255, 255], surfMat: null };
const gmrtGL = () => (typeof R !== 'undefined' && R.gl && !R.gl1 ? R.gl : null);

// ---- texturas (ITexture) ----
function gmrtMtTex() {
  if (GMA.mtTex) return GMA.mtTex;
  const M = (GMA.mtTex = new LuaTable()); M.set('__index', M); M.set('MetaName', 'ITexture');
  const F = { GetName: (t) => t.n, Width: (t) => t.w, Height: (t) => t.h, GetMappingWidth: (t) => t.w, GetMappingHeight: (t) => t.h, IsError: () => false, IsErrorTexture: () => false, GetNumAnimationFrames: () => 1, Download: () => {}, GetColor: () => GMA.color(0, 0, 0, 255), IsValid: () => true };
  for (const [k, f] of Object.entries(F)) M.set(k, f);
  M.set('__tostring', (t) => 'ITexture [' + t.n + ']');
  return M;
}
// formato de Source → formato de WebGL (los de coma flotante si la placa deja dibujar en ellos; si no, 8 bits)
function gmrtFormato(gl, f) {
  if (f >= 24 && f <= 29 && (GRT.flotante ?? (GRT.flotante = !!gl.getExtension('EXT_color_buffer_float')))) {
    if (f === 29) return { i: gl.RGBA32F, f: gl.RGBA, t: gl.FLOAT, flot: 32 };
    return { i: gl.RGBA16F, f: gl.RGBA, t: gl.HALF_FLOAT, flot: 16 };
  }
  return { i: gl.RGBA8, f: gl.RGBA, t: gl.UNSIGNED_BYTE, flot: 0 };
}
function gmrtAlocar(t, w, h) {
  const gl = gmrtGL(); if (!gl) return;
  w = Math.max(1, Math.min(4096, w | 0)); h = Math.max(1, Math.min(4096, h | 0));
  if (t.tex && t.w === w && t.h === h) return;
  if (!t.tex) t.tex = gl.createTexture();
  t.w = w; t.h = h; const F = gmrtFormato(gl, t.fmt);
  gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, F.i, w, h, 0, F.f, F.t, null);
  const punto = (t.flags & 1) || (F.flot === 32 && !gl.getExtension('OES_texture_float_linear'));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, punto ? gl.NEAREST : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, punto ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, t.flags & 4 || t.pant ? gl.CLAMP_TO_EDGE : gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, t.flags & 8 || t.pant ? gl.CLAMP_TO_EDGE : gl.REPEAT);
  if (!t.fb) t.fb = gl.createFramebuffer();
  const fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); t.flot = F.flot;
}
// un render target (por nombre, como GMod: el mismo nombre devuelve el mismo, aunque se pida otro tamaño)
function gmrtCrear(n, w, h, modo, flags, fmt) {
  n = String(n || 'rt'); const k = n.toLowerCase(); let t = GRT.rts.get(k);
  if (t) return t;
  t = { n, w: 0, h: 0, flags: flags | 0, fmt: fmt === undefined ? 0 : fmt | 0, rt: true, modo: modo | 0, __mt: gmrtMtTex() };
  if (t.modo === 4 || t.modo === 6) { const p = gmrtPantTam(); w = p[0]; h = p[1]; t.pantTam = true; }
  gmrtAlocar(t, w || 16, h || 16); GRT.rts.set(k, t); return t;
}
// la textura de la pantalla (_rt_FullFrameFB): del tamaño del destino de la pantalla
function gmrtPantTam() { const gl = gmrtGL(); if (!gl) return [VW(), VH()]; return [gl.drawingBufferWidth, gl.drawingBufferHeight]; }
function gmrtPantalla(i) {
  const k = '_rt_fullframefb' + (i ? i : ''); let t = GRT.rts.get(k);
  if (!t) { t = { n: '_rt_FullFrameFB' + (i ? i : ''), w: 0, h: 0, flags: 4 | 8, fmt: 0, rt: true, pant: true, __mt: gmrtMtTex() }; GRT.rts.set(k, t); }
  const p = gmrtPantTam(); gmrtAlocar(t, p[0], p[1]); return t;
}
// una textura nombrada (string o ITexture o material con imagen) → { tex, w, h, flags }
function gmrtTex(x) {
  if (!x) return null;
  if (typeof x === 'object' && x.rt) return x;
  const n = typeof x === 'string' ? x : x.n || '', k = n.toLowerCase().replace(/\\/g, '/');
  if (/^_rt_fullframefb\d?$|^_rt_powerOfTwoFB$|^_rt_fullscreen/i.test(k)) return gmrtPantalla(/1$/.test(k) ? 1 : 0);
  if (GRT.rts.has(k)) return GRT.rts.get(k);
  // (una imagen: la del material, subida a la placa una vez)
  const m = typeof x === 'object' && x.img !== undefined ? x : gmaMaterial(n);
  const base = m.prm && m.prm.get('$basetexture'); if (base && base !== m && typeof base === 'object' && base.rt) return base;
  if (!m.img) return null;
  const gl = gmrtGL(); if (!gl) return null;
  if (!m.glTex || m.glImg !== m.img) {
    m.glTex = m.glTex || gl.createTexture(); m.glImg = m.img;
    gl.bindTexture(gl.TEXTURE_2D, m.glTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.img); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }
  return { tex: m.glTex, w: m.w || 1, h: m.h || 1, flags: 0, img: true };
}

// ---- los parámetros de los materiales ($basetexture, $c0_x...) y los .vmt con su shader ----
function gmrtVmt(txt) {
  // (KeyValues de Valve: el nombre del shader y sus "$clave" "valor"; los bloques de adentro —"<dx90" { }— se saltean)
  const T = []; const re = /"([^"]*)"|([{}])|([^\s"{}]+)/g; let m;
  const sinCom = txt.replace(/\/\/[^\n]*/g, '');
  while ((m = re.exec(sinCom))) T.push(m[1] !== undefined ? { s: m[1] } : m[2] ? { b: m[2] } : { s: m[3] });
  const out = { shader: '', prm: new Map() }; let i = 0;
  if (T[i] && T[i].s !== undefined) out.shader = T[i++].s;
  if (T[i] && T[i].b === '{') i++;
  let prof = 1;
  while (i < T.length && prof > 0) {
    const t = T[i];
    if (t.b === '}') { prof--; i++; continue; }
    if (t.b === '{') { prof++; i++; continue; }
    const v = T[i + 1];
    if (v && v.b === '{') { let p = 0; i++; do { if (T[i].b === '{') p++; else if (T[i].b === '}') p--; i++; } while (i < T.length && p > 0); continue; }
    if (prof === 1 && v && v.s !== undefined) { const n = v.s, x = /^-?\d+(\.\d+)?$/.test(n) ? +n : n; out.prm.set(t.s.toLowerCase(), x); }
    i += 2;
  }
  return out;
}
function gmrtPrm(m) {
  if (m.prm) return m.prm;
  m.prm = new Map(); m.shader = m.shader || '';
  const k = String(m.n || '').toLowerCase().replace(/\\/g, '/').replace(/^materials\//, '').replace(/\.vmt$/, '');
  const b = typeof gmArchivo === 'function' ? gmArchivo('materials/' + k + '.vmt') : null;
  if (b) { try { const v = gmrtVmt(new TextDecoder().decode(b)); m.shader = v.shader; for (const [a, x] of v.prm) m.prm.set(a, x); } catch (e) {} }
  else if (GRT_PP[k]) { m.shader = GRT_PP[k][0]; for (const [a, x] of Object.entries(GRT_PP[k][1])) m.prm.set(a, x); }
  return m.prm;
}

// ---- programas: el de cada $pixshader (traducido) y uno simple para copiar texturas ----
function gmrtProg(gl, vs, fs) {
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(x); gl.deleteShader(x); throw new Error(e); } return x; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (const n of ['uRect', 'uUV', 'C', 'I', 'B', 'uTam', 'uSrgb', 'uSrgbOut', 'uCol', 's0', 's1', 's2', 's3']) u[n] = gl.getUniformLocation(p, n);
  gl.useProgram(p); for (let i = 0; i < 4; i++) if (u['s' + i]) gl.uniform1i(u['s' + i], i);
  return { p, u };
}
// (el nivel de DirectX que ven los mods, como GMod en una placa floja: en Patata, Bajo y Medio es 90 —sin shaders ps_3_0—
// y los mods usan su versión liviana, si la traen; en Alto y Ultra, 95. Con el VHS del Viewfinder: la cadena ps_3_0 de
// alta fidelidad costaba 7 veces lo que cuesta dibujar toda la escena; la ps_2_0b, menos de una)
function gmrtSM3() { return typeof GFX === 'undefined' || GFX.nombre === 'alto' || GFX.nombre === 'ultra'; }
const GRT_SIN_SM3 = { err: 'ps_3_0: en esta calidad el motor es DirectX 90 (Alto o Ultra lo prenden)' };
function gmrtProgSS(nom) {
  const P = gmrtProgSS0(nom);
  return P && P.ps3 && !gmrtSM3() ? GRT_SIN_SM3 : P;
}
function gmrtProgSS0(nom) {
  const gl = gmrtGL(); if (!gl || !nom) return null; const k = String(nom).toLowerCase();
  if (GRT.progs.has(k)) return GRT.progs.get(k);
  // (el archivo: shaders/fxc/<nombre>.vcs; "_ps20" busca también el de ps_2_b, como Source)
  const cands = [k, k.replace(/_ps20$/, '_ps20b'), k + 'b', k.replace(/_ps2x$/, '_ps20b')];
  let b = null;
  for (const c of cands) { b = gmArchivo('shaders/fxc/' + c + '.vcs'); if (b) break; }
  if (!b) { if (!cands.some((c) => gmExiste('shaders/fxc/' + c + '.vcs'))) { const P = { err: 'no está el shader ' + nom }; GRT.progs.set(k, P); return P; } return null; }   // (si se está leyendo, al próximo cuadro)
  let P;
  try {
    const L = dx9Vcs(b), c = L.find((x) => x.st === 0 && x.dyn === 0) || L[0]; if (!c) throw new Error('sin combos');
    const T = dx9Glsl(c.code); P = gmrtProg(gl, DX9_VS, T.fs); P.ver = T.ver; P.ps3 = !!T.ps3;
  } catch (e) { P = { err: String((e && e.message) || e).slice(0, 300) }; if (typeof gmErr === 'function') gmErr('shader ' + nom, e); }
  GRT.progs.set(k, P); return P;
}
// los shaders estándar de Source/GMod para efectos de pantalla (pp/colour, pp/blurx, refract...), hechos acá
const GRT_FS0 = '#version 300 es\nprecision highp float;\nin vec4 vTex[4];\nuniform sampler2D s0;\nuniform sampler2D s1;\nout vec4 o;\nvec4 T(sampler2D s, vec2 t) { return texture(s, vec2(t.x, 1.0 - t.y)); }\n';
const GRT_FS = {
  // (g_colourmodify: sumar, saturación, brillo, contraste y multiplicar por la luminancia, como DrawColorModify)
  color: 'uniform vec3 uAdd;\nuniform vec3 uMul;\nuniform vec3 uBcc;\nvoid main() { vec4 a = T(s0, vTex[0].xy); vec3 c = a.rgb + uAdd; float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uBcc.z); c = (c + uBcc.x) * uBcc.y; c += uMul * l; o = vec4(c, 1.0); }',
  // (g_blurx/g_blury: desenfoque gaussiano en una dirección; $size en píxeles de la textura)
  blur: 'uniform vec2 uDir;\nvoid main() { vec2 t = vTex[0].xy; vec4 c = T(s0, t) * 0.2270270; c += (T(s0, t + uDir * 1.3846153) + T(s0, t - uDir * 1.3846153)) * 0.3162162; c += (T(s0, t + uDir * 3.2307692) + T(s0, t - uDir * 3.2307692)) * 0.0702702; o = vec4(c.rgb, 1.0); }',
  // (refract: la imagen de $fbtexture corrida por el mapa de normales de $normalmap)
  refract: 'uniform float uAmt;\nvoid main() { vec2 t = vTex[0].xy; vec2 n = T(s1, t).xy * 2.0 - 1.0; o = vec4(T(s0, t + n * uAmt).rgb, 1.0); }',
};
function gmrtStock(k) {
  const gl = gmrtGL(); if (!gl) return null; GRT.stock = GRT.stock || {};
  if (!GRT.stock[k]) { const P = gmrtProg(gl, DX9_VS, GRT_FS0 + GRT_FS[k]); for (const n of ['uAdd', 'uMul', 'uBcc', 'uDir', 'uAmt']) P.u[n] = gl.getUniformLocation(P.p, n); GRT.stock[k] = P; }
  return GRT.stock[k];
}
// los materiales estándar que se piden por nombre (Material("pp/colour")...)
const GRT_PP = { 'pp/colour': ['g_colourmodify', { $fbtexture: '_rt_FullFrameFB' }], 'pp/blurx': ['g_blurx', { $basetexture: '_rt_FullFrameFB', $size: 1 }], 'pp/blury': ['g_blury', { $basetexture: '_rt_FullFrameFB', $size: 1 }],
  'pp/blurscreen': ['g_blurscreen', { $fbtexture: '_rt_FullFrameFB', $blur: 3 }], 'pp/fb': ['GMODScreenspace', { $basetexture: '_rt_FullFrameFB' }], 'pp/copy': ['GMODScreenspace', { $basetexture: '_rt_FullFrameFB' }],
  'pp/sharpen': ['GMODScreenspace', { $basetexture: '_rt_FullFrameFB' }], 'pp/motionblur': ['GMODScreenspace', { $basetexture: '_rt_FullFrameFB', $alpha: 0.5 }] };
function gmrtSimple() {
  const gl = gmrtGL(); if (!gl) return null; if (GRT.simple) return GRT.simple;
  const fs = '#version 300 es\nprecision highp float;\nin vec4 vTex[4];\nuniform sampler2D s0;\nuniform vec4 uCol;\nuniform vec4 uSrgb;\nout vec4 o;\nvoid main() { vec2 t = vTex[0].xy; o = texture(s0, vec2(t.x, 1.0 - t.y)) * uCol; }';
  return (GRT.simple = gmrtProg(gl, DX9_VS, fs));
}

// ---- el estado de WebGL: se guarda antes de cada operación y se deja como estaba (el juego sigue dibujando lo suyo) ----
function gmrtGuardar(gl) {
  return { fb: gl.getParameter(gl.FRAMEBUFFER_BINDING), vp: gl.getParameter(gl.VIEWPORT), dt: gl.isEnabled(gl.DEPTH_TEST), cf: gl.isEnabled(gl.CULL_FACE), bl: gl.isEnabled(gl.BLEND), sc: gl.isEnabled(gl.SCISSOR_TEST), st: gl.isEnabled(gl.STENCIL_TEST),
    prog: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING), at: gl.getParameter(gl.ACTIVE_TEXTURE), dm: gl.getParameter(gl.DEPTH_WRITEMASK), cm: gl.getParameter(gl.COLOR_WRITEMASK),
    bs: gl.getParameter(gl.BLEND_SRC_RGB), bd: gl.getParameter(gl.BLEND_DST_RGB), bsa: gl.getParameter(gl.BLEND_SRC_ALPHA), bda: gl.getParameter(gl.BLEND_DST_ALPHA), be: gl.getParameter(gl.BLEND_EQUATION_RGB), bea: gl.getParameter(gl.BLEND_EQUATION_ALPHA),
    cc: gl.getParameter(gl.COLOR_CLEAR_VALUE), scb: gl.getParameter(gl.SCISSOR_BOX), tex: [0, 1, 2, 3].map((i) => { gl.activeTexture(gl.TEXTURE0 + i); return gl.getParameter(gl.TEXTURE_BINDING_2D); }) };
}
function gmrtVolver(gl, E) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, E.fb); gl.viewport(E.vp[0], E.vp[1], E.vp[2], E.vp[3]);
  const en = (c, b) => (b ? gl.enable(c) : gl.disable(c)); en(gl.DEPTH_TEST, E.dt); en(gl.CULL_FACE, E.cf); en(gl.BLEND, E.bl); en(gl.SCISSOR_TEST, E.sc); en(gl.STENCIL_TEST, E.st);
  gl.useProgram(E.prog); gl.bindVertexArray(E.vao); gl.depthMask(E.dm); gl.colorMask(E.cm[0], E.cm[1], E.cm[2], E.cm[3]);
  gl.blendFuncSeparate(E.bs, E.bd, E.bsa, E.bda); gl.blendEquationSeparate(E.be, E.bea); gl.clearColor(E.cc[0], E.cc[1], E.cc[2], E.cc[3]); gl.scissor(E.scb[0], E.scb[1], E.scb[2], E.scb[3]);
  for (let i = 0; i < 4; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, E.tex[i]); }
  gl.activeTexture(E.at);
  if (typeof R !== 'undefined') { R.progAct = null; R.vaoAct = null; }
}
// el destino actual: el render target puesto o la pantalla (lo que esté dibujando el juego: el búfer que esté puesto)
// (en la pantalla, las coordenadas que da Lua son las de ScrW/ScrH: se pasan a los píxeles del búfer, que puede tener
// otra resolución —la resolución dinámica, la densidad de la pantalla—)
function gmrtDestino(gl, E) {
  if (GRT.act) return { fb: GRT.act.fb, w: GRT.act.w, h: GRT.act.h, rt: GRT.act, sx: 1, sy: 1 };
  // (fuera del dibujo del mundo, la pantalla es la de verdad —el búfer por defecto—, aunque el juego haya dejado puesto otro,
  // como el del celular de la mano; durante el dibujo —los hooks 3D— es el búfer en el que se está dibujando la escena)
  const B = GRT.base || (GRT.enDibujo ? { fb: E.fb, vp: E.vp } : { fb: null });
  const w = B.fb ? B.vp[0] + B.vp[2] : gl.drawingBufferWidth, h = B.fb ? B.vp[1] + B.vp[3] : gl.drawingBufferHeight;
  return { fb: B.fb, w, h, rt: null, sx: w / Math.max(1, VW()), sy: h / Math.max(1, VH()) };
}
const gmrtEsc = (D, r) => (r ? [r[0] * D.sx, r[1] * D.sy, r[2] * D.sx, r[3] * D.sy] : null);
// el viewport (en coordenadas de Source, arriba a la izquierda) → el de WebGL (abajo a la izquierda)
function gmrtVp(gl, D) {
  const v = GRT.vp ? gmrtEsc(D, GRT.vp) : [0, 0, D.w, D.h];
  gl.viewport(Math.round(v[0]), Math.round(D.h - v[1] - v[3]), Math.max(1, Math.round(v[2])), Math.max(1, Math.round(v[3]))); return v;
}
function gmrtOp(f) {
  const gl = gmrtGL(); if (!gl) return undefined;
  if (GRT.d2 || GMA.dibujoHUD) gmrtVolcar(gl);
  const E = gmrtGuardar(gl);
  try { return f(gl, gmrtDestino(gl, E), E); } finally { gmrtVolver(gl, E); }
}

function gmrtVao(gl) { if (!GRT.vao) { GRT.vao = gl.createVertexArray(); gl.bindVertexArray(GRT.vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); } return GRT.vao; }

// ---- lo 2D (surface/draw) en orden con lo de WebGL ----
// En GMod el texto y las cajas van al mismo búfer que todo lo demás y en el orden en que se dibujan. Acá el 2D de la pantalla
// va a una capa aparte, encima (la compone el navegador: no cuesta nada mientras nadie lea la pantalla), y el que se dibuja
// con un render target puesto, a un lienzo del tamaño de ese target. Antes de cada operación de WebGL de un mod —copiar la
// pantalla, un cuadro, borrar, leer píxeles— lo 2D pendiente se vuelca a su destino: así el OSD de una cámara entra en la
// cinta y sale con el mismo desenfoque que la imagen, el texto que un mod escribe en un target para medirlo se puede leer y
// un cuadro de pantalla tapa lo que ya estaba dibujado, como en GMod.
function gmrt2D(rt) {
  if (GRT.d2 && GRT.d2.rt !== rt) gmrtVolcar(gmrtGL());
  let c = GRT.c2d; if (!c) { c = GRT.c2d = document.createElement('canvas'); GRT.g2d = c.getContext('2d'); }
  if (c.width !== rt.w || c.height !== rt.h) { c.width = rt.w; c.height = rt.h; }
  if (!GRT.d2) GRT.d2 = { rt };
  return GRT.g2d;
}
function gmrtVolcar(gl) {
  if (!gl) return;
  const P = GRT.d2;
  if (P) {
    GRT.d2 = null;
    if (P.rt.fb) { gmrtSubir(gl, GRT.c2d, P.rt.fb, P.rt.w, P.rt.h); P.rt.sucio = true; }
    const g = GRT.g2d; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, GRT.c2d.width, GRT.c2d.height); g.restore();
  }
  // (la capa de la pantalla, sólo durante la HUD y si se dibujó algo desde el último vuelco)
  if (GMA.dibujoHUD && GMA.hud && !GMA.lienzo && !GRT.enDibujo && (GMA.hudN | 0) !== (GRT.hudN0 | 0)) {
    GRT.hudN0 = GMA.hudN | 0; GRT.volcados = (GRT.volcados | 0) + 1;
    const c = GMA.hud.c, g = GMA.hud.g;
    gmrtSubir(gl, c, null, gl.drawingBufferWidth, gl.drawingBufferHeight);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.restore();
  }
}
// (un lienzo 2D → encima de un búfer, con su transparencia)
function gmrtSubir(gl, cv, fb, w, h) {
  if (!cv || !cv.width || !cv.height) return;
  const E = gmrtGuardar(gl);
  const fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), pub = gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
  try {
    gl.activeTexture(gl.TEXTURE0);
    if (!GRT.t2d) { GRT.t2d = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GRT.t2d); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
    gl.bindTexture(gl.TEXTURE_2D, GRT.t2d);
    if (pub) gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    const P = gmrtSimple(); if (!P) return;
    gmrtVao(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST); gl.depthMask(false); gl.colorMask(true, true, true, true);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.blendEquation(gl.FUNC_ADD);
    gl.useProgram(P.p); gl.bindVertexArray(GRT.vao);
    gl.uniform4f(P.u.uRect, 0, 0, 1, 1); if (P.u.uUV) gl.uniform4f(P.u.uUV, 0, 0, 0, 0); gl.uniform4f(P.u.uCol, 1, 1, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } finally {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm); if (pub) gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, pub);
    gmrtVolver(gl, E);
  }
}

// ---- dibujar un cuadro de pantalla con un material ----
const GRT_BLEND = (gl, b) => [gl.ZERO, gl.ONE, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.SRC_ALPHA_SATURATE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR][b | 0] ?? gl.ONE;
const GRT_EQ = (gl, e) => [gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT, gl.MIN, gl.MAX][e | 0] ?? gl.FUNC_ADD;
function gmrtCuadro(m, rect, uv, col) {
  if (!m) return false;
  return gmrtOp((gl, D) => {
    const prm = gmrtPrm(m), sh = String(m.shader || '').toLowerCase(), ss = /screenspace_general/.test(sh) && prm.get('$pixshader');
    const tipo = ss ? 'ss' : /colourmodify|colormodify/.test(sh) ? 'color' : /^g_blur[xy]$/.test(sh) ? 'blur' : /refract|blurscreen/.test(sh) ? 'refract' : 'simple';
    let P;
    if (ss) { P = gmrtProgSS(prm.get('$pixshader')); if (!P || P.err) return false; }
    else P = tipo === 'simple' ? gmrtSimple() : gmrtStock(tipo);
    if (!P) return false;
    gmrtVao(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, D.fb); const v = gmrtVp(gl, D);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST); gl.depthMask(false);
    if (GRT.colorW) gl.colorMask(...GRT.colorW); else gl.colorMask(true, true, true, true);
    const add = +prm.get('$additive') === 1, trans = +prm.get('$translucent') === 1 || +prm.get('$vertexalpha') === 1 || (col && col[3] < 255);
    if (GRT.blend) { gl.enable(gl.BLEND); const b = GRT.blend; gl.blendFuncSeparate(GRT_BLEND(gl, b[0]), GRT_BLEND(gl, b[1]), GRT_BLEND(gl, b[3]), GRT_BLEND(gl, b[4])); gl.blendEquationSeparate(GRT_EQ(gl, b[2]), GRT_EQ(gl, b[5])); }
    else if (!ss && (add || trans)) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.blendEquation(gl.FUNC_ADD); }
    else gl.disable(gl.BLEND);
    gl.useProgram(P.p); gl.bindVertexArray(GRT.vao);
    // (el rectángulo, en fracciones del viewport)
    const r = rect ? gmrtEsc(D, rect) : [v[0], v[1], v[2], v[3]];
    gl.uniform4f(P.u.uRect, (r[0] - v[0]) / v[2], (r[1] - v[1]) / v[3], r[2] / v[2], r[3] / v[3]);
    if (P.u.uTam) gl.uniform2f(P.u.uTam, D.w, D.h);
    if (P.u.uUV) gl.uniform4f(P.u.uUV, uv ? uv[0] : 0, uv ? uv[1] : 0, uv ? uv[2] : 0, uv ? uv[3] : 0);
    const filtro = GRT.filtro.length ? GRT.filtro[GRT.filtro.length - 1] : 0;
    const texs = ss ? ['$basetexture', '$texture1', '$texture2', '$texture3'] : tipo === 'refract' ? ['$fbtexture', '$normalmap'] : tipo === 'color' ? ['$fbtexture'] : ['$basetexture'];
    const tex0 = [];
    for (let i = 0; i < texs.length; i++) {
      let t = gmrtTex(prm.get(texs[i]) ?? (i === 0 && !ss ? (prm.get('$basetexture') ?? prm.get('$fbtexture') ?? m) : null)); tex0.push(t);
      if (t && D.rt && t.tex === D.rt.tex) t = null;   // (leer y escribir la misma textura no se puede: queda vacía)
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t ? t.tex : null);
      if (t && filtro) { const f = filtro === 1 ? gl.NEAREST : gl.LINEAR; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); }
    }
    if (ss) {
      const C = new Float32Array(16); for (let c = 0; c < 4; c++) for (let j = 0; j < 4; j++) C[c * 4 + j] = +(prm.get('$c' + c + '_' + 'xyzw'[j]) || 0);
      gl.uniform4fv(P.u.C, C);
      const lr = (k) => (+prm.get(k) === 1 ? 0 : 1);
      if (P.u.uSrgb) gl.uniform4f(P.u.uSrgb, lr('$linearread_basetexture'), lr('$linearread_texture1'), lr('$linearread_texture2'), lr('$linearread_texture3'));
      if (P.u.uSrgbOut) gl.uniform1f(P.u.uSrgbOut, +prm.get('$linearwrite') === 1 ? 0 : 1);
    } else if (tipo === 'color') {
      const g = (k, d) => { const v = prm.get('$pp_colour_' + k); return v === undefined ? d : +v; };
      gl.uniform3f(P.u.uAdd, g('addr', 0), g('addg', 0), g('addb', 0)); gl.uniform3f(P.u.uMul, g('mulr', 0), g('mulg', 0), g('mulb', 0)); gl.uniform3f(P.u.uBcc, g('brightness', 0), g('contrast', 1), g('colour', 1));
    } else if (tipo === 'blur') {
      const t = tex0[0], tam = +(prm.get('$size') ?? 1), x = /x$/.test(sh);
      gl.uniform2f(P.u.uDir, x && t ? tam / t.w : 0, !x && t ? tam / t.h : 0);
    } else if (tipo === 'refract') {
      gl.uniform1f(P.u.uAmt, /blurscreen/.test(sh) ? 0 : +(prm.get('$refractamount') ?? 0));
    } else {
      // (UnlitGeneric y GMODScreenspace: la textura por $color y $alpha, y por el color de render.SetColorModulation/SetBlend o de surface)
      const mc = prm.get('$color'), a = prm.get('$alpha'), c = col || [255, 255, 255, 255], md = !col && GR.mod ? GR.mod : [1, 1, 1], bl = !col && GR.blend !== undefined ? GR.blend : 1;
      const cc = Array.isArray(mc) ? mc : [1, 1, 1];
      gl.uniform4f(P.u.uCol, (c[0] / 255) * cc[0] * md[0], (c[1] / 255) * cc[1] * md[1], (c[2] / 255) * cc[2] * md[2], (c[3] / 255) * (a === undefined ? 1 : +a) * bl);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (D.rt) D.rt.sucio = true;
    return true;
  });
}

// ---- la API de Lua (reemplaza lo que había de mentira en gmod_render.js y gmod_api.js) ----
function gmrtApi(R0, G, def, lib, num) {
  const render = lib('render');
  if (!GMA.mtMat) gmaMaterial('__color');
  // (los parámetros de los materiales, de verdad)
  const I = GMA.mtMat.get('__index'), k = (x) => String(x || '').toLowerCase();
  const texDe = (v) => (v && typeof v === 'object' ? v : typeof v === 'string' ? (gmrtTex(v) && GRT.rts.get(v.toLowerCase())) || v : v);
  I.set('SetTexture', (m, n, v) => { gmrtPrm(m).set(k(n), texDe(v)); });
  I.set('SetFloat', (m, n, v) => { gmrtPrm(m).set(k(n), num(v, 0)); });
  I.set('SetInt', (m, n, v) => { gmrtPrm(m).set(k(n), num(v, 0) | 0); });
  I.set('SetString', (m, n, v) => { gmrtPrm(m).set(k(n), String(v)); });
  I.set('SetVector', (m, n, v) => { gmrtPrm(m).set(k(n), v && v.x !== undefined ? [v.x, v.y, v.z] : v); });
  I.set('SetVector4D', (m, n, a, b, c, d) => { gmrtPrm(m).set(k(n), [num(a, 0), num(b, 0), num(c, 0), num(d, 0)]); });
  I.set('SetMatrix', (m, n, v) => { gmrtPrm(m).set(k(n), v); });
  I.set('SetUndefined', (m, n) => { gmrtPrm(m).delete(k(n)); });
  I.set('GetFloat', (m, n) => { const v = gmrtPrm(m).get(k(n)); return typeof v === 'number' ? v : undefined; });
  I.set('GetInt', (m, n) => { const v = gmrtPrm(m).get(k(n)); return typeof v === 'number' ? Math.trunc(v) : undefined; });
  I.set('GetString', (m, n) => { const v = gmrtPrm(m).get(k(n)); return v === undefined ? undefined : typeof v === 'object' ? v.n : String(v); });
  I.set('GetVector', (m, n) => { const v = gmrtPrm(m).get(k(n)); return Array.isArray(v) ? GMA.nv(v[0], v[1], v[2]) : GMA.nv(1, 1, 1); });
  I.set('GetShader', (m) => { gmrtPrm(m); return m.shader || 'UnlitGeneric'; });
  I.set('GetTexture', (m, n) => { const v = gmrtPrm(m).get(k(n || '$basetexture')); if (v && typeof v === 'object' && v.rt) return v; if (typeof v === 'string') { const t = GRT.rts.get(v.toLowerCase()); if (t) return t; } return m; });
  I.set('GetKeyValues', (m) => { const t = new LuaTable(); for (const [a, b] of gmrtPrm(m)) t.set(a, b); return t; });
  // CreateMaterial: uno nuevo con sus parámetros (los de pantalla y los que usan una textura de render target); los demás,
  // como antes (el de la imagen de $basetexture)
  const cm0 = G.get('CreateMaterial');
  def(G, 'CreateMaterial', (n, sh, prm) => {
    const esRTv = (v) => (typeof v === 'string' && (GRT.rts.has(v.toLowerCase()) || /^_rt_/i.test(v))) || (v && typeof v === 'object' && v.rt);
    const rtBase = prm instanceof LuaTable && [...prm.h.values()].some(esRTv);
    if (!/screenspace_general|^g_|refract|gmodscreenspace/i.test(String(sh || '')) && !rtBase) return typeof cm0 === 'function' ? cm0(n, sh, prm) : gmaMaterial(String(n || ''));
    const key = 'cm:' + String(n || '').toLowerCase(); GMA.mats = GMA.mats || new Map();
    let m = GMA.mats.get(key); if (!m) { m = { n: String(n || ''), ok: true, img: null, w: 0, h: 0, err: false, __mt: GMA.mtMat }; GMA.mats.set(key, m); }
    m.prm = new Map(); m.shader = String(sh || '');
    if (prm instanceof LuaTable) for (const [a, b] of prm.h) { const kk = k(a); m.prm.set(kk, kk.startsWith('$') && typeof b === 'string' && /texture|base/.test(kk) ? texDe(b) : b); }
    return m;
  });
  // render targets
  const rtNuevo = (n, w, h, modo, prof, flags, rtf, fmt) => gmrtCrear(n, num(w, 16), num(h, 16), num(modo, 0), num(flags, 0), num(fmt, 0));
  def(G, 'GetRenderTarget', (n, w, h) => rtNuevo(n, w, h, 0, 0, 0, 0, 0));
  def(G, 'GetRenderTargetEx', rtNuevo);
  def(render, 'GetScreenEffectTexture', (i) => gmrtPantalla(num(i, 0) ? 1 : 0));
  def(render, 'GetResolvedFullFrameDepth', () => gmrtPantalla(0)); def(render, 'GetPowerOfTwoTexture', () => gmrtPantalla(0)); def(render, 'GetFullScreenDepthTexture', () => gmrtPantalla(0));
  def(render, 'GetRenderTarget', () => GRT.act || undefined);
  const poner = (rt) => { GRT.act = rt && typeof rt === 'object' && rt.rt ? rt : null; if (GRT.act) gmrtAlocar(GRT.act, GRT.act.w, GRT.act.h); };
  def(render, 'PushRenderTarget', (rt, x, y, w, h) => {
    const gl = gmrtGL();
    if (gl && GRT.base === undefined && !GRT.pila.length) { const vp = gl.getParameter(gl.VIEWPORT); GRT.base = GRT.enDibujo ? { fb: gl.getParameter(gl.FRAMEBUFFER_BINDING), vp } : { fb: null }; }
    GRT.pila.push([GRT.act, GRT.vp]); poner(rt);
    GRT.vp = x !== undefined && w !== undefined ? [num(x, 0), num(y, 0), num(w, 1), num(h, 1)] : null;
  });
  def(render, 'PopRenderTarget', () => { const p = GRT.pila.pop(); if (p) { GRT.act = p[0]; GRT.vp = p[1]; } else { GRT.act = null; GRT.vp = null; } if (!GRT.pila.length) GRT.base = undefined; });
  def(render, 'SetRenderTarget', (rt) => { poner(rt); GRT.vp = null; });
  def(render, 'SetRenderTargetEx', (i, rt) => { if (!num(i, 0)) { poner(rt); GRT.vp = null; } });
  def(render, 'SetViewPort', (x, y, w, h) => { GRT.vp = [num(x, 0), num(y, 0), Math.max(1, num(w, 1)), Math.max(1, num(h, 1))]; });
  // borrar (sólo el viewport, como Source)
  def(render, 'Clear', (r, g, b, a, dep, sten) => gmrtOp((gl, D) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, D.fb); const v = gmrtVp(gl, D);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.round(v[0]), Math.round(D.h - v[1] - v[3]), Math.max(1, Math.round(v[2])), Math.max(1, Math.round(v[3]))); gl.colorMask(true, true, true, true);
    gl.clearColor(num(r, 0) / 255, num(g, 0) / 255, num(b, 0) / 255, num(a, 0) / 255);
    let bits = gl.COLOR_BUFFER_BIT; if (dep && !D.rt) { bits |= gl.DEPTH_BUFFER_BIT; gl.depthMask(true); }
    gl.clear(bits); if (D.rt) D.rt.sucio = true;
  }));
  def(render, 'ClearDepth', () => {}); def(render, 'ClearStencil', () => {});
  // copiar la pantalla (o el destino actual) a la textura de pantalla; copiar entre texturas
  const copiar = (gl, D, dst) => {
    gmrtAlocar(dst, dst.pant ? D.w : dst.w, dst.pant ? D.h : dst.h);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, D.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.fb);
    gl.blitFramebuffer(0, 0, D.w, D.h, 0, 0, dst.w, dst.h, gl.COLOR_BUFFER_BIT, D.w === dst.w && D.h === dst.h ? gl.NEAREST : gl.LINEAR);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  };
  def(render, 'UpdateScreenEffectTexture', (i) => gmrtOp((gl, D) => { const t = gmrtPantalla(num(i, 0) ? 1 : 0); if (D.rt && D.rt.tex === t.tex) return; copiar(gl, D, t); }));
  def(render, 'UpdateFullScreenDepthTexture', () => {}); def(render, 'UpdateRefractTexture', () => gmrtOp((gl, D) => copiar(gl, D, gmrtPantalla(0))));
  def(render, 'UpdatePowerOfTwoTexture', () => gmrtOp((gl, D) => copiar(gl, D, gmrtPantalla(0))));
  def(render, 'CopyRenderTargetToTexture', (t) => gmrtOp((gl, D) => { if (t && t.rt && !(D.rt && D.rt.tex === t.tex)) copiar(gl, D, t); }));
  def(render, 'CopyTexture', (a, b) => gmrtOp((gl) => { if (!a || !b || !a.rt || !b.rt || a === b) return; copiar(gl, { fb: a.fb, w: a.w, h: a.h }, b); }));
  // los cuadros de pantalla
  def(render, 'DrawScreenQuad', () => { gmrtCuadro(GR.mat); });
  def(render, 'DrawScreenQuadEx', (x, y, w, h) => { gmrtCuadro(GR.mat, [num(x, 0), num(y, 0), num(w, 0), num(h, 0)]); });
  def(render, 'DrawTextureToScreen', (t) => { if (t) gmrtCuadro({ n: 'tex', prm: new Map([['$basetexture', t]]), shader: 'UnlitGeneric' }); });
  def(render, 'DrawTextureToScreenRect', (t, x, y, w, h) => { if (t) gmrtCuadro({ n: 'tex', prm: new Map([['$basetexture', t]]), shader: 'UnlitGeneric' }, [num(x, 0), num(y, 0), num(w, 0), num(h, 0)]); });
  // leer píxeles (los addons prueban así si su shader corrió)
  def(render, 'CapturePixels', () => gmrtOp((gl, D) => {
    const px = new Uint8Array(D.w * D.h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, D.fb);
    if (D.rt && D.rt.flot) { const f = new Float32Array(D.w * D.h * 4); gl.readPixels(0, 0, D.w, D.h, gl.RGBA, gl.FLOAT, f); for (let i = 0; i < f.length; i++) px[i] = Math.max(0, Math.min(255, Math.round(f[i] * 255))); }
    else gl.readPixels(0, 0, D.w, D.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    GRT.cap = { px, w: D.w, h: D.h, rt: D.rt };
  }));
  def(render, 'ReadPixel', (x, y) => {
    const c = GRT.cap; if (!c) return [0, 0, 0, 255];
    x = Math.max(0, Math.min(c.w - 1, num(x, 0) | 0)); y = Math.max(0, Math.min(c.h - 1, num(y, 0) | 0));
    const o = ((c.h - 1 - y) * c.w + x) * 4; return [c.px[o], c.px[o + 1], c.px[o + 2], c.px[o + 3]];
  });
  // mezcla, escritura de color y filtro de las texturas
  def(render, 'OverrideBlend', (en, s, d, op, sa, da, opa) => { GRT.blend = en ? [num(s, 1), num(d, 0), num(op, 0), num(sa ?? s, 1), num(da ?? d, 0), num(opa ?? op, 0)] : null; });
  def(render, 'OverrideBlendFunc', (en, s, d, sa, da) => { GRT.blend = en ? [num(s, 1), num(d, 0), 0, num(sa ?? s, 1), num(da ?? d, 0), 0] : null; });
  def(render, 'OverrideColorWriteEnable', (en, w) => { GRT.colorW = en ? [!!w, !!w, !!w, GRT.colorW ? GRT.colorW[3] : true] : null; });
  def(render, 'OverrideAlphaWriteEnable', (en, w) => { GRT.colorW = en ? [true, true, true, !!w] : null; });
  def(render, 'PushFilterMag', (f) => { GRT.filtro.push(num(f, 0)); }); def(render, 'PushFilterMin', () => {});
  def(render, 'PopFilterMag', () => { GRT.filtro.pop(); }); def(render, 'PopFilterMin', () => {});
  def(render, 'SupportsPixelShaders_2_0', () => true); def(render, 'SupportsPixelShaders_1_4', () => true); def(render, 'SupportsVertexShaders_2_0', () => true);
  // surface con una textura de render target: se dibuja en la pantalla de WebGL (lo demás de surface sigue en la capa 2D)
  const surface = lib('surface'), sm0 = surface.get('SetMaterial'), dc0 = surface.get('SetDrawColor'), dt0 = surface.get('DrawTexturedRect'), duv0 = surface.get('DrawTexturedRectUV');
  const esRT = (m) => { if (!m || typeof m !== 'object') return false; if (m.rt) return true; const v = m.prm && m.prm.get('$basetexture'); return !!((v && typeof v === 'object' && v.rt) || (typeof v === 'string' && (GRT.rts.has(v.toLowerCase()) || /^_rt_/i.test(v)))) || (m.prm && /screenspace_general/i.test(m.shader || '')); };
  if (typeof sm0 === 'function') def(surface, 'SetMaterial', (m) => { GRT.surfMat = m; return sm0(m); });
  if (typeof dc0 === 'function') def(surface, 'SetDrawColor', (r, g, b, a) => { if (r && typeof r === 'object' && r.r !== undefined) GRT.dc = [r.r, r.g, r.b, r.a ?? 255]; else if (r instanceof LuaTable) GRT.dc = [num(r.get('r'), 255), num(r.get('g'), 255), num(r.get('b'), 255), num(r.get('a'), 255)]; else GRT.dc = [num(r, 255), num(g, 255), num(b, 255), num(a, 255)]; return dc0(r, g, b, a); });
  if (typeof dt0 === 'function') def(surface, 'DrawTexturedRect', (x, y, w, h) => {
    const m = GRT.surfMat; if (!esRT(m)) return dt0(x, y, w, h);
    gmrtCuadro(m.rt ? { n: 'tex', prm: new Map([['$basetexture', m]]), shader: 'UnlitGeneric' } : m, [num(x, 0), num(y, 0), num(w, 0), num(h, 0)], null, GRT.dc);
  });
  if (typeof duv0 === 'function') def(surface, 'DrawTexturedRectUV', (x, y, w, h, u0, v0, u1, v1) => {
    const m = GRT.surfMat; if (!esRT(m)) return duv0(x, y, w, h, u0, v0, u1, v1);
    gmrtCuadro(m.rt ? { n: 'tex', prm: new Map([['$basetexture', m]]), shader: 'UnlitGeneric' } : m, [num(x, 0), num(y, 0), num(w, 0), num(h, 0)], [num(u0, 0), num(v0, 0), num(u1, 1), num(v1, 1)], GRT.dc);
  });
}
// al final de cada cuadro: sin render targets puestos de más (un addon que se olvidó un Pop no deja todo dibujando en otro lado)
function gmrtFinCuadro() { if (GRT.d2) gmrtVolcar(gmrtGL()); GRT.hudN0 = 0; if (GRT.pila.length || GRT.act) { GRT.pila.length = 0; GRT.act = null; GRT.vp = null; } GRT.base = undefined; GRT.blend = null; GRT.colorW = null; GRT.filtro.length = 0; }
