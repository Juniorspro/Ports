//! El multijugador (jxjuego::red) en Android: el TLS hacia el broker y el HTTPS a la tienda los hace Java (el
//! SSLSocketFactory y el HttpURLConnection del sistema, con sus certificados), llamados desde Rust por JNI (crate jni).
//!
//! Uso (en app.rs, una vez): `let java = unsafe { red_android::Java::de_vm(app.vm_as_ptr()) };` y `java.puente()` es el
//! `jxjuego::red::Puente` que se bombea cada cuadro (ver «La red» en comun.rs). Se declara en lib.rs con
//! `#[cfg(target_os = "android")] mod red_android;` (el crate jni sólo está para Android).
//!
//! - mqtts://host:puerto (broker.emqx.io:8883: el broker de la web por TLS, los mismos temas): un Socket conectado (9 s),
//!   envuelto en un SSLSocket con el nombre del host (SNI), el saludo con el nombre revisado como HTTPS (endpoint
//!   identification; en Android, además, con el verificador de HTTPS del sistema); después se lee con un tope de 25 ms
//!   (SocketTimeoutException: «nada todavía», ver mqtt::Flujo).
//! - wss://… (lo mismo que la web, 8084): lo mismo, con WebSocket encima (mqtt::Ws).
//! - mqtt:// y ws:// sin TLS (una partida en la red local: ws://IP:8765/mqtt): el TCP de Rust.
//! - HTTPS: HttpURLConnection (GET y POST con JSON), y el cuerpo de la respuesta aunque sea un error (como fetch).
//! Cada conexión MQTT y cada pedido HTTP van en su hilo (los de mqtt::Conexion y red::Puente): se enganchan a Java una vez
//! (y se desenganchan solos al terminar). Hace falta el permiso INTERNET en el manifiesto.
use jni::errors::Error as JErr;
use jni::objects::{JByteArray, JObject, JString};
use jni::refs::Global;
use jni::{jni_sig, jni_str, Env, JValue, JavaVM};
use jxjuego::mqtt::{self, Conector, Flujo, Ws};
use jxjuego::red::{Http, Puente};
use std::io;
use std::sync::Arc;

