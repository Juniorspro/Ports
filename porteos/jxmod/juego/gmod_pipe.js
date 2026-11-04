// ---------------- SteamPipe en el juego: los addons del Workshop que Steam no da como archivo directo ----------------
// Más o menos la mitad de los addons de GMod están sólo en el CDN de Steam: cifrados (AES-256) y en pedazos de hasta 1 MB
// comprimidos. La tienda (worker) entra anónima a Steam y da la clave del depósito y el código del manifiesto
// (/api/gmod/pipe/ID) y deja pedir el CDN desde una página (/api/gmod/cdn/...). Acá se baja el manifiesto (un zip con
// protobuf), se descifran los nombres, se bajan los pedazos del .gma de a varios, se descifran, se descomprimen (LZMA,
// zip o zstd) en otro hilo, se comprueba cada uno con su SHA-1 y se arma el .gma entero, que se instala como siempre.
const GP = { paralelo: 6, hilo: null, nHilo: 0, esperan: new Map() };
const gpHex = (b) => { let s = ''; for (let i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; };
const gpDeHex = (s) => { const o = new Uint8Array(s.length >> 1); for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16); return o; };
// protobuf de lectura: campo → lista de valores (varint y fixed64 como número; los ids de 64 bits no hacen falta acá)
function gpPB(b) {
  const m = new Map(); let i = 0;
  const vi = () => { let r = 0, s = 1; for (;;) { const x = b[i++]; r += (x & 0x7f) * s; if (!(x & 0x80)) return r; s *= 128; } };
  while (i < b.length) {
    const k = vi(), f = Math.floor(k / 8), t = k & 7; let v;
    if (t === 0) v = vi();
    else if (t === 1) { v = 0; for (let j = 7; j >= 0; j--) v = v * 256 + b[i + j]; i += 8; }
    else if (t === 2) { const n = vi(); v = b.subarray(i, i + n); i += n; }
    else if (t === 5) { v = (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; i += 4; }
    else throw new Error('manifiesto dañado');
    if (!m.has(f)) m.set(f, []); m.get(f).push(v);
  }
  return m;
}
const gpUno = (m, f, d) => (m.has(f) ? m.get(f)[0] : d);

// ---- AES-256 de Steam: el IV va cifrado en ECB en los primeros 16 bytes; el resto, CBC con PKCS7 ----
// (WebCrypto no trae ECB: un bloque solo se descifra como CBC con IV 0 agregándole un segundo bloque de relleno válido)
async function gpECB(K, blk) {
  const x = new Uint8Array(16); for (let i = 0; i < 16; i++) x[i] = blk[i] ^ 16;
  const e = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, K, x));
  const c = new Uint8Array(32); c.set(blk.subarray(0, 16), 0); c.set(e.subarray(0, 16), 16);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, K, c));
}
async function gpDescifrar(K, b) { const iv = await gpECB(K, b.subarray(0, 16)); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, K, b.subarray(16))); }

// ---- zip de un archivo (el manifiesto y los pedazos viejos) ----
function gpZipEntrada(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  let met, cs, us, lo = 0;
  if (e >= 0) { const cd = dv.getUint32(e + 16, true); met = dv.getUint16(cd + 10, true); cs = dv.getUint32(cd + 20, true); us = dv.getUint32(cd + 24, true); lo = dv.getUint32(cd + 42, true); }
  else { met = dv.getUint16(8, true); cs = dv.getUint32(18, true); us = dv.getUint32(22, true); }
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('zip dañado');
  const ini = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
  return { met, us, d: b.subarray(ini, ini + cs) };
}
async function gpInflar(d, us) {
  if (typeof DecompressionStream === 'function') { try { const o = new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); if (o.length === us) return o; } catch (e) {} }
  return inflarJS(d, us);
}
async function gpUnzip(b) { const z = gpZipEntrada(b); if (z.met === 0) return z.d.slice(); if (z.met !== 8) throw new Error('zip con método ' + z.met); return gpInflar(z.d, z.us); }

