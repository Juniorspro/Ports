# Los memes de Stickerazo: qué foto libre (id de Openverse, CC0 o dominio público) va en cada uno, su texto, cómo se
# deforma («xD») y con qué letra. Lo arma herramientas/memes_libres.py (armar); en la app son «packs listos» que se pueden cambiar.
# efecto: nada | ojo (ojo de pez en la cara) | aplastar | ancho | estirar | quemar | trucha (calidad baja) | espejo |
#         ojoq (ojo de pez y quemado) | lentes:x,y,ancho (anteojos pixelados) — se pueden sumar con «+»
# estilo: comic (minúscula, abajo) | impact (mayúscula; «arriba|abajo») | tira (franja blanca arriba, letra negra;
#         «franja|abajo» para sumar un remate abajo)
# (pack, nombre, descripción, país, etiquetas, [(id de la foto, texto, emoji, efecto, estilo)])
PACKS = [
    ('gritos', 'Gatos al grito', 'Todo es una tragedia', 'ar', 'gato gatos michi grito drama', [
        ('4daae21d-0d31-4244-b579-265a1a8350e6', 'cómo q se cortó la luz', '😱', 'quemar', 'comic'),  # antes: ¿¡CÓMO QUE SE CORTÓ LA LUZ!?
        ('fd884ba3-d71d-4f07-a319-60104638ab20', 'NOOO EL LUNES NO', '😩', 'estirar', 'impact'),  # antes: NOOO, EL LUNES NO
        ('6698c574-8c40-48bc-b4cd-15886a33bb91', 'cuando te dicen "tenemos q hablar"', '😨', 'ojo', 'tira'),  # antes: CUANDO TE DICEN «TENEMOS QUE HABLAR»
        ('0ae33e34-5909-46a7-b10e-200f11c6b57d', 'cómo q no hay dulce de leche', '😤', 'ancho', 'comic'),  # antes: ¿CÓMO QUE NO HAY DULCE DE LECHE?
        ('0d369815-9cef-457e-bb5c-257f7b987ff6', 'la alarma a las 6 am', '⏰', 'quemar', 'tira'),  # antes: CUANDO SUENA LA ALARMA
        ('4c70a3a8-8cd2-427b-b5e8-427bf8bde8b8', 'me tenés podrido', '😠', 'ojo', 'comic'),  # antes: ¡ME TENÉS PODRIDO!
        ('5a2bc170-d8f8-41ba-b31d-139a57a51e18', 'bostezo nivel dios', '🥱', 'trucha', 'comic'),  # antes: BOSTEZO DE LUNES
        ('7215dc6e-676f-4cb3-baf7-3ad0e6f2c07c', 'no doy más', '😫', 'trucha', 'comic'),  # antes: NO DOY MÁS
        ('7b554631-138d-4bd1-b4e6-63b1d905f9d5', 'AAAAAAAAAAH', '😾', 'estirar+quemar', 'impact'),  # antes: ¡SALÍ DE MI CAMA!
        ('7e338f19-62ab-4994-a750-3bd32db61d43', 'aiuda', '😱', 'ojo', 'comic'),  # antes: ¡AAAAAH!
        ('c59f2c6e-b1da-40a1-a5e6-10f63ae22c31', 'quién tocó mi comida', '😡', 'quemar', 'tira'),  # antes: ¿QUIÉN TOCÓ MI COMIDA?
        ('d1c793b3-7f95-4d3a-85a0-bc92ebd893a5', 'ni se te ocurra', '🙅', 'aplastar', 'comic'),  # antes: NI SE TE OCURRA
        ('89b3f066-3fab-46db-9d19-f7ff6823924f', 'quién se comió mi milanesa', '🦁', 'ojo', 'tira'),  # antes: ¿QUIÉN SE COMIÓ MI MILANESA?
        ('c8a9e749-a14b-4c14-a617-e1026e7a3dd3', 'RESPETÁ LA FILA', '😤', 'quemar', 'impact'),  # antes: ¡RESPETÁ LA FILA!
    ]),
    ('gatos', 'Gatos con actitud', 'Los dueños de la casa', 'ar', 'gato gatos michi actitud', [
        ('a1331369-4681-4ae6-b47a-db6e4ba14d15', 'domingo modo off', '😴', 'trucha', 'comic'),  # antes: DOMINGO, NO MOLESTAR
        ('b15ef325-8717-4fec-b82e-b433255af30a', 'te estoy juzgando', '🤨', 'aplastar', 'comic'),  # antes: TE ESTOY JUZGANDO
        ('db8a16c9-dd23-4a5f-b1e3-b3e83cdd27d1', 'no estoy, decile q no estoy', '🙈', 'nada', 'tira'),  # antes: NO ESTOY DECILE QUE NO ESTOY
        ('19d96b4d-d692-4bc5-afef-433a2a469d60', 'el rey de la casa', '👑', 'nada', 'comic'),  # antes: EL REY DE LA CASA
        ('f73c2d6b-c6f6-40f2-b809-b0ae45ac7225', 'pov: cobraste el aguinaldo', '💸', 'quemar', 'tira'),  # antes: COBRÉ EL AGUINALDO
        ('6e1904ec-ed11-4d11-b2e8-1da58d4d7c57', '._.xD', '😳', 'trucha+aplastar', 'comic'),  # antes: ¿ME HABLÁS A MÍ?
        ('84f906dc-b0e8-43d9-afa3-151d42bb38ae', 'ya se fue la visita?', '👀', 'ojo', 'comic'),  # antes: ¿YA SE FUE LA VISITA?
        ('e9140acc-ee67-4e48-8556-458e29fd689c', 'me prestás las zapas?', '👟', 'nada', 'comic'),  # antes: ¿ME PRESTÁS LAS ZAPAS?
        ('ede2ee85-cbe2-4d36-9d99-3d0f252c0405', 'modo ahorro de energía', '🔋', 'trucha', 'comic'),  # antes: MODO AHORRO DE ENERGÍA
        ('fc8d60b4-c999-491e-a391-a1902f410964', 'KHÉ', '🥺', 'ojo', 'impact'),  # antes: ¿ME DAS?
        ('f6b63f32-3b54-42ce-aa2c-272a39c3eb97', 'a dieta desde el lunes xd', '🍈', 'nada', 'tira'),  # antes: A DIETA DESDE EL LUNES
        ('1bd9788b-9ba2-477c-899b-e95903f1ac6f', 'acá laburando re duro', '💻', 'aplastar', 'comic'),  # antes: ACÁ, LABURANDO
        ('384938d5-ff2a-46ce-b495-fbc95170ed19', 'desayuno en familia uwu', '🥛', 'quemar', 'comic'),  # antes: DESAYUNO EN FAMILIA
    ]),
    ('perros', 'Perros de la cuadra', 'Los que mandan en el barrio', 'ar', 'perro perros firulais barrio', [
        ('0dbdc9dc-d90b-493f-9ba3-77ea55bd9190', 'no pregunten', '🙃', 'quemar', 'comic'),  # antes: NO PREGUNTEN
        ('1c33dddf-e5e9-4514-af8c-219924278eb1', 'nadando en deudas', '💸', 'trucha', 'comic'),  # antes: NADANDO EN DEUDAS
        ('31627bfd-0906-490b-9f8b-c82739152408', 'yo cuando huelo el asado del vecino', '🍖', 'ojo', 'tira'),  # antes: ¿HAY ASADO?
        ('46a127f5-c385-49a5-bd52-b2615571e766', 'VOY DE INCÓGNITO', '🥸', 'quemar', 'impact'),  # antes: TRANQUI VOY DE INCÓGNITO
        ('4abb2437-5da9-486e-aa44-94f8633c9a8b', 'llegó el delivery!!', '🏃', 'ancho', 'comic'),  # antes: ¡LLEGÓ EL DELIVERY!
        ('53623ffd-32e5-4657-a822-febed89d451f', 'q comés', '👃', 'ojo', 'comic'),  # antes: ¿QUÉ ESTÁS COMIENDO?
        ('7aafe81b-743d-4382-af4b-869b5e88a7da', 'NASHE', '🥳', 'ojoq', 'impact'),  # antes: ¡ES VIERNES!
        ('ad69635d-90b4-436b-b6bf-dc2bf798dbed', 'dijeron milanesa?', '😮', 'ojo', 'comic'),  # antes: ¿DIJERON MILANESA?
        ('afcd4a24-68cc-46dd-9da4-6daaa9a5296e', 'paz interior', '😌', 'trucha', 'comic'),  # antes: PAZ INTERIOR
        ('cb5971d5-bc58-450b-9d06-e478de96f770', 'vacaciones modo on', '🏖️', 'nada', 'comic'),  # antes: VACACIONES MODO ON
        ('cf82aa2c-b637-471c-9010-9dbc1ea67805', 'vamos a la plaza?', '🐕', 'aplastar', 'comic'),  # antes: ¿VAMOS A LA PLAZA?
        ('d07a6177-ac13-4fcf-b52a-dae45dd1fa85', 'yo viendo el precio del dólar', '😞', 'aplastar', 'tira'),  # antes: YO VIENDO EL PRECIO DEL DÓLAR
        ('0ece779c-cdfd-4128-af7d-d51ad6da8d67', 'q calor loco', '🥵', 'quemar', 'comic'),  # antes: QUÉ CALOR, LOCO
        ('52302f7a-87cc-40e8-b325-d79e1760fca8', 'q rico estaba', '😋', 'ojo', 'comic'),  # antes: QUÉ RICO ESTABA
        ('995f6e3e-2850-4af7-b7f4-04564cb0d3e9', 'holi', '👋', 'ojo', 'comic'),  # antes: ¡HOLA, HOLA!
        ('97da0dc8-1e30-4863-8547-e9dcbce05760', 'me das un poquito?', '🥺', 'ojo', 'comic'),  # antes: ¿ME DAS UN POQUITO?
        ('bce6395d-28de-4eb0-ab26-0c5ea4349b09', 'perdón fui yo :(', '😔', 'trucha', 'comic'),  # antes: PERDÓN, FUI YO
        ('81d2fe24-9c26-4de6-8a04-f342d0778690', 'LLEGUÉ, BAJEN', '🚗', 'quemar', 'impact'),  # antes: LLEGUÉ, BAJEN YA
        ('d24c97fb-0be0-4a29-b0b0-eb00cfacef36', 'estudiando para el parcial', '📚', 'nada', 'tira'),  # antes: ESTUDIANDO PARA EL PARCIAL
        ('1d5fcd90-dba0-407b-977b-06c363178dce', 'sin ganas de nada', '😑', 'ancho', 'comic'),  # antes: SIN GANAS DE NADA
    ]),
    ('pugs', 'Pugs dramáticos', 'Cara de tragedia', 'ar', 'pug bulldog drama perro', [
        ('123a1626-77ad-4c7f-97ad-89d8fe810de0', 'xq me hacés esto', '🥺', 'ojo', 'comic'),  # antes: ¿POR QUÉ ME HACÉS ESTO?
        ('2a66c4ca-3332-4e40-a668-6d432ceb9b0c', 'q frío, no salgo', '🥶', 'nada', 'comic'),  # antes: QUÉ FRÍO, NO SALGO
        ('32eb7522-5527-4453-a37e-ce511e42dcba', 'te estoy mirando', '👀', 'aplastar', 'comic'),  # antes: TE ESTOY MIRANDO
        ('47f595c8-24ed-4263-89a1-07a04e624413', 'invierno sos vos?', '❄️', 'trucha', 'comic'),  # antes: INVIERNO, ¿SOS VOS?
        ('70cc0742-c17c-481d-bc44-181557ed3d32', 'hoy no me levanto', '🛌', 'nada', 'comic'),  # antes: HOY NO ME LEVANTO
        ('86b5f2e8-2cc8-44a8-ba3e-147cf3a3600e', 'fue un año difícil', '😔', 'quemar', 'comic'),  # antes: FUE UN AÑO DIFÍCIL
        ('f45a6e46-519c-42dd-a903-a64c383938b8', 'FELIZ CUMPLE', '🎉', 'quemar', 'impact'),  # antes: ¡FELIZ CUMPLE!
        ('f655fe53-42e5-4e24-9e2b-815f5aca64ac', 'toi triste :(', '😩', 'ancho', 'comic'),  # antes: LUNES OTRA VEZ
        ('ed025ab2-b12b-44d4-8391-f6513f95ebe4', 'no fuimos nosotros', '😇', 'nada', 'comic'),  # antes: NO FUIMOS NOSOTROS
        ('ffffe14f-86d7-4408-966a-d5747062cbb4', 'c rompió solo', '🙈', 'trucha', 'comic'),  # antes: SE ME ROMPIÓ SOLO
        ('54be7d75-2dc0-48cc-9381-09d1f835dded', 'cómo q no?', '😠', 'ojo', 'comic'),  # antes: ¿CÓMO QUE NO?
    ]),
    ('siestas', 'Siestas y buenas noches', 'Para el grupo de la familia', 'ar', 'dormir siesta buenas noches sueño', [
        ('b86db915-eecf-4e7e-8875-74aae14016eb', 'a mimir', '😴', 'trucha', 'comic'),  # antes: CINCO MINUTITOS MÁS
        ('1097c9d6-fd0b-4eb2-af84-8249acd61ff4', 'no estoy para nadie', '🙅', 'nada', 'comic'),  # antes: NO ESTOY PARA NADIE
        ('397cc745-ef07-4003-a3e7-00be3708cec9', 'buenas noches', '🌙', 'quemar', 'comic'),  # antes: BUENAS NOCHES
        ('441a4792-c705-4cc2-9907-af9e78f139d7', 'dormí como un bebé', '👶', 'nada', 'comic'),  # antes: DORMÍ COMO UN BEBÉ
        ('60ea223e-130f-4aef-9462-a3107cc6939e', 'me quedé dormido', '⏰', 'trucha', 'comic'),  # antes: ME QUEDÉ DORMIDO
        ('6e7c0aaf-421d-4817-ae68-bf5d20c5a826', 'mi lugar favorito', '🧺', 'nada', 'comic'),  # antes: MI LUGAR FAVORITO
        ('870994d5-a553-44ce-94d3-3cf647817584', 'no me despierten', '🤫', 'nada', 'comic'),  # antes: NO ME DESPIERTEN
        ('bf1f69a0-bfdc-4c69-b8ae-8d44b2cd3b99', 'siesta de domingo', '💤', 'quemar', 'comic'),  # antes: SIESTA DE DOMINGO
        ('d6dc6a10-8f53-4dab-9002-7a5026ca1279', 'hasta mañana uwu', '✨', 'nada', 'comic'),  # antes: HASTA MAÑANA
        ('a7a7f30a-20c7-4fe3-a53c-10003c8b7d23', 'tirado al sol', '☀️', 'ancho', 'comic'),  # antes: TIRADO AL SOL
        ('dad9205e-52ae-4618-9c0b-e59249db41a4', 'modo bolita', '🦔', 'ojo', 'comic'),  # antes: MODO BOLITA
        ('543294cc-aa1c-40f2-93c1-b020edf0b1fd', 'no me puedo levantar', '😩', 'aplastar', 'comic'),  # antes: NO ME PUEDO LEVANTAR
        ('dd8ee631-2df5-4589-a206-0ce3f07ce215', 'siesta en pareja', '💑', 'nada', 'comic'),  # antes: SIESTA EN PAREJA
    ]),
    ('criollos', 'Carpinchos y bichos de acá', 'Fauna argenta', 'ar', 'carpincho pinguino hornero tero fauna', [
        ('a5ee9747-0dc3-4422-afcf-f9f626364763', 'c pudrió todo', '🛁', 'ojoq', 'comic'),  # antes: RECIÉN BAÑADO, ¿QUÉ TAL?
        ('e95d76ac-87fd-470e-b834-5e8f3ce1bd71', 'tranqui, acá flotando', '😌', 'nada', 'comic'),  # antes: TRANQUI, ACÁ FLOTANDO
        ('eb8072ff-18ab-4cc4-bf3a-0d094732603b', 'llegué, q me perdí?', '🙋', 'ojo', 'comic'),  # antes: LLEGUÉ ¿QUÉ ME PERDÍ?
        ('7082b322-f111-4fc4-a073-b5391c96dbde', 'laburando en la casa', '🏠', 'nada', 'comic'),  # antes: LABURANDO EN LA CASA
        ('f60d7fc6-91dc-4e5c-9c73-45de549a76fe', 'q mirás', '🤨', 'ojo', 'comic'),  # antes: ¿QUÉ MIRÁS?
        ('885a768c-7c85-4dbb-97c6-0151370fa45c', 'hace frío o es idea mía', '🥶', 'nada', 'comic'),  # antes: ¿HACE FRÍO O ES IDEA MÍA?
        ('b812b299-8888-43a7-8659-fc09af0a5a30', 'ola? ¿fábrica de carpinchos?|c les escapó uno', '🐧', 'lentes:96,72,150', 'tira'),  # antes: VENGO DEL SUR
        ('d69bdc03-0b36-48d9-b01e-c525c8c1f81a', 'y el bondi?', '🚌', 'ojo', 'comic'),  # antes: ¿Y EL BONDI?
        ('d6941e5b-106a-4d95-a22b-fb007d03a7cd', 'a ver a ver', '👀', 'estirar', 'comic'),  # antes: A VER, A VER...
        ('526e69b0-f33a-4cbd-b05f-646b5f5d0a0a', 'no estoy, me escondí', '🙈', 'nada', 'comic'),  # antes: NO ESTOY, ME ESCONDÍ
        ('3b11f2d0-58f9-469c-b4ad-5e996851bef5', 'bla bla bla', '🦜', 'ojo', 'comic'),  # antes: BLA BLA BLA
        ('08d0548b-c810-4881-9465-b85e4ed9b5b5', 'esto es mío!!', '😤', 'quemar', 'comic'),  # antes: ¡ESTO ES MÍO!
        ('aefd7a0b-f555-4067-8bc9-f5004b92291d', 'AFUERA', '👉', 'quemar', 'impact'),  # antes: ¡AFUERA!
    ]),
    ('mexico', 'México lindo', 'Para los cuates', 'mx', 'mexico ajolote chido wey tacos', [
        ('14a0d848-4d64-4b16-a7f5-41436fb15985', 'q onda wey', '👋', 'ojo', 'comic'),  # antes: ¡QUÉ ONDA!
        ('41bd3cba-b430-4b1e-b613-9d7abbee59ab', 'ahorita voy', '🐢', 'nada', 'comic'),  # antes: AHORITA VOY
        ('76e10091-9554-408d-b749-6f4ef7273059', 'NO MANCHES', '😱', 'ojo', 'impact'),  # antes: ¡NO MANCHES!
        ('ed1074f7-adf1-4178-845e-9e8668f76be8', 'me da flojera', '😴', 'trucha', 'comic'),  # antes: ME DA FLOJERA
        ('c22bfb37-3c85-4555-9744-13ebf17e206d', 'neta?', '🤨', 'ojo', 'comic'),  # antes: ¿NETA?
        ('21dede4f-08fd-4c5e-8be1-3d673e2a22a3', 'bien padre', '😎', 'quemar', 'comic'),  # antes: BIEN PADRE
        ('a170c6ca-84c2-4199-a106-514f8d484927', 'unos taquitos?', '🌮', 'nada', 'comic'),  # antes: ¿UNOS TAQUITOS?
        ('99be1351-640e-481c-ada8-acd3e16ce725', 'órale', '🐦', 'nada', 'comic'),  # antes: ¡ÓRALE!
    ]),
    ('andes', 'Perú y los Andes', '¡Asu mare!', 'pe', 'peru llama alpaca cuy causa', [
        ('1049d235-fadb-48c9-8b53-f413f4d85616', 'ya pe', '😒', 'aplastar', 'comic'),  # antes: ¿YA PE?
        ('530371fc-c046-424d-85c0-970c9b8594e7', 'KHÉ', '😱', 'ojo', 'impact'),  # antes: ¡ASU MARE!
        ('1a24cb86-d029-49f3-87c6-b637c5b394b6', 'compartir es amar uwu', '❤️', 'nada', 'comic'),  # antes: COMPARTIR ES AMAR
        ('2c24e2d9-8f9d-4110-91e5-6fbf991c21a5', 'chévere', '😄', 'ojo', 'comic'),  # antes: ¡CHÉVERE!
        ('d5dbe6b5-708c-489f-ace9-40cb08526dc5', 'qué fue, causa', '🐹', 'ojo', 'comic'),  # antes: ¿QUÉ FUE, CAUSA?
        ('511d7131-3857-4fb6-8f24-09d878ed5e91', 'todo bien', '👍', 'nada', 'comic'),  # antes: TODO BIEN
        ('774e0c70-0a58-4c20-a539-fe54774aa58c', 'tengo hambre', '🥬', 'trucha', 'comic'),  # antes: TENGO HAMBRE
        ('ddc9c224-7ffb-42d3-8aad-59abea0e3681', 'está buenazo', '😋', 'nada', 'comic'),  # antes: ¡ESTÁ BUENAZO!
        ('b897a728-e83e-4403-8e75-aaf3c2a94cf2', 'acá en la sierra', '🏔️', 'nada', 'comic'),  # antes: ACÁ EN LA SIERRA
        ('3cca215d-d1c6-4c42-b161-b6431bf6d22b', 'me llevás?', '🚗', 'ojo', 'comic'),  # antes: ¿ME LLEVÁS?
    ]),
    ('colombia', 'Colombia parce', '¡Qué bacano!', 'co', 'colombia parce bacano tucan', [
        ('5bb69d15-6c36-4783-8235-1679050becfe', 'qué bacano', '😄', 'nada', 'comic'),  # antes: ¡QUÉ BACANO!
        ('278d4588-4845-45ff-80af-5e355632d5ed', 'quiubo parce', '👋', 'ojo', 'comic'),  # antes: ¡QUIUBO, PARCE!
        ('6eb7cfea-0b0f-4b25-8615-985bcd1ba672', 'HÁGALE', '💪', 'quemar', 'impact'),  # antes: ¡HÁGALE!
        ('bcad8b5e-f728-4862-bb70-d755671dd556', 'sí o qué', '🤔', 'nada', 'comic'),  # antes: ¿SÍ O QUÉ?
        ('b19f7f4d-5d40-4592-bf7b-6e67f428febe', 'tranquilo parce', '😌', 'nada', 'comic'),  # antes: TRANQUILO, PARCE
        ('3c5222b1-5a60-469e-85e2-c5f08d45b7ec', 'todo al revés', '🙃', 'nada', 'comic'),  # antes: TODO AL REVÉS
        ('acd31fe7-aa3a-49a1-9964-0bab84a83036', 'una arepita?', '🫓', 'nada', 'comic'),  # antes: ¿UNA AREPITA?
        ('7d2d6235-b32a-4471-a7e5-61cfcf395e24', 'qué nota', '🎶', 'ojo', 'comic'),  # antes: ¡QUÉ NOTA!
    ]),
    ('venezuela', 'Venezuela chamo', '¡Épale!', 've', 'venezuela chamo pana chevere', [
        ('917bca84-be41-4b24-b422-779d6df997cc', 'épale chamo', '👋', 'nada', 'comic'),  # antes: ¡ÉPALE, CHAMO!
        ('e807b66b-bd14-4586-a57d-be515951612e', 'qué ladilla', '😒', 'quemar', 'comic'),  # antes: ¡QUÉ LADILLA!
        ('e56808eb-f836-45b6-9a9c-74f50f866fa0', 'chévere', '😄', 'ojo', 'comic'),  # antes: ¡CHÉVERE!
        ('cc71a876-eb8e-4560-a05b-5779f42bf34e', 'VÁLGAME', '😱', 'estirar', 'impact'),  # antes: ¡VÁLGAME!
        ('e8cedbc2-904e-426d-9d86-99e4035eb7c8', 'huelo tequeños', '👃', 'nada', 'comic'),  # antes: HUELO TEQUEÑOS
        ('36df1dd9-8a3a-4d07-8967-37ffc49a7c9e', 'pana me llevás', '🎒', 'nada', 'comic'),  # antes: PANA, ¿ME LLEVÁS?
    ]),
    ('chile', 'Chile po', 'Al tiro', 'cl', 'chile cachai po bacan', [
        ('20765ed8-53fc-4a8d-8fe7-2c51250e6175', 'chuta', '😮', 'ojo', 'comic'),  # antes: ¡CHUTA!
        ('07222290-4acb-454b-ba95-34231c5d0d19', 'bacán', '😎', 'nada', 'comic'),  # antes: BACÁN
        ('6b13d6bc-5bd9-46c0-b580-7ac1b64da1c7', 'al tiro!!', '⚡', 'quemar', 'comic'),  # antes: ¡AL TIRO!
        ('a22f5f0b-d035-40a4-bed2-329ff0fbef68', 'ola k ase', '🤔', 'espejo', 'comic'),  # antes: ¿CACHAI?
        ('bb55c1bb-bd1c-4068-9c90-e3f3f2cd4a19', 'qué lata', '😩', 'aplastar', 'comic'),  # antes: QUÉ LATA
        ('182f599f-d04e-440e-b175-a290e68bdd6f', 'ya po', '🙄', 'nada', 'comic'),  # antes: YA PO
    ]),
    ('uruguay', 'Uruguay bo', 'Ta, de más', 'uy', 'uruguay bo ta de mas', [
        ('35cb5877-ec71-4bd0-b6f1-fd13bd86fa78', 'TA', '👍', 'nada', 'impact'),  # antes: ¡TA!
        ('1310cadf-1436-4e3c-b48e-631e56bd8047', 'bo, todo bien?', '🙋', 'nada', 'comic'),  # antes: BO, ¿TODO BIEN?
        ('05d1dc62-0465-40d6-bbee-78d0ba7a0041', 'tremendo', '😮', 'ancho', 'comic'),  # antes: TREMENDO
        ('dcfc29c6-b6ae-404b-8bc1-ef6e848064e7', 'de más', '🤩', 'nada', 'comic'),  # antes: DE MÁS
    ]),
    ('burros', 'Burros y caballos', 'Pura cara', 'ar', 'burro caballo campo cara', [
        ('167c8bb4-bdb8-40d7-98d4-8a8376b26ac1', 'q me vendés', '🤨', 'ojo', 'comic'),  # antes: ¿QUÉ ME VENDÉS?
        ('44d840b2-eff1-4753-9a50-25ad95e6444c', 'me quedó clarísimo', '🙄', 'nada', 'comic'),  # antes: ME QUEDÓ CLARÍSIMO
        ('508f950f-583f-4bc4-81b7-99b793ff66d3', 'hay alguien?', '👀', 'ojo', 'comic'),  # antes: ¿HAY ALGUIEN?
        ('a865fb3e-79ea-43fa-953c-2cfb1a5f598e', 'te estoy escuchando', '👂', 'quemar', 'comic'),  # antes: TE ESTOY ESCUCHANDO
        ('c418d956-e02f-47c1-b7e0-9901f5e46e0e', 'presente profe', '🙋', 'nada', 'comic'),  # antes: PRESENTE, PROFE
        ('1bb3435b-6639-4a53-899e-e7e1689a917b', 'bro q', '😛', 'ojo', 'comic'),  # antes: ¡BLEH!
        ('23dcbcda-6e1c-4413-8f3f-5e2d0c169047', 'ja ja q gracioso', '😒', 'aplastar', 'comic'),  # antes: JA, JA. QUÉ GRACIOSO
        ('6b88397e-a3aa-425b-a714-d485afcb9036', 'recién salido de la pelu', '💇', 'nada', 'tira'),  # antes: RECIÉN SALIDO DE LA PELU
        ('2572b917-d8e8-4b89-844f-e74ebb24f21e', 'no escuché nada', '🙉', 'nada', 'comic'),  # antes: NO ESCUCHÉ NADA
        ('15de17d6-1d00-470b-acb2-db6433ff342e', 'todo bien y vos?', '🙂', 'trucha', 'comic'),  # antes: TODO BIEN, ¿Y VOS?
    ]),
    ('granja', 'La granja', 'Del campo al grupo', 'ar', 'campo granja gallo pato cabra', [
        ('bbfe2dcc-0096-42ff-bd34-96606ae6929e', 'q lindo día', '🌞', 'ojo', 'comic'),  # antes: ¡QUÉ LINDO DÍA!
        ('e1f4ab5e-2952-4b35-847c-af4f1ca1bb98', 'q hacen vecinos', '👀', 'nada', 'comic'),  # antes: ¿QUÉ HACEN, VECINOS?
        ('38eadeb7-dc8f-4ac5-8964-f5cd14827db4', 'me enteré de todo', '🤭', 'nada', 'comic'),  # antes: ME ENTERÉ DE TODO
        ('a3b26226-d5d7-4444-b9a9-fd829e178203', 'arriba q son las 6', '🐓', 'ojo', 'tira'),  # antes: ¡ARRIBA, QUE SON LAS 6!
        ('c3e34e30-997b-49a2-aada-c4f11d873280', 'QUIQUIRIQUÍ', '📣', 'quemar', 'impact'),  # antes: ¡QUIQUIRIQUÍ!
        ('314d669a-250f-4185-8557-8e0fa5604a53', 'paso paso', '🚶', 'ancho', 'comic'),  # antes: PASO, PASO
        ('fbc8c993-4797-4b1c-ac94-76f59112a6f9', 'te gusta mi pico nuevo?', '💅', 'nada', 'comic'),  # antes: ¿TE GUSTA MI PICO NUEVO?
        ('dbd635ce-632d-4f13-8f08-12a0c5298f29', 'de vacaciones', '🏖️', 'nada', 'comic'),  # antes: DE VACACIONES
        ('09e10985-f362-4f36-901b-cd004228ed46', 'colorado de la vergüenza', '😳', 'quemar', 'comic'),  # antes: COLORADO DE LA VERGÜENZA
    ]),
    ('pajaros', 'Búhos y loros', 'Chusmas profesionales', 'ar', 'buho loro pajaro chusma', [
        ('3aa96fbc-4ca9-4fb1-ac50-e0f00cd5e6b3', 'no soy de mañana', '😑', 'aplastar', 'comic'),  # antes: NO SOY DE MAÑANA
        ('646a05dd-9b16-43b4-90c5-fa5a0cbeb106', 'TE VI', '👁️', 'ojo', 'impact'),  # antes: TE VI
        ('80a9a9ca-895f-4061-83ee-55745d8e95a2', 'ola?', '👋', 'nada', 'comic'),  # antes: ¿HOLA?
        ('ab3447db-867b-4210-b836-425d166ec0d2', 'quién anda ahí', '🕵️', 'nada', 'comic'),  # antes: ¿QUIÉN ANDA AHÍ?
        ('04853d69-8efb-4be7-aa4f-4746f433a0d9', 'noche larga', '🌙', 'trucha', 'comic'),  # antes: NOCHE LARGA
        ('95909394-f2e6-4e54-a2fe-222ba4ddc459', 'en serio?', '🤨', 'ojo', 'comic'),  # antes: ¿EN SERIO?
        ('acda132e-9fe8-40b2-b169-a18be817fac0', 'alegría', '🌈', 'quemar', 'comic'),  # antes: ¡ALEGRÍA!
        ('77616130-f117-4972-a32e-cd4706d01680', 'chusmeando', '🗣️', 'nada', 'comic'),  # antes: CHUSMEANDO
        ('446d32cc-6d9c-498c-b09c-406c867e1fb0', 'viste lo q pasó?', '😮', 'nada', 'comic'),  # antes: ¿VISTE LO QUE PASÓ?
        ('3b7c1b0b-2fa5-42ea-b7dd-9ac5e2999f06', 'soltá eso', '✋', 'nada', 'comic'),  # antes: SOLTÁ ESO
    ]),
    ('bichos', 'Bichos varios', 'Reacciones al toque', 'ar', 'reacciones hamster mapache rana mono', [
        ('07f7d407-7f46-4533-93ab-643511d0b4e8', 'hay lugar?', '🤔', 'ojo', 'comic'),  # antes: ¿HAY LUGAR?
        ('a7401254-dd93-4f5b-b3b1-f037f9b8cca1', 'porfis', '🙏', 'nada', 'comic'),  # antes: PORFIS
        ('ff808925-119c-423d-9128-881e62f8957f', 'aiuda', '😨', 'ojo', 'comic'),  # antes: ¡SOCORRO!
        ('aa1ec647-8eb9-4388-aa61-5eb3c0fd41b6', 'el pepe', '🐸', 'ojoq', 'comic'),  # antes: ¿QUÉ PASA, AMIGO?
        ('151a3795-e432-43aa-bd20-8129f01e6eac', 'acá de chill', '😎', 'nada', 'comic'),  # antes: ACÁ, DE CHILL
        ('903799c6-860d-41e9-8061-12fbaa186ce3', 'estoy pensando', '🤔', 'aplastar', 'comic'),  # antes: ESTOY PENSANDO
        ('5cdeb536-6869-442d-93ed-e341121fd7ba', 'ni idea', '🤷', 'nada', 'comic'),  # antes: NI IDEA
        ('2abbb321-913c-469d-9a2d-79e437f88f66', 'nos vieron?', '👀', 'nada', 'comic'),  # antes: ¿NOS VIERON?
        ('8d570bc9-146f-4cbd-a594-9186f022f742', 'no viste nada', '🤫', 'trucha', 'comic'),  # antes: NO VISTE NADA
        ('d393c92a-f160-4fb4-ba95-3823541ef1e9', 'voy para tu casa', '🏃', 'nada', 'comic'),  # antes: VOY PARA TU CASA
        ('89375c41-8fa3-41d4-9356-b23685be98d6', 'no me toques', '🦔', 'ojo', 'comic'),  # antes: NO ME TOQUES
        ('e945263d-9b90-4b81-84db-d23b1ad34138', 'esto es mío', '🥜', 'nada', 'comic'),  # antes: ESTO ES MÍO
        ('84c1e26b-345f-43f5-a234-a7176ccbb068', 'ah re', '👂', 'nada', 'comic'),  # antes: TE ESCUCHO
    ]),
    ('amor', 'Bichos enamorados', 'Para mandarle a esa persona', 'ar', 'amor chamuyo te quiero', [
        ('dd9f6326-e67e-4c52-af09-f1181dcb2bff', 'mi persona favorita', '🫶', 'nada', 'comic'),  # antes: MI PERSONA FAVORITA
        ('bf194a98-209e-46e0-aab2-918856f55399', 'te cuido uwu', '🤗', 'nada', 'comic'),  # antes: TE CUIDO
        ('cd2a03f9-f5e9-4df4-ae60-c1faf34ac4bf', 'muac', '😘', 'nada', 'comic'),  # antes: MUAC
        ('915035dd-1240-4df7-957c-2f02d1d76241', 'juntitos', '🥰', 'nada', 'comic'),  # antes: JUNTITOS COMO DEBE SER
        ('86c8075e-6da4-4bd2-8c7b-8dc66dc3dd6f', 'te quiero mucho', '❤️', 'nada', 'comic'),  # antes: TE QUIERO MUCHO
    ]),
    ('morfi', 'El morfi', 'Con hambre no se piensa', 'ar', 'comida morfi empanada facturas pizza helado', [
        ('5cc777b5-fb88-4ad2-918a-46a782e25609', 'se arma?', '🥟', 'nada', 'comic'),  # antes: ¿SE ARMA?
        ('06dbfe4f-0902-47ae-9f57-8cc46bc992c7', 'hay facturas?', '🥐', 'nada', 'comic'),  # antes: ¿HAY FACTURAS?
        ('2898eab5-54fe-4cb8-9e24-7df0270f0fc0', 'de manteca, por favor', '🧈', 'quemar', 'comic'),  # antes: DE MANTECA, POR FAVOR
        ('b4bd7ade-69b3-48f6-9800-183e002f7931', 'desayuno de campeones', '☕', 'nada', 'comic'),  # antes: DESAYUNO DE CAMPEONES
        ('51942343-468e-4e19-8afc-84fb223a69fc', 'pizza, peli y manta', '🍕', 'nada', 'comic'),  # antes: PIZZA, PELI Y MANTA
        ('90b6f7e1-ed7b-4929-ac2b-43d79ab02693', 'una porción más y listo', '😋', 'ojo', 'comic'),  # antes: UNA PORCIÓN MÁS Y LISTO
        ('a0ee9df0-3aa6-4ac5-b055-406947c1fc6f', 'HELADO', '🍦', 'quemar', 'impact'),  # antes: ¡HELADO!
        ('226eb0a8-5afd-4612-a13f-e975e627b6da', 'el postre no se negocia', '🍨', 'nada', 'comic'),  # antes: EL POSTRE NO SE NEGOCIA
    ]),
    ('fiestas', 'Fiestas', 'Navidad y Año Nuevo', 'ar', 'navidad fiestas año nuevo', [
        ('0441d894-a867-474b-8133-567f4bdfbf2e', 'ya terminó el año?', '🎄', 'nada', 'comic'),  # antes: ¿YA TERMINÓ EL AÑO?
        ('1bae9ff3-a515-449b-9447-8b501f8e8e9e', 'feliz navidad', '🎅', 'ojo', 'comic'),  # antes: ¡FELIZ NAVIDAD!
        ('f87d881f-f6ae-4791-b4a7-20f281765d09', 'jo jo jo', '🐴', 'nada', 'comic'),  # antes: JO, JO, JO
    ]),
]
