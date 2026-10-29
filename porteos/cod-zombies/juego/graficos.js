// Apartado grafico: el juego dibuja en un framebuffer propio (no en el canvas) y aca se le agregan efectos:
//   resolucion interna escalable, oclusion ambiental y sombras de contacto (desde el buffer de profundidad),
//   resplandor (bloom), tonos de cine, gradacion de color, vineta, desenfoque de movimiento, FXAA, nitidez, grano,
//   y camara dinamica (balanceo al caminar, inercia al mirar, respiracion) inyectada en los vertex shaders del juego.
// Los efectos "de mundo" se aplican justo antes de que el juego empiece a dibujar el HUD (primer dibujo sin prueba
// de profundidad despues de la escena 3D), asi la interfaz queda limpia.
'use strict';
const Graficos = (() => {
  const CAB = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec2 uv;\n';
  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}';
  const LIN = 'float lin(float d){return 1.0/max(1.0-d,0.00002);}\nfloat ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}\n';
  const F_COPIA = CAB + 'uniform sampler2D t;void main(){gl_FragColor=texture2D(t,uv);}';
  // oclusion ambiental + sombras de contacto: r = visibilidad, g = profundidad lineal comprimida (para el difuminado)
  const fAO = (N, M) => CAB + 'uniform sampler2D prof;uniform vec4 par;uniform vec2 luz;\n' + LIN + `
void main(){
  float d=texture2D(prof,uv).r;
  if(d>=0.99999){gl_FragColor=vec4(1.0,1.0,0.0,1.0);return;}
  float L=lin(d);
  float r=clamp(par.z/L,0.002,0.05);
  float a=ign(gl_FragCoord.xy)*6.2831853;
  float occ=0.0;
  ${N > 0 ? `for(int i=0;i<${N};i++){
    float t=(float(i)+0.5)/${N}.0;float an=a+float(i)*2.3999632;
    vec2 o=vec2(cos(an),sin(an)*par.w)*r*sqrt(t);
    float df=(L-lin(texture2D(prof,uv+o).r))/L;
    occ+=smoothstep(0.015,0.06,df)*(1.0-smoothstep(0.3,0.7,df));
  }
  occ/=${N}.0;` : ''}
  float sh=0.0;
  ${M > 0 ? `float j=ign(gl_FragCoord.yx+7.0);
  for(int i=1;i<=${M};i++){
    float k=(float(i)-j)/${M}.0;
    vec2 q=uv+luz*r*1.6*k;
    float df=(L-lin(texture2D(prof,q).r))/L;
    sh=max(sh,smoothstep(0.01,0.04,df)*(1.0-smoothstep(0.12,0.3,df))*(1.0-k*0.7));
  }` : ''}
  float vis=(1.0-par.x*occ)*(1.0-par.y*sh);
  gl_FragColor=vec4(vis,L/(L+40.0),0.0,1.0);
}`;
  const F_AOAPLICAR = CAB + `uniform sampler2D aoT;uniform vec2 aoPx;
void main(){
  vec2 ce=texture2D(aoT,uv).rg;float w=1.0;float v=ce.r;
  for(int i=0;i<8;i++){
    float an=float(i)*0.7853982;vec2 o=vec2(cos(an),sin(an))*aoPx*(i<4?1.5:3.0);
    vec2 s=texture2D(aoT,uv+o).rg;float ww=1.0-smoothstep(0.0,0.015,abs(s.g-ce.g));v+=s.r*ww;w+=ww;
  }
  gl_FragColor=vec4(vec3(v/w),1.0);
}`;
  const F_BRILLO = CAB + `uniform sampler2D t;uniform vec2 px;uniform float umbral;
void main(){
  vec3 c=(texture2D(t,uv+px*vec2(-0.5,-0.5)).rgb+texture2D(t,uv+px*vec2(0.5,-0.5)).rgb+texture2D(t,uv+px*vec2(-0.5,0.5)).rgb+texture2D(t,uv+px*vec2(0.5,0.5)).rgb)*0.25;
  float b=max(c.r,max(c.g,c.b));
  float k=smoothstep(umbral,umbral+0.3,b);
  gl_FragColor=vec4(c*k,1.0);
}`;
  const F_BLUR = CAB + `uniform sampler2D t;uniform vec2 dir;
void main(){
  vec3 c=texture2D(t,uv).rgb*0.2270270;
  c+=(texture2D(t,uv+dir*1.3846154).rgb+texture2D(t,uv-dir*1.3846154).rgb)*0.3162162;
  c+=(texture2D(t,uv+dir*3.2307692).rgb+texture2D(t,uv-dir*3.2307692).rgb)*0.0702703;
  gl_FragColor=vec4(c,1.0);
}`;
  // mezcla final de la escena 3D: AO/sombras, bloom, desenfoque de movimiento, tonos, color, vineta
  const F_MEZCLA = CAB + `uniform sampler2D col;uniform sampler2D bl;
uniform vec4 tono;uniform vec3 alza;uniform vec3 gan;uniform vec4 extra;uniform vec2 mb;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
void main(){
  vec3 c=texture2D(col,uv).rgb;
  if(extra.y>0.0){
    vec3 s=c;
    for(int i=1;i<6;i++){float k=float(i)/5.0-0.5;s+=texture2D(col,uv+mb*k).rgb;}
    c=s/6.0;
  }
  c+=texture2D(bl,uv).rgb*tono.w;
  c*=tono.x;
  if(extra.z>0.0)c=mix(c,aces(c*1.3),extra.z);
  c=max((c-0.42)*tono.y+0.42,c*0.6);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  c=mix(vec3(l),c,tono.z);
  c=c*gan+alza;
  vec2 d=uv-0.5;
  c*=mix(1.0,smoothstep(0.85,0.25,length(d*vec2(1.15,1.0))),extra.w);
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;
  // salida al canvas: FXAA, nitidez, grano
  const F_FINAL = CAB + `uniform sampler2D t;uniform vec2 px;uniform vec4 par;
float lu(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
void main(){
  vec3 c=texture2D(t,uv).rgb;
  if(par.x>0.0){
    vec3 nw=texture2D(t,uv+vec2(-1.0,-1.0)*px).rgb,ne=texture2D(t,uv+vec2(1.0,-1.0)*px).rgb,sw=texture2D(t,uv+vec2(-1.0,1.0)*px).rgb,se=texture2D(t,uv+vec2(1.0,1.0)*px).rgb;
    float lnw=lu(nw),lne=lu(ne),lsw=lu(sw),lse=lu(se),lm=lu(c);
    float mn=min(lm,min(min(lnw,lne),min(lsw,lse))),mx=max(lm,max(max(lnw,lne),max(lsw,lse)));
    vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),((lnw+lsw)-(lne+lse)));
    float red=max((lnw+lne+lsw+lse)*0.03125,0.0078125);
    float rcp=1.0/(min(abs(dir.x),abs(dir.y))+red);
    dir=clamp(dir*rcp,-8.0,8.0)*px;
    vec3 a=0.5*(texture2D(t,uv+dir*(1.0/3.0-0.5)).rgb+texture2D(t,uv+dir*(2.0/3.0-0.5)).rgb);
    vec3 b=a*0.5+0.25*(texture2D(t,uv-dir*0.5).rgb+texture2D(t,uv+dir*0.5).rgb);
    float lb=lu(b);
    c=(lb<mn||lb>mx)?a:b;
  }
  if(par.y>0.0){
    vec3 n=(texture2D(t,uv+vec2(px.x,0.0)).rgb+texture2D(t,uv-vec2(px.x,0.0)).rgb+texture2D(t,uv+vec2(0.0,px.y)).rgb+texture2D(t,uv-vec2(0.0,px.y)).rgb)*0.25;
    c=clamp(c+(c-n)*par.y,0.0,1.0);
  }
  if(par.z>0.0)c+=(ign(gl_FragCoord.xy+par.w)-0.5)*par.z;
  gl_FragColor=vec4(c,1.0);
}`;

  // estilos de color: [exposicion, contraste, saturacion, alza(rgb), ganancia(rgb)]
  const ESTILOS = {
    original: [1.0, 1.0, 1.0, [0, 0, 0], [1, 1, 1]],
    realista: [1.1, 1.06, 0.95, [0.004, 0.006, 0.012], [1.03, 1.0, 0.96]],
    cine: [1.14, 1.1, 0.9, [0.006, 0.014, 0.026], [1.06, 0.99, 0.9]],
    frio: [1.05, 1.1, 0.85, [0.0, 0.01, 0.03], [0.94, 1.0, 1.08]],
    calido: [1.06, 1.08, 1.0, [0.02, 0.008, 0.0], [1.08, 1.0, 0.9]],
    terror: [0.98, 1.25, 0.65, [0.015, 0.0, 0.0], [1.05, 0.95, 0.92]],
  };
  const PRESETS = {
    bajo: { calidad: 0.75, ao: 0, sombras: 0, bloom: 0, aces: 0, estilo: 'original', vineta: 0, fxaa: 0, nitidez: 0, grano: 0, camara: 0, desenfoque: 0 },
    medio: { calidad: 1, ao: 0, sombras: 0, bloom: 0.25, aces: 0, estilo: 'realista', vineta: 0.3, fxaa: 1, nitidez: 0.2, grano: 0, camara: 1, desenfoque: 0 },
    alto: { calidad: 1, ao: 1, sombras: 1, bloom: 0.35, aces: 0.6, estilo: 'realista', vineta: 0.45, fxaa: 1, nitidez: 0.3, grano: 0, camara: 1, desenfoque: 0 },
    goty: { calidad: 1.25, ao: 2, sombras: 2, bloom: 0.5, aces: 1, estilo: 'cine', vineta: 0.45, fxaa: 1, nitidez: 0.45, grano: 0.025, camara: 2, desenfoque: 1 },
  };

  class Graficos {
    constructor(gl, hle, logW, logH) {
      this.gl = gl; this.hle = hle; this.logW = logW; this.logH = logH;
      this.cfg = Object.assign({}, PRESETS.alto);
      this.vao = gl.getExtension('OES_vertex_array_object');
      this.extProf = gl.getExtension('WEBGL_depth_texture');
      this.salidaW = gl.canvas.width; this.salidaH = gl.canvas.height;
      this.ajuste = 'completa';
      this.progs = {};
      this.cuadro = 0; this.t0 = performance.now(); this.dib3d = 0; this.prev3d = 0;
      this.cam = { fase: 0, mover: 0, miraX: 0, miraY: 0, velX: 0, velY: 0, roll: 0, ox: 0, oy: 0 };
      this.toques = new Map();
      this.camVec = new Float32Array(4); this.mb = [0, 0];
      this.crearRecursos();
      this.redimensionar();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    }

    // ---------- recursos ----------
    prog(nombre, fs) {
      if (this.progs[nombre]) return this.progs[nombre];
      const g = this.gl;
      const sh = (t, s) => { const x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x); if (!g.getShaderParameter(x, g.COMPILE_STATUS)) throw new Error('graficos: ' + nombre + ': ' + g.getShaderInfoLog(x)); return x; };
      const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, fs));
      g.bindAttribLocation(p, 0, 'p'); g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error('graficos: enlace ' + nombre + ': ' + g.getProgramInfoLog(p));
      const u = {}; const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = g.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = g.getUniformLocation(p, a.name); }
      return (this.progs[nombre] = { p, u });
    }
    crearRecursos() {
      const g = this.gl;
      this.quad = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, this.quad);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, null);
      if (this.vao) {
        this.vaoObj = this.vao.createVertexArrayOES();
        this.vao.bindVertexArrayOES(this.vaoObj);
        g.bindBuffer(g.ARRAY_BUFFER, this.quad);
        g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
        this.vao.bindVertexArrayOES(null);
        g.bindBuffer(g.ARRAY_BUFFER, null);
      }
      this.fbo = g.createFramebuffer();
      this.fboAux = g.createFramebuffer();
      this.fboAO = g.createFramebuffer(); this.fboB1 = g.createFramebuffer(); this.fboB2 = g.createFramebuffer();
    }
    tex(w, h, filtro) {
      const g = this.gl, t = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filtro || g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filtro || g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      return t;
    }
    // tamano interno: logico x factor (salida fisica / logico) x calidad; con tope
    redimensionar() {
      const g = this.gl, prev = g.getParameter(g.TEXTURE_BINDING_2D);
      const nat = Math.min(this.salidaW / this.logW, this.salidaH / this.logH);
      let f = Math.max(0.5, nat * this.cfg.calidad);
      const max = Math.min(g.getParameter(g.MAX_TEXTURE_SIZE), 3200);
      f = Math.min(f, max / this.logW, max / this.logH);
      const W = Math.max(1, Math.round(this.logW * f)), H = Math.max(1, Math.round(this.logH * f));
      if (W === this.W && H === this.H) return;
      for (const t of [this.cur, this.alt, this.prof, this.aoT, this.b1, this.b2]) if (t) g.deleteTexture(t);
      if (this.rbProf) { g.deleteRenderbuffer(this.rbProf); this.rbProf = null; }
      this.W = W; this.H = H; this.sx = W / this.logW; this.sy = H / this.logH;
      this.cur = this.tex(W, H); this.alt = this.tex(W, H);
      g.bindFramebuffer(g.FRAMEBUFFER, this.fbo);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.cur, 0);
      if (this.extProf) {
        this.prof = g.createTexture(); g.bindTexture(g.TEXTURE_2D, this.prof);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.texImage2D(g.TEXTURE_2D, 0, g.DEPTH_STENCIL, W, H, 0, g.DEPTH_STENCIL, this.extProf.UNSIGNED_INT_24_8_WEBGL, null);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_STENCIL_ATTACHMENT, g.TEXTURE_2D, this.prof, 0);
      }
      if (!this.extProf || g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) { // sin texturas de profundidad: sin AO ni sombras
        if (this.prof) { g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_STENCIL_ATTACHMENT, g.TEXTURE_2D, null, 0); g.deleteTexture(this.prof); this.prof = null; }
        this.rbProf = g.createRenderbuffer(); g.bindRenderbuffer(g.RENDERBUFFER, this.rbProf);
        g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_STENCIL, W, H);
        g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_STENCIL_ATTACHMENT, g.RENDERBUFFER, this.rbProf);
        g.bindRenderbuffer(g.RENDERBUFFER, null);
      }
      const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
      this.aoW = hw; this.aoH = hh;
      this.aoT = this.tex(hw, hh); this.b1 = this.tex(Math.max(1, W >> 2), Math.max(1, H >> 2)); this.b2 = this.tex(Math.max(1, W >> 2), Math.max(1, H >> 2));
      const pegar = (fb, t) => { g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0); };
      pegar(this.fboAux, this.alt); pegar(this.fboAO, this.aoT); pegar(this.fboB1, this.b1); pegar(this.fboB2, this.b2);
      g.bindTexture(g.TEXTURE_2D, prev);
      g.bindFramebuffer(g.FRAMEBUFFER, this.hle.fbAct ? this.hle.obj('fb', this.hle.fbAct) : this.fbo);
      this.hle.aplicarVp(); // el viewport real del juego cambia de escala
    }
    configurar(c) { Object.assign(this.cfg, c); this.pendienteTam = true; }
    salida(w, h) { this.salidaW = w; this.salidaH = h; this.pendienteTam = true; }

    // ---------- estado de GL: se guarda lo que tocan los pasos y se devuelve tal cual ----------
    guardar() {
      const g = this.gl, h = this.hle;
      const s = { en: {}, tex: [] };
      for (const c of [g.DEPTH_TEST, g.BLEND, g.CULL_FACE, g.SCISSOR_TEST, g.STENCIL_TEST]) s.en[c] = g.isEnabled(c);
      s.activa = g.getParameter(g.ACTIVE_TEXTURE);
      for (let i = 0; i < 3; i++) { g.activeTexture(g.TEXTURE0 + i); s.tex.push(g.getParameter(g.TEXTURE_BINDING_2D)); }
      s.mask = g.getParameter(g.COLOR_WRITEMASK);
      for (const c of [g.DEPTH_TEST, g.BLEND, g.CULL_FACE, g.SCISSOR_TEST, g.STENCIL_TEST]) g.disable(c);
      g.colorMask(true, true, true, true);
      if (this.vao) this.vao.bindVertexArrayOES(this.vaoObj);
      else { g.bindBuffer(g.ARRAY_BUFFER, this.quad); g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0); }
      return s;
    }
    devolver(s) {
      const g = this.gl, h = this.hle;
      for (let i = 0; i < 3; i++) { g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, s.tex[i]); }
      g.activeTexture(s.activa);
      for (const c in s.en) if (s.en[c]) g.enable(Number(c)); else g.disable(Number(c));
      g.colorMask(s.mask[0], s.mask[1], s.mask[2], s.mask[3]);
      if (this.vao) this.vao.bindVertexArrayOES(null);
      else { const a = h.atr[0]; if (a.on) g.enableVertexAttribArray(0); else g.disableVertexAttribArray(0); if (a.vbo) { g.bindBuffer(g.ARRAY_BUFFER, h.obj('buf', a.vbo)); g.vertexAttribPointer(0, a.tam, a.tipo, a.norm, a.paso, a.ptr); } }
      g.bindBuffer(g.ARRAY_BUFFER, h.obj('buf', h.vboAct));
      g.useProgram(h.obj('pr', h.progAct));
      g.bindFramebuffer(g.FRAMEBUFFER, h.fbAct ? h.obj('fb', h.fbAct) : this.fbo);
      h.aplicarVp();
    }
    pasada(nombre, fs, fb, w, h, uniformes, texturas) {
      const g = this.gl, pr = this.prog(nombre, fs);
      g.bindFramebuffer(g.FRAMEBUFFER, fb); g.viewport(0, 0, w, h);
      g.useProgram(pr.p);
      texturas.forEach((t, i) => { g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, t); });
      for (const k in uniformes) {
        const u = pr.u[k]; if (!u) continue; const v = uniformes[k];
        if (typeof v === 'number') { if (k === 't' || k === 'col' || k === 'aoT' || k === 'bl' || k === 'prof') g.uniform1i(u, v); else g.uniform1f(u, v); }
        else if (v.length === 2) g.uniform2f(u, v[0], v[1]); else if (v.length === 3) g.uniform3f(u, v[0], v[1], v[2]); else g.uniform4f(u, v[0], v[1], v[2], v[3]);
      }
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }

    // ---------- llamadas desde la capa GL ----------
    // antes de cada dibujo del juego en el framebuffer principal
    // AO/sombras: al terminar lo opaco (primer dibujo con profundidad sin escritura); el resto: antes del HUD
    antesDeDibujar(prof, mascara) {
      if (prof) {
        if (mascara) this.dib3d++;
        else if (!this.aoHecho && this.dib3d >= 6 && this.conAO()) this.pasoAO();
      } else if (!this.mundoHecho && this.dib3d >= 6 && this.hayEfectosMundo()) this.pasoMundo();
      const pr = this.hle.obj('pr', this.hle.progAct);
      if (pr && pr._gotyLoc) {
        const usar = prof && this.cfg.camara > 0 && this.prev3d >= 20; // solo en escenas 3D (no en menus)
        const marca = usar ? this.cuadro : -1;
        if (pr._gotyMarca !== marca) { pr._gotyMarca = marca; const v = usar ? this.camVec : null; this.gl.uniform4f(pr._gotyLoc, v ? v[0] : 0, v ? v[1] : 0, v ? v[2] : 0, v ? v[3] : 0); }
      }
      if (pr && pr._gotyEsc && pr._gotyEscV !== this.sx) { pr._gotyEscV = this.sx; this.gl.uniform1f(pr._gotyEsc, this.sx - 1); }
    }
    antesDeLimpiar(mascara) { // el juego borra la profundidad antes del HUD
      if ((mascara & 0x100) && !this.mundoHecho && this.dib3d >= 6 && this.hayEfectosMundo()) this.pasoMundo();
    }
    antesDeDibujarOtroFb() { // dibujos a texturas propias del juego: sin camara dinamica
      const pr = this.hle.obj('pr', this.hle.progAct);
      if (pr && pr._gotyLoc && pr._gotyMarca !== -2) { pr._gotyMarca = -2; this.gl.uniform4f(pr._gotyLoc, 0, 0, 0, 0); }
      if (pr && pr._gotyEsc && pr._gotyEscV !== 1) { pr._gotyEscV = 1; this.gl.uniform1f(pr._gotyEsc, 0); }
    }
    conAO() { return !!this.prof && (this.cfg.ao > 0 || this.cfg.sombras > 0); }
    hayEfectosMundo() { const c = this.cfg; return this.conAO() || c.bloom > 0 || c.aces > 0 || c.estilo !== 'original' || c.vineta > 0 || (c.desenfoque > 0 && Math.hypot(this.mb[0], this.mb[1]) > 0.0015); }

    pasoAO() {
      this.aoHecho = true;
      const g = this.gl, c = this.cfg, s = this.guardar(), W = this.W, H = this.H;
      const N = c.ao >= 2 ? 12 : c.ao === 1 ? 8 : 0, M = c.sombras >= 2 ? 10 : c.sombras === 1 ? 6 : 0;
      this.pasada('ao' + N + '_' + M, fAO(N, M), this.fboAO, this.aoW, this.aoH,
        { prof: 0, par: [c.ao >= 2 ? 1.0 : 0.75, c.sombras >= 2 ? 0.5 : 0.35, 0.55, W / H], luz: [-0.38 * H / W, 0.92] }, [this.prof]);
      // se multiplica sobre la escena opaca (las transparencias y el HUD quedan encima)
      const bs = [g.BLEND_SRC_RGB, g.BLEND_DST_RGB, g.BLEND_SRC_ALPHA, g.BLEND_DST_ALPHA, g.BLEND_EQUATION_RGB, g.BLEND_EQUATION_ALPHA].map((x) => g.getParameter(x));
      g.enable(g.BLEND); g.blendEquation(g.FUNC_ADD); g.blendFunc(g.DST_COLOR, g.ZERO);
      g.colorMask(true, true, true, false);
      this.pasada('aoaplicar', F_AOAPLICAR, this.fbo, W, H, { aoT: 0, aoPx: [1 / this.aoW, 1 / this.aoH] }, [this.aoT]);
      g.blendFuncSeparate(bs[0], bs[1], bs[2], bs[3]); g.blendEquationSeparate(bs[4], bs[5]);
      this.devolver(s);
    }
    pasoMundo() {
      this.mundoHecho = true;
      if (!this.aoHecho && this.conAO()) this.pasoAO();
      const g = this.gl, c = this.cfg, s = this.guardar();
      const W = this.W, H = this.H;
      const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
      if (c.bloom > 0) {
        this.pasada('brillo', F_BRILLO, this.fboB1, bw, bh, { t: 0, px: [1 / W * 2, 1 / H * 2], umbral: 0.62 }, [this.cur]);
        for (let k = 0; k < 2; k++) {
          this.pasada('blur', F_BLUR, this.fboB2, bw, bh, { t: 0, dir: [(1 + k) / bw, 0] }, [this.b1]);
          this.pasada('blur', F_BLUR, this.fboB1, bw, bh, { t: 0, dir: [0, (1 + k) / bh] }, [this.b2]);
        }
      }
      const e = ESTILOS[c.estilo] || ESTILOS.original;
      const mbOn = c.desenfoque > 0 && Math.hypot(this.mb[0], this.mb[1]) > 0.0015 ? 1 : 0;
      this.pasada('mezcla', F_MEZCLA, this.fboAux, W, H, {
        col: 0, bl: 1, tono: [e[0], e[1], e[2], c.bloom], alza: e[3], gan: e[4],
        extra: [0, mbOn, c.aces, c.vineta], mb: this.mb,
      }, [this.cur, c.bloom > 0 ? this.b1 : this.cur]);
      // el resultado pasa a ser el color del framebuffer principal (el HUD se dibuja encima)
      const t = this.cur; this.cur = this.alt; this.alt = t;
      g.bindFramebuffer(g.FRAMEBUFFER, this.fbo); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.cur, 0);
      g.bindFramebuffer(g.FRAMEBUFFER, this.fboAux); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.alt, 0);
      this.devolver(s);
    }

    // fin de cuadro (eglSwapBuffers): sale al canvas
    presentar() {
      const g = this.gl, c = this.cfg;
      if (!this.mundoHecho && this.dib3d >= 6 && this.hayEfectosMundo()) this.pasoMundo();
      const s = this.guardar();
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      const cw = g.canvas.width, ch = g.canvas.height;
      let x = 0, y = 0, w = cw, h = ch;
      if (this.ajuste === 'bordes') { const k = Math.min(cw / this.logW, ch / this.logH); w = Math.round(this.logW * k); h = Math.round(this.logH * k); x = (cw - w) >> 1; y = (ch - h) >> 1; }
      if (w !== cw || h !== ch) { g.viewport(0, 0, cw, ch); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); }
      g.useProgram(this.prog('final', F_FINAL).p);
      const pr = this.progs.final;
      g.viewport(x, y, w, h);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, c.ver === 'ao' ? this.aoT : c.ver === 'bloom' ? this.b1 : this.cur);
      g.uniform1i(pr.u.t, 0); g.uniform2f(pr.u.px, 1 / this.W, 1 / this.H);
      g.uniform4f(pr.u.par, c.fxaa, c.nitidez, c.grano, (this.cuadro * 7.0) % 64);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      this.devolver(s);
      // siguiente cuadro
      this.cuadro++; this.prev3d = this.dib3d; this.dib3d = 0; this.mundoHecho = false; this.aoHecho = false;
      if (this.pendienteTam) { this.pendienteTam = false; this.redimensionar(); }
      this.actualizarCamara();
    }

    // ---------- camara dinamica ----------
    entrada(m) {
      const L = this.logW;
      if (m.e === 'down') this.toques.set(m.id, { x0: m.x, y0: m.y, x: m.x, y: m.y, izq: m.x < L * 0.45 });
      else if (m.e === 'move') { const t = this.toques.get(m.id); if (t) { if (!t.izq) { this.cam.miraX += m.x - t.x; this.cam.miraY += m.y - t.y; } t.x = m.x; t.y = m.y; } }
      else if (m.e === 'up') this.toques.delete(m.id);
    }
    actualizarCamara() {
      const ahora = performance.now(), dt = Math.min(0.1, (ahora - (this.tCam || ahora)) / 1000); this.tCam = ahora;
      const cam = this.cam, k = this.cfg.camara;
      // caminar: hay un toque en la mitad izquierda que se alejo de donde empezo
      let mover = 0;
      for (const t of this.toques.values()) if (t.izq) mover = Math.max(mover, Math.min(1, Math.hypot(t.x - t.x0, t.y - t.y0) / (this.logH * 0.12)));
      cam.mover += (mover - cam.mover) * Math.min(1, dt * 6);
      cam.fase += dt * (6.5 + 3 * cam.mover) * cam.mover;
      // mirar: velocidad suavizada en pixeles logicos por segundo
      const vx = dt > 0 ? cam.miraX / Math.max(dt, 1 / 120) : 0, vy = dt > 0 ? cam.miraY / Math.max(dt, 1 / 120) : 0;
      cam.miraX = 0; cam.miraY = 0;
      cam.velX += (vx - cam.velX) * Math.min(1, dt * 12); cam.velY += (vy - cam.velY) * Math.min(1, dt * 12);
      const t = (ahora - this.t0) / 1000;
      const a = k >= 2 ? 1.6 : 1.0;
      // balanceo al caminar, respiracion, inclinacion al girar e inercia
      let roll = Math.sin(cam.fase) * 0.012 * cam.mover * a + Math.sin(t * 0.7) * 0.0025 * a;
      roll += Math.max(-0.035, Math.min(0.035, -cam.velX / this.logW * 0.012 * a));
      let ox = Math.sin(cam.fase) * 0.006 * cam.mover * a + Math.max(-0.02, Math.min(0.02, -cam.velX / this.logW * 0.006 * a));
      let oy = Math.abs(Math.sin(cam.fase)) * -0.012 * cam.mover * a + Math.sin(t * 1.3) * 0.003 * a + Math.max(-0.02, Math.min(0.02, cam.velY / this.logH * 0.005 * a));
      cam.roll += (roll - cam.roll) * Math.min(1, dt * 8); cam.ox += (ox - cam.ox) * Math.min(1, dt * 8); cam.oy += (oy - cam.oy) * Math.min(1, dt * 8);
      const v = this.camVec; v[0] = cam.roll; v[1] = cam.ox; v[2] = cam.oy; v[3] = k >= 2 ? 0.035 * Math.min(1, cam.mover) : 0.0; // leve zoom al correr
      // desenfoque de movimiento: en la direccion opuesta al giro
      const f = this.cfg.desenfoque > 0 ? 0.00004 : 0;
      this.mb[0] = Math.max(-0.04, Math.min(0.04, cam.velX * f)); this.mb[1] = Math.max(-0.04, Math.min(0.04, -cam.velY * f));
    }

    // ---------- shaders del juego ----------
    // renombra main() del vertex shader y agrega una envoltura que aplica la camara dinamica en espacio de recorte
    static adaptar(src, tipo) {
      if (tipo !== 0x8b31 || !/void\s+main\s*\(/.test(src)) return src;
      let s = src.replace(/void\s+main\s*\(\s*(void)?\s*\)/, 'void _gotyMain()');
      const punto = /gl_PointSize/.test(src);
      s += '\nuniform vec4 _gotyCam;\n' + (punto ? 'uniform float _gotyEsc;\n' : '') +
        'void main(){_gotyMain();float _c=cos(_gotyCam.x),_s=sin(_gotyCam.x);vec4 _p=gl_Position;' +
        '_p.xy=(mat2(_c,_s,-_s,_c)*_p.xy)*(1.0+_gotyCam.w)+_gotyCam.yz*_p.w;gl_Position=_p;' + (punto ? 'gl_PointSize*=(1.0+_gotyEsc);' : '') + '}\n';
      return s;
    }
  }
  Graficos.PRESETS = PRESETS;
  Graficos.ESTILOS = ESTILOS;
  return Graficos;
})();
if (typeof module !== 'undefined') module.exports = Graficos;