/// la máquina virtual de Java de la app
#[derive(Clone)]
pub struct Java { vm: JavaVM }
impl Java {
    /// # Safety
    /// `vm`: el JavaVM* de la app (android_activity::AndroidApp::vm_as_ptr()), que vive lo que la app
    pub unsafe fn de_vm(vm: *mut std::ffi::c_void) -> Java { Java { vm: unsafe { JavaVM::from_raw(vm as *mut jni::sys::JavaVM) } } }
    /// abre el flujo hacia el broker (mqtt::Conector)
    pub fn conector(&self) -> Conector { let j = self.clone(); Arc::new(move |dir: &str| j.abrir(dir)) }
    /// los pedidos a la tienda (red::Http)
    pub fn http(&self) -> Http { let j = self.clone(); Arc::new(move |m: &str, u: &str, c: &[(String, String)], b: Option<&str>| j.pedir(m, u, c, b)) }
    /// el puente de red.rs con las conexiones de Android
    pub fn puente(&self) -> Puente { Puente::nuevo(self.conector(), Some(self.http())) }
    pub fn abrir(&self, dir: &str) -> io::Result<Box<dyn Flujo>> {
        let u = mqtt::url(dir).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;
        if !u.tls { return mqtt::conectar_tcp(dir); }
        let t = TlsJava::abrir(&self.vm, &u.host, u.puerto)?;
        if u.ws { Ok(Box::new(Ws::abrir(t, &format!("{}:{}", u.host, u.puerto), &u.ruta)?)) } else { Ok(Box::new(t)) }
    }
    /// los pedidos binarios (los .gma de los addons de GMod: gmod_juego.rs), de hasta 300 MB
    pub fn http_bin(&self) -> crate::comun::gmod_juego::HttpBin { let j = self.clone(); Arc::new(move |u: &str| j.pedir_crudo("GET", u, &[], None, 300 << 20)) }
    /// bajar un archivo grande directo a la memoria del celular, de a pedazos y diciendo cuánto va (los paquetes aparte: bajas.rs)
    pub fn bajar(&self) -> crate::bajas::Bajar { let j = self.clone(); Arc::new(move |u: &str, a: &std::path::Path, prog: &dyn Fn(u64, u64)| j.bajar_a(u, a, prog)) }
    /// un pedido HTTPS: (código, cuerpo) o por qué no se pudo
    pub fn pedir(&self, metodo: &str, url: &str, cab: &[(String, String)], cuerpo: Option<&str>) -> Result<(u16, String), String> {
        self.pedir_crudo(metodo, url, cab, cuerpo, 4 << 20).map(|(c, b)| (c, String::from_utf8_lossy(&b).into_owned()))
    }
    /// lo mismo, con el cuerpo en bytes (hasta `tope`)
    /// GET de `url` al archivo `destino` (lo que llegue: con un error, el archivo queda a medias y lo borra quien llama)
    pub fn bajar_a(&self, url: &str, destino: &std::path::Path, prog: &dyn Fn(u64, u64)) -> Result<u16, String> {
        use std::io::Write;
        let mut f = std::fs::File::create(destino).map_err(|e| e.to_string())?;
        con_java(&self.vm, |env| {
            let u = env.new_string(url)?;
            let url_o = env.new_object(jni_str!("java/net/URL"), jni_sig!("(Ljava/lang/String;)V"), &[JValue::Object(&u)])?;
            let c = env.call_method(&url_o, jni_str!("openConnection"), jni_sig!("()Ljava/net/URLConnection;"), &[])?.l()?;
            env.call_method(&c, jni_str!("setConnectTimeout"), jni_sig!("(I)V"), &[JValue::Int(9000)])?;
            env.call_method(&c, jni_str!("setReadTimeout"), jni_sig!("(I)V"), &[JValue::Int(20000)])?;
            let codigo = env.call_method(&c, jni_str!("getResponseCode"), jni_sig!("()I"), &[])?.i()?;
            if codigo != 200 { env.call_method(&c, jni_str!("disconnect"), jni_sig!("()V"), &[])?; return Ok(codigo.clamp(0, 999) as u16); }
            let tot = env.call_method(&c, jni_str!("getContentLengthLong"), jni_sig!("()J"), &[])?.j()?.max(0) as u64;
            let ent = env.call_method(&c, jni_str!("getInputStream"), jni_sig!("()Ljava/io/InputStream;"), &[])?.l()?;
            let a = env.new_byte_array(262144)?; let mut tmp = vec![0i8; 262144]; let mut buf = vec![0u8; 262144]; let mut va = 0u64;
            prog(0, tot);
            loop {
                let n = env.call_method(&ent, jni_str!("read"), jni_sig!("([B)I"), &[JValue::Object(&a)])?.i()?;
                if n < 0 { break; }
                let n = (n as usize).min(tmp.len()); a.get_region(env, 0, &mut tmp[..n])?;
                for (d, s) in buf[..n].iter_mut().zip(&tmp[..n]) { *d = *s as u8; }
                if f.write_all(&buf[..n]).is_err() { break; }
                va += n as u64; prog(va, tot.max(va));
            }
            env.call_method(&ent, jni_str!("close"), jni_sig!("()V"), &[])?;
            env.call_method(&c, jni_str!("disconnect"), jni_sig!("()V"), &[])?;
            Ok(if tot > 0 && va != tot { 0 } else { 200 })
        }).map_err(|e| e.to_string())
    }
    pub fn pedir_crudo(&self, metodo: &str, url: &str, cab: &[(String, String)], cuerpo: Option<&str>, tope: usize) -> Result<(u16, Vec<u8>), String> {
        con_java(&self.vm, |env| {
            let u = env.new_string(url)?;
            let url_o = env.new_object(jni_str!("java/net/URL"), jni_sig!("(Ljava/lang/String;)V"), &[JValue::Object(&u)])?;
            let c = env.call_method(&url_o, jni_str!("openConnection"), jni_sig!("()Ljava/net/URLConnection;"), &[])?.l()?;
            env.call_method(&c, jni_str!("setConnectTimeout"), jni_sig!("(I)V"), &[JValue::Int(9000)])?;
            env.call_method(&c, jni_str!("setReadTimeout"), jni_sig!("(I)V"), &[JValue::Int(15000)])?;
            env.call_method(&c, jni_str!("setUseCaches"), jni_sig!("(Z)V"), &[JValue::Bool(false)])?;
            let m = env.new_string(metodo)?;
            env.call_method(&c, jni_str!("setRequestMethod"), jni_sig!("(Ljava/lang/String;)V"), &[JValue::Object(&m)])?;
            for (k, v) in cab {
                let (k, v) = (env.new_string(k)?, env.new_string(v)?);
                env.call_method(&c, jni_str!("setRequestProperty"), jni_sig!("(Ljava/lang/String;Ljava/lang/String;)V"), &[JValue::Object(&k), JValue::Object(&v)])?;
            }
            if let Some(b) = cuerpo {
                env.call_method(&c, jni_str!("setDoOutput"), jni_sig!("(Z)V"), &[JValue::Bool(true)])?;
                let o = env.call_method(&c, jni_str!("getOutputStream"), jni_sig!("()Ljava/io/OutputStream;"), &[])?.l()?;
                let a = env.byte_array_from_slice(b.as_bytes())?;
                env.call_method(&o, jni_str!("write"), jni_sig!("([B)V"), &[JValue::Object(&a)])?;
                env.call_method(&o, jni_str!("close"), jni_sig!("()V"), &[])?;
            }
            let codigo = env.call_method(&c, jni_str!("getResponseCode"), jni_sig!("()I"), &[])?.i()?;
            // (con un error, el cuerpo viene por getErrorStream, que puede no haber)
            let ent = if codigo >= 400 { env.call_method(&c, jni_str!("getErrorStream"), jni_sig!("()Ljava/io/InputStream;"), &[])?.l()? } else { env.call_method(&c, jni_str!("getInputStream"), jni_sig!("()Ljava/io/InputStream;"), &[])?.l()? };
            let mut cuerpo = vec![];
            if !ent.is_null() {
                let a = env.new_byte_array(65536)?; let mut tmp = vec![0i8; 65536];
                loop {
                    let n = env.call_method(&ent, jni_str!("read"), jni_sig!("([B)I"), &[JValue::Object(&a)])?.i()?;
                    if n < 0 { break; }
                    let n = (n as usize).min(tmp.len()); a.get_region(env, 0, &mut tmp[..n])?;
                    cuerpo.extend(tmp[..n].iter().map(|b| *b as u8));
                    if cuerpo.len() > tope { break; }
                }
                env.call_method(&ent, jni_str!("close"), jni_sig!("()V"), &[])?;
            }
            env.call_method(&c, jni_str!("disconnect"), jni_sig!("()V"), &[])?;
            Ok((codigo.clamp(0, 999) as u16, cuerpo))
        }).map_err(|e| e.to_string())
    }
}

