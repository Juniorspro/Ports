//! El corpus: cada tests/corpus/*.lua se corre con jxlua y lo que imprime se compara byte a byte con lo que imprimió el
//! Lua de la web (juego/gmod_lua.js en node) con el mismo archivo, guardado en el .esperado de al lado. Para rehacer los
//! .esperado: `TZ=UTC node tests/web/correr_web.js ../../juego --esperado tests/corpus/*.lua` (desde motor/lua).
use std::cell::RefCell;
use std::path::Path;
use std::rc::Rc;

use jxlua::{Estado, Valor};

/// lo que imprime un archivo, como lo arma correr_web.js (un error que no agarra nadie: «ERROR: mensaje»)
pub fn salida_de(src: &[u8], nombre: &str) -> Vec<u8> {
    let out = Rc::new(RefCell::new(Vec::<u8>::new()));
    let mut lua = Estado::nuevo();
    jxlua::bib::utf8::abrir(&mut lua);
    let o = out.clone();
    lua.set_salida(move |s| { let mut o = o.borrow_mut(); o.extend_from_slice(s); o.push(b'\n'); });
    if let Err(e) = lua.ejecutar(src, nombre) {
        // (como 'ERROR: ' + valor en JavaScript)
        let m = match &e.valor {
            Valor::Cad(s) => s.bytes().to_vec(),
            Valor::Nil => b"undefined".to_vec(),
            Valor::Num(n) => jxlua::numeros::js_tostring(*n).into_bytes(),
            Valor::Bool(b) => b.to_string().into_bytes(),
            _ => b"[object Object]".to_vec(),
        };
        let mut o = out.borrow_mut();
        o.extend_from_slice(b"ERROR: ");
        o.extend_from_slice(&m);
        o.push(b'\n');
    }
    drop(lua);
    let v = out.borrow().clone();
    if v.is_empty() { b"\n".to_vec() } else { v }
}

/// Los mensajes del intérprete con tildes: la web los arma como texto de JavaScript y correr_web.js escribe un byte por
/// caracter (latin1); jxlua los escribe en UTF-8. Para comparar, esas palabras (sólo las de los mensajes) a latin1.
pub fn normalizar_mensajes(v: &[u8]) -> Vec<u8> {
    let mut s = v.to_vec();
    for (utf8, latin1) in [("número malo", "n\u{fa}mero malo"), ("necesita un número", "necesita un n\u{fa}mero"), ("expresión rara", "expresi\u{f3}n rara"),
                           ("tardó demasiado (¿bucle", "tard\u{f3} demasiado (\u{bf}bucle"), ("patrón demasiado", "patr\u{f3}n demasiado"),
                           ("una función con", "una funci\u{f3}n con")] {
        let de = utf8.as_bytes();
        let a: Vec<u8> = latin1.chars().map(|c| c as u32 as u8).collect();
        let mut r = Vec::with_capacity(s.len());
        let mut i = 0;
        while i < s.len() { if s[i..].starts_with(de) { r.extend_from_slice(&a); i += de.len(); } else { r.push(s[i]); i += 1; } }
        s = r;
    }
    s
}

#[test]
fn corpus_igual_que_la_web() {
    std::env::set_var("TZ", "UTC");
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/corpus");
    let mut archivos: Vec<_> = std::fs::read_dir(&dir).unwrap().flatten().map(|e| e.path()).filter(|p| p.extension().map(|x| x == "lua").unwrap_or(false)).collect();
    archivos.sort();
    let (mut iguales, mut total, mut lineas_ok, mut lineas) = (0, 0, 0, 0);
    let mut malos = vec![];
    for a in &archivos {
        let esp = match std::fs::read(a.with_extension("esperado")) { Ok(e) => e, Err(_) => continue };
        total += 1;
        let nombre = a.file_name().unwrap().to_string_lossy().into_owned();
        let src = std::fs::read(a).unwrap();
        let sal = normalizar_mensajes(&salida_de(&src, &nombre));
        let (ls, le): (Vec<&[u8]>, Vec<&[u8]>) = (sal.split(|&c| c == b'\n').collect(), esp.split(|&c| c == b'\n').collect());
        lineas += le.len();
        lineas_ok += le.iter().zip(ls.iter()).filter(|(x, y)| x == y).count();
        if sal == esp { iguales += 1; continue; }
        let mut dif = String::new();
        for (i, (x, y)) in le.iter().zip(ls.iter()).enumerate() {
            if x != y { dif = format!("línea {}:\n  web:   {}\n  jxlua: {}", i + 1, String::from_utf8_lossy(x), String::from_utf8_lossy(y)); break; }
        }
        if dif.is_empty() { dif = format!("largo distinto: web {} líneas, jxlua {}", le.len(), ls.len()); }
        malos.push(format!("{nombre}: {dif}"));
    }
    for m in &malos { println!("DISTINTO {m}"); }
    println!("corpus: {iguales}/{total} archivos iguales a la web; {lineas_ok}/{lineas} líneas");
    assert!(malos.is_empty(), "{} archivos distintos", malos.len());
}
