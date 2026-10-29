// Carga los scripts del emulador en el contexto global (como lo hace el navegador con varios <script>)
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'juego');
module.exports = (archivos) => {
  for (const f of archivos || ['decode.js', 'cpu.js', 'vfp.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
};
