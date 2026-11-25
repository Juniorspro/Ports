// Agrega a la copia de Baileys el campo 26 de StickerMessage: audioMessage (el audio de los stickers con sonido de
// WhatsApp; en el protocolo de WhatsApp es `oneof audio { Message.AudioMessage audioMessage = 26; }`). Baileys 7.0.0-rc14
// todavía no lo trae. Se corre al armar el APK (herramientas/armar_apk.py) sobre node_modules; si ya está, no hace nada.
// uso: node parche_proto.mjs [CARPETA_node_modules]
import fs from 'node:fs'; import path from 'node:path';
const raiz = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules');
const f = path.join(raiz, 'baileys', 'WAProto', 'index.js'); let s = fs.readFileSync(f, 'utf8');
if (s.includes('/*sz:audio26*/')) { console.log('ya estaba'); process.exit(0); }
const ini = s.indexOf('StickerMessage.encode = function encode(m, w) {'), fin = s.indexOf('StickerMessage.toObject = function toObject(m, o) {');
if (ini < 0 || fin < 0) throw new Error('no encontré StickerMessage en WAProto');
let t = s.slice(ini, fin); const una = (a, b) => { const n = t.split(a).length - 1; if (n !== 1) throw new Error(`ancla «${a.slice(0, 50)}» ${n} veces`); t = t.replace(a, b); };
una('w.uint32(184).int32(m.mediaKeyDomain);\n                return w;', 'w.uint32(184).int32(m.mediaKeyDomain);\n                /*sz:audio26*/ if (m.audioMessage != null && Object.hasOwnProperty.call(m, "audioMessage"))\n                    $root.proto.Message.AudioMessage.encode(m.audioMessage, w.uint32(210).fork()).ldelim();\n                return w;');
una('                    case 23: {\n                            m.mediaKeyDomain = r.int32();\n                            break;\n                        }\n', '                    case 23: {\n                            m.mediaKeyDomain = r.int32();\n                            break;\n                        }\n                    case 26: {\n                            m.audioMessage = $root.proto.Message.AudioMessage.decode(r, r.uint32());\n                            break;\n                        }\n');
una('StickerMessage.fromObject = function fromObject(d) {\n                if (d instanceof $root.proto.Message.StickerMessage)\n                    return d;\n                var m = new $root.proto.Message.StickerMessage();\n',
    'StickerMessage.fromObject = function fromObject(d) {\n                if (d instanceof $root.proto.Message.StickerMessage)\n                    return d;\n                var m = new $root.proto.Message.StickerMessage();\n                if (d.audioMessage != null) m.audioMessage = $root.proto.Message.AudioMessage.fromObject(d.audioMessage);\n');
s = s.slice(0, ini) + t + s.slice(fin);
// (toObject: para que se vea al leerlo)
s = s.replace('StickerMessage.toObject = function toObject(m, o) {\n                if (!o)\n                    o = {};\n                var d = {};\n', 'StickerMessage.toObject = function toObject(m, o) {\n                if (!o)\n                    o = {};\n                var d = {};\n                if (m.audioMessage != null) d.audioMessage = $root.proto.Message.AudioMessage.toObject(m.audioMessage, o);\n');
fs.writeFileSync(f, s); console.log('listo: StickerMessage.audioMessage = 26');