// ---- el manifiesto: los archivos del addon con sus pedazos ----
async function gpManifiesto(zip, K) {
  const b = await gpUnzip(zip), dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let i = 0, carga = null, meta = null;
  while (i + 4 <= b.length) {
    const mg = dv.getUint32(i, true); i += 4; if (mg === 0x32c415ab) break;
    const n = dv.getUint32(i, true); i += 4; const d = b.subarray(i, i + n); i += n;
    if (mg === 0x71f617d0) carga = d; else if (mg === 0x1f4812be) meta = d;
  }
  if (!carga) throw new Error('manifiesto sin archivos');
  const M = meta ? gpPB(meta) : new Map(), cifrados = !!gpUno(M, 4, 0), td = new TextDecoder();
  const archivos = [];
  for (const fm of gpPB(carga).get(1) || []) {
    const f = gpPB(fm); let nom = td.decode(gpUno(f, 1, new Uint8Array(0)));
    if (cifrados && nom) { try { const s = atob(nom.replace(/\s+/g, '')), e = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) e[k] = s.charCodeAt(k); nom = td.decode(await gpDescifrar(K, e)).replace(/\0+$/, ''); } catch (e) { nom = ''; } }
    archivos.push({
      nombre: nom.replace(/\\/g, '/'), tam: gpUno(f, 2, 0), flags: gpUno(f, 3, 0), sha: gpUno(f, 5, null),
      pedazos: (f.get(6) || []).map((c) => { const C = gpPB(c); return { sha: gpHex(gpUno(C, 1, new Uint8Array(0))), off: gpUno(C, 3, 0), tam: gpUno(C, 4, 0), comp: gpUno(C, 5, 0) }; }).sort((a, b2) => a.off - b2.off),
    });
  }
  return archivos;
}

