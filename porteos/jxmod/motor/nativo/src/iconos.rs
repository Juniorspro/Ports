//! Los íconos de la web (juego/iconos.js: GLIFOS, los dibujos de 24×24 con trazo redondo —o relleno donde hace falta— que
//! usan los botones; y las redes de inicio.js, RED_SOCIAL), con los mismos caminos SVG, y su dibujo en píxeles: un lector
//! de lo que usan (path, circle, rect, ellipse; M L H V C S Q T A Z, absolutos y relativos) y un pintor que da la cobertura
//! de cada píxel (el trazo por la distancia al camino, con puntas y uniones redondas como `.gli`; el relleno con la regla
//! de la web —nonzero— y 4×4 muestras). Nada de emojis: dibujos propios.

/// (nombre, el SVG de adentro, relleno: los que pintan lleno en vez de trazar, como las redes)
pub const GLIFOS: &[(&str, &str, bool)] = &[
    ("pie", r#"<path d="M8 2.5v8.5c0 1.5-.6 2.6-1.8 3.6l-1.7 1.4C3.3 17 3 18.3 3.6 19.4c.5.9 1.4 1.3 2.4 1.3h11.8c1.2 0 2.2-1 2.2-2.2 0-1.3-1-2.3-2.3-2.4l-3.4-.4c-1.4-.2-2.3-1.4-2.3-2.8V2.5z"/><path d="M8 6h4.2"/>"#, false),
    ("calavera", r#"<path d="M12 2.8c-4.6 0-8 3.2-8 7.6 0 2.5 1.1 4.3 3 5.5v2.6c0 .9.7 1.6 1.6 1.6h6.8c.9 0 1.6-.7 1.6-1.6v-2.6c1.9-1.2 3-3 3-5.5 0-4.4-3.4-7.6-8-7.6z"/><circle cx="8.9" cy="11" r="1.9"/><circle cx="15.1" cy="11" r="1.9"/><path d="M12 13.5l-1 2h2zM10 20.1v-2.3M14 20.1v-2.3"/>"#, false),
    ("lupa", r#"<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>"#, false),
    ("linterna", r#"<rect x="2.5" y="10" width="8.5" height="4" rx="1"/><path d="M11 10l4.5-3v10L11 14z"/><path d="M15.5 7v10"/><path d="M18 9.2l3.5-1.4M18.5 12H22M18 14.8l3.5 1.4"/>"#, false),
    ("ojo", r#"<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>"#, false),
    ("camara", r#"<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13" r="3.4"/>"#, false),
    ("granada", r#"<circle cx="11" cy="14.5" r="6"/><path d="M9 8.7V6.5h4v2.2M13 6.5l3.2-2.5 1.8 2"/>"#, false),
    ("cuchillo", r#"<path d="M4 20l3.6-3.6"/><path d="M7.6 16.4 17.5 4c1.6 2.6 1.1 6.2-1.9 9.3l-4.6 4.6z"/>"#, false),
    ("escudo", r#"<path d="M12 3l7.5 3v5.5c0 4.7-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.8-7.5-9.5V6z"/>"#, false),
    ("rafaga", r#"<rect x="4" y="9" width="3.6" height="10" rx="1.8"/><rect x="10.2" y="9" width="3.6" height="10" rx="1.8"/><rect x="16.4" y="9" width="3.6" height="10" rx="1.8"/><path d="M5.8 9V6M12 9V6M18.2 9V6"/>"#, false),
    ("mano", r#"<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 14.6a1.5 1.5 0 0 1 2.5-1.6L8 15"/>"#, false),
    ("puerta", r#"<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M4 21h16"/><circle cx="14.5" cy="12.5" r="1"/>"#, false),
    ("power", r#"<path d="M12 3v8"/><path d="M7.2 6.5a7 7 0 1 0 9.6 0"/>"#, false),
    ("foco", r#"<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>"#, false),
    ("bocina", r#"<path d="M3 10h3l9-5v14l-9-5H3z"/><path d="M6 14l1.5 5H10l-1.3-4.3M18.5 9.5a3.5 3.5 0 0 1 0 5"/>"#, false),
    ("sirena", r#"<path d="M6 18v-5a6 6 0 0 1 12 0v5"/><path d="M4 18h16v3H4zM12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"/>"#, false),
    ("alas", r#"<path d="M12 9c-2-3-6-4.5-10-4 1 4 3.5 7 7 8M12 9c2-3 6-4.5 10-4-1 4-3.5 7-7 8"/><path d="M12 9v11"/>"#, false),
    ("fantasma", r#"<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2z"/><circle cx="9.5" cy="10.5" r=".8"/><circle cx="14.5" cy="10.5" r=".8"/>"#, false),
    ("vista", r#"<circle cx="8.5" cy="7.5" r="3"/><path d="M3.5 20c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5"/><rect x="15" y="9" width="6" height="5" rx="1"/><path d="M15 11.5l-2.5-1.5"/>"#, false),
    ("pistola", r#"<path d="M3.5 7.5h15l1.5 1.5v2.5h-6l-1 2.5h-2.5l-.5 4.5H6l1-5.5-3.5-1z"/><path d="M12.5 11.5l-.8 2"/>"#, false),
    ("pregunta", r#"<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5M12 16.6v.2"/>"#, false),
    ("pausa", r#"<path d="M8 5v14M16 5v14"/>"#, false),
    ("chico", r#"<path d="M7 5l11 7-11 7z"/>"#, false),
    ("chat", r#"<path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>"#, false),
    ("enviar", r#"<path d="M3.5 11.5 20.5 4l-6.5 16.5-3-6.8z"/><path d="M11 13.7 20.5 4"/>"#, false),
    ("reloj", r#"<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>"#, false),
    ("copiar", r#"<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>"#, false),
    ("mas", r#"<path d="M12 5v14M5 12h14"/>"#, false),
    ("baile", r#"<circle cx="13" cy="4.5" r="2"/><path d="M13 7l-1 6 3 3 1 5M12 13l-3.5 2-2 4M12 9l4-1 2-3M12 9.5 8 8 6 5"/>"#, false),
    ("mods", r#"<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z"/><path d="M16.5 13v7M13 16.5h7"/>"#, false),
    ("lista", r#"<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r="1.2" fill="currentColor"/><circle cx="3.6" cy="12" r="1.2" fill="currentColor"/><circle cx="3.6" cy="18" r="1.2" fill="currentColor"/>"#, false),
    ("libro", r#"<path d="M4 4.5h6.5c1 0 1.5.6 1.5 1.5v14c0-1-.6-1.5-1.5-1.5H4zM20 4.5h-6.5c-1 0-1.5.6-1.5 1.5v14c0-1 .6-1.5 1.5-1.5H20z"/>"#, false),
    ("servidor", r#"<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><circle cx="8" cy="7.5" r=".9" fill="currentColor"/><circle cx="8" cy="16.5" r=".9" fill="currentColor"/>"#, false),
    ("pin", r#"<path d="M9 3h6M10 3v6l-3 4h10l-3-4V3M12 13v8"/>"#, false),
    ("candado", r#"<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>"#, false),
    ("info", r#"<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/>"#, false),
    ("props", r#"<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>"#, false),
    ("punto", r#"<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>"#, false),
    ("gente", r#"<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.1c2.9.3 5.2 2.5 5.2 5.9"/>"#, false),
    ("ajustes", r#"<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.6"/>"#, false),
    ("guardar", r#"<path d="M5 3.5h11l3.5 3.5v13.5H5z"/><path d="M8 3.5v5h7.5v-5M8 20.5v-6.5h8v6.5"/>"#, false),
    ("jugar", r#"<path d="M7.5 4.8v14.4L19 12z" fill="currentColor"/>"#, false),
    ("subir", r#"<path d="M12 15.5V4M6.5 9.5 12 4l5.5 5.5M4.5 20h15"/>"#, false),
    ("bajar", r#"<path d="M12 4v11.5M6.5 10 12 15.5 17.5 10M4.5 20h15"/>"#, false),
    ("si", r#"<path d="m4.5 12.5 5 5 10-10.5"/>"#, false),
    ("no", r#"<path d="m6 6 12 12M18 6 6 18"/>"#, false),
    ("prohibido", r#"<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>"#, false),
    ("lapiz", r#"<path d="m4 20 1.2-4.8L15.8 4.6a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L8.8 18.8z"/><path d="m13.8 6.6 3.6 3.6"/>"#, false),
    ("girar", r#"<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.6h-4.6"/>"#, false),
    ("traer", r#"<path d="M12 3.5v9M8 8.5l4 4 4-4"/><circle cx="12" cy="17.5" r="3"/>"#, false),
    ("basura", r#"<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/>"#, false),
    ("dado", r#"<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>"#, false),
    ("persona", r#"<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>"#, false),
    ("gorro", r#"<path d="M2.5 17.2c3 2.2 16 2.2 19 0"/><path d="M6.2 17V10.8C6.2 7.2 8.8 5 12 5s5.8 2.2 5.8 5.8V17"/><path d="M6.3 13.6c3.6 1.1 7.8 1.1 11.4 0"/>"#, false),
    ("corazon", r#"<path d="M12 20s-7.8-4.7-7.8-10.3A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.5C19.8 15.3 12 20 12 20z"/>"#, false),
    ("rayo", r#"<path d="M13.5 2.5 5 13.5h6l-1.5 8 9-11.5h-6z"/>"#, false),
    ("salto", r#"<path d="m6 12.5 6-6 6 6M6 19l6-6 6 6"/>"#, false),
    ("mira", r#"<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>"#, false),
    ("estrella", r#"<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>"#, false),
    ("aviso", r#"<path d="M12 3.5 2.5 20h19z"/><path d="M12 9.5v5M12 17.3v.2"/>"#, false),
    ("campana", r#"<path d="M6 16.8V11a6 6 0 0 1 12 0v5.8l1.7 1.9H4.3z"/><path d="M10 21a2.1 2.1 0 0 0 4 0"/>"#, false),
    ("bicho", r#"<ellipse cx="12" cy="14" rx="5" ry="6.2"/><path d="M12 7.8v12.4M9.2 6.6 7.5 4.3M14.8 6.6l1.7-2.3M7 11H3.5M7 15H3.3M7.6 18.6l-2.6 2M17 11h3.5M17 15h3.7M16.4 18.6l2.6 2"/><path d="M9 8.6a3 3 0 0 1 6 0"/>"#, false),
    ("martillo", r#"<path d="M13.5 4.5 19.5 10.5 17 13 11 7z"/><path d="m14.5 9.5-10 10"/>"#, false),
    ("salir", r#"<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>"#, false),
    ("carpeta", r#"<path d="M3.5 7V5.8c0-.7.6-1.3 1.3-1.3h4.4l2 2.2h8c.7 0 1.3.6 1.3 1.3V18c0 .8-.6 1.4-1.4 1.4H4.9c-.8 0-1.4-.6-1.4-1.4z"/><path d="M3.5 10h17"/>"#, false),
    ("caja", r#"<path d="M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3z"/><path d="M3.5 7.5 12 11.8l8.5-4.3M12 11.8v9"/>"#, false),
    ("cosa", r#"<path d="M12 3.5 14.6 9.4l5.9 2.6-5.9 2.6L12 20.5l-2.6-5.9L3.5 12l5.9-2.6z"/>"#, false),
    ("buscar", r#"<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>"#, false),
    ("parar", r#"<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor"/>"#, false),
    ("volumen", r#"<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4M19 6.3a8 8 0 0 1 0 11.4"/>"#, false),
    ("micro", r#"<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>"#, false),
    ("atras", r#"<path d="m15 5-7 7 7 7"/>"#, false),
    ("adelante", r#"<path d="m9 5 7 7-7 7"/>"#, false),
    ("abajo", r#"<path d="M5 8.5h14l-7 9z" fill="currentColor"/>"#, false),
    ("mapa", r#"<path d="m3.5 6 5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2z"/><path d="M9 4v14M15 6v14"/>"#, false),
    ("bandera", r#"<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>"#, false),
    ("radio", r#"<rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="8.5" cy="14" r="3"/><path d="M14 12h4M14 15.5h4M6.5 8l10-5"/>"#, false),
    ("musica", r#"<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>"#, false),
    ("espalda", r#"<path d="M7 9a5 5 0 0 1 10 0v11.5H7z"/><path d="M9.5 4.6V3h5v1.6M7 13.5h10M10 13.5v3h4v-3"/>"#, false),
    ("mas3", r#"<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>"#, false),
    ("codigo", r#"<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>"#, false),
    ("mundo", r#"<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.4 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.4-3.6-8.5s1-5.9 3.6-8.5z"/>"#, false),
    ("ajustar", r#"<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>"#, false),
    ("video", r#"<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>"#, false),
    ("vr", r#"<path d="M3.5 8.6c0-1.2.9-2.1 2.1-2.1h12.8c1.2 0 2.1.9 2.1 2.1v6.1c0 1.2-.9 2.1-2.1 2.1h-3.3l-1.9-2.5a1.5 1.5 0 0 0-2.4 0l-1.9 2.5H5.6c-1.2 0-2.1-.9-2.1-2.1z"/><circle cx="8.2" cy="11.4" r="1.8"/><circle cx="15.8" cy="11.4" r="1.8"/>"#, false),
    // (las redes de JXStudios: Simple Icons, CC0 —RED_SOCIAL de inicio.js—, llenas)
    ("discord", r#"<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>"#, true),
    ("tiktok", r#"<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>"#, true),
    // (los que suman los paneles: el wifi de LAN —rbmenus.js— y el refrescar)
    ("chevron", r#"<path d="m6 9 6 6 6-6"/>"#, false),
    ("wifi", r#"<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.2" r=".9" fill="currentColor"/>"#, false),
];

/// una figura de un ícono: sus contornos (cerrado o abierto) y si se traza y se llena
struct Figura { contornos: Vec<(Vec<[f32; 2]>, bool)>, trazo: bool, relleno: bool }

/// los atributos de un elemento SVG (`nombre="valor"`)
fn atributos(e: &str) -> Vec<(&str, &str)> {
    let mut v = vec![]; let mut r = e;
    while let Some(i) = r.find("=\"") {
        let nombre = r[..i].rsplit(|c: char| c.is_whitespace()).next().unwrap_or("");
        let resto = &r[i + 2..]; let Some(j) = resto.find('"') else { break };
        v.push((nombre, &resto[..j])); r = &resto[j + 1..];
    }
    v
}
fn num(a: &[(&str, &str)], k: &str) -> f32 { a.iter().find(|x| x.0 == k).and_then(|x| x.1.trim().parse().ok()).unwrap_or(0.0) }

/// los números de un camino: "1.5-.6" son dos, ".8.8" también; con `bandera`, un solo dígito (los de los arcos)
struct Lector<'a> { s: &'a [u8], i: usize }
impl<'a> Lector<'a> {
    fn blancos(&mut self) { while self.i < self.s.len() && (self.s[self.i].is_ascii_whitespace() || self.s[self.i] == b',') { self.i += 1; } }
    fn hay_num(&mut self) -> bool { self.blancos(); self.i < self.s.len() && matches!(self.s[self.i], b'0'..=b'9' | b'-' | b'+' | b'.') }
    fn bandera(&mut self) -> f32 { self.blancos(); let c = self.s.get(self.i).copied().unwrap_or(b'0'); self.i += 1; if c == b'1' { 1.0 } else { 0.0 } }
    fn num(&mut self) -> f32 {
        self.blancos(); let ini = self.i; let s = self.s;
        if self.i < s.len() && matches!(s[self.i], b'-' | b'+') { self.i += 1; }
        let mut punto = false;
        while self.i < s.len() { match s[self.i] { b'0'..=b'9' => self.i += 1, b'.' if !punto => { punto = true; self.i += 1; } _ => break } }
        if self.i < s.len() && matches!(s[self.i], b'e' | b'E') { self.i += 1; if self.i < s.len() && matches!(s[self.i], b'-' | b'+') { self.i += 1; } while self.i < s.len() && s[self.i].is_ascii_digit() { self.i += 1; } }
        std::str::from_utf8(&s[ini..self.i]).ok().and_then(|t| t.parse().ok()).unwrap_or(0.0)
    }
}

/// un camino SVG (el atributo d) en contornos de segmentos rectos
fn camino(d: &str) -> Vec<(Vec<[f32; 2]>, bool)> {
    let mut l = Lector { s: d.as_bytes(), i: 0 };
    let mut sal: Vec<(Vec<[f32; 2]>, bool)> = vec![]; let mut cur: Vec<[f32; 2]> = vec![];
    let (mut p, mut ini) = ([0.0f32; 2], [0.0f32; 2]); let mut ctrl: Option<[f32; 2]> = None; let mut cmd = b'M';
    const N: usize = 12;
    let cerrar = |cur: &mut Vec<[f32; 2]>, sal: &mut Vec<(Vec<[f32; 2]>, bool)>, c: bool| { if cur.len() > 1 { sal.push((std::mem::take(cur), c)); } else { cur.clear(); } };
    loop {
        l.blancos(); if l.i >= l.s.len() { break; }
        let c = l.s[l.i];
        if c.is_ascii_alphabetic() { cmd = c; l.i += 1; } else if !l.hay_num() { l.i += 1; continue; }
        let rel = cmd.is_ascii_lowercase(); let o = if rel { p } else { [0.0, 0.0] };
        match cmd.to_ascii_uppercase() {
            b'M' => { cerrar(&mut cur, &mut sal, false); p = [o[0] + l.num(), o[1] + l.num()]; ini = p; cur.push(p); ctrl = None; cmd = if rel { b'l' } else { b'L' }; }
            b'L' => { p = [o[0] + l.num(), o[1] + l.num()]; cur.push(p); ctrl = None; }
            b'H' => { p = [o[0] + l.num(), p[1]]; cur.push(p); ctrl = None; }
            b'V' => { p = [p[0], o[1] + l.num()]; cur.push(p); ctrl = None; }
            b'C' | b'S' => {
                let c1 = if cmd.to_ascii_uppercase() == b'C' { [o[0] + l.num(), o[1] + l.num()] } else { ctrl.map(|c| [2.0 * p[0] - c[0], 2.0 * p[1] - c[1]]).unwrap_or(p) };
                let c2 = [o[0] + l.num(), o[1] + l.num()]; let q = [o[0] + l.num(), o[1] + l.num()];
                if cur.is_empty() { cur.push(p); }
                for k in 1..=N { let t = k as f32 / N as f32; let u = 1.0 - t;
                    cur.push([u * u * u * p[0] + 3.0 * u * u * t * c1[0] + 3.0 * u * t * t * c2[0] + t * t * t * q[0], u * u * u * p[1] + 3.0 * u * u * t * c1[1] + 3.0 * u * t * t * c2[1] + t * t * t * q[1]]); }
                ctrl = Some(c2); p = q;
            }
            b'Q' | b'T' => {
                let c1 = if cmd.to_ascii_uppercase() == b'Q' { [o[0] + l.num(), o[1] + l.num()] } else { ctrl.map(|c| [2.0 * p[0] - c[0], 2.0 * p[1] - c[1]]).unwrap_or(p) };
                let q = [o[0] + l.num(), o[1] + l.num()];
                if cur.is_empty() { cur.push(p); }
                for k in 1..=N { let t = k as f32 / N as f32; let u = 1.0 - t; cur.push([u * u * p[0] + 2.0 * u * t * c1[0] + t * t * q[0], u * u * p[1] + 2.0 * u * t * c1[1] + t * t * q[1]]); }
                ctrl = Some(c1); p = q;
            }
            b'A' => {
                let (rx, ry, rot) = (l.num().abs(), l.num().abs(), l.num().to_radians()); let (fa, fs) = (l.bandera(), l.bandera());
                let q = [o[0] + l.num(), o[1] + l.num()];
                if cur.is_empty() { cur.push(p); }
                arco(p, q, rx, ry, rot, fa > 0.5, fs > 0.5, &mut cur); p = q; ctrl = None;
            }
            b'Z' => { if !cur.is_empty() { cur.push(ini); } cerrar(&mut cur, &mut sal, true); p = ini; ctrl = None; cur.push(p); cmd = b'M'; l.blancos(); if l.hay_num() { cmd = if rel { b'l' } else { b'L' }; } }
            _ => { l.i += 1; }
        }
    }
    cerrar(&mut cur, &mut sal, false);
    sal
}
/// un arco elíptico de SVG (la conversión de la especificación, F.6.5) en segmentos
fn arco(p: [f32; 2], q: [f32; 2], mut rx: f32, mut ry: f32, rot: f32, grande: bool, barrido: bool, v: &mut Vec<[f32; 2]>) {
    if rx < 1e-6 || ry < 1e-6 { v.push(q); return; }
    let (c, s) = (rot.cos(), rot.sin());
    let (dx, dy) = ((p[0] - q[0]) / 2.0, (p[1] - q[1]) / 2.0);
    let (x1, y1) = (c * dx + s * dy, -s * dx + c * dy);
    let l = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry); if l > 1.0 { rx *= l.sqrt(); ry *= l.sqrt(); }
    let num = (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1).max(0.0); let den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
    let mut k = if den > 0.0 { (num / den).sqrt() } else { 0.0 }; if grande == barrido { k = -k; }
    let (cx1, cy1) = (k * rx * y1 / ry, -k * ry * x1 / rx);
    let (cx, cy) = (c * cx1 - s * cy1 + (p[0] + q[0]) / 2.0, s * cx1 + c * cy1 + (p[1] + q[1]) / 2.0);
    let ang = |ux: f32, uy: f32, vx: f32, vy: f32| { let a = (ux * vy - uy * vx).atan2(ux * vx + uy * vy); a };
    let t1 = ang(1.0, 0.0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let mut dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if !barrido && dt > 0.0 { dt -= std::f32::consts::TAU; } else if barrido && dt < 0.0 { dt += std::f32::consts::TAU; }
    let n = ((dt.abs() / 0.25).ceil() as usize).clamp(2, 48);
    for i in 1..=n { let t = t1 + dt * i as f32 / n as f32; let (x, y) = (rx * t.cos(), ry * t.sin()); v.push([c * x - s * y + cx, s * x + c * y + cy]); }
}
fn elipse(cx: f32, cy: f32, rx: f32, ry: f32) -> Vec<[f32; 2]> { let n = 40; (0..=n).map(|i| { let t = i as f32 / n as f32 * std::f32::consts::TAU; [cx + rx * t.cos(), cy + ry * t.sin()] }).collect() }

/// las figuras de un ícono
fn figuras(svg: &str, lleno: bool) -> Vec<Figura> {
    let mut v = vec![];
    for parte in svg.split('<').skip(1) {
        let (tag, resto) = parte.split_once(|c: char| c.is_whitespace() || c == '/' || c == '>').unwrap_or((parte, ""));
        let a = atributos(resto);
        let relleno = lleno || a.iter().any(|x| x.0 == "fill" && x.1 != "none");
        let trazo = !lleno;
        let contornos = match tag {
            "path" => camino(a.iter().find(|x| x.0 == "d").map(|x| x.1).unwrap_or("")),
            "circle" => vec![(elipse(num(&a, "cx"), num(&a, "cy"), num(&a, "r"), num(&a, "r")), true)],
            "ellipse" => vec![(elipse(num(&a, "cx"), num(&a, "cy"), num(&a, "rx"), num(&a, "ry")), true)],
            "rect" => {
                let (x, y, w, h) = (num(&a, "x"), num(&a, "y"), num(&a, "width"), num(&a, "height")); let r = num(&a, "rx").min(w / 2.0).min(h / 2.0);
                let mut c = vec![];
                if r <= 0.0 { c = vec![[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]; }
                else { for (cx, cy, a0) in [(x + w - r, y + r, -90.0f32), (x + w - r, y + h - r, 0.0), (x + r, y + h - r, 90.0), (x + r, y + r, 180.0)] { for i in 0..=8 { let t = (a0 + i as f32 * 90.0 / 8.0).to_radians(); c.push([cx + r * t.cos(), cy + r * t.sin()]); } } let p0 = c[0]; c.push(p0); }
                vec![(c, true)]
            }
            _ => continue,
        };
        v.push(Figura { contornos, trazo, relleno });
    }
    v
}

/// la distancia de un punto a un segmento
fn dist_seg(p: [f32; 2], a: [f32; 2], b: [f32; 2]) -> f32 {
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]); let l = dx * dx + dy * dy;
    let t = if l > 0.0 { (((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l).clamp(0.0, 1.0) } else { 0.0 };
    let (x, y) = (a[0] + dx * t - p[0], a[1] + dy * t - p[1]); (x * x + y * y).sqrt()
}
/// el número de vueltas (nonzero) de los contornos alrededor de un punto
fn vueltas(p: [f32; 2], cs: &[(Vec<[f32; 2]>, bool)]) -> i32 {
    let mut w = 0;
    for (c, _) in cs { let n = c.len(); for i in 0..n { let (a, b) = (c[i], c[(i + 1) % n]);
        if a[1] <= p[1] { if b[1] > p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[1] - a[1]) * 0.0 - (p[0] - a[0]) * (b[1] - a[1]) > 0.0 { w += 1; } }
        else if b[1] <= p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) < 0.0 { w -= 1; }
    } }
    w
}

/// el ícono `nombre` en un cuadrado de `lado` píxeles con trazo de `trazo` (en unidades de 24): la cobertura de cada píxel
/// (0–255). None si no existe.
pub fn pintar(nombre: &str, lado: usize, trazo: f32) -> Option<Vec<u8>> {
    let (_, svg, lleno) = GLIFOS.iter().find(|g| g.0 == nombre)?;
    let figs = figuras(svg, *lleno);
    let k = lado as f32 / 24.0; let hw = trazo * k / 2.0;
    let mut o = vec![0u8; lado * lado];
    // (las figuras en píxeles, y sus cajas para saltear lo lejano)
    let figs: Vec<(Vec<(Vec<[f32; 2]>, bool)>, bool, bool, [f32; 4])> = figs.into_iter().map(|f| {
        let cs: Vec<(Vec<[f32; 2]>, bool)> = f.contornos.into_iter().map(|(c, z)| (c.into_iter().map(|p| [p[0] * k, p[1] * k]).collect(), z)).collect();
        let mut b = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
        for (c, _) in &cs { for p in c { b[0] = b[0].min(p[0]); b[1] = b[1].min(p[1]); b[2] = b[2].max(p[0]); b[3] = b[3].max(p[1]); } }
        (cs, f.trazo, f.relleno, b)
    }).collect();
    for y in 0..lado { for x in 0..lado {
        let p = [x as f32 + 0.5, y as f32 + 0.5]; let mut cob = 0.0f32;
        for (cs, trazo, relleno, b) in &figs {
            if p[0] < b[0] - hw - 1.0 || p[0] > b[2] + hw + 1.0 || p[1] < b[1] - hw - 1.0 || p[1] > b[3] + hw + 1.0 { continue; }
            if *trazo { let mut d = f32::MAX; for (c, _) in cs { for i in 1..c.len() { d = d.min(dist_seg(p, c[i - 1], c[i])); } if c.len() == 1 { d = d.min(dist_seg(p, c[0], c[0])); } }
                cob = cob.max((hw - d + 0.5).clamp(0.0, 1.0)); }
            if *relleno && cob < 1.0 { let mut n = 0; for sy in 0..4 { for sx in 0..4 { let q = [x as f32 + (sx as f32 + 0.5) / 4.0, y as f32 + (sy as f32 + 0.5) / 4.0]; if vueltas(q, cs) != 0 { n += 1; } } }
                cob = cob.max(n as f32 / 16.0); }
        }
        o[y * lado + x] = (cob * 255.0 + 0.5) as u8;
    } }
    Some(o)
}
/// ¿existe el ícono?
pub fn hay(nombre: &str) -> bool { GLIFOS.iter().any(|g| g.0 == nombre) || COLOR.iter().any(|g| g.0 == nombre) }

/// los íconos de colores (juego/iconos/*.svg —los de los mods y las animaciones— y el de GMod de gmod.js): SVG enteros, con su
/// viewBox, sus rellenos y trazos de color
pub const COLOR: &[(&str, &str)] = &[
    ("ico_mod", include_str!("../../../juego/iconos/mod.svg")),
    ("ico_animacion", include_str!("../../../juego/iconos/animacion.svg")),
    ("ico_volar", include_str!("../../../juego/iconos/volar.svg")),
    ("ico_ragdoll", include_str!("../../../juego/iconos/ragdoll.svg")),
    ("ico_scp", include_str!("../../../juego/iconos/scp.svg")),
    ("ico_ciclope", include_str!("../../../juego/iconos/ciclope.svg")),
    ("ico_auto", include_str!("../../../juego/iconos/auto.svg")),
    ("ico_piano", include_str!("../../../juego/iconos/piano.svg")),
    // (los del Mundo, propios: las horas del día y el ciclo)
    ("ico_amanecer", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#e98a4f"/><rect x="1" y="38" width="62" height="25" rx="0" fill="#7a4a8c"/><circle cx="32" cy="40" r="11" fill="#ffe08a"/><rect x="1" y="40" width="62" height="23" fill="#5b3a78"/><path fill="#ffe08a" d="M30 16h4v8h-4zM14 24l3-3 6 6-3 3zM47 21l3 3-6 6-3-3z"/></svg>"##),
    ("ico_manana", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#6fb6ec"/><circle cx="24" cy="26" r="10" fill="#ffd54a"/><path fill="#ffffff" d="M30 46a8 8 0 0 1 8-8 10 10 0 0 1 19 3 6 6 0 0 1-1 12H34a6 6 0 0 1-4-7z"/></svg>"##),
    ("ico_dia", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#3a9be8"/><circle cx="32" cy="32" r="11" fill="#ffd54a"/><path fill="#ffd54a" d="M30 7h4v9h-4zM30 48h4v9h-4zM7 30h9v4H7zM48 30h9v4h-9zM13.5 16.3l2.8-2.8 6.4 6.4-2.8 2.8zM41.3 44.1l2.8-2.8 6.4 6.4-2.8 2.8zM13.5 47.7l6.4-6.4 2.8 2.8-6.4 6.4zM41.3 19.9l6.4-6.4 2.8 2.8-6.4 6.4z"/></svg>"##),
    ("ico_tarde", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#f0a23a"/><circle cx="40" cy="30" r="12" fill="#fff1b8"/><path fill="#c96a1e" d="M1 46c12-4 22-4 31 0s19 4 31 0v4c0 7-6 13-13 13H14C7 63 1 57 1 50z"/></svg>"##),
    ("ico_atardecer", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#d9573b"/><circle cx="32" cy="42" r="13" fill="#ffc067"/><path fill="#7d2a3c" d="M1 42h62v8c0 7-6 13-13 13H14C7 63 1 57 1 50z"/><path fill="#ffc067" d="M14 50h36v3H14zM20 56h24v3H20z"/></svg>"##),
    ("ico_noche", include_str!("../../../juego/iconos/luna.svg")),
    ("ico_ciclo", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#36447a"/><path fill="#ffd54a" d="M32 14a18 18 0 0 0-18 18h18z"/><path fill="#ffffff" d="M32 50a18 18 0 0 0 18-18H32z"/><path fill="none" stroke="#ffffff" stroke-width="3.5" d="M46 20a18 18 0 0 1 4 8M18 44a18 18 0 0 1-4-8"/><path fill="#ffffff" d="M52 23l-1 9-7-5zM12 41l1-9 7 5z"/></svg>"##),
    ("ico_hora_mas", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#4a5568"/><circle cx="28" cy="34" r="17" fill="none" stroke="#ffffff" stroke-width="4"/><path fill="none" stroke="#ffffff" stroke-width="4" d="M28 24v10l7 5"/><path fill="#5fc9a8" d="M46 8h5v7h7v5h-7v7h-5v-7h-7v-5h7z"/></svg>"##),
    ("ico_hora_menos", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#4a5568"/><circle cx="28" cy="34" r="17" fill="none" stroke="#ffffff" stroke-width="4"/><path fill="none" stroke="#ffffff" stroke-width="4" d="M28 24v10l7 5"/><path fill="#f08080" d="M39 15h19v5H39z"/></svg>"##),
    // (propios, del mismo estilo: la pantalla con cosas de Props y la llave de Herramientas)
    ("ico_props", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#2f7de1"/><rect x="11" y="13" width="42" height="31" rx="4" fill="#ffffff"/><rect x="15" y="17" width="15" height="11" rx="2" fill="#2f7de1"/><rect x="34" y="17" width="15" height="11" rx="2" fill="#f2b31b"/><rect x="15" y="31" width="34" height="9" rx="2" fill="#9cc5f5"/><rect x="22" y="48" width="20" height="4" rx="2" fill="#ffffff"/></svg>"##),
    ("ico_herr", r##"<svg viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#4a5568"/><path fill="#ffffff" d="M45 11a11 11 0 0 0-12 14L13 45a4.5 4.5 0 0 0 6.4 6.4l20-20A11 11 0 0 0 53 19l-7 7-6.5-2.5L37 17l7-7z"/></svg>"##),
    ("ico_gmod", r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1b8fdc"/><path d="M45 22a15 15 0 1 0 2 13H33v-7h22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>"##),
];
fn color_de(v: &str) -> Option<[f32; 3]> {
    let v = v.trim(); if v == "none" { return None; }
    let h = v.strip_prefix('#')?; let n = u32::from_str_radix(h, 16).ok()?;
    Some(if h.len() == 3 { [((n >> 8) & 15) as f32 * 17.0 / 255.0, ((n >> 4) & 15) as f32 * 17.0 / 255.0, (n & 15) as f32 * 17.0 / 255.0] } else { [((n >> 16) & 255) as f32 / 255.0, ((n >> 8) & 255) as f32 / 255.0, (n & 255) as f32 / 255.0] })
}
/// un ícono de color en un cuadrado de `lado` píxeles (RGBA, cada figura encima de la anterior)
pub fn pintar_color(nombre: &str, lado: usize) -> Option<Vec<u8>> {
    let (_, svg) = COLOR.iter().find(|g| g.0 == nombre)?;
    Some(pintar_svg(svg, lado))
}
/// un SVG entero (con su viewBox; 24 si no dice) en un cuadrado de `lado` píxeles, RGBA. Lo de cada figura: su relleno, su
/// trazo y el ancho del trazo, o los del `<g>` que la envuelve (también su `rotate(a cx cy)` y su `opacity`): así se pintan
/// los íconos del HUD de hud.js (HUD_SVG), que traen colores y grupos girados
pub fn pintar_svg(svg: &str, lado: usize) -> Vec<u8> {
    let vb: f32 = svg.split("viewBox=\"").nth(1).and_then(|r| r.split('"').next()).and_then(|r| r.split_whitespace().nth(2)).and_then(|x| x.parse().ok()).unwrap_or(24.0);
    let k = lado as f32 / vb; let mut o = vec![0f32; lado * lado * 4];
    // (lo heredado de los grupos: relleno —None: no dice; Some(None): «none»—, trazo, ancho, giro y opacidad)
    #[derive(Clone, Copy, Default)]
    struct G { fill: Option<Option<[f32; 3]>>, stroke: Option<Option<[f32; 3]>>, sw: Option<f32>, rot: Option<(f32, f32, f32)>, op: f32 }
    let mut pila: Vec<G> = vec![G { op: 1.0, ..Default::default() }];
    let giro = |t: &str| -> Option<(f32, f32, f32)> { let r = t.split("rotate(").nth(1)?.split(')').next()?; let v: Vec<f32> = r.split(|c: char| c == ',' || c.is_whitespace()).filter(|x| !x.is_empty()).filter_map(|x| x.parse().ok()).collect(); Some((v.first().copied()?, v.get(1).copied().unwrap_or(0.0), v.get(2).copied().unwrap_or(0.0))) };
    for parte in svg.split('<').skip(1) {
        if parte.starts_with("/g") { if pila.len() > 1 { pila.pop(); } continue; }
        let (tag, resto) = parte.split_once(|c: char| c.is_whitespace() || c == '/' || c == '>').unwrap_or((parte, ""));
        let a = atributos(resto); let at = |n: &str| a.iter().find(|x| x.0 == n).map(|x| x.1);
        let arriba = *pila.last().unwrap();
        if tag == "g" {
            let mut g = arriba;
            if let Some(v) = at("fill") { g.fill = Some(color_de(v)); }
            if let Some(v) = at("stroke") { g.stroke = Some(color_de(v)); }
            if let Some(v) = at("stroke-width").and_then(|x| x.parse().ok()) { g.sw = Some(v); }
            if let Some(r) = at("transform").and_then(giro) { g.rot = Some(r); }
            if let Some(v) = at("opacity").and_then(|x| x.parse::<f32>().ok()) { g.op *= v; }
            if !parte.trim_end().ends_with("/>") { pila.push(g); }
            continue;
        }
        let relleno = match at("fill") { Some(v) => color_de(v), None => match arriba.fill { Some(f) => f, None => Some([0.0; 3]) } };   // (sin decir nada, negro: como SVG)
        let trazo = match at("stroke") { Some(v) => color_de(v), None => arriba.stroke.flatten() };
        let tw = at("stroke-width").and_then(|x| x.parse::<f32>().ok()).or(arriba.sw).unwrap_or(1.0) * k / 2.0;
        let op = arriba.op * at("opacity").and_then(|x| x.parse::<f32>().ok()).unwrap_or(1.0);
        let rot = at("transform").and_then(giro).or(arriba.rot);
        let cs: Vec<(Vec<[f32; 2]>, bool)> = match tag {
            "path" => camino(at("d").unwrap_or("")),
            "circle" => vec![(elipse(num(&a, "cx"), num(&a, "cy"), num(&a, "r"), num(&a, "r")), true)],
            "ellipse" => vec![(elipse(num(&a, "cx"), num(&a, "cy"), num(&a, "rx"), num(&a, "ry")), true)],
            "rect" => { let f = figuras(&format!("<rect {resto}"), true); f.into_iter().flat_map(|x| x.contornos).collect() }
            _ => continue,
        };
        let (sn, cn) = rot.map(|r| r.0.to_radians().sin_cos()).unwrap_or((0.0, 1.0)); let (rx, ry) = rot.map(|r| (r.1, r.2)).unwrap_or((0.0, 0.0));
        let cs: Vec<(Vec<[f32; 2]>, bool)> = cs.into_iter().map(|(c, z)| (c.into_iter().map(|p| { let (dx, dy) = (p[0] - rx, p[1] - ry); [(rx + dx * cn - dy * sn) * k, (ry + dx * sn + dy * cn) * k] }).collect(), z)).collect();
        let mut caja = [f32::MAX, f32::MAX, f32::MIN, f32::MIN]; for (c, _) in &cs { for p in c { caja[0] = caja[0].min(p[0]); caja[1] = caja[1].min(p[1]); caja[2] = caja[2].max(p[0]); caja[3] = caja[3].max(p[1]); } }
        let m = tw + 2.0;
        for y in 0..lado { for x in 0..lado {
            let p = [x as f32 + 0.5, y as f32 + 0.5];
            if p[0] < caja[0] - m || p[0] > caja[2] + m || p[1] < caja[1] - m || p[1] > caja[3] + m { continue; }
            let mut capa = |col: [f32; 3], cob: f32| { let cob = cob * op; if cob <= 0.0 { return; } let j = (y * lado + x) * 4; let da = o[j + 3]; let oa = cob + da * (1.0 - cob);
                for c in 0..3 { o[j + c] = if oa > 0.0 { (col[c] * cob + o[j + c] * da * (1.0 - cob)) / oa } else { 0.0 }; } o[j + 3] = oa; };
            if let Some(col) = relleno { let mut n = 0; for sy in 0..4 { for sx in 0..4 { if vueltas([x as f32 + (sx as f32 + 0.5) / 4.0, y as f32 + (sy as f32 + 0.5) / 4.0], &cs) != 0 { n += 1; } } } capa(col, n as f32 / 16.0); }
            if let Some(col) = trazo { let mut d = f32::MAX; for (c, _) in &cs { for i in 1..c.len() { d = d.min(dist_seg(p, c[i - 1], c[i])); } } capa(col, (tw - d + 0.5).clamp(0.0, 1.0)); }
        } }
    }
    o.chunks_exact(4).flat_map(|c| [(c[0] * 255.0) as u8, (c[1] * 255.0) as u8, (c[2] * 255.0) as u8, (c[3] * 255.0 + 0.5) as u8]).collect()
}

