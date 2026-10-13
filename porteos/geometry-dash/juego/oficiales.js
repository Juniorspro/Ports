// Los niveles que trae el juego: nombre, canción, dificultad, estrellas y monedas.
'use strict';
GD.OFICIALES = {
  1: ['Stereo Madness', 'StereoMadness', 'easy', 1], 2: ['Back On Track', 'BackOnTrack', 'easy', 2], 3: ['Polargeist', 'Polargeist', 'normal', 3],
  4: ['Dry Out', 'DryOut', 'normal', 4], 5: ['Base After Base', 'BaseAfterBase', 'hard', 5], 6: ["Can't Let Go", 'CantLetGo', 'hard', 6],
  7: ['Jumper', 'Jumper', 'harder', 7], 8: ['Time Machine', 'TimeMachine', 'harder', 8], 9: ['Cycles', 'Cycles', 'harder', 9],
  10: ['xStep', 'xStep', 'insane', 10], 11: ['Clutterfunk', 'Clutterfunk', 'insane', 11], 12: ['Theory of Everything', 'TheoryOfEverything', 'insane', 12],
  13: ['Electroman Adventures', 'Electroman', 'insane', 10], 14: ['Clubstep', 'Clubstep', 'demon', 14], 15: ['Electrodynamix', 'Electrodynamix', 'insane', 12],
  16: ['Hexagon Force', 'HexagonForce', 'insane', 12], 17: ['Blast Processing', 'BlastProcessing', 'harder', 10], 18: ['Theory of Everything 2', 'TheoryOfEverything2', 'demon', 14],
  19: ['Geometrical Dominator', 'GeometricalDominator', 'harder', 10], 20: ['Deadlocked', 'Deadlocked', 'demon', 15], 21: ['Fingerdash', 'Fingerdash', 'insane', 12],
  22: ['Dash', 'Dash', 'insane', 12],
  3001: ['The Challenge', 'secretLoop', 'hard', 3],
  5001: ['The Tower', null, 'normal', 0], 5002: ['The Sewers', null, 'normal', 0], 5003: ['The Cellar', null, 'normal', 0], 5004: ['The Secret Hollow', null, 'normal', 0],
};
GD.oficial = function (id) {
  const o = GD.OFICIALES[id]; if (!o) return null;
  return { id: +id, nombre: o[0], musica: o[1] ? `datos/mus/${o[1]}.ogg` : null, dif: o[2], estrellas: o[3], oficial: true };
};