// ---- zstd (los pedazos nuevos de Steam, "VSZa"): fzstd de Arjun Barrett, licencia MIT (github.com/101arrowz/fzstd) ----
const GP_ZSTD_SRC = "!function(f){typeof module!='undefined'&&typeof exports=='object'?module.exports=f():typeof define!='undefined'&&define.amd?define(['fzstd',f]):(typeof self!='undefined'?self:this).fzstd=f()}(function(){var _e={};\"use strict\";var r=ArrayBuffer,t=Uint8Array,e=Uint16Array,n=Int16Array,a=Uint32Array,s=Int32Array,i=function(r,e,n){if(t.prototype.slice)return t.prototype.slice.call(r,e,n);(null==e||e<0)&&(e=0),(null==n||n>r.length)&&(n=r.length);var a=new t(n-e);return a.set(r.subarray(e,n)),a},o=function(r,e,n,a){if(t.prototype.fill)return t.prototype.fill.call(r,e,n,a);for((null==n||n<0)&&(n=0),(null==a||a>r.length)&&(a=r.length);n<a;++n)r[n]=e;return r},u=function(r,e,n,a){if(t.prototype.copyWithin)return t.prototype.copyWithin.call(r,e,n,a);for((null==n||n<0)&&(n=0),(null==a||a>r.length)&&(a=r.length);n<a;)r[e++]=r[n++]};_e.ZstdErrorCode={InvalidData:0,WindowSizeTooLarge:1,InvalidBlockType:2,FSEAccuracyTooHigh:3,DistanceTooFarBack:4,UnexpectedEOF:5};var h=[\"invalid zstd data\",\"window size too large (>2046MB)\",\"invalid block type\",\"FSE accuracy too high\",\"match distance too far back\",\"unexpected EOF\"],f=function(r,t,e){var n=Error(t||h[r]);if(n.code=r,Error.captureStackTrace&&Error.captureStackTrace(n,f),!e)throw n;return n},l=function(r,t,e){for(var n=0,a=0;n<e;++n)a|=r[t++]<<(n<<3);return a},v=function(r,t){return(r[t]|r[t+1]<<8|r[t+2]<<16|r[t+3]<<24)>>>0},c=function(r,e){var n=r[0]|r[1]<<8|r[2]<<16;if(3126568==n&&253==r[3]){var a=r[4],i=a>>5&1,o=a>>2&1,u=3&a,h=a>>6;8&a&&f(0);var c=6-i,b=3==u?4:u,y=l(r,c,b),p=h?1<<h:i,w=l(r,c+=b,p)+(1==h&&256),g=w;if(!i){var d=1<<10+(r[5]>>3);g=d+(d>>3)*(7&r[5])}g>2145386496&&f(1);var m=new t((1==e?w||g:e?0:g)+12);return m[0]=1,m[4]=4,m[8]=8,{b:c+p,y:0,l:0,d:y,w:e&&1!=e?e:m.subarray(12),e:g,o:new s(m.buffer,0,3),u:w,c:o,m:Math.min(131072,g)}}if(25481893==(n>>4|r[3]<<20))return v(r,4)+8;f(0)},b=function(r){for(var t=0;1<<t<=r;++t);return t-1},y=function(a,s,i){var o=4+(s<<3),u=5+(15&a[s]);u>i&&f(3);for(var h=1<<u,l=h,v=-1,c=-1,y=-1,p=h,w=new r(512+(h<<2)),g=new n(w,0,256),d=new e(w,0,256),m=new e(w,512,h),z=512+(h<<1),E=new t(w,z,h),k=new t(w,z+h);v<255&&l>0;){var A=b(l+1),T=o>>3,x=(1<<A+1)-1,F=(a[T]|a[T+1]<<8|a[T+2]<<16)>>(7&o)&x,S=(1<<A)-1,B=x-l-1,I=F&S;if(I<B?(o+=A,F=I):(o+=A+1,F>S&&(F-=B)),g[++v]=--F,-1==F?(l+=F,E[--p]=v):l-=F,!F)do{var U=o>>3;c=(a[U]|a[U+1]<<8)>>(7&o)&3,o+=2,v+=c}while(3==c)}(v>255||l)&&f(0);for(var D=0,M=(h>>1)+(h>>3)+3,W=h-1,O=0;O<=v;++O){var j=g[O];if(j<1)d[O]=-j;else for(y=0;y<j;++y){E[D]=O;do{D=D+M&W}while(D>=p)}}for(D&&f(0),y=0;y<h;++y){var C=d[E[y]]++,H=k[y]=u-b(C);m[y]=(C<<H)-h}return[o+7>>3,{b:u,s:E,n:k,t:m}]},p=function(r,n){var a=0,s=-1,i=new t(292),u=r[n],h=i.subarray(0,256),l=i.subarray(256,268),v=new e(i.buffer,268);if(u<128){var c=y(r,n+1,6),p=c[1],w=c[0]<<3,g=r[n+=u];g||f(0);for(var d=0,m=0,z=p.b,E=z,k=(++n<<3)-8+b(g);!((k-=z)<w);){var A=k>>3;if(h[++s]=p.s[d+=(r[A]|r[A+1]<<8)>>(7&k)&(1<<z)-1],(k-=E)<w)break;h[++s]=p.s[m+=(r[A=k>>3]|r[A+1]<<8)>>(7&k)&(1<<E)-1],z=p.n[d],d=p.t[d],E=p.n[m],m=p.t[m]}++s>255&&f(0)}else{for(s=u-127;a<s;a+=2){var T=r[++n];h[a]=T>>4,h[a+1]=15&T}++n}var x=0;for(a=0;a<s;++a)(I=h[a])>11&&f(0),x+=I&&1<<I-1;var F=b(x)+1,S=1<<F,B=S-x;for(B&B-1&&f(0),h[s++]=b(B)+1,a=0;a<s;++a){var I;++l[h[a]=(I=h[a])&&F+1-I]}var U=new t(S<<1),D=U.subarray(0,S),M=U.subarray(S);for(v[F]=0,a=F;a>0;--a){var W=v[a];o(M,a,W,v[a-1]=W+l[a]*(1<<F-a))}for(v[0]!=S&&f(0),a=0;a<s;++a){var O=h[a];if(O){var j=v[O];o(D,a,j,v[O]=j+(1<<F-O))}}return[n,{n:M,b:F,s:D}]},w=y(new t([81,16,99,140,49,198,24,99,12,33,196,24,99,102,102,134,70,146,4]),0,6)[1],g=y(new t([33,20,196,24,99,140,33,132,16,66,8,33,132,16,66,8,33,68,68,68,68,68,68,68,68,36,9]),0,6)[1],d=y(new t([32,132,16,66,102,70,68,68,68,68,36,73,2]),0,5)[1],m=function(r,t){for(var e=r.length,n=new s(e),a=0;a<e;++a)n[a]=t,t+=1<<r[a];return n},z=new t(new s([0,0,0,0,16843009,50528770,134678020,202050057,269422093]).buffer,0,36),E=m(z,0),k=new t(new s([0,0,0,0,0,0,0,0,16843009,50528770,117769220,185207048,252579084,16]).buffer,0,53),A=m(k,3),T=function(r,t,e){var n=r.length,a=t.length,s=r[n-1],i=(1<<e.b)-1,o=-e.b;s||f(0);for(var u=0,h=e.b,l=(n<<3)-8+b(s)-h,v=-1;l>o&&v<a;){var c=l>>3;t[++v]=e.s[u=(u<<h|(r[c]|r[c+1]<<8|r[c+2]<<16)>>(7&l))&i],l-=h=e.n[u]}l==o&&v+1==a||f(0)},x=function(r,t,e){var n=6,a=t.length+3>>2,s=a<<1,i=a+s;T(r.subarray(n,n+=r[0]|r[1]<<8),t.subarray(0,a),e),T(r.subarray(n,n+=r[2]|r[3]<<8),t.subarray(a,s),e),T(r.subarray(n,n+=r[4]|r[5]<<8),t.subarray(s,i),e),T(r.subarray(n),t.subarray(i),e)},F=function(r,n,a){var s,u=n.b,h=r[u],l=h>>1&3;n.l=1&h;var v=h>>3|r[u+1]<<5|r[u+2]<<13,c=(u+=3)+v;if(1==l){if(u>=r.length)return;return n.b=u+1,a?(o(a,r[u],n.y,n.y+=v),a):o(new t(v),r[u])}if(!(c>r.length)){if(0==l)return n.b=c,a?(a.set(r.subarray(u,c),n.y),n.y+=v,a):i(r,u,c);if(2==l){var m=r[u],F=3&m,S=m>>2&3,B=m>>4,I=0,U=0;F<2?1&S?B|=r[++u]<<4|(2&S&&r[++u]<<12):B=m>>3:(U=S,S<2?(B|=(63&r[++u])<<4,I=r[u]>>6|r[++u]<<2):2==S?(B|=r[++u]<<4|(3&r[++u])<<12,I=r[u]>>2|r[++u]<<6):(B|=r[++u]<<4|(63&r[++u])<<12,I=r[u]>>6|r[++u]<<2|r[++u]<<10)),++u;var D=a?a.subarray(n.y,n.y+n.m):new t(n.m),M=D.length-B;if(0==F)D.set(r.subarray(u,u+=B),M);else if(1==F)o(D,r[u++],M);else{var W=n.h;if(2==F){var O=p(r,u);I+=u-(u=O[0]),n.h=W=O[1]}else W||f(0);(U?x:T)(r.subarray(u,u+=I),D.subarray(M),W)}var j=r[u++];if(j){255==j?j=32512+(r[u++]|r[u++]<<8):j>127&&(j=j-128<<8|r[u++]);var C=r[u++];3&C&&f(0);for(var H=[g,d,w],L=2;L>-1;--L){var Z=C>>2+(L<<1)&3;if(1==Z){var q=new t([0,0,r[u++]]);H[L]={s:q.subarray(2,3),n:q.subarray(0,1),t:new e(q.buffer,0,1),b:0}}else 2==Z?(u=(s=y(r,u,9-(1&L)))[0],H[L]=s[1]):3==Z&&(n.t||f(0),H[L]=n.t[L])}var G=n.t=H,J=G[0],K=G[1],N=G[2],P=r[c-1];P||f(0);var Q=(c<<3)-8+b(P)-N.b,R=Q>>3,V=0,X=(r[R]|r[R+1]<<8)>>(7&Q)&(1<<N.b)-1,Y=(r[R=(Q-=K.b)>>3]|r[R+1]<<8)>>(7&Q)&(1<<K.b)-1,$=(r[R=(Q-=J.b)>>3]|r[R+1]<<8)>>(7&Q)&(1<<J.b)-1;for(++j;--j;){var _=N.s[X],rr=N.n[X],tr=J.s[$],er=J.n[$],nr=K.s[Y],ar=K.n[Y],sr=1<<nr,ir=sr+((r[R=(Q-=nr)>>3]|r[R+1]<<8|r[R+2]<<16|r[R+3]<<24)>>>(7&Q)&sr-1);R=(Q-=k[tr])>>3;var or=A[tr]+((r[R]|r[R+1]<<8|r[R+2]<<16)>>(7&Q)&(1<<k[tr])-1);R=(Q-=z[_])>>3;var ur=E[_]+((r[R]|r[R+1]<<8|r[R+2]<<16)>>(7&Q)&(1<<z[_])-1);if(R=(Q-=rr)>>3,X=N.t[X]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<rr)-1),R=(Q-=er)>>3,$=J.t[$]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<er)-1),R=(Q-=ar)>>3,Y=K.t[Y]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<ar)-1),ir>3)n.o[2]=n.o[1],n.o[1]=n.o[0],n.o[0]=ir-=3;else{var hr=ir-(0!=ur);hr?(ir=3==hr?n.o[0]-1:n.o[hr],hr>1&&(n.o[2]=n.o[1]),n.o[1]=n.o[0],n.o[0]=ir):ir=n.o[0]}for(L=0;L<ur;++L)D[V+L]=D[M+L];M+=ur;var fr=(V+=ur)-ir;if(fr<0){var lr=-fr,vr=n.e+fr;for(lr>or&&(lr=or),L=0;L<lr;++L)D[V+L]=n.w[vr+L];V+=lr,or-=lr,fr=0}for(L=0;L<or;++L)D[V+L]=D[fr+L];V+=or}if(V!=M)for(;M<D.length;)D[V++]=D[M++];else V=D.length;a?n.y+=V:D=i(D,0,V)}else if(a){if(n.y+=B,M)for(L=0;L<B;++L)D[L]=D[M+L]}else M&&(D=i(D,M));return n.b=c,D}f(2)}},S=function(r,e){if(1==r.length)return r[0];for(var n=new t(e),a=0,s=0;a<r.length;++a){var i=r[a];n.set(i,s),s+=i.length}return n};function B(r,t){for(var e=[],n=+!t,a=0,s=0;r.length;){var i=c(r,n||t);if(\"object\"==typeof i){for(n?(t=null,i.w.length==i.u&&(e.push(t=i.w),s+=i.u)):(e.push(t),i.e=0);!i.l;){var o=F(r,i,t);o||f(5),t?i.e=i.y:(e.push(o),s+=o.length,u(i.w,0,o.length),i.w.set(o,i.w.length-o.length))}a=i.b+4*i.c}else a=i;r=r.subarray(a)}return S(e,s)}_e.decompress=B;var I=function(){function r(r){this.ondata=r,this.c=[],this.l=0,this.z=0}return r.prototype.push=function(r,e){if(\"number\"==typeof this.s){var n=Math.min(r.length,this.s);r=r.subarray(n),this.s-=n}var a=r.length+this.l;if(!this.s){if(e){if(!a)return void this.ondata(new t(0),!0);a<5&&f(5)}else if(a<18)return this.c.push(r),void(this.l=a);if(this.l&&(this.c.push(r),r=S(this.c,a),this.c=[],this.l=0),\"number\"==typeof(this.s=c(r)))return this.push(r,e)}if(\"number\"!=typeof this.s){if(a<(this.z||3))return e&&f(5),this.c.push(r),void(this.l=a);if(this.l&&(this.c.push(r),r=S(this.c,a),this.c=[],this.l=0),!this.z&&a<(this.z=2&r[this.s.b]?4:3+(r[this.s.b]>>3|r[this.s.b+1]<<5|r[this.s.b+2]<<13)))return e&&f(5),this.c.push(r),void(this.l=a);for(this.z=0;;){var s=F(r,this.s);if(!s){e&&f(5);var i=r.subarray(this.s.b);return this.s.b=0,this.c.push(i),void(this.l+=i.length)}if(this.ondata(s,!1),u(this.s.w,0,s.length),this.s.w.set(s,this.s.w.length-s.length),this.s.l){var o=r.subarray(this.s.b);return this.s=4*this.s.c,void this.push(o,e)}}}else e&&f(5)},r}();_e.Decompress=I;return _e})";
const GP_ZSTD_ARMAR = 'const _fz=(function(module,exports,define){'+GP_ZSTD_SRC+';return module.exports})({exports:{}},{},undefined);';
let _gpFz = null;
function gpZstd(d, tam) { if (!_gpFz) _gpFz = new Function(GP_ZSTD_ARMAR + 'return _fz')(); return _gpFz.decompress(d, new Uint8Array(tam)); }

