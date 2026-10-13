// Escenas: titulo, mapa, partida.
'use strict';
const Escenas = {
  // prueba del motor: Rocky Plateau con el heroe caminando
  titulo() {
    const fondo = Fondo.crear('Quests/RockyPlateau/bg_rocky_plateau');
    const frente = Fondo.crear('Quests/RockyPlateau/fg_rocky_plateau');
    const heroe = Obj.crear(Object.keys(Datos.prefabs).find((k) => Datos.prefabs[k].n === 'Hero' && k[0] === 's'));
    Obj.iniciarAnim(heroe);
    const camina = Obj.buscar(heroe, 'Walking Animation');
    let x = 0, cam = 0;
    return {
      paso() {
        Fondo.paso(fondo); Fondo.paso(frente); Obj.paso(camina, 1 / TICS);
        if (Juego.t % 4 === 0) x++;
        cam = Math.max(cam, x - 20);
      },
      dibujar() {
        Fondo.dibujar(fondo, cam);
        Obj.dibujarSprite(Obj.sprite(camina), x - cam, 16);
        Fondo.dibujar(frente, cam);
      },
    };
  },
};
