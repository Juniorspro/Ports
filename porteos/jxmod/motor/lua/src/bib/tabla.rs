//! La biblioteca table: insert, remove, concat, sort (estable, como Array.prototype.sort de la web), getn, maxn,
//! unpack y pack.
use std::cmp::Ordering;

use super::cadena::sarg;
use super::*;
use crate::numeros::{fmt_num, js_tostring};
use crate::valor::{TablaRef, Valor};
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let t = lib(e, "table");
    def(&t, "insert", insert);
    def(&t, "remove", remove);
    def(&t, "concat", concat);
    def(&t, "sort", sort);
    def(&t, "getn", getn);
    def(&t, "maxn", maxn);
    def(&t, "unpack", super::base::unpack);
    def(&t, "pack", pack);
}

fn targ(e: &Estado, v: &Valor, f: &str) -> Result<TablaRef, Error> {
    match v { Valor::Tabla(t) => Ok(t.clone()), otro => Err(e.error(&format!("bad argument #1 to '{}' (table expected, got {})", f, otro.tipo()))) }
}

fn insert(e: &mut Estado, a: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> {
    let t = targ(e, arg(a, 0), "insert")?;
    let n = t.borrow().len();
    if a.len() < 3 {
        let v = arg(a, 1);
        if v.es_nil() { return Ok(()); }
        let _ = t.borrow_mut().set(Valor::Num((n + 1) as f64), v.clone());
        return Ok(());
    }
    let pos = num(e, arg(a, 1), "insert")?.trunc();
    let b = arg(a, 2).clone();
    if pos < 1.0 || pos > (n + 1) as f64 {
        return t.borrow_mut().set(Valor::Num(pos), b).map_err(|m| Error::nuevo(m.mensaje()));
    }
    let pos = pos as usize;
    let mut tb = t.borrow_mut();
    // (como la web: se mete en el arreglo, aunque sea nil)
    tb.arr.insert(pos - 1, b);
    Ok(())
}

fn remove(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = targ(e, arg(a, 0), "remove")?;
    let mut tb = t.borrow_mut();
    let n = tb.len();
    if n == 0 { return Ok(()); }
    let pos = if arg(a, 1).es_nil() { n as f64 } else { js_num(arg(a, 1)).trunc() };
    if pos == n as f64 {
        let v = tb.arr[n - 1].clone();
        let _ = tb.set(Valor::Num(n as f64), Valor::Nil);
        if !v.es_nil() { out.push(v); }
        return Ok(());
    }
    if !(pos >= 1.0 && pos <= n as f64) { return Ok(()); }
    let v = tb.arr.remove(pos as usize - 1);
    while matches!(tb.arr.last(), Some(Valor::Nil)) { tb.arr.pop(); }
    if !v.es_nil() { out.push(v); }
    Ok(())
}

fn concat(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = targ(e, arg(a, 0), "concat")?;
    let sep = if arg(a, 1).es_nil() { Vec::new() } else { sarg(e, arg(a, 1), "concat")?.into_owned() };
    let tb = t.borrow();
    let i = if arg(a, 2).es_nil() { 1.0 } else { js_num(arg(a, 2)) };
    let j = if arg(a, 3).es_nil() { tb.len() as f64 } else { js_num(arg(a, 3)) };
    let mut r = Vec::new();
    let mut k = i;
    while k <= j {
        if k > i { r.extend_from_slice(&sep); }
        match tb.get(&Valor::Num(k)) {
            Valor::Cad(s) => r.extend_from_slice(s.bytes()),
            Valor::Num(x) => r.extend_from_slice(fmt_num(x).as_bytes()),
            _ => return Err(e.error(&format!("invalid value (at index {}) in table for 'concat'", js_tostring(k)))),
        }
        k += 1.0;
    }
    out.push(Valor::from(r));
    Ok(())
}

/// El TimSort de V8 (array-sort.tq), paso por paso: con una comparación consistente da lo mismo que cualquier orden
/// estable, pero así también coinciden el orden de las llamadas a la función de comparación (sus errores, lo que
/// imprime) y el resultado con comparaciones raras (`a <= b`, comunes en los addons), como en la web.
struct TimSort<'a> {
    w: Vec<Valor>,
    cmp: &'a mut dyn FnMut(&Valor, &Valor) -> Result<Ordering, Error>,
    min_gallop: usize,
    runs: Vec<(usize, usize)>,
}

