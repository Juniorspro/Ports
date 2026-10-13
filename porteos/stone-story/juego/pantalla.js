// Pantalla: grilla de celdas (letra + color de frente + fondo) dibujada con WebGL.
// Como AsciiRenderProcedural: entre 58 y 92 columnas y entre 25 y 27 filas segun la proporcion.
'use strict';
const Pantalla = (() => {
  const P = { cols: 92, filas: 26, celdaW: 22, celdaH: 40 };
  let gl, prog, texFg, texBg, texAtlas, lienzo, bufFg, bufBg;

  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;varying vec2 uv;uniform sampler2D fg,bg,atlas;uniform vec2 grilla;uniform vec2 celdaPx;
  void main(){vec2 g=uv*grilla;vec2 c=(floor(g)+.5)/grilla;vec2 l=fract(g);
  vec4 f=texture2D(fg,c);vec4 b=texture2D(bg,c);float i=floor(f.a*255.+.5);
  float tinta=0.;if(i<255.){vec2 m=.5/celdaPx;l=clamp(l,m,1.-m);vec2 a=(vec2(mod(i,16.),floor(i/16.))+l)/16.;tinta=1.-texture2D(atlas,a).r;}
  gl_FragColor=vec4(mix(b.rgb,f.rgb,tinta),1.);}`;

  function tex(filtro) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  P.iniciar = (canvas, atlasImg) => {
    lienzo = canvas;
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    texFg = tex(gl.NEAREST); texBg = tex(gl.NEAREST); texAtlas = tex(gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, texAtlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImg);
    P.celdaW = atlasImg.width / 16; P.celdaH = atlasImg.height / 16;
    gl.uniform2f(gl.getUniformLocation(prog, 'celdaPx'), P.celdaW, P.celdaH);
    gl.uniform1i(gl.getUniformLocation(prog, 'fg'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'bg'), 1);
    gl.uniform1i(gl.getUniformLocation(prog, 'atlas'), 2);
    P.medir();
  };

  // elige filas y columnas como SelectDimensions (bestFit 58..92 x 25..27)
  P.medir = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    let filas = 25, cols = 58;
    for (const f of [27, 26, 25]) {
      const c = Math.round(w / ((h / f) * P.celdaW / P.celdaH));
      if (c >= 58) { filas = f; cols = Math.min(92, c); break; }
      cols = Math.max(58, c); filas = f;
    }
    if (cols !== P.cols || filas !== P.filas || !P.glifo) {
      P.cols = cols; P.filas = filas;
      const n = cols * filas;
      P.glifo = new Int16Array(n); P.fg = new Uint8Array(n * 3); P.bg = new Uint8Array(n * 3);
      bufFg = new Uint8Array(n * 4); bufBg = new Uint8Array(n * 4);
    }
    lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
    gl.viewport(0, 0, lienzo.width, lienzo.height);
    gl.uniform2f(gl.getUniformLocation(prog, 'grilla'), P.cols, P.filas);
  };

  P.limpiar = () => { P.glifo.fill(32); P.fg.fill(255); P.bg.fill(0); };

  // pone una celda; bg = null deja el fondo como estaba
  P.poner = (x, y, g, r, v, a, bg) => {
    if (x < 0 || y < 0 || x >= P.cols || y >= P.filas) return;
    const i = y * P.cols + x;
    P.glifo[i] = g; P.fg[i * 3] = r; P.fg[i * 3 + 1] = v; P.fg[i * 3 + 2] = a;
    if (bg) { P.bg[i * 3] = bg[0]; P.bg[i * 3 + 1] = bg[1]; P.bg[i * 3 + 2] = bg[2]; }
  };

  P.texto = (x, y, s, col) => {
    col = col || [255, 255, 255];
    for (let k = 0; k < s.length; k++) P.poner(x + k, y, Ascii.codigo(s.charCodeAt(k)), col[0], col[1], col[2]);
  };

  P.presentar = () => {
    const n = P.cols * P.filas;
    for (let i = 0; i < n; i++) {
      const g = P.glifo[i];
      bufFg[i * 4] = P.fg[i * 3]; bufFg[i * 4 + 1] = P.fg[i * 3 + 1]; bufFg[i * 4 + 2] = P.fg[i * 3 + 2];
      bufFg[i * 4 + 3] = (g < 0 || g > 254 || g === 32) ? 255 : g;
      bufBg[i * 4] = P.bg[i * 3]; bufBg[i * 4 + 1] = P.bg[i * 3 + 1]; bufBg[i * 4 + 2] = P.bg[i * 3 + 2];
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texFg);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, P.cols, P.filas, 0, gl.RGBA, gl.UNSIGNED_BYTE, bufFg);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texBg);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, P.cols, P.filas, 0, gl.RGBA, gl.UNSIGNED_BYTE, bufBg);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texAtlas);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // de pixel de la pagina a celda
  P.celda = (px, py) => {
    const r = lienzo.getBoundingClientRect();
    return [Math.floor((px - r.left) / r.width * P.cols), Math.floor((py - r.top) / r.height * P.filas)];
  };
  return P;
})();
