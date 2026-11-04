---
name: perfeccionista
description: Autocontrol de perfeccionista nato para cualquier trabajo visual o de juego (animaciones, contactos entre personajes, cámaras, gráficos, interfaz, rendimiento). Medir en vez de suponer, revisar todas las variantes y ángulos, encontrar uno mismo los defectos y corregirlos antes de entregar. Usar siempre antes de dar por terminado un trabajo de animación, render, UI o gameplay, aunque el pedido no lo diga.
---

# Perfeccionista nato

Nada se entrega porque "parece andar". Se entrega cuando pasó criterios medibles que uno mismo definió, y
después de haber buscado activamente cómo podría estar mal.

## 1. Definir "perfecto" antes de tocar nada

- Traducir el pedido (aunque sea vago: "que agarre bien", "que se vea god") a criterios concretos y exigentes,
  con números. Ejemplos: "la palma toca el cuello a ≤ 1,5 cm", "ningún vértice de la mano entra más de 1,5 cm en
  el otro cuerpo", "los dedos rodean ≥ 180° del cuello", "ningún hueso salta más de 5 cm entre dos cuadros",
  "el costo por cuadro no sube más de 3 %".
- Incluir los criterios que el usuario no dijo pero que un jugador exigente notaría (que nada atraviese nada, que
  nada flote, que no haya saltos, que se vea bien desde la cámara real).

## 2. Medir, no solo mirar

- Armar un verificador automático que recorra todo: cada instante de la animación (no solo uno), cada
  personaje o variante (tamaños distintos), cada pantalla (compu y celular), cada perfil gráfico.
- Para contactos entre cuerpos, usar la geometría real (vértices con su piel y sus normales): distancia de
  contacto, profundidad de penetración y cuánto rodea una mano a lo que agarra.
- Para rendimiento, comparar contra la versión anterior en las mismas condiciones (misma semilla, mismo evento,
  alternando corridas para promediar el ruido).

## 3. Mirar como el usuario

- Capturas desde la cámara real del juego, no solo desde cámaras de prueba cómodas.
- Además, ángulos que delatan trampas: de atrás, de abajo, de muy cerca, en el momento de la transición.
- Hojas de contacto antes/después para comparar de un vistazo.

## 4. Buscar el defecto activamente

Preguntas obligatorias antes de entregar:

- ¿Qué atraviesa a qué? ¿Qué flota sin tocar? ¿Qué salta de un cuadro al otro?
- ¿Se ve igual con el personaje más chico y con el más grande? ¿En el celular? ¿A 30 cuadros por segundo?
- ¿Qué pasa al principio y al final de cada transición?
- ¿Hay algo raro aunque no lo hayan pedido? Anotarlo y arreglarlo (o decirlo).

## 5. Corregir la causa, no el síntoma

- Si los personajes son distintos, que el código calcule las medidas de la geometría real (radio del cuello,
  grosor del brazo) en vez de un número a ojo que sirve para uno solo.
- Si un arreglo empeora otra cosa, volver a medir todo, no solo lo que se tocó.

## 6. Iterar hasta pasar

- Repetir medir → corregir → medir hasta que todos los criterios pasen en todas las variantes.
- Si algo no se puede lograr, decirlo con el número exacto y el motivo.

## 7. No romper nada

- Correr las pruebas existentes al final. Lo que andaba tiene que seguir andando.
- Diferenciar lo que causó el cambio de lo que ya estaba (comparar con la versión anterior en igualdad de
  condiciones).

## 8. Informe honesto

- Decir qué criterios pasan, con números; qué quedó pendiente y por qué.
- Nunca "perfecto" sin datos que lo muestren.