const MIN_GALLOP: usize = 7;

impl<'a> TimSort<'a> {
    #[inline]
    fn c(&mut self, a: &Valor, b: &Valor) -> Result<Ordering, Error> { (self.cmp)(a, b) }
    fn min_run(mut n: usize) -> usize {
        let mut r = 0;
        while n >= 64 { r |= n & 1; n >>= 1; }
        n + r
    }
    fn contar_tramo(&mut self, low_arg: usize, high: usize) -> Result<usize, Error> {
        let low = low_arg + 1;
        if low == high { return Ok(1); }
        let mut largo = 2;
        let (el, ep) = (self.w[low].clone(), self.w[low - 1].clone());
        let desc = self.c(&el, &ep)? == Ordering::Less;
        let mut prev = el;
        for idx in low + 1..high {
            let cur = self.w[idx].clone();
            let o = self.c(&cur, &prev)?;
            if desc { if o != Ordering::Less { break; } } else if o == Ordering::Less { break; }
            prev = cur;
            largo += 1;
        }
        if desc { self.w[low_arg..low_arg + largo].reverse(); }
        Ok(largo)
    }
    fn insercion_binaria(&mut self, low: usize, start_arg: usize, high: usize) -> Result<(), Error> {
        let mut start = if low == start_arg { start_arg + 1 } else { start_arg };
        while start < high {
            let (mut left, mut right) = (low, start);
            let pivot = self.w[start].clone();
            while left < right {
                let mid = left + ((right - left) >> 1);
                let m = self.w[mid].clone();
                if self.c(&pivot, &m)? == Ordering::Less { right = mid; } else { left = mid + 1; }
            }
            let mut p = start;
            while p > left { self.w[p] = self.w[p - 1].clone(); p -= 1; }
            self.w[left] = pivot;
            start += 1;
        }
        Ok(())
    }
    fn gallop_left(&mut self, arr: &[Valor], key: &Valor, base: usize, length: usize, hint: usize) -> Result<usize, Error> {
        let (mut last, mut ofs) = (0usize, 1usize);
        let o = self.c(&arr[base + hint], key)?;
        if o == Ordering::Less {
            let max = length - hint;
            while ofs < max {
                if self.c(&arr[base + hint + ofs], key)? != Ordering::Less { break; }
                last = ofs;
                ofs = (ofs << 1) + 1;
            }
            if ofs > max { ofs = max; }
            last += hint;
            ofs += hint;
        } else {
            let max = hint + 1;
            while ofs < max {
                if self.c(&arr[base + hint - ofs], key)? == Ordering::Less { break; }
                last = ofs;
                ofs = (ofs << 1) + 1;
            }
            if ofs > max { ofs = max; }
            let t = last;
            last = (hint as isize - ofs as isize) as usize;
            ofs = hint - t;
        }
        last = last.wrapping_add(1);
        while last < ofs {
            let m = last + ((ofs - last) >> 1);
            if self.c(&arr[base + m], key)? == Ordering::Less { last = m + 1; } else { ofs = m; }
        }
        Ok(ofs)
    }
    fn gallop_right(&mut self, arr: &[Valor], key: &Valor, base: usize, length: usize, hint: usize) -> Result<usize, Error> {
        let (mut last, mut ofs) = (0usize, 1usize);
        let o = self.c(key, &arr[base + hint])?;
        if o == Ordering::Less {
            let max = hint + 1;
            while ofs < max {
                if self.c(key, &arr[base + hint - ofs])? != Ordering::Less { break; }
                last = ofs;
                ofs = (ofs << 1) + 1;
            }
            if ofs > max { ofs = max; }
            let t = last;
            last = (hint as isize - ofs as isize) as usize;
            ofs = hint - t;
        } else {
            let max = length - hint;
            while ofs < max {
                if self.c(key, &arr[base + hint + ofs])? == Ordering::Less { break; }
                last = ofs;
                ofs = (ofs << 1) + 1;
            }
            if ofs > max { ofs = max; }
            last += hint;
            ofs += hint;
        }
        last = last.wrapping_add(1);
        while last < ofs {
            let m = last + ((ofs - last) >> 1);
            if self.c(key, &arr[base + m])? == Ordering::Less { ofs = m; } else { last = m + 1; }
        }
        Ok(ofs)
    }
    fn invariante(&self, n: usize) -> bool {
        if n < 2 { return true; }
        self.runs[n - 2].1 > self.runs[n - 1].1 + self.runs[n].1
    }
    fn colapsar(&mut self) -> Result<(), Error> {
        while self.runs.len() > 1 {
            let mut n = self.runs.len() - 2;
            if !self.invariante(n + 1) || !self.invariante(n) {
                if n > 0 && self.runs[n - 1].1 < self.runs[n + 1].1 { n -= 1; }
                self.mezclar_en(n)?;
            } else if self.runs[n].1 <= self.runs[n + 1].1 {
                self.mezclar_en(n)?;
            } else {
                break;
            }
        }
        Ok(())
    }
    fn colapsar_todo(&mut self) -> Result<(), Error> {
        while self.runs.len() > 1 {
            let mut n = self.runs.len() - 2;
            if n > 0 && self.runs[n - 1].1 < self.runs[n + 1].1 { n -= 1; }
            self.mezclar_en(n)?;
        }
        Ok(())
    }
    fn mezclar_en(&mut self, i: usize) -> Result<(), Error> {
        let (mut base_a, mut len_a) = self.runs[i];
        let (base_b, mut len_b) = self.runs[i + 1];
        self.runs[i].1 = len_a + len_b;
        self.runs.remove(i + 1);
        let w = std::mem::take(&mut self.w);
        let key_r = w[base_b].clone();
        let k = self.gallop_right(&w, &key_r, base_a, len_a, 0);
        self.w = w;
        let k = k?;
        base_a += k;
        len_a -= k;
        if len_a == 0 { return Ok(()); }
        let w = std::mem::take(&mut self.w);
        let key_l = w[base_a + len_a - 1].clone();
        let r = self.gallop_left(&w, &key_l, base_b, len_b, len_b - 1);
        self.w = w;
        len_b = r?;
        if len_b == 0 { return Ok(()); }
        if len_a <= len_b { self.mezclar_bajo(base_a, len_a, base_b, len_b) } else { self.mezclar_alto(base_a, len_a, base_b, len_b) }
    }
    fn mezclar_bajo(&mut self, base_a: usize, mut len_a: usize, base_b: usize, mut len_b: usize) -> Result<(), Error> {
        let tmp: Vec<Valor> = self.w[base_a..base_a + len_a].to_vec();
        let (mut dest, mut ct, mut cb) = (base_a, 0usize, base_b);
        self.w[dest] = self.w[cb].clone();
        dest += 1;
        cb += 1;
        // 0: listo, 1: copiar B
        let fin: u8 = 'todo: {
            len_b -= 1;
            if len_b == 0 { break 'todo 0; }
            if len_a == 1 { break 'todo 1; }
            let mut min_gallop = self.min_gallop;
            loop {
                let (mut wa, mut wb) = (0usize, 0usize);
                loop {
                    let (x, y) = (self.w[cb].clone(), tmp[ct].clone());
                    if self.c(&x, &y)? == Ordering::Less {
                        self.w[dest] = x; dest += 1; cb += 1;
                        wb += 1; len_b -= 1; wa = 0;
                        if len_b == 0 { break 'todo 0; }
                        if wb >= min_gallop { break; }
                    } else {
                        self.w[dest] = y; dest += 1; ct += 1;
                        wa += 1; len_a -= 1; wb = 0;
                        if len_a == 1 { break 'todo 1; }
                        if wa >= min_gallop { break; }
                    }
                }
                min_gallop += 1;
                let mut primera = true;
                while wa >= MIN_GALLOP || wb >= MIN_GALLOP || primera {
                    primera = false;
                    min_gallop = min_gallop.saturating_sub(1).max(1);
                    self.min_gallop = min_gallop;
                    let key = self.w[cb].clone();
                    wa = self.gallop_right(&tmp, &key, ct, len_a, 0)?;
                    if wa > 0 {
                        for j in 0..wa { self.w[dest + j] = tmp[ct + j].clone(); }
                        dest += wa; ct += wa; len_a -= wa;
                        if len_a == 1 { break 'todo 1; }
                        if len_a == 0 { break 'todo 0; }
                    }
                    self.w[dest] = self.w[cb].clone(); dest += 1; cb += 1;
                    len_b -= 1;
                    if len_b == 0 { break 'todo 0; }
                    let key = tmp[ct].clone();
                    let w = std::mem::take(&mut self.w);
                    let r = self.gallop_left(&w, &key, cb, len_b, 0);
                    self.w = w;
                    wb = r?;
                    if wb > 0 {
                        for j in 0..wb { self.w[dest + j] = self.w[cb + j].clone(); }
                        dest += wb; cb += wb; len_b -= wb;
                        if len_b == 0 { break 'todo 0; }
                    }
                    self.w[dest] = tmp[ct].clone(); dest += 1; ct += 1;
                    len_a -= 1;
                    if len_a == 1 { break 'todo 1; }
                }
                min_gallop += 1;
                self.min_gallop = min_gallop;
            }
        };
        if fin == 0 {
            for j in 0..len_a { self.w[dest + j] = tmp[ct + j].clone(); }
        } else {
            for j in 0..len_b { self.w[dest + j] = self.w[cb + j].clone(); }
            self.w[dest + len_b] = tmp[ct].clone();
        }
        Ok(())
    }
    fn mezclar_alto(&mut self, base_a: usize, mut len_a: usize, base_b: usize, mut len_b: usize) -> Result<(), Error> {
        let tmp: Vec<Valor> = self.w[base_b..base_b + len_b].to_vec();
        let mut dest = (base_b + len_b - 1) as isize;
        let mut ct = len_b as isize - 1;
        let mut ca = (base_a + len_a - 1) as isize;
        self.w[dest as usize] = self.w[ca as usize].clone();
        dest -= 1;
        ca -= 1;
        // 0: listo, 1: copiar A
        let fin: u8 = 'todo: {
            len_a -= 1;
            if len_a == 0 { break 'todo 0; }
            if len_b == 1 { break 'todo 1; }
            let mut min_gallop = self.min_gallop;
            loop {
                let (mut wa, mut wb) = (0usize, 0usize);
                loop {
                    let (x, y) = (tmp[ct as usize].clone(), self.w[ca as usize].clone());
                    if self.c(&x, &y)? == Ordering::Less {
                        self.w[dest as usize] = y; dest -= 1; ca -= 1;
                        wa += 1; len_a -= 1; wb = 0;
                        if len_a == 0 { break 'todo 0; }
                        if wa >= min_gallop { break; }
                    } else {
                        self.w[dest as usize] = x; dest -= 1; ct -= 1;
                        wb += 1; len_b -= 1; wa = 0;
                        if len_b == 1 { break 'todo 1; }
                        if wb >= min_gallop { break; }
                    }
                }
                min_gallop += 1;
                let mut primera = true;
                while wa >= MIN_GALLOP || wb >= MIN_GALLOP || primera {
                    primera = false;
                    min_gallop = min_gallop.saturating_sub(1).max(1);
                    self.min_gallop = min_gallop;
                    let key = tmp[ct as usize].clone();
                    let w = std::mem::take(&mut self.w);
                    let r = self.gallop_right(&w, &key, base_a, len_a, len_a - 1);
                    self.w = w;
                    let k = r?;
                    wa = len_a - k;
                    if wa > 0 {
                        dest -= wa as isize; ca -= wa as isize;
                        for j in (0..wa).rev() { self.w[(dest + 1) as usize + j] = self.w[(ca + 1) as usize + j].clone(); }
                        len_a -= wa;
                        if len_a == 0 { break 'todo 0; }
                    }
                    self.w[dest as usize] = tmp[ct as usize].clone(); dest -= 1; ct -= 1;
                    len_b -= 1;
                    if len_b == 1 { break 'todo 1; }
                    let key = self.w[ca as usize].clone();
                    let k = self.gallop_left(&tmp, &key, 0, len_b, len_b - 1)?;
                    wb = len_b - k;
                    if wb > 0 {
                        dest -= wb as isize; ct -= wb as isize;
                        for j in 0..wb { self.w[(dest + 1) as usize + j] = tmp[(ct + 1) as usize + j].clone(); }
                        len_b -= wb;
                        if len_b == 1 { break 'todo 1; }
                        if len_b == 0 { break 'todo 0; }
                    }
                    self.w[dest as usize] = self.w[ca as usize].clone(); dest -= 1; ca -= 1;
                    len_a -= 1;
                    if len_a == 0 { break 'todo 0; }
                }
                min_gallop += 1;
                self.min_gallop = min_gallop;
            }
        };
        if fin == 0 {
            if len_b > 0 { let ini = (dest - (len_b as isize - 1)) as usize; for j in 0..len_b { self.w[ini + j] = tmp[j].clone(); } }
        } else {
            dest -= len_a as isize; ca -= len_a as isize;
            for j in (0..len_a).rev() { self.w[(dest + 1) as usize + j] = self.w[(ca + 1) as usize + j].clone(); }
            self.w[dest as usize] = tmp[ct as usize].clone();
        }
        Ok(())
    }
}

/// ordenar como Array.prototype.sort de V8 (la comparación puede fallar)
fn ordenar(v: &mut Vec<Valor>, cmp: &mut dyn FnMut(&Valor, &Valor) -> Result<Ordering, Error>) -> Result<(), Error> {
    let n = v.len();
    if n < 2 { return Ok(()); }
    let mut ts = TimSort { w: std::mem::take(v), cmp, min_gallop: MIN_GALLOP, runs: vec![] };
    let r = (|| -> Result<(), Error> {
        let (mut low, mut resto) = (0usize, n);
        let min_run = TimSort::min_run(resto);
        while resto != 0 {
            let mut largo = ts.contar_tramo(low, low + resto)?;
            if largo < min_run {
                let forzado = min_run.min(resto);
                ts.insercion_binaria(low, low + largo, low + forzado)?;
                largo = forzado;
            }
            ts.runs.push((low, largo));
            ts.colapsar()?;
            low += largo;
            resto -= largo;
        }
        ts.colapsar_todo()
    })();
    *v = ts.w;
    r
}

fn sort(e: &mut Estado, a: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> {
    let t = targ(e, arg(a, 0), "sort")?;
    let f = arg(a, 1).clone();
    let todos: Vec<Valor> = t.borrow().arr.clone();
    let n = todos.len();
    // (los nil van al final sin compararse, como en JavaScript)
    let mut v: Vec<Valor> = todos.iter().filter(|x| !x.es_nil()).cloned().collect();
    let huecos = n - v.len();
    let mut cmp = |x: &Valor, y: &Valor| -> Result<Ordering, Error> {
        if !f.es_nil() {
            if e.llamar_1(&f, &[x.clone(), y.clone()], "sort")?.es_verdad() { return Ok(Ordering::Less); }
            if e.llamar_1(&f, &[y.clone(), x.clone()], "sort")?.es_verdad() { return Ok(Ordering::Greater); }
            Ok(Ordering::Equal)
        } else {
            if e.menor(x, y)? { return Ok(Ordering::Less); }
            if e.menor(y, x)? { return Ok(Ordering::Greater); }
            Ok(Ordering::Equal)
        }
    };
    ordenar(&mut v, &mut cmp)?;
    v.extend(std::iter::repeat(Valor::Nil).take(huecos));
    let mut tb = t.borrow_mut();
    for (k, x) in v.into_iter().enumerate() { if k < tb.arr.len() { tb.arr[k] = x; } }
    Ok(())
}

fn getn(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = targ(e, arg(a, 0), "getn")?;
    out.push(Valor::Num(t.borrow().len() as f64));
    Ok(())
}

fn maxn(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = targ(e, arg(a, 0), "maxn")?;
    let mut m = 0f64;
    for (k, _) in t.borrow().pares() { if let Valor::Num(x) = k { if x > m { m = x; } } }
    out.push(Valor::Num(m));
    Ok(())
}

fn pack(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let t = crate::valor::Tabla::nueva_ref();
    {
        let mut tb = t.borrow_mut();
        for (i, v) in a.iter().enumerate() { tb.poner_lista(i + 1, v.clone()); }
        tb.cerrar_lista();
        tb.set_str("n", Valor::Num(a.len() as f64));
    }
    out.push(Valor::Tabla(t));
    Ok(())
}
