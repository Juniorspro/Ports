//! Los hilos del motor nativo. Cada capa de la red se reparte en trozos (filas de la imagen o grupos de canales) y los
//! hilos se los van llevando de a uno (así un núcleo lento de los chicos del celular no hace esperar a los demás).
//!
//! Entre capa y capa los hilos no se duermen: giran mirando un contador, porque despertar un hilo dormido tarda de 20 a
//! 100 µs y una red tiene más de 100 capas. Si pasan unos milisegundos sin trabajo (entre un cuadro y el otro) sí se
//! duermen, para no gastar batería ni calentar el celular.
//!
//! En WebAssembly no hay hilos: todo corre en el que llama.

thread_local! { static SOLO: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }

/// cuántos hilos usa el motor (contando el que llama); 1 en un hilo marcado con `solo_este_hilo`
pub fn cuantos() -> usize { if SOLO.with(|x| x.get()) { 1 } else { imp::cuantos() } }

/// que lo que corra en este hilo no use el grupo de hilos (para el detector que busca manos de fondo: así no le
/// quita los núcleos al cuadro de ahora)
pub fn solo_este_hilo(s: bool) { SOLO.with(|x| x.set(s)) }

/// los núcleos chicos (de bajo consumo): ahí corre lo que va de fondo. 0 = donde quiera el sistema.
pub fn fijar_chicos(mascara: u64) { imp::fijar_chicos(mascara) }
/// pone el hilo actual en los núcleos chicos (si se conocen)
pub fn ir_a_chicos() { imp::ir_a_chicos() }

/// baja la prioridad del hilo actual (nice: 0 normal, 19 la más baja): lo que va de fondo no le saca el núcleo a los hilos
/// que dan cada cuadro ni al juego
pub fn bajar_prioridad(nice: i32) {
    #[cfg(target_os = "android")]
    unsafe {
        extern "C" { fn setpriority(which: i32, who: u32, prio: i32) -> i32; fn gettid() -> i32; }
        setpriority(0, gettid() as u32, nice);
    }
    #[cfg(not(target_os = "android"))]
    let _ = nice;
}

/// fija cuántos hilos usar (1 = sin hilos). Se puede llamar cuando sea: los hilos de más se quedan dormidos.
pub fn configurar(n: usize) { imp::configurar(n) }

/// en qué núcleos correr (máscara de bits; 0 = donde quiera el sistema). En el celular: los grandes.
pub fn fijar_nucleos(mascara: u64) { imp::fijar_nucleos(mascara) }
/// los núcleos medianos: si se piden más hilos que núcleos grandes, los hilos corren en los grandes y en éstos
pub fn fijar_medianos(mascara: u64) { imp::fijar_medianos(mascara) }
/// los núcleos que se suman si se piden todavía más hilos que grandes y medianos (los chicos)
pub fn fijar_resto(mascara: u64) { imp::fijar_resto(mascara) }

/// corre `f(0)`, `f(1)`, … `f(n - 1)` repartidas entre los hilos, y vuelve cuando terminaron todas
pub fn repartir(n: usize, f: &(dyn Fn(usize) + Sync)) {
    if n <= 1 || cuantos() <= 1 { for i in 0..n { f(i); } return; }
    imp::repartir(n, f)
}

/// un puntero que se puede compartir entre hilos, para que cada trozo escriba su parte de una salida (las partes no se
/// pisan: lo garantiza quien reparte)
#[derive(Clone, Copy)]
pub struct Puntero(pub *mut f32);
unsafe impl Send for Puntero {}
unsafe impl Sync for Puntero {}
impl Puntero {
    /// la parte [desde, desde + largo) de la salida
    /// SAFETY: las partes que se piden desde hilos distintos no se pisan y están dentro de la salida
    #[inline(always)]
    pub unsafe fn parte<'a>(self, desde: usize, largo: usize) -> &'a mut [f32] { std::slice::from_raw_parts_mut(self.0.add(desde), largo) }
}

#[cfg(target_arch = "wasm32")]
mod imp {
    pub fn cuantos() -> usize { 1 }
    pub fn configurar(_: usize) {}
    pub fn fijar_nucleos(_: u64) {}
    pub fn fijar_chicos(_: u64) {}
    pub fn fijar_medianos(_: u64) {}
    pub fn fijar_resto(_: u64) {}
    pub fn ir_a_chicos() {}
    pub fn repartir(n: usize, f: &(dyn Fn(usize) + Sync)) { for i in 0..n { f(i); } }
}