// ---- descomprimir los pedazos en otro hilo (LZMA de VZip, zstd de VSZa); zip y lo que falle, acá ----
function gpHiloCrear() {
  if (GP.hilo !== null) return GP.hilo;
  try {
    const src = 'const GMF={};GMF.lzma=' + GMF.lzma.toString() + ';' + GP_ZSTD_ARMAR + 'function gpZstd(d,t){return _fz.decompress(d,new Uint8Array(t))};' + gpDescomprimirSinc.toString() +
      ';onmessage=(e)=>{const{id,d,tam}=e.data;try{const o=gpDescomprimirSinc(d,tam);postMessage({id,o},[o.buffer])}catch(x){postMessage({id,e:String(x&&x.message||x)})}}';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = (e) => { const f = GP.esperan.get(e.data.id); if (f) { GP.esperan.delete(e.data.id); f(e.data); } };
    w.onerror = () => { for (const f of GP.esperan.values()) f({ e: 'hilo' }); GP.esperan.clear(); GP.hilo = false; };
    GP.hilo = w;
  } catch (e) { GP.hilo = false; }
  return GP.hilo;
}
// (VZip: 'VZa' + 4 bytes + 5 de propiedades LZMA + datos + CRC, tamaño y 'zv'; se arma el LZMA "alone" que ya decodifica GMF)
function gpDescomprimirSinc(d, tam) {
  if (d[0] === 0x56 && d[1] === 0x53 && d[2] === 0x5a && d[3] === 0x61) return gpZstd(d.subarray(8, d.length - 15), tam);
  if (d[0] === 0x56 && d[1] === 0x5a && d[2] === 0x61) {
    const n = d.length, us = (d[n - 6] | (d[n - 5] << 8) | (d[n - 4] << 16) | (d[n - 3] << 24)) >>> 0, src = new Uint8Array(13 + n - 22);
    src.set(d.subarray(7, 12), 0); src[5] = us & 255; src[6] = (us >>> 8) & 255; src[7] = (us >>> 16) & 255; src[8] = us >>> 24; src.set(d.subarray(12, n - 10), 13);
    return GMF.lzma(src);
  }
  throw new Error('pedazo con formato desconocido');
}
async function gpDescomprimir(d, tam) {
  if (d[0] === 0x50 && d[1] === 0x4b) return gpUnzip(d);
  const w = typeof Worker === 'function' ? gpHiloCrear() : false;
  if (!w) return gpDescomprimirSinc(d, tam);
  // (nunca en el hilo del juego: un pedazo grande ahí lo congela, y con muchos en cola el juego quedaba trabado. Si el
  // hilo no contesta en 90 s —los pedazos esperan su turno, en un celular lento pueden ser muchos—, se arma otro y se
  // prueba una vez más; si tampoco, la descarga da error y la cola la reintenta)
  for (let k = 0; k < 2; k++) {
    const hilo = k ? gpHiloCrear() : w; if (!hilo) break;
    const id = ++GP.nHilo, r = await new Promise((ok) => { GP.esperan.set(id, ok); const c = d.slice(); hilo.postMessage({ id, d: c, tam }, [c.buffer]); setTimeout(() => { if (GP.esperan.has(id)) { GP.esperan.delete(id); ok({ e: 'hilo' }); } }, 90000); });
    if (!r.e) return r.o;
    if (r.e !== 'hilo') throw new Error(r.e);
    if (GP.hilo === hilo) { try { hilo.terminate(); } catch (e) {} for (const f of GP.esperan.values()) f({ e: 'hilo' }); GP.esperan.clear(); GP.hilo = null; }
  }
  throw Object.assign(new Error('el hilo de descompresión no contesta'), { trabado: true });
}