/// el cuadro para escribir de Juego.java (pedirTexto / tomarEscrito): el chat, la contraseña de una sala, el nombre
#[derive(Clone)]
pub struct Teclado { vm: JavaVM, act: Arc<Global<JObject<'static>>> }
impl Teclado {
    /// # Safety
    /// `vm` y `act`: el JavaVM* y el jobject de la actividad (AndroidApp::vm_as_ptr y activity_as_ptr)
    pub unsafe fn nuevo(vm: *mut std::ffi::c_void, act: *mut std::ffi::c_void) -> Option<Teclado> {
        let vm = unsafe { JavaVM::from_raw(vm as *mut jni::sys::JavaVM) };
        let g = con_java(&vm, |env| { let o = unsafe { JObject::from_raw(env, act as jni::sys::jobject) }; env.new_global_ref(&o) }).ok()?;
        Some(Teclado { vm, act: Arc::new(g) })
    }
    /// abre el cuadro (en el hilo de la interfaz de Android)
    pub fn pedir(&self, id: i32, titulo: &str, inicial: &str, max: i32, clave: bool) {
        let a = self.act.clone();
        let _ = con_java(&self.vm, |env| {
            let (t, i) = (env.new_string(titulo)?, env.new_string(inicial)?);
            env.call_method(a.as_obj(), jni_str!("pedirTexto"), jni_sig!("(ILjava/lang/String;Ljava/lang/String;IZ)V"), &[JValue::Int(id), JValue::Object(&t), JValue::Object(&i), JValue::Int(max), JValue::Bool(clave)])?;
            Ok(())
        });
    }
    /// cómo va la actualización de la app (Juego.estadoActualizacion: «nueva\t…», «bajando\t…», «error\t…» o "")
    pub fn estado_actualizacion(&self) -> String {
        let a = self.act.clone();
        con_java(&self.vm, |env| {
            let r = env.call_method(a.as_obj(), jni_str!("estadoActualizacion"), jni_sig!("()Ljava/lang/String;"), &[])?.l()?;
            if r.is_null() { return Ok(String::new()); }
            env.cast_local::<JString>(r)?.try_to_string(env)
        }).unwrap_or_default()
    }
    fn medios<R>(&self, f: impl FnOnce(&mut Env, &jni::objects::JClass, &JObject) -> Result<R, JErr>) -> Option<R> {
        let a = self.act.clone(); con_java(&self.vm, |env| { let c = env.find_class(jni_str!("com/jxmod/nativo/Medios"))?; f(env, &c, a.as_obj()) }).ok()
    }
    /// abre una dirección en el navegador del celular (Juego.abrirUrl: la cuenta con Google)
    pub fn abrir_url(&self, u: &str) { let a = self.act.clone(); let _ = con_java(&self.vm, |env| { let s = env.new_string(u)?; env.call_method(a.as_obj(), jni_str!("abrirUrl"), jni_sig!("(Ljava/lang/String;)V"), &[JValue::Object(&s)])?; Ok(()) }); }
    /// baja la versión nueva y la instala encima (Juego.actualizarAhora)
    pub fn actualizar_ahora(&self) { let a = self.act.clone(); let _ = con_java(&self.vm, |env| { env.call_method(a.as_obj(), jni_str!("actualizarAhora"), jni_sig!("()V"), &[])?; Ok(()) }); }
    /// el refresco de la pantalla (Hz: 60, 90, 120…), para los gráficos automáticos
    pub fn refresco(&self) -> Option<f32> {
        let a = self.act.clone();
        con_java(&self.vm, |env| {
            let wm = env.call_method(a.as_obj(), jni_str!("getWindowManager"), jni_sig!("()Landroid/view/WindowManager;"), &[])?.l()?;
            let d = env.call_method(&wm, jni_str!("getDefaultDisplay"), jni_sig!("()Landroid/view/Display;"), &[])?.l()?;
            env.call_method(&d, jni_str!("getRefreshRate"), jni_sig!("()F"), &[])?.f()
        }).ok()
    }
    /// el candado de multicast del Wi-Fi (sin él muchos celulares no reciben los anuncios de las partidas de la red)
    pub fn candado_multicast(&self) {
        let a = self.act.clone();
        let _ = con_java(&self.vm, |env| {
            let ctx = env.call_method(a.as_obj(), jni_str!("getApplicationContext"), jni_sig!("()Landroid/content/Context;"), &[])?.l()?;
            let s = env.new_string("wifi")?;
            let wm = env.call_method(&ctx, jni_str!("getSystemService"), jni_sig!("(Ljava/lang/String;)Ljava/lang/Object;"), &[JValue::Object(&s)])?.l()?;
            if wm.is_null() { return Ok(()); }
            let t = env.new_string("jxmod-lan")?;
            let l = env.call_method(&wm, jni_str!("createMulticastLock"), jni_sig!("(Ljava/lang/String;)Landroid/net/wifi/WifiManager$MulticastLock;"), &[JValue::Object(&t)])?.l()?;
            env.call_method(&l, jni_str!("setReferenceCounted"), jni_sig!("(Z)V"), &[JValue::Bool(false)])?;
            env.call_method(&l, jni_str!("acquire"), jni_sig!("()V"), &[])?;
            Ok(())
        });
    }
    /// Grabar (Grabar.java): empieza la grabación y devuelve la ventana nativa del codificador (ANativeWindow*), o el motivo
    pub fn grabar_empezar(&self, w: i32, h: i32, fps: i32, rate: i32) -> Result<*mut std::ffi::c_void, String> {
        #[link(name = "android")] extern "C" { fn ANativeWindow_fromSurface(env: *mut jni::sys::JNIEnv, s: jni::sys::jobject) -> *mut std::ffi::c_void; }
        let a = self.act.clone();
        con_java(&self.vm, |env| {
            let c = env.find_class(jni_str!("com/jxmod/nativo/Grabar"))?;
            let sup = env.call_static_method(&c, jni_str!("empezar"), jni_sig!("(Landroid/app/Activity;IIII)Landroid/view/Surface;"), &[JValue::Object(a.as_obj()), JValue::Int(w), JValue::Int(h), JValue::Int(fps), JValue::Int(rate)])?.l()?;
            if sup.is_null() {
                let e = env.call_static_method(&c, jni_str!("error"), jni_sig!("()Ljava/lang/String;"), &[])?.l()?;
                return Ok(Err(env.cast_local::<JString>(e)?.try_to_string(env)?));
            }
            Ok(Ok(unsafe { ANativeWindow_fromSurface(env.get_raw(), sup.as_raw()) }))
        }).map_err(|e| e.to_string())?
    }
    /// el sonido del juego para la grabación (estéreo intercalado, 16 bits)
    pub fn grabar_audio(&self, pcm: &[i16]) {
        if pcm.is_empty() { return; }
        let _ = con_java(&self.vm, |env| {
            let c = env.find_class(jni_str!("com/jxmod/nativo/Grabar"))?;
            let a = env.new_short_array(pcm.len())?; a.set_region(env, 0, pcm)?;
            env.call_static_method(&c, jni_str!("audio"), jni_sig!("([SI)V"), &[JValue::Object(&a), JValue::Int(pcm.len() as i32)])?;
            Ok(())
        });
    }
    /// termina la grabación: dónde quedó (o «!» y el motivo)
    pub fn grabar_terminar(&self) -> String {
        con_java(&self.vm, |env| {
            let c = env.find_class(jni_str!("com/jxmod/nativo/Grabar"))?;
            let r = env.call_static_method(&c, jni_str!("terminar"), jni_sig!("()Ljava/lang/String;"), &[])?.l()?;
            if r.is_null() { return Ok(String::from("!")); }
            env.cast_local::<JString>(r)?.try_to_string(env)
        }).unwrap_or_else(|e| format!("!{e}"))
    }
    /// lo escrito, si ya llegó: (id, Some(texto)) aceptado o (id, None) cancelado
    pub fn tomar(&self) -> Option<(i32, Option<String>)> {
        let a = self.act.clone();
        let s = con_java(&self.vm, |env| {
            let c = env.get_object_class(a.as_obj())?;
            let r = env.call_static_method(&c, jni_str!("tomarEscrito"), jni_sig!("()Ljava/lang/String;"), &[])?.l()?;
            if r.is_null() { return Ok(None); }
            Ok(Some(env.cast_local::<JString>(r)?.try_to_string(env)?))
        }).ok().flatten()?;
        let (id, resto) = s.split_once('\n')?;
        Some((id.parse().ok()?, resto.strip_prefix('1').map(|t| t.to_string())))
    }
}

/// hace `f` con el hilo enganchado a Java; una excepción de Java vuelve como io::Error (TimedOut si fue un
/// SocketTimeoutException: la lectura con tope no trajo nada)
fn con_java<T>(vm: &JavaVM, f: impl FnOnce(&mut Env) -> Result<T, JErr>) -> io::Result<T> {
    let r: Result<io::Result<T>, JErr> = vm.attach_current_thread(|env| -> Result<io::Result<T>, JErr> {
        match f(env) {
            Ok(x) => Ok(Ok(x)),
            Err(e) => {
                let Some(ex) = env.exception_occurred() else { return Ok(Err(io::Error::other(format!("JNI: {e}")))) };
                env.exception_clear();
                let tope = env.is_instance_of(&ex, jni_str!("java/net/SocketTimeoutException")).unwrap_or(false);
                if tope { return Ok(Err(io::Error::new(io::ErrorKind::TimedOut, "nada todavía"))); }
                let msg = env.call_method(&ex, jni_str!("toString"), jni_sig!("()Ljava/lang/String;"), &[]).and_then(|v| v.l())
                    .and_then(|o| env.cast_local::<JString>(o)).and_then(|s| s.try_to_string(env)).unwrap_or_else(|_| format!("{e}"));
                env.exception_clear();
                Ok(Err(io::Error::other(msg)))
            }
        }
    });
    r.map_err(|e| io::Error::other(format!("JNI: {e}")))?
}

/// un SSLSocket de Java como flujo de bytes de mqtt.rs
pub struct TlsJava { vm: JavaVM, sock: Global<JObject<'static>>, ent: Global<JObject<'static>>, sal: Global<JObject<'static>>, buf: Global<JByteArray<'static>>, n: usize }
impl TlsJava {
    /// conecta (9 s), saluda con TLS (SNI con `host`) y revisa que el certificado sea de `host`
    pub fn abrir(vm: &JavaVM, host: &str, puerto: u16) -> io::Result<TlsJava> {
        const N: usize = 16384;
        let r = con_java(vm, |env| {
            let h = env.new_string(host)?;
            let crudo = env.new_object(jni_str!("java/net/Socket"), jni_sig!("()V"), &[])?;
            let dir = env.new_object(jni_str!("java/net/InetSocketAddress"), jni_sig!("(Ljava/lang/String;I)V"), &[JValue::Object(&h), JValue::Int(puerto as i32)])?;
            env.call_method(&crudo, jni_str!("connect"), jni_sig!("(Ljava/net/SocketAddress;I)V"), &[JValue::Object(&dir), JValue::Int(9000)])?;
            let fab = env.call_static_method(jni_str!("javax/net/ssl/SSLSocketFactory"), jni_str!("getDefault"), jni_sig!("()Ljavax/net/SocketFactory;"), &[])?.l()?;
            let s = env.call_method(&fab, jni_str!("createSocket"), jni_sig!("(Ljava/net/Socket;Ljava/lang/String;IZ)Ljava/net/Socket;"), &[JValue::Object(&crudo), JValue::Object(&h), JValue::Int(puerto as i32), JValue::Bool(true)])?.l()?;
            env.call_method(&s, jni_str!("setSoTimeout"), jni_sig!("(I)V"), &[JValue::Int(9000)])?;
            // (createSocket no revisa el nombre del certificado: se pide como HTTPS —Android 7 en adelante, minSdk 24—)
            let par = env.call_method(&s, jni_str!("getSSLParameters"), jni_sig!("()Ljavax/net/ssl/SSLParameters;"), &[])?.l()?;
            let alg = env.new_string("HTTPS")?;
            env.call_method(&par, jni_str!("setEndpointIdentificationAlgorithm"), jni_sig!("(Ljava/lang/String;)V"), &[JValue::Object(&alg)])?;
            env.call_method(&s, jni_str!("setSSLParameters"), jni_sig!("(Ljavax/net/ssl/SSLParameters;)V"), &[JValue::Object(&par)])?;
            env.call_method(&s, jni_str!("startHandshake"), jni_sig!("()V"), &[])?;
            // (y en Android, otra vez con el verificador de HTTPS del sistema; el de la JVM de escritorio siempre dice que no)
            let clave = env.new_string("java.vm.name")?;
            let vmn = env.call_static_method(jni_str!("java/lang/System"), jni_str!("getProperty"), jni_sig!("(Ljava/lang/String;)Ljava/lang/String;"), &[JValue::Object(&clave)])?.l()?;
            let android = !vmn.is_null() && env.cast_local::<JString>(vmn)?.try_to_string(env)?.starts_with("Dalvik");
            if android {
                let ses = env.call_method(&s, jni_str!("getSession"), jni_sig!("()Ljavax/net/ssl/SSLSession;"), &[])?.l()?;
                let ver = env.call_static_method(jni_str!("javax/net/ssl/HttpsURLConnection"), jni_str!("getDefaultHostnameVerifier"), jni_sig!("()Ljavax/net/ssl/HostnameVerifier;"), &[])?.l()?;
                let ok = env.call_method(&ver, jni_str!("verify"), jni_sig!("(Ljava/lang/String;Ljavax/net/ssl/SSLSession;)Z"), &[JValue::Object(&h), JValue::Object(&ses)])?.z()?;
                if !ok { env.call_method(&s, jni_str!("close"), jni_sig!("()V"), &[])?; return Ok(None); }
            }
            env.call_method(&s, jni_str!("setSoTimeout"), jni_sig!("(I)V"), &[JValue::Int(25)])?;
            env.call_method(&s, jni_str!("setTcpNoDelay"), jni_sig!("(Z)V"), &[JValue::Bool(true)])?;
            let ent = env.call_method(&s, jni_str!("getInputStream"), jni_sig!("()Ljava/io/InputStream;"), &[])?.l()?;
            let sal = env.call_method(&s, jni_str!("getOutputStream"), jni_sig!("()Ljava/io/OutputStream;"), &[])?.l()?;
            let buf = env.new_byte_array(N)?;
            Ok(Some(TlsJava { vm: vm.clone(), sock: env.new_global_ref(&s)?, ent: env.new_global_ref(&ent)?, sal: env.new_global_ref(&sal)?, buf: env.new_global_ref(&buf)?, n: N }))
        })?;
        r.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, format!("el certificado no es de {host}")))
    }
}
impl Flujo for TlsJava {
    fn leer(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = buf.len().min(self.n); if n == 0 { return Ok(0); }
        let (ent, jb) = (&self.ent, &self.buf); let mut tmp = vec![0i8; n];
        let r = con_java(&self.vm, |env| {
            let r = env.call_method(ent.as_obj(), jni_str!("read"), jni_sig!("([BII)I"), &[JValue::Object(jb.as_obj()), JValue::Int(0), JValue::Int(n as i32)])?.i()?;
            if r > 0 { jb.get_region(env, 0, &mut tmp[..r as usize])?; }
            Ok(r)
        })?;
        if r < 0 { return Ok(0); }
        for (d, s) in buf.iter_mut().zip(&tmp[..r as usize]) { *d = *s as u8; }
        Ok(r as usize)
    }
    fn escribir(&mut self, datos: &[u8]) -> io::Result<()> {
        let sal = &self.sal;
        con_java(&self.vm, |env| {
            let a = env.byte_array_from_slice(datos)?;
            env.call_method(sal.as_obj(), jni_str!("write"), jni_sig!("([BII)V"), &[JValue::Object(&a), JValue::Int(0), JValue::Int(datos.len() as i32)])?;
            env.call_method(sal.as_obj(), jni_str!("flush"), jni_sig!("()V"), &[])?;
            Ok(())
        })
    }
    fn cerrar(&mut self) { let s = &self.sock; let _ = con_java(&self.vm, |env| { env.call_method(s.as_obj(), jni_str!("close"), jni_sig!("()V"), &[])?; Ok(()) }); }
}

