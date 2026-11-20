# Los memes de Stickerazo: qué foto libre (id de Openverse, CC0 o dominio público) va en cada uno y su texto.
# Lo arma herramientas/memes_libres.py (armar). Los packs salen en la app como «packs listos» (se pueden cambiar).
# (pack, nombre, descripción, país, etiquetas, [(id de la foto, texto de arriba, texto de abajo, emoji, xD)])
PACKS = [
    ('gritos', 'Gatos al grito', 'Todo es una tragedia', 'ar', 'gato gatos michi grito drama', [
        ('4daae21d-0d31-4244-b579-265a1a8350e6', '¿¡CÓMO QUE', 'SE CORTÓ LA LUZ!?', '😱', 1),  # nature_animal_cat_010
        ('fd884ba3-d71d-4f07-a319-60104638ab20', '', 'NOOO, EL LUNES NO', '😩', 0),  # Tabby cat yawning close-up shot
        ('6698c574-8c40-48bc-b4cd-15886a33bb91', 'CUANDO TE DICEN', '«TENEMOS QUE HABLAR»', '😨', 0),  # 
        ('0ae33e34-5909-46a7-b10e-200f11c6b57d', '¿CÓMO QUE NO', 'HAY DULCE DE LECHE?', '😤', 0),  # Silent roar
        ('0d369815-9cef-457e-bb5c-257f7b987ff6', '', 'CUANDO SUENA LA ALARMA', '⏰', 0),  # Cat yawning lying cement floor
        ('4c70a3a8-8cd2-427b-b5e8-427bf8bde8b8', '', '¡ME TENÉS PODRIDO!', '😠', 0),  # 
        ('5a2bc170-d8f8-41ba-b31d-139a57a51e18', '', 'BOSTEZO DE LUNES', '🥱', 0),  # Sun lit gray haired cat
        ('7215dc6e-676f-4cb3-baf7-3ad0e6f2c07c', '', 'NO DOY MÁS', '😫', 0),  # African Lion
        ('7b554631-138d-4bd1-b4e6-63b1d905f9d5', '', '¡SALÍ DE MI CAMA!', '😾', 0),  # Calico cat yawning
        ('7e338f19-62ab-4994-a750-3bd32db61d43', '', '¡AAAAAH!', '😱', 1),  # Yawning striped cat background
        ('c59f2c6e-b1da-40a1-a5e6-10f63ae22c31', '¿QUIÉN TOCÓ', 'MI COMIDA?', '😡', 0),  # Cat yawning, domestic pet animal
        ('d1c793b3-7f95-4d3a-85a0-bc92ebd893a5', '', 'NI SE TE OCURRA', '🙅', 0),  # nature_animal_cat_005
        ('89b3f066-3fab-46db-9d19-f7ff6823924f', '¿QUIÉN SE COMIÓ', 'MI MILANESA?', '🦁', 0),  # Male lion yawn, carnivore wildlife
        ('c8a9e749-a14b-4c14-a617-e1026e7a3dd3', '', '¡RESPETÁ LA FILA!', '😤', 0),  # Lynx, wild cat background
    ]),
    ('gatos', 'Gatos con actitud', 'Los dueños de la casa', 'ar', 'gato gatos michi actitud', [
        ('a1331369-4681-4ae6-b47a-db6e4ba14d15', '', 'DOMINGO, NO MOLESTAR', '😴', 0),  # 2011-05-02_13-59-19_Amis_Mr_Pig_JH
        ('b15ef325-8717-4fec-b82e-b433255af30a', '', 'TE ESTOY JUZGANDO', '🤨', 0),  # the cat is lying in a chair
        ('db8a16c9-dd23-4a5f-b1e3-b3e83cdd27d1', 'NO ESTOY', 'DECILE QUE NO ESTOY', '🙈', 0),  # Pat under the blanket
        ('19d96b4d-d692-4bc5-afef-433a2a469d60', '', 'EL REY DE LA CASA', '👑', 0),  # 2024-12-20_16-02-40_CZ_PRG_Tutankhamun_e
        ('f73c2d6b-c6f6-40f2-b809-b0ae45ac7225', '', 'COBRÉ EL AGUINALDO', '💸', 0),  # A Cat Sitting On Money
        ('6e1904ec-ed11-4d11-b2e8-1da58d4d7c57', '', '¿ME HABLÁS A MÍ?', '😳', 0),  # Cat Kitten
        ('84f906dc-b0e8-43d9-afa3-151d42bb38ae', '', '¿YA SE FUE LA VISITA?', '👀', 0),  # Kitten Animal
        ('e9140acc-ee67-4e48-8556-458e29fd689c', '', '¿ME PRESTÁS LAS ZAPAS?', '👟', 0),  # Kitten likes shoes.
        ('ede2ee85-cbe2-4d36-9d99-3d0f252c0405', '', 'MODO AHORRO DE ENERGÍA', '🔋', 0),  # Cat Kitten
        ('fc8d60b4-c999-491e-a391-a1902f410964', '', '¿ME DAS?', '🥺', 0),  # Free Kitten
        ('f6b63f32-3b54-42ce-aa2c-272a39c3eb97', '', 'A DIETA DESDE EL LUNES', '🍈', 0),  # Cataloupe
        ('1bd9788b-9ba2-477c-899b-e95903f1ac6f', '', 'ACÁ, LABURANDO', '💻', 0),  # the cat is lying in a chair
        ('384938d5-ff2a-46ce-b495-fbc95170ed19', '', 'DESAYUNO EN FAMILIA', '🥛', 0),  # Three kittens
    ]),
    ('perros', 'Perros de la cuadra', 'Los que mandan en el barrio', 'ar', 'perro perros firulais barrio', [
        ('0dbdc9dc-d90b-493f-9ba3-77ea55bd9190', '', 'NO PREGUNTEN', '🙃', 0),  # 2021/365/296 Uh Oh...
        ('1c33dddf-e5e9-4514-af8c-219924278eb1', '', 'NADANDO EN DEUDAS', '💸', 0),  # Dog swimming river
        ('31627bfd-0906-490b-9f8b-c82739152408', '', '¿HAY ASADO?', '🍖', 1),  # Free close dog's nose image
        ('46a127f5-c385-49a5-bd52-b2615571e766', 'TRANQUI', 'VOY DE INCÓGNITO', '🥸', 0),  # dog wearing disguise mask glasses
        ('4abb2437-5da9-486e-aa44-94f8633c9a8b', '', '¡LLEGÓ EL DELIVERY!', '🏃', 0),  # Brown dog playing grass field
        ('53623ffd-32e5-4657-a822-febed89d451f', '', '¿QUÉ ESTÁS COMIENDO?', '👃', 1),  # Golden Retriever Closeup
        ('7aafe81b-743d-4382-af4b-869b5e88a7da', '', '¡ES VIERNES!', '🥳', 0),  # 
        ('ad69635d-90b4-436b-b6bf-dc2bf798dbed', '', '¿DIJERON MILANESA?', '😮', 1),  # Free funny face doberman puppy
        ('afcd4a24-68cc-46dd-9da4-6daaa9a5296e', '', 'PAZ INTERIOR', '😌', 0),  # Free furry, white, brown beige
        ('cb5971d5-bc58-450b-9d06-e478de96f770', '', 'VACACIONES MODO ON', '🏖️', 0),  # Bulldog sleeping chair
        ('cf82aa2c-b637-471c-9010-9dbc1ea67805', '', '¿VAMOS A LA PLAZA?', '🐕', 0),  # Brown dog playing grass field
        ('d07a6177-ac13-4fcf-b52a-dae45dd1fa85', 'YO VIENDO', 'EL PRECIO DEL DÓLAR', '😞', 0),  # Close face black white dog
        ('0ece779c-cdfd-4128-af7d-d51ad6da8d67', '', 'QUÉ CALOR, LOCO', '🥵', 0),  # Black & brown dog tongue
        ('52302f7a-87cc-40e8-b325-d79e1760fca8', '', 'QUÉ RICO ESTABA', '😋', 0),  # Dog Tongue
        ('995f6e3e-2850-4af7-b7f4-04564cb0d3e9', '', '¡HOLA, HOLA!', '👋', 0),  # Little white dog tongue sticking
        ('97da0dc8-1e30-4863-8547-e9dcbce05760', '', '¿ME DAS UN POQUITO?', '🥺', 0),  # Dog Puppy
        ('bce6395d-28de-4eb0-ab26-0c5ea4349b09', '', 'PERDÓN, FUI YO', '😔', 0),  # Bulldog Puppy
        ('81d2fe24-9c26-4de6-8a04-f342d0778690', '', 'LLEGUÉ, BAJEN YA', '🚗', 0),  # Pug Dog
        ('d24c97fb-0be0-4a29-b0b0-eb00cfacef36', '', 'ESTUDIANDO PARA EL PARCIAL', '📚', 0),  # Dog Sleeping
        ('1d5fcd90-dba0-407b-977b-06c363178dce', '', 'SIN GANAS DE NADA', '😑', 0),  # Dog Sleeping
    ]),
    ('pugs', 'Pugs dramáticos', 'Cara de tragedia', 'ar', 'pug bulldog drama perro', [
        ('123a1626-77ad-4c7f-97ad-89d8fe810de0', '', '¿POR QUÉ ME HACÉS ESTO?', '🥺', 0),  # Free pug dog image
        ('2a66c4ca-3332-4e40-a668-6d432ceb9b0c', '', 'QUÉ FRÍO, NO SALGO', '🥶', 0),  # Pug Dog
        ('32eb7522-5527-4453-a37e-ce511e42dcba', '', 'TE ESTOY MIRANDO', '👀', 0),  # Brown Pug
        ('47f595c8-24ed-4263-89a1-07a04e624413', '', 'INVIERNO, ¿SOS VOS?', '❄️', 0),  # Pug Dog
        ('70cc0742-c17c-481d-bc44-181557ed3d32', '', 'HOY NO ME LEVANTO', '🛌', 0),  # Pug Dog
        ('86b5f2e8-2cc8-44a8-ba3e-147cf3a3600e', '', 'FUE UN AÑO DIFÍCIL', '😔', 0),  # Pug Dog
        ('f45a6e46-519c-42dd-a903-a64c383938b8', '', '¡FELIZ CUMPLE!', '🎉', 0),  # Dog Pug
        ('f655fe53-42e5-4e24-9e2b-815f5aca64ac', '', 'LUNES OTRA VEZ', '😩', 1),  # A Pug.
        ('ed025ab2-b12b-44d4-8391-f6513f95ebe4', '', 'NO FUIMOS NOSOTROS', '😇', 0),  # Free pug dogs image
        ('ffffe14f-86d7-4408-966a-d5747062cbb4', '', 'SE ME ROMPIÓ SOLO', '🙈', 0),  # Dog Puppy
        ('54be7d75-2dc0-48cc-9381-09d1f835dded', '', '¿CÓMO QUE NO?', '😠', 0),  # Dog Puppy
    ]),
    ('siestas', 'Siestas y buenas noches', 'Para el grupo de la familia', 'ar', 'dormir siesta buenas noches sueño', [
        ('b86db915-eecf-4e7e-8875-74aae14016eb', '', 'CINCO MINUTITOS MÁS', '😴', 0),  # Brown Puppy
        ('1097c9d6-fd0b-4eb2-af84-8249acd61ff4', '', 'NO ESTOY PARA NADIE', '🙅', 0),  # Dog Animals
        ('397cc745-ef07-4003-a3e7-00be3708cec9', '', 'BUENAS NOCHES', '🌙', 0),  # Puppy Dog Sleeping Shadow
        ('441a4792-c705-4cc2-9907-af9e78f139d7', '', 'DORMÍ COMO UN BEBÉ', '👶', 0),  # Yorkie Yorkshireterrier
        ('60ea223e-130f-4aef-9462-a3107cc6939e', '', 'ME QUEDÉ DORMIDO', '⏰', 0),  # Shiba dog sleeping living room
        ('6e7c0aaf-421d-4817-ae68-bf5d20c5a826', '', 'MI LUGAR FAVORITO', '🧺', 0),  # Dog Sleeping
        ('870994d5-a553-44ce-94d3-3cf647817584', '', 'NO ME DESPIERTEN', '🤫', 0),  # Dolly Whippet
        ('bf1f69a0-bfdc-4c69-b8ae-8d44b2cd3b99', '', 'SIESTA DE DOMINGO', '💤', 0),  # Free brown dog sleeping couch
        ('d6dc6a10-8f53-4dab-9002-7a5026ca1279', '', 'HASTA MAÑANA', '✨', 0),  # Dog Sleeping
        ('a7a7f30a-20c7-4fe3-a53c-10003c8b7d23', '', 'TIRADO AL SOL', '☀️', 0),  # A juvenile harp seal rests on the beach 
        ('dad9205e-52ae-4618-9c0b-e59249db41a4', '', 'MODO BOLITA', '🦔', 0),  # Hedgehog background
        ('543294cc-aa1c-40f2-93c1-b020edf0b1fd', '', 'NO ME PUEDO LEVANTAR', '😩', 0),  # Lille zoo tapir terrestre
        ('dd8ee631-2df5-4589-a206-0ce3f07ce215', '', 'SIESTA EN PAREJA', '💑', 0),  # Tapirs
    ]),
    ('criollos', 'Carpinchos y bichos de acá', 'Fauna argenta', 'ar', 'carpincho pinguino hornero tero fauna', [
        ('a5ee9747-0dc3-4422-afcf-f9f626364763', '', 'RECIÉN BAÑADO, ¿QUÉ TAL?', '🛁', 0),  # Cute capybara animal
        ('e95d76ac-87fd-470e-b834-5e8f3ce1bd71', '', 'TRANQUI, ACÁ FLOTANDO', '😌', 0),  # Capybara swimming lake
        ('eb8072ff-18ab-4cc4-bf3a-0d094732603b', 'LLEGUÉ', '¿QUÉ ME PERDÍ?', '🙋', 0),  # San Diego Zoo - capybara 2
        ('7082b322-f111-4fc4-a073-b5391c96dbde', '', 'LABURANDO EN LA CASA', '🏠', 0),  # rufous hornero
        ('f60d7fc6-91dc-4e5c-9c73-45de549a76fe', '', '¿QUÉ MIRÁS?', '🤨', 0),  # greater rhea
        ('885a768c-7c85-4dbb-97c6-0151370fa45c', '', '¿HACE FRÍO O ES IDEA MÍA?', '🥶', 0),  # magellanic penguin
        ('b812b299-8888-43a7-8659-fc09af0a5a30', '', 'VENGO DEL SUR', '🐧', 0),  # magellanic penguin
        ('d69bdc03-0b36-48d9-b01e-c525c8c1f81a', '', '¿Y EL BONDI?', '🚌', 0),  # magellanic penguin
        ('d6941e5b-106a-4d95-a22b-fb007d03a7cd', '', 'A VER, A VER...', '👀', 0),  # vicugna, vicuna, vicuña
        ('526e69b0-f33a-4cbd-b05f-646b5f5d0a0a', '', 'NO ESTOY, ME ESCONDÍ', '🙈', 0),  # La Plata Three-banded Armadillo (2006)
        ('3b11f2d0-58f9-469c-b4ad-5e996851bef5', '', 'BLA BLA BLA', '🦜', 0),  # Monk parakeet
        ('08d0548b-c810-4881-9465-b85e4ed9b5b5', '', '¡ESTO ES MÍO!', '😤', 0),  # 04-05-2025 - PANAMA CITY TO COLON THRU P
        ('aefd7a0b-f555-4067-8bc9-f5004b92291d', '', '¡AFUERA!', '👉', 0),  # avefría tero, quero-quero, southern lapw
    ]),
    ('mexico', 'México lindo', 'Para los cuates', 'mx', 'mexico ajolote chido wey tacos', [
        ('14a0d848-4d64-4b16-a7f5-41436fb15985', '', '¡QUÉ ONDA!', '👋', 0),  # Axolotl
        ('41bd3cba-b430-4b1e-b613-9d7abbee59ab', '', 'AHORITA VOY', '🐢', 0),  # axolotl, salamandra ajolote
        ('76e10091-9554-408d-b749-6f4ef7273059', '', '¡NO MANCHES!', '😱', 0),  # axolotl, salamandra ajolote
        ('ed1074f7-adf1-4178-845e-9e8668f76be8', '', 'ME DA FLOJERA', '😴', 0),  # axolotl, salamandra ajolote
        ('c22bfb37-3c85-4555-9744-13ebf17e206d', '', '¿NETA?', '🤨', 0),  # Iguana Pet
        ('21dede4f-08fd-4c5e-8be1-3d673e2a22a3', '', 'BIEN PADRE', '😎', 0),  # Iguana iguana (Linnaeus, 1758)
        ('a170c6ca-84c2-4199-a106-514f8d484927', '', '¿UNOS TAQUITOS?', '🌮', 0),  # Mexican Tacos
        ('99be1351-640e-481c-ada8-acd3e16ce725', '', '¡ÓRALE!', '🐦', 0),  # Rufous hummingbird at Seedskadee Nationa
    ]),
    ('andes', 'Perú y los Andes', '¡Asu mare!', 'pe', 'peru llama alpaca cuy causa', [
        ('1049d235-fadb-48c9-8b53-f413f4d85616', '', '¿YA PE?', '😒', 0),  # Wet Alpaca
        ('530371fc-c046-424d-85c0-970c9b8594e7', '', '¡ASU MARE!', '😱', 0),  # Alpaca Dandelions
        ('1a24cb86-d029-49f3-87c6-b637c5b394b6', '', 'COMPARTIR ES AMAR', '❤️', 0),  # Alpaca Envy
        ('2c24e2d9-8f9d-4110-91e5-6fbf991c21a5', '', '¡CHÉVERE!', '😄', 0),  # Chicken Photobomb
        ('d5dbe6b5-708c-489f-ace9-40cb08526dc5', '', '¿QUÉ FUE, CAUSA?', '🐹', 0),  # Free cute Guinea pig image
        ('511d7131-3857-4fb6-8f24-09d878ed5e91', '', 'TODO BIEN', '👍', 0),  # Free cute Guinea pig image
        ('774e0c70-0a58-4c20-a539-fe54774aa58c', '', 'TENGO HAMBRE', '🥬', 0),  # Guinea pig green grass
        ('ddc9c224-7ffb-42d3-8aad-59abea0e3681', '', '¡ESTÁ BUENAZO!', '😋', 0),  # Close hamster face
        ('b897a728-e83e-4403-8e75-aaf3c2a94cf2', '', 'ACÁ EN LA SIERRA', '🏔️', 0),  # guanaco, llama
        ('3cca215d-d1c6-4c42-b161-b6431bf6d22b', '', '¿ME LLEVÁS?', '🚗', 0),  # guanaco, llama
    ]),
    ('colombia', 'Colombia parce', '¡Qué bacano!', 'co', 'colombia parce bacano tucan', [
        ('5bb69d15-6c36-4783-8235-1679050becfe', '', '¡QUÉ BACANO!', '😄', 0),  # Black and Green Toucan on Tree Branch
        ('278d4588-4845-45ff-80af-5e355632d5ed', '', '¡QUIUBO, PARCE!', '👋', 0),  # Blue-and-yellow Macaw,
        ('6eb7cfea-0b0f-4b25-8615-985bcd1ba672', '', '¡HÁGALE!', '💪', 0),  # Scarlet Macaw
        ('bcad8b5e-f728-4862-bb70-d755671dd556', '', '¿SÍ O QUÉ?', '🤔', 0),  # 04-02-2025 - PUNTARENAS, COSTA RICA - 16
        ('b19f7f4d-5d40-4592-bf7b-6e67f428febe', '', 'TRANQUILO, PARCE', '😌', 0),  # Three-toed-sloth (Bradypus variegatus), 
        ('3c5222b1-5a60-469e-85e2-c5f08d45b7ec', '', 'TODO AL REVÉS', '🙃', 0),  # Sloth
        ('acd31fe7-aa3a-49a1-9964-0bab84a83036', '', '¿UNA AREPITA?', '🫓', 0),  # 20241025-USDA-FNS-UNK-0024
        ('7d2d6235-b32a-4471-a7e5-61cfcf395e24', '', '¡QUÉ NOTA!', '🎶', 0),  # BLACK-MANDIBILLED TOUCAN (02-08-2026) vi
    ]),
    ('venezuela', 'Venezuela chamo', '¡Épale!', 've', 'venezuela chamo pana chevere', [
        ('917bca84-be41-4b24-b422-779d6df997cc', '', '¡ÉPALE, CHAMO!', '👋', 0),  # 062 Los Angeles Zoo (62) - Black Howler 
        ('e807b66b-bd14-4586-a57d-be515951612e', '', '¡QUÉ LADILLA!', '😒', 0),  # central american black howler, guatemala
        ('e56808eb-f836-45b6-9a9c-74f50f866fa0', '', '¡CHÉVERE!', '😄', 0),  # Sloth zoo
        ('cc71a876-eb8e-4560-a05b-5779f42bf34e', '', '¡VÁLGAME!', '😱', 0),  # South American Coati
        ('e8cedbc2-904e-426d-9d86-99e4035eb7c8', '', 'HUELO TEQUEÑOS', '👃', 0),  # brazilian tapir, south american tapir
        ('36df1dd9-8a3a-4d07-8967-37ffc49a7c9e', '', 'PANA, ¿ME LLEVÁS?', '🎒', 0),  # Giant Anteater (2011) Mehgan Murphy
    ]),
    ('chile', 'Chile po', 'Al tiro', 'cl', 'chile cachai po bacan', [
        ('20765ed8-53fc-4a8d-8fe7-2c51250e6175', '', '¡CHUTA!', '😮', 0),  # Southern Pudu
        ('07222290-4acb-454b-ba95-34231c5d0d19', '', 'BACÁN', '😎', 0),  # New Zealand fur seal.
        ('6b13d6bc-5bd9-46c0-b580-7ac1b64da1c7', '', '¡AL TIRO!', '⚡', 0),  # Hawaiian monk seals on Midway Atoll
        ('a22f5f0b-d035-40a4-bed2-329ff0fbef68', '', '¿CACHAI?', '🤔', 0),  # Harbor Seal at Piedras Blancas
        ('bb55c1bb-bd1c-4068-9c90-e3f3f2cd4a19', '', 'QUÉ LATA', '😩', 0),  # Hawaiian monk seals on Midway Atoll
        ('182f599f-d04e-440e-b175-a290e68bdd6f', '', 'YA PO', '🙄', 0),  # Seagull
    ]),
    ('uruguay', 'Uruguay bo', 'Ta, de más', 'uy', 'uruguay bo ta de mas', [
        ('35cb5877-ec71-4bd0-b6f1-fd13bd86fa78', '', '¡TA!', '👍', 0),  # Seagull
        ('1310cadf-1436-4e3c-b48e-631e56bd8047', '', 'BO, ¿TODO BIEN?', '🙋', 0),  # Seagull
        ('05d1dc62-0465-40d6-bbee-78d0ba7a0041', '', 'TREMENDO', '😮', 0),  # Pigeon ramier
        ('dcfc29c6-b6ae-404b-8bc1-ef6e848064e7', '', 'DE MÁS', '🤩', 0),  # Pigeon
    ]),
    ('burros', 'Burros y caballos', 'Pura cara', 'ar', 'burro caballo campo cara', [
        ('167c8bb4-bdb8-40d7-98d4-8a8376b26ac1', '', '¿QUÉ ME VENDÉS?', '🤨', 0),  # The Donkey Sanctuary Sidmouth
        ('44d840b2-eff1-4753-9a50-25ad95e6444c', '', 'ME QUEDÓ CLARÍSIMO', '🙄', 0),  # George The Donkey
        ('508f950f-583f-4bc4-81b7-99b793ff66d3', '', '¿HAY ALGUIEN?', '👀', 0),  # George The Donkey KENT LIFE
        ('a865fb3e-79ea-43fa-953c-2cfb1a5f598e', '', 'TE ESTOY ESCUCHANDO', '👂', 1),  # George The Donkey
        ('c418d956-e02f-47c1-b7e0-9901f5e46e0e', '', 'PRESENTE, PROFE', '🙋', 0),  # The Donkey Sanctuary Sidmouth
        ('1bb3435b-6639-4a53-899e-e7e1689a917b', '', '¡BLEH!', '😛', 1),  # Close-up horse sticking its tongue
        ('23dcbcda-6e1c-4413-8f3f-5e2d0c169047', '', 'JA, JA. QUÉ GRACIOSO', '😒', 0),  # 
        ('6b88397e-a3aa-425b-a714-d485afcb9036', '', 'RECIÉN SALIDO DE LA PELU', '💇', 0),  # Funny horse, animal photography
        ('2572b917-d8e8-4b89-844f-e74ebb24f21e', '', 'NO ESCUCHÉ NADA', '🙉', 0),  # 
        ('15de17d6-1d00-470b-acb2-db6433ff342e', '', 'TODO BIEN, ¿Y VOS?', '🙂', 0),  # Damp Donkey. They have a stable but deci
    ]),
    ('granja', 'La granja', 'Del campo al grupo', 'ar', 'campo granja gallo pato cabra', [
        ('bbfe2dcc-0096-42ff-bd34-96606ae6929e', '', '¡QUÉ LINDO DÍA!', '🌞', 0),  # Mountain Goat - Oreamnos americanus
        ('e1f4ab5e-2952-4b35-847c-af4f1ca1bb98', '', '¿QUÉ HACEN, VECINOS?', '👀', 0),  # Mountain Goat at Johnston Ridge Observat
        ('38eadeb7-dc8f-4ac5-8964-f5cd14827db4', '', 'ME ENTERÉ DE TODO', '🤭', 0),  # Mountain Goat - Oreamnos americanus
        ('a3b26226-d5d7-4444-b9a9-fd829e178203', '¡ARRIBA,', 'QUE SON LAS 6!', '🐓', 0),  # Rooster Cock
        ('c3e34e30-997b-49a2-aada-c4f11d873280', '', '¡QUIQUIRIQUÍ!', '📣', 0),  # Rooster Chicken
        ('314d669a-250f-4185-8557-8e0fa5604a53', '', 'PASO, PASO', '🚶', 0),  # 220 There Were About A Dozen Wandering R
        ('fbc8c993-4797-4b1c-ac94-76f59112a6f9', '', '¿TE GUSTA MI PICO NUEVO?', '💅', 0),  # Ruddy duck at Seedskadee National Wildli
        ('dbd635ce-632d-4f13-8f08-12a0c5298f29', '', 'DE VACACIONES', '🏖️', 0),  # A redhead duck resting along the ocean s
        ('09e10985-f362-4f36-901b-cd004228ed46', '', 'COLORADO DE LA VERGÜENZA', '😳', 0),  # from the right (or 'the serious duck')
    ]),
    ('pajaros', 'Búhos y loros', 'Chusmas profesionales', 'ar', 'buho loro pajaro chusma', [
        ('3aa96fbc-4ca9-4fb1-ac50-e0f00cd5e6b3', '', 'NO SOY DE MAÑANA', '😑', 0),  # Great horned owl along lower Columbia Ri
        ('646a05dd-9b16-43b4-90c5-fa5a0cbeb106', '', 'TE VI', '👁️', 0),  # Great horned owl along lower Columbia Ri
        ('80a9a9ca-895f-4061-83ee-55745d8e95a2', '', '¿HOLA?', '👋', 0),  # Barn Owl Hideaway built by volunteer
        ('ab3447db-867b-4210-b836-425d166ec0d2', '', '¿QUIÉN ANDA AHÍ?', '🕵️', 0),  # Barn Owl Hideaway built by volunteer
        ('04853d69-8efb-4be7-aa4f-4746f433a0d9', '', 'NOCHE LARGA', '🌙', 0),  # Great horned owl along lower Columbia Ri
        ('95909394-f2e6-4e54-a2fe-222ba4ddc459', '', '¿EN SERIO?', '🤨', 0),  # Indian Ringneck parrot. (Psittacula kram
        ('acda132e-9fe8-40b2-b169-a18be817fac0', '', '¡ALEGRÍA!', '🌈', 0),  # The superb parrot
        ('77616130-f117-4972-a32e-cd4706d01680', '', 'CHUSMEANDO', '🗣️', 0),  # WHITE-FRONTED PARROT (12-06-2021) olivei
        ('446d32cc-6d9c-498c-b09c-406c867e1fb0', '', '¿VISTE LO QUE PASÓ?', '😮', 0),  # WHITE-FRONTED PARROT (12-06-2021) olivei
        ('3b7c1b0b-2fa5-42ea-b7dd-9ac5e2999f06', '', 'SOLTÁ ESO', '✋', 0),  # Kea. NZ parrot.
    ]),
    ('bichos', 'Bichos varios', 'Reacciones al toque', 'ar', 'reacciones hamster mapache rana mono', [
        ('07f7d407-7f46-4533-93ab-643511d0b4e8', '', '¿HAY LUGAR?', '🤔', 0),  # Hamster running wheel
        ('a7401254-dd93-4f5b-b3b1-f037f9b8cca1', '', 'PORFIS', '🙏', 0),  # Hamster Animals
        ('ff808925-119c-423d-9128-881e62f8957f', '', '¡SOCORRO!', '😨', 0),  # dzhungarian hamster, striped desert hams
        ('aa1ec647-8eb9-4388-aa61-5eb3c0fd41b6', '', '¿QUÉ PASA, AMIGO?', '🐸', 1),  # Columbia Spotted Frog - Rana luteiventri
        ('151a3795-e432-43aa-bd20-8129f01e6eac', '', 'ACÁ, DE CHILL', '😎', 0),  # Gray Tree Frog
        ('903799c6-860d-41e9-8061-12fbaa186ce3', '', 'ESTOY PENSANDO', '🤔', 0),  # Gorilla Monkey
        ('5cdeb536-6869-442d-93ed-e341121fd7ba', '', 'NI IDEA', '🤷', 0),  # Lake Sebu Monkey
        ('2abbb321-913c-469d-9a2d-79e437f88f66', '', '¿NOS VIERON?', '👀', 0),  # Raccoons
        ('8d570bc9-146f-4cbd-a594-9186f022f742', '', 'NO VISTE NADA', '🤫', 1),  # Raccoon
        ('d393c92a-f160-4fb4-ba95-3823541ef1e9', '', 'VOY PARA TU CASA', '🏃', 0),  # Raccoon
        ('89375c41-8fa3-41d4-9356-b23685be98d6', '', 'NO ME TOQUES', '🦔', 0),  # Free hedgehog image
        ('e945263d-9b90-4b81-84db-d23b1ad34138', '', 'ESTO ES MÍO', '🥜', 0),  # Red Squirrel - KNPP - _MG_7430-1
        ('84c1e26b-345f-43f5-a234-a7176ccbb068', '', 'TE ESCUCHO', '👂', 0),  # Cottontail rabbit
    ]),
    ('amor', 'Bichos enamorados', 'Para mandarle a esa persona', 'ar', 'amor chamuyo te quiero', [
        ('dd9f6326-e67e-4c52-af09-f1181dcb2bff', '', 'MI PERSONA FAVORITA', '🫶', 0),  # Cat Kitten
        ('bf194a98-209e-46e0-aab2-918856f55399', '', 'TE CUIDO', '🤗', 0),  # Echo's Kitten
        ('cd2a03f9-f5e9-4df4-ae60-c1faf34ac4bf', '', 'MUAC', '😘', 0),  # Ducks.
        ('915035dd-1240-4df7-957c-2f02d1d76241', 'JUNTITOS', 'COMO DEBE SER', '🥰', 0),  # Cat Kitten
        ('86c8075e-6da4-4bd2-8c7b-8dc66dc3dd6f', '', 'TE QUIERO MUCHO', '❤️', 0),  # Raccoon
    ]),
    ('morfi', 'El morfi', 'Con hambre no se piensa', 'ar', 'comida morfi empanada facturas pizza helado', [
        ('5cc777b5-fb88-4ad2-918a-46a782e25609', '', '¿SE ARMA?', '🥟', 0),  # 20241025-USDA-FNS-UNK-0054
        ('06dbfe4f-0902-47ae-9f57-8cc46bc992c7', '', '¿HAY FACTURAS?', '🥐', 0),  # Croissants Pastries
        ('2898eab5-54fe-4cb8-9e24-7df0270f0fc0', '', 'DE MANTECA, POR FAVOR', '🧈', 0),  # Ham and cheese croissant
        ('b4bd7ade-69b3-48f6-9800-183e002f7931', '', 'DESAYUNO DE CAMPEONES', '☕', 0),  # Croissant Pastry
        ('51942343-468e-4e19-8afc-84fb223a69fc', '', 'PIZZA, PELI Y MANTA', '🍕', 0),  # Pepperoni Slices
        ('90b6f7e1-ed7b-4929-ac2b-43d79ab02693', '', 'UNA PORCIÓN MÁS Y LISTO', '😋', 0),  # Pepperoni pizza
        ('a0ee9df0-3aa6-4ac5-b055-406947c1fc6f', '', '¡HELADO!', '🍦', 0),  # Free assorted ice cream cones
        ('226eb0a8-5afd-4612-a13f-e975e627b6da', '', 'EL POSTRE NO SE NEGOCIA', '🍨', 0),  # Ice Cream Cones
    ]),
    ('fiestas', 'Fiestas', 'Navidad y Año Nuevo', 'ar', 'navidad fiestas año nuevo', [
        ('0441d894-a867-474b-8133-567f4bdfbf2e', '', '¿YA TERMINÓ EL AÑO?', '🎄', 0),  # Dog Puppy
        ('1bae9ff3-a515-449b-9447-8b501f8e8e9e', '', '¡FELIZ NAVIDAD!', '🎅', 0),  # Dog Puppy
        ('f87d881f-f6ae-4791-b4a7-20f281765d09', '', 'JO, JO, JO', '🐴', 0),  # 
    ]),
]