// ---- bajar un addon entero ----
const gpURL = (base, host, ruta) => base + 'gmod/cdn/' + host + ruta;
async function gpPedirCDN(base, hosts, ruta, intentos) {
  let ult = null;
  for (let k = 0; k < (intentos || 4); k++) {
    const h = hosts[(k + (gpPedirCDN.n = (gpPedirCDN.n || 0) + 1)) % hosts.length];
    // (cada pedazo con tiempo máximo: uno colgado se vuelve a pedir a otro servidor en vez de trabar todo)
    try { const r = await gmFetch(gpURL(base, h, ruta), null, 30000); if (r.ok) return new Uint8Array(await gmTiempo(r.arrayBuffer(), 60000, 'pedazo trabado')); ult = new Error('CDN ' + r.status); if (r.status === 404 || r.status === 403) { if (k >= 1) break; } }
    catch (e) { ult = e; }
  }
  throw ult || new Error('CDN');
}
async function gpBajar(wid, prog, base) {
  base = base || TIENDA_URL;
  const r = await gmFetch(base + 'gmod/pipe/' + wid, null, 30000);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && j.noExiste) throw Object.assign(new Error(T('gm.noExiste')), { noExiste: true });
    if (r.status === 409) throw Object.assign(new Error(T('gm.sinArchivo')), { sinArchivo: true });
    if (r.status === 404) throw Object.assign(new Error(T('gm.sinArchivo')), { sinArchivo: true, sinPuente: true });   // (la tienda todavía no tiene este puente)
    throw new Error('Steam: ' + (j.error || r.status));
  }
  const info = await r.json(), hosts = info.cdn && info.cdn.length ? info.cdn : ['cache1-lax1.steamcontent.com'];
  const K = await crypto.subtle.importKey('raw', gpDeHex(info.clave), 'AES-CBC', false, ['encrypt', 'decrypt']);
  if (prog) prog(0.02, 'bajando');
  const archivos = await gpManifiesto(await gpPedirCDN(base, hosts, `/depot/${info.dep}/manifest/${info.man}/5` + (info.codigo && info.codigo !== '0' ? '/' + info.codigo : '')), K);
  // (el addon: el .gma; si trae varios, el más grande)
  const gmas = archivos.filter((f) => /\.gma$/i.test(f.nombre) && f.pedazos.length), f = (gmas.length ? gmas : archivos.filter((x) => x.pedazos.length)).sort((a, b) => b.tam - a.tam)[0];
  if (!f) throw new Error('el addon no trae archivos');
  if (f.tam > 1.5e9) throw new Error('addon demasiado grande');
  const out = new Uint8Array(f.tam), tot = f.pedazos.reduce((s, c) => s + (c.comp || c.tam), 0) || 1; let hecho = 0, sig = 0, err = null;
  const uno = async () => {
    while (!err && sig < f.pedazos.length) {
      const c = f.pedazos[sig++];
      try {
        const enc = await gpPedirCDN(base, hosts, `/depot/${info.dep}/chunk/${c.sha}`);
        const d = await gpDescomprimir(await gpDescifrar(K, enc), c.tam);
        if (d.length !== c.tam) throw new Error('pedazo de tamaño malo');
        if (gpHex(new Uint8Array(await crypto.subtle.digest('SHA-1', d))) !== c.sha) throw new Error('pedazo dañado');
        out.set(d, c.off); hecho += c.comp || c.tam; if (prog) prog(0.02 + 0.96 * hecho / tot, 'bajando');
      } catch (e) { err = e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(GP.paralelo, f.pedazos.length) }, uno));
  if (err) throw err;
  if (f.sha && f.sha.length === 20 && gpHex(new Uint8Array(await crypto.subtle.digest('SHA-1', out))) !== gpHex(f.sha)) throw new Error('el addon llegó dañado');
  return out;
}