/// la radio y la tele de Medios.java
impl crate::comun::paneles_juego::medios::MediosApp for Teclado {
    fn radio_poner(&self, id: i32, url: &str) { self.medios(|env, c, _| { let u = env.new_string(url)?; env.call_static_method(c, jni_str!("radioPoner"), jni_sig!("(ILjava/lang/String;)V"), &[JValue::Int(id), JValue::Object(&u)])?; Ok(()) }); }
    fn radio_vol(&self, id: i32, l: f32, r: f32) { self.medios(|env, c, _| { env.call_static_method(c, jni_str!("radioVol"), jni_sig!("(IFF)V"), &[JValue::Int(id), JValue::Float(l), JValue::Float(r)])?; Ok(()) }); }
    fn radio_parar(&self, id: i32) { self.medios(|env, c, _| { env.call_static_method(c, jni_str!("radioParar"), jni_sig!("(I)V"), &[JValue::Int(id)])?; Ok(()) }); }
    fn radio_estado(&self, id: i32) -> String { self.medios(|env, c, _| { let r = env.call_static_method(c, jni_str!("radioEstado"), jni_sig!("(I)Ljava/lang/String;"), &[JValue::Int(id)])?.l()?; if r.is_null() { return Ok(String::new()); } env.cast_local::<JString>(r)?.try_to_string(env) }).unwrap_or_default() }
    fn tele_poner(&self, id: i32, vid: &str) { self.medios(|env, c, a| { let v = env.new_string(vid)?; env.call_static_method(c, jni_str!("telePoner"), jni_sig!("(Landroid/app/Activity;ILjava/lang/String;)V"), &[JValue::Object(a), JValue::Int(id), JValue::Object(&v)])?; Ok(()) }); }
    fn tele_lugar(&self, id: i32, r: [i32; 4], ve: bool) { self.medios(|env, c, a| { env.call_static_method(c, jni_str!("teleLugar"), jni_sig!("(Landroid/app/Activity;IIIIIZ)V"), &[JValue::Object(a), JValue::Int(id), JValue::Int(r[0]), JValue::Int(r[1]), JValue::Int(r[2]), JValue::Int(r[3]), JValue::Bool(ve)])?; Ok(()) }); }
    fn tele_vol(&self, id: i32, v: i32) { self.medios(|env, c, a| { env.call_static_method(c, jni_str!("teleVol"), jni_sig!("(Landroid/app/Activity;II)V"), &[JValue::Object(a), JValue::Int(id), JValue::Int(v)])?; Ok(()) }); }
    fn tele_parar(&self, id: i32) { self.medios(|env, c, a| { env.call_static_method(c, jni_str!("teleParar"), jni_sig!("(Landroid/app/Activity;I)V"), &[JValue::Object(a), JValue::Int(id)])?; Ok(()) }); }
}
/// el micrófono de la voz por cercanía (Voz.java)
impl crate::comun::vozcerca::Micro for Teclado {
    fn prender(&self) -> i32 {
        let a = self.act.clone();
        con_java(&self.vm, |env| { let c = env.find_class(jni_str!("com/jxmod/nativo/Voz"))?; env.call_static_method(&c, jni_str!("prender"), jni_sig!("(Landroid/app/Activity;)I"), &[JValue::Object(a.as_obj())])?.i() }).unwrap_or(-1)
    }
    fn apagar(&self) { let _ = con_java(&self.vm, |env| { let c = env.find_class(jni_str!("com/jxmod/nativo/Voz"))?; env.call_static_method(&c, jni_str!("soltar"), jni_sig!("()V"), &[])?; Ok(()) }); }
    fn leer(&self) -> Vec<i16> {
        con_java(&self.vm, |env| {
            let c = env.find_class(jni_str!("com/jxmod/nativo/Voz"))?;
            let r = env.call_static_method(&c, jni_str!("leer"), jni_sig!("()[S"), &[])?.l()?;
            if r.is_null() { return Ok(vec![]); }
            let arr = env.cast_local::<jni::objects::JShortArray>(r)?; let n = arr.len(env)?;
            let mut v = vec![0i16; n]; arr.get_region(env, 0, &mut v)?; Ok(v)
        }).unwrap_or_default()
    }
}