#[cfg(not(target_arch = "wasm32"))]
mod imp {
    use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering::*};
    use std::sync::{Mutex, OnceLock};
    use std::thread::{self, Thread};
    use std::time::{Duration, Instant};

    /// el trabajo del momento: la función (puntero gordo guardado como dos números) y cuántos trozos tiene
    struct Comun {
        gen: AtomicU64,
        f0: AtomicUsize, f1: AtomicUsize,
        total: AtomicUsize,
        siguiente: AtomicUsize,
        /// cuántos hilos terminaron con el trabajo actual (el que llama espera a que estén todos)
        listos: AtomicUsize,
        /// cuántos hilos participan (los demás duermen hasta que se los vuelva a pedir)
        activos: AtomicUsize,
        durmiendo: Vec<AtomicBool>,
        hilos: Mutex<Vec<Thread>>,
    }

    static COMUN: OnceLock<&'static Comun> = OnceLock::new();
    static PEDIDOS: AtomicUsize = AtomicUsize::new(0);
    /// para que no se metan dos repartos a la vez desde hilos distintos del programa
    static UNO: Mutex<()> = Mutex::new(());
    const MAX: usize = 16;

    static MASCARA: AtomicU64 = AtomicU64::new(0);
    static CHICOS: AtomicU64 = AtomicU64::new(0);
    pub fn fijar_nucleos(m: u64) { MASCARA.store(m, Relaxed); }
    pub fn fijar_chicos(m: u64) { CHICOS.store(m, Relaxed); }
    static MEDIANOS: AtomicU64 = AtomicU64::new(0);
    static RESTO: AtomicU64 = AtomicU64::new(0);
    pub fn fijar_medianos(m: u64) { MEDIANOS.store(m, Relaxed); }
    pub fn fijar_resto(m: u64) { RESTO.store(m, Relaxed); }
    /// la máscara para los hilos de ahora: los grandes; si hay más hilos que grandes, también los medianos; y si todavía
    /// son más, el resto (los chicos)
    fn mascara() -> u64 {
        let n = cuantos();
        let mut m = MASCARA.load(Relaxed);
        if m == 0 { return 0; }
        for t in [MEDIANOS.load(Relaxed), RESTO.load(Relaxed)] {
            if n <= m.count_ones() as usize { break; }
            m |= t;
        }
        m
    }
    pub fn ir_a_chicos() {
        let m = CHICOS.load(Relaxed);
        if m == 0 { return; }
        #[cfg(target_os = "android")]
        unsafe {
            extern "C" { fn sched_setaffinity(pid: i32, tam: usize, mascara: *const u64) -> i32; }
            let mut conj = [0u64; 16]; conj[0] = m;
            sched_setaffinity(0, std::mem::size_of_val(&conj), conj.as_ptr());
        }
    }
    thread_local! { static AFINADO: std::cell::Cell<u64> = const { std::cell::Cell::new(0) }; }
    /// pone el hilo actual en los núcleos pedidos (una vez por hilo y por máscara)
    fn afinar() {
        let m = mascara();
        if m == 0 || AFINADO.with(|a| a.get()) == m { return; }
        AFINADO.with(|a| a.set(m));
        #[cfg(target_os = "android")]
        unsafe {
            extern "C" { fn sched_setaffinity(pid: i32, tam: usize, mascara: *const u64) -> i32; }
            let mut conj = [0u64; 16]; conj[0] = m;
            sched_setaffinity(0, std::mem::size_of_val(&conj), conj.as_ptr());
        }
    }

    fn por_defecto() -> usize { thread::available_parallelism().map(|n| n.get()).unwrap_or(1).min(MAX) }

    pub fn cuantos() -> usize {
        let p = PEDIDOS.load(Relaxed);
        if p == 0 { por_defecto() } else { p }
    }
    pub fn configurar(n: usize) { PEDIDOS.store(n.clamp(1, MAX), Relaxed); }

    fn comun() -> &'static Comun {
        COMUN.get_or_init(|| {
            let c: &'static Comun = Box::leak(Box::new(Comun {
                gen: AtomicU64::new(0), f0: AtomicUsize::new(0), f1: AtomicUsize::new(0), total: AtomicUsize::new(0),
                siguiente: AtomicUsize::new(0), listos: AtomicUsize::new(0), activos: AtomicUsize::new(0),
                durmiendo: (0..MAX).map(|_| AtomicBool::new(false)).collect(), hilos: Mutex::new(Vec::new()),
            }));
            c
        })
    }

    /// hilos de trabajo: el k-ésimo participa sólo si k < activos − 1 (el que llama es el «hilo 0»)
    fn asegurar(c: &'static Comun, n: usize) {
        let mut h = c.hilos.lock().unwrap();
        while h.len() < n - 1 {
            let k = h.len();
            // (el número de trabajo se lee acá, antes de publicar el próximo: si lo leyera el hilo al arrancar, podría
            // perderse el primer trabajo y el que llama se quedaría esperándolo para siempre)
            let visto = c.gen.load(Acquire);
            let t = thread::Builder::new().name(format!("jxhand-{}", k + 1)).spawn(move || trabajar(c, k, visto)).expect("hilo del motor");
            h.push(t.thread().clone());
        }
    }

    fn correr_trozos(c: &Comun) {
        let (f0, f1, total) = (c.f0.load(Acquire), c.f1.load(Acquire), c.total.load(Acquire));
        // SAFETY: el que llama a `repartir` no vuelve (y la función no deja de existir) hasta que todos los hilos
        // avisaron que terminaron con este trabajo
        let f: &(dyn Fn(usize) + Sync) = unsafe { std::mem::transmute::<[usize; 2], &(dyn Fn(usize) + Sync)>([f0, f1]) };
        loop {
            let i = c.siguiente.fetch_add(1, AcqRel);
            if i >= total { break; }
            f(i);
        }
    }

    fn trabajar(c: &'static Comun, k: usize, mut visto: u64) {
        loop {
            afinar();
            // esperar un trabajo nuevo: girando un rato, después cediendo el núcleo y al final durmiendo
            let t0 = Instant::now(); let mut vueltas = 0u32;
            loop {
                let g = c.gen.load(Acquire);
                if g != visto { visto = g; break; }
                vueltas += 1;
                if vueltas < 2000 { std::hint::spin_loop(); continue; }
                if t0.elapsed() < Duration::from_millis(3) { thread::yield_now(); continue; }
                c.durmiendo[k].store(true, SeqCst);
                if c.gen.load(SeqCst) == visto { thread::park_timeout(Duration::from_millis(500)); }
                c.durmiendo[k].store(false, SeqCst);
                vueltas = 0;
            }
            if k + 1 < c.activos.load(Acquire) { correr_trozos(c); }
            c.listos.fetch_add(1, AcqRel);
        }
    }

    pub fn repartir(n: usize, f: &(dyn Fn(usize) + Sync)) {
        let _uno = UNO.lock().unwrap_or_else(|e| e.into_inner());
        afinar();
        let c = comun();
        let hilos = cuantos().min(n);
        asegurar(c, cuantos());
        let todos = c.hilos.lock().unwrap().len();
        // SAFETY: el puntero gordo se guarda como dos números y se vuelve a armar en los hilos; ver `correr_trozos`
        let [f0, f1]: [usize; 2] = unsafe { std::mem::transmute::<&(dyn Fn(usize) + Sync), [usize; 2]>(f) };
        c.f0.store(f0, Release); c.f1.store(f1, Release); c.total.store(n, Release);
        c.siguiente.store(0, Release); c.listos.store(0, Release); c.activos.store(hilos, Release);
        c.gen.fetch_add(1, SeqCst);
        {
            let h = c.hilos.lock().unwrap();
            for (k, t) in h.iter().enumerate() { if c.durmiendo[k].load(SeqCst) { t.unpark(); } }
        }
        correr_trozos(c);
        // todos los hilos (también los que no participan) avisan que vieron este trabajo: así ninguno puede quedar
        // leyendo la función cuando volvemos
        let mut vueltas = 0u32;
        while c.listos.load(Acquire) < todos {
            vueltas += 1;
            if vueltas < 100_000 { std::hint::spin_loop(); } else { thread::yield_now(); }
        }
    }
}
