// ---------------------------------------------------------------------------------------------------------
// VHS a pantalla completa (el evento de los 300 miembros: ev300.js). El del Viewfinder (el mod de la cámara de GMod, con
// el que se hicieron los videos de Pepe) es 4:3, viene en un addon aparte y en un celular tarda casi un segundo por cuadro:
// éste es nuestro, del ancho de la pantalla como el juego normal y de una sola pasada al final del cuadro. Copia la imagen
// ya dibujada y la vuelve a dibujar como una cinta: la luminancia un poco borrosa y el color (YIQ) corrido y manchado a la
// derecha, el temblor de las líneas, la banda de tracking que baja, el ruido de las cabezas abajo de todo, la nieve, las
// líneas de barrido, la viñeta y la cinta gastada (VHS.dano). Para el evento, además: bajo el agua (ondas y azul, los
// recuerdos), el rojo de un golpe, el negro y el sacudón. Lo de arriba (PLAY, la fecha, la hora) va en la página, con la
// letra VCR OSD Mono (de los recursos del Viewfinder; CREDITOS.md).
// ---------------------------------------------------------------------------------------------------------
const VHS = { on: false, t0: 0, dano: 0.35, agua: 0, rojo: 0, negro: 0, sacudon: 0, blanco: 0, tex: null, w: 0, h: 0, P: null, malo: false, osd: null, osdTxt: {} };
// (uTiempo: no «uT», que el motor toma por la textura 0 —gl.js, shader— y le pone un entero)
const FS_VHS = `
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uRes; uniform float uTiempo, uDano, uAgua, uRojo, uNegro, uSac, uBlanco; out vec4 o;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aYIQ(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312))); }
vec3 deYIQ(vec3 y) { return vec3(y.x + 0.956 * y.y + 0.621 * y.z, y.x - 0.272 * y.y - 0.647 * y.z, y.x - 1.106 * y.y + 1.703 * y.z); }
void main() {
  vec2 uv = vUV;
  // (las líneas de la cinta: 240 de alto como una de verdad, la pantalla sea la que sea)
  float L = 240.0, fila = floor(uv.y * L), tq = floor(uTiempo * 30.0);
  // bajo el agua (los recuerdos): la imagen ondula
  uv.x += uAgua * 0.007 * sin(uv.y * 26.0 + uTiempo * 3.3); uv.y += uAgua * 0.006 * sin(uv.x * 19.0 + uTiempo * 2.1);
  // temblor de las líneas, la banda de tracking que baja despacio y el ruido de las cabezas abajo de todo
  float jit = (h2(vec2(fila, tq)) - 0.5) * 0.0016 * (0.5 + uDano);
  float by = 1.0 - fract(uTiempo * 0.045 + 0.35), banda = smoothstep(0.045, 0.0, abs(uv.y - by)) * (0.25 + uDano);
  jit += banda * (h2(vec2(fila, uTiempo)) - 0.5) * 0.03;
  float cab = smoothstep(0.03, 0.0, uv.y); jit += cab * (0.01 + 0.025 * h2(vec2(fila, tq)));
  float s1 = h1(floor(uTiempo * 45.0)); uv += uSac * vec2(s1 - 0.5, h1(floor(uTiempo * 45.0) + 7.0) - 0.5) * vec2(0.035, 0.025);
  uv.x += jit;
  // luminancia un poco borrosa; el color más corrido a la derecha y manchado (como la señal compuesta)
  float e = max(1.0, uRes.x / 640.0); vec2 px = vec2(e / uRes.x, 0.0);
  vec3 c0 = texture(uTex, uv).rgb, c1 = texture(uTex, uv - px).rgb, c2 = texture(uTex, uv + px).rgb;
  vec3 y = aYIQ(c0 * 0.5 + c1 * 0.25 + c2 * 0.25);
  vec3 k1 = aYIQ(texture(uTex, uv + px * 3.0).rgb), k2 = aYIQ(texture(uTex, uv + px * 6.5).rgb), k3 = aYIQ(texture(uTex, uv - px * 1.5).rgb);
  y.yz = (k1.yz + k2.yz + k3.yz) * (0.29 - 0.04 * uDano);
  vec3 c = deYIQ(y);
  // la cinta: negros levantados, un poco verde en las sombras, menos contraste
  c = c * 0.9 + vec3(0.03, 0.04, 0.03);
  c = mix(c, c * vec3(0.5, 0.85, 1.1) + vec3(0.0, 0.035, 0.09), uAgua * 0.85);
  // líneas de barrido, la nieve, la banda y las rayas blancas sueltas
  c *= 0.9 + 0.1 * sin(uv.y * L * 6.2832);
  float n = h2(vUV * uRes + fract(uTiempo * 13.7) * 91.0);
  c += (n - 0.5) * (0.05 + 0.12 * uDano) + banda * n * 0.45 + cab * n * 0.5;
  c += step(0.9975 - uDano * 0.004, h2(vec2(fila, floor(uTiempo * 24.0)))) * h2(vec2(floor(uv.x * 70.0), fila)) * 0.55;
  vec2 q = vUV - 0.5; c *= 1.0 - dot(q, q) * 0.85;
  c = mix(c, vec3(c.r * 0.55 + 0.45, c.g * 0.12, c.b * 0.1), uRojo);
  c = mix(c, vec3(0.92) + (n - 0.5) * 0.3, uBlanco);
  c *= 1.0 - uNegro;
  o = vec4(c, 1.0);
}`;
// al final del cuadro (principal.js, dibujar): la imagen de la pantalla a una textura y de vuelta, como cinta
function vhsPasada() {
  if (VHS.malo) return;
  const gl = R.gl, W = R.cv.width, H = R.cv.height;
  try {
    if (!VHS.P) VHS.P = shader(VS_PANT, FS_VHS, []);
    if (!VHS.tex || VHS.w !== W || VHS.h !== H) {
      if (VHS.tex) gl.deleteTexture(VHS.tex);
      VHS.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, VHS.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      VHS.w = W; VHS.h = H;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, VHS.tex); gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    const P = VHS.P; gl.useProgram(P.p); R.progAct = P;
    gl.uniform2f(P.u.uRes, W, H); gl.uniform1f(P.u.uTiempo, (performance.now() - VHS.t0) / 1000);   // (la textura va en la unidad 0, la de siempre)
    gl.uniform1f(P.u.uDano, VHS.dano); gl.uniform1f(P.u.uAgua, VHS.agua); gl.uniform1f(P.u.uRojo, VHS.rojo); gl.uniform1f(P.u.uNegro, VHS.negro);
    gl.uniform1f(P.u.uSac, VHS.sacudon); gl.uniform1f(P.u.uBlanco, VHS.blanco);
    gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.bindTexture(gl.TEXTURE_2D, null);
    R.progAct = null; R.texAct = null; R.vaoAct = null;
  } catch (e) { VHS.malo = true; console.warn('vhs', e); if (typeof cnAnotar === 'function') cnAnotar('vhs', String(e && e.message || e).slice(0, 200)); }
}
// prender y apagar (con lo de arriba de la pantalla)
function vhsPrender(si) {
  VHS.on = !!si; if (si && !VHS.t0) VHS.t0 = performance.now() - 1000 * Math.random() * 100;
  vhsOsd(); VHS.osd.classList.toggle('oc', !si);
  if (!si) { VHS.agua = VHS.rojo = VHS.negro = VHS.sacudon = VHS.blanco = 0; }
}
// lo escrito arriba de la cinta: arriba a la izquierda (PLAY ▶), arriba a la derecha (SP / los sellos), abajo a la
// izquierda la hora que corre y abajo la fecha. Cada uno se cambia con vhsTexto(lugar, texto)
function vhsOsd() {
  if (VHS.osd) return VHS.osd;
  const d = document.createElement('div'); d.id = 'vhsOsd'; d.className = 'oc';
  d.innerHTML = '<b class="vI"></b><b class="vD"></b><b class="vC"></b><b class="vAI"></b><b class="vAD"></b>';
  document.body.appendChild(d); VHS.osd = d; return d;
}
function vhsTexto(lugar, txt) {
  vhsOsd(); if (VHS.osdTxt[lugar] === txt) return; VHS.osdTxt[lugar] = txt;
  const e = VHS.osd.querySelector('.v' + lugar); if (e) e.textContent = txt;
}
// la hora de la cinta (AM 3:00:00 que corre desde que empezó)
function vhsHora(seg) {
  const s = Math.max(0, Math.floor(seg)), h = 3 + Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return 'AM ' + h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0');
}
