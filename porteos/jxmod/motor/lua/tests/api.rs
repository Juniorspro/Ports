//! La API para el anfitrión: funciones nativas, userdata con metatabla (un Vector como el de GMod), llamar a Lua desde
//! Rust, errores con «archivo:línea:», el tope de pasos, la capa de globales del lado que corre y el método que falta.
use std::cell::RefCell;
use std::rc::Rc;

use jxlua::{Error, Estado, Tabla, TablaRef, Valor};

fn con_salida() -> (Estado, Rc<RefCell<Vec<String>>>) {
    let mut lua = Estado::nuevo();
    let out = Rc::new(RefCell::new(Vec::new()));
    let o = out.clone();
    lua.set_salida(move |s| o.borrow_mut().push(String::from_utf8_lossy(s).into_owned()));
    (lua, out)
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Vec3 { x: f64, y: f64, z: f64 }

/// un Vector de GMod: userdata con __add, __eq, __tostring, __index (x, y, z y los métodos) y __newindex
fn poner_vector(lua: &mut Estado) -> TablaRef {
    let mt = Tabla::nueva_ref();
    let metodos = Tabla::nueva_ref();
    let mtc = mt.clone();
    let nuevo = move |v: Vec3| Estado::udata(v, Some(mtc.clone()));
    let vec_de = |v: &Valor| -> Option<Vec3> { v.udata().and_then(|u| u.copia::<Vec3>()) };
    let n2 = nuevo.clone();
    lua.registrar("Vector", move |_, a| {
        let n = |i: usize| a.get(i).and_then(Estado::a_numero).unwrap_or(0.0);
        Ok(vec![n2(Vec3 { x: n(0), y: n(1), z: n(2) })])
    });
    let n3 = nuevo.clone();
    mt.borrow_mut().set_str("__add", Estado::funcion(move |e, a| {
        match (vec_de(&a[0]), vec_de(&a[1])) {
            (Some(p), Some(q)) => Ok(vec![n3(Vec3 { x: p.x + q.x, y: p.y + q.y, z: p.z + q.z })]),
            _ => Err(e.error("bad argument to '__add' (Vector expected)")),
        }
    }));
    mt.borrow_mut().set_str("__eq", Estado::funcion(move |_, a| Ok(vec![Valor::Bool(vec_de(&a[0]) == vec_de(&a[1]))])));
    mt.borrow_mut().set_str("__tostring", Estado::funcion(move |_, a| {
        let v = vec_de(&a[0]).unwrap();
        Ok(vec![Valor::from(format!("{} {} {}", v.x, v.y, v.z))])
    }));
    metodos.borrow_mut().set_str("Length", Estado::funcion_rapida(move |_, a, out| {
        let v = vec_de(&a[0]).unwrap();
        out.push(Valor::Num((v.x * v.x + v.y * v.y + v.z * v.z).sqrt()));
        Ok(())
    }));
    metodos.borrow_mut().set_str("Mul", Estado::funcion(move |_, a| {
        let k = Estado::a_numero(&a[1]).unwrap_or(1.0);
        a[0].udata().unwrap().con_mut(|v: &mut Vec3| { v.x *= k; v.y *= k; v.z *= k; });
        Ok(vec![])
    }));
    let met = metodos.clone();
    mt.borrow_mut().set_str("__index", Estado::funcion(move |_, a| {
        let v = vec_de(&a[0]).unwrap();
        let r = match a[1].texto().as_deref() {
            Some("x") => Valor::Num(v.x),
            Some("y") => Valor::Num(v.y),
            Some("z") => Valor::Num(v.z),
            _ => met.borrow().get(&a[1]),
        };
        Ok(vec![r])
    }));
    mt.borrow_mut().set_str("__newindex", Estado::funcion(move |_, a| {
        let x = Estado::a_numero(&a[2]).unwrap_or(0.0);
        let k = a[1].texto().map(|s| s.into_owned()).unwrap_or_default();
        a[0].udata().unwrap().con_mut(|v: &mut Vec3| match k.as_str() { "x" => v.x = x, "y" => v.y = x, "z" => v.z = x, _ => {} });
        Ok(vec![])
    }));
    mt
}

#[test]
fn nativas_y_userdata() {
    let (mut lua, out) = con_salida();
    poner_vector(&mut lua);
    lua.ejecutar(br#"
        local a = Vector(1, 2, 2)
        local b = Vector(1, 0, 0)
        local c = a + b
        print(c, c.x, a:Length(), type(a), a == Vector(1, 2, 2), a == b)
        c.y = 10; c:Mul(2)
        print(tostring(c), c.y)
        print(pcall(function() return a + 1 end))
    "#, "vec.lua").unwrap();
    let o = out.borrow();
    assert_eq!(o[0], "2 2 2\t2\t3\tuserdata\ttrue\tfalse");
    assert_eq!(o[1], "4 20 4\t20");
    assert_eq!(o[2], "false\tvec.lua:8: bad argument to '__add' (Vector expected)");
}

#[test]
fn llamar_desde_rust() {
    let mut lua = Estado::nuevo();
    lua.ejecutar(b"function suma(a, b, ...) return a + b, select('#', ...), ... end\nT = {n = 1}", "def.lua").unwrap();
    let f = lua.global("suma");
    let r = lua.llamar(&f, &[Valor::Num(2.0), Valor::Num(3.0), Valor::from("x"), Valor::Nil]).unwrap();
    assert_eq!(r.len(), 4);
    assert_eq!(r[0].num(), Some(5.0));
    assert_eq!(r[1].num(), Some(2.0));
    assert_eq!(r[2].texto().as_deref(), Some("x"));
    assert!(r[3].es_nil());
    // una tabla de Lua desde Rust
    let t = lua.global("T");
    assert_eq!(t.tabla().unwrap().borrow().get_str("n").num(), Some(1.0));
    // indexar con metamétodos desde Rust
    lua.ejecutar(b"P = setmetatable({}, {__index = function(t, k) return k .. '!' end})", "p.lua").unwrap();
    let p = lua.global("P");
    assert_eq!(lua.indexar(&p, &Valor::from("hola")).unwrap().texto().as_deref(), Some("hola!"));
    assert_eq!(lua.a_texto(&Valor::Num(0.1)).unwrap(), "0.1");
}

#[test]
fn errores_con_archivo_y_linea() {
    let mut lua = Estado::nuevo();
    let e = lua.ejecutar(b"local x = 1\n\nlocal y = x + nil\n", "addon/lua/autorun/init.lua").unwrap_err();
    assert_eq!(e.mensaje(), "addon/lua/autorun/init.lua:3: attempt to perform arithmetic on a nil value");
    let e = lua.ejecutar(b"local t = {}\nt.f()", "b.lua").unwrap_err();
    assert_eq!(e.mensaje(), "b.lua:2: attempt to call 'f' (a nil value)");
    let e = lua.ejecutar(b"x = = 1", "sintaxis.lua").unwrap_err();
    assert_eq!(e.mensaje(), "sintaxis.lua:1: expresión rara cerca de '='");
    // un error de una nativa lleva la línea de quien la llamó
    lua.registrar("falla", |e, _| Err(e.error("algo salió mal")));
    let e = lua.ejecutar(b"local a = 1\nlocal function f()\n  falla()\nend\nf()", "n.lua").unwrap_err();
    assert_eq!(e.mensaje(), "n.lua:3: algo salió mal");
    // error() con una tabla: el valor llega tal cual
    let e = lua.ejecutar(b"error({codigo = 7})", "t.lua").unwrap_err();
    assert_eq!(e.valor.tabla().unwrap().borrow().get_str("codigo").num(), Some(7.0));
    // y un error de Rust (sin posición) que pasa por pcall
    lua.registrar("rust_err", |_, _| Err(Error::nuevo("sin posición")));
    let r = lua.ejecutar(b"return pcall(rust_err)", "p.lua").unwrap();
    assert_eq!(r[1].texto().as_deref(), Some("sin posición"));
}

#[test]
fn tope_de_pasos() {
    let mut lua = Estado::nuevo();
    lua.set_limite_pasos(100_000);
    let e = lua.ejecutar(b"local ok = pcall(function() while true do end end)\nprint('no llega')", "bucle.lua").unwrap_err();
    assert!(e.es_duro());
    assert_eq!(e.mensaje(), "bucle.lua:1: el script tardó demasiado (¿bucle infinito?)");
    // cada llamada desde el anfitrión empieza con el contador en 0
    lua.ejecutar(b"function trabajo() local s = 0 for i = 1, 60000 do s = s + i end return s end", "t.lua").unwrap();
    let f = lua.global("trabajo");
    for _ in 0..5 { assert!(lua.llamar(&f, &[]).is_ok()); }
}

#[test]
fn capa_de_globales() {
    // como R.ov de la web: lo nuevo que asignan los scripts va a la capa del lado que corre; lo de _G es de todos
    let mut lua = Estado::nuevo();
    lua.set_global("COMUN", Valor::Num(1.0));
    let servidor = Tabla::nueva_ref();
    let cliente = Tabla::nueva_ref();
    lua.set_capa_globales(Some(servidor.clone()));
    lua.ejecutar(b"NUEVA = 'server'; COMUN = 2", "s.lua").unwrap();
    lua.set_capa_globales(Some(cliente.clone()));
    let r = lua.ejecutar(b"local a = NUEVA; NUEVA = 'client'; return a, NUEVA, COMUN", "c.lua").unwrap();
    assert!(r[0].es_nil());
    assert_eq!(r[1].texto().as_deref(), Some("client"));
    assert_eq!(r[2].num(), Some(2.0));
    assert_eq!(servidor.borrow().get_str("NUEVA").texto().as_deref(), Some("server"));
    assert_eq!(lua.global("COMUN").num(), Some(2.0));
}

#[test]
fn metodo_faltante() {
    let (mut lua, out) = con_salida();
    let mt = Tabla::nueva_ref();
    mt.borrow_mut().set_str("__index", Valor::tabla_nueva());
    let ent = Estado::udata(42u32, Some(mt));
    lua.set_global("ent", ent);
    lua.set_metodo_faltante(Some(Rc::new(|_, _, m| {
        let es_pregunta = m.bytes().starts_with(b"Is");
        Some(Estado::funcion(move |_, _| Ok(if es_pregunta { vec![Valor::Bool(false)] } else { vec![] })))
    })));
    lua.ejecutar(b"print(ent:IsOnFire(), ent:SetColor(1, 2, 3))", "m.lua").unwrap();
    assert_eq!(out.borrow()[0], "false");
}

#[test]
fn corrutinas_desde_rust() {
    let mut lua = Estado::nuevo();
    lua.ejecutar(b"co = coroutine.wrap(function(a) local b = coroutine.yield(a * 2); return a + b end)", "co.lua").unwrap();
    let co = lua.global("co");
    assert_eq!(lua.llamar(&co, &[Valor::Num(5.0)]).unwrap()[0].num(), Some(10.0));
    assert_eq!(lua.llamar(&co, &[Valor::Num(1.0)]).unwrap()[0].num(), Some(6.0));
    let e = lua.llamar(&co, &[]).unwrap_err();
    assert_eq!(e.mensaje(), "cannot resume dead coroutine");
}

#[test]
fn aislamiento() {
    // cada Estado es otro mundo: lo que define uno no lo ve el otro, y sin bibliotecas no hay nada
    let mut a = Estado::nuevo();
    let mut b = Estado::nuevo();
    a.ejecutar(b"X = 1; string.mio = true", "a.lua").unwrap();
    assert!(b.ejecutar(b"return X, string.mio", "b.lua").unwrap().iter().all(|v| v.es_nil()));
    let mut vacio = Estado::sin_bibliotecas();
    let e = vacio.ejecutar(b"print('hola')", "v.lua").unwrap_err();
    assert_eq!(e.mensaje(), "v.lua:1: attempt to call 'print' (a nil value)");
}

#[test]
fn ciclos_se_liberan() {
    // tablas que se apuntan entre sí y funciones que las capturan: al soltar el Estado se cortan los ciclos
    let marca = Rc::new(());
    {
        let mut lua = Estado::nuevo();
        let m = marca.clone();
        lua.set_global("ud", Estado::udata(m, None));
        lua.ejecutar(b"local t = {}; t.t = t; t.ud = ud; t.f = function() return t end; G = t; ud = nil", "c.lua").unwrap();
        assert_eq!(Rc::strong_count(&marca), 2);
    }
    assert_eq!(Rc::strong_count(&marca), 1);
}
