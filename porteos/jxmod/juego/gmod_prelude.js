// ---------------- lo que GMod trae escrito en Lua (lua/includes/extensions, util.lua, weapon_base...) ----------------
// Escrito de nuevo a partir de la documentación pública de la wiki de GMod (mismos nombres y comportamiento), no copiado.
// Corre una vez al crear el Lua, antes que cualquier addon.
const GMA_PRELUDE = String.raw`
local string, table, math, pairs, ipairs, type, tostring, tonumber, next, select, setmetatable, getmetatable, rawget, rawset =
      string, table, math, pairs, ipairs, type, tostring, tonumber, next, select, setmetatable, getmetatable, rawget, rawset

-- ---------- constantes (valores de la wiki) ----------
local function enum(pre, t) for k, v in pairs(t) do _G[pre .. k] = v end end
enum("TYPE_", { NONE=-1, INVALID=-1, NIL=0, BOOL=1, LIGHTUSERDATA=2, NUMBER=3, STRING=4, TABLE=5, FUNCTION=6, USERDATA=7, THREAD=8, ENTITY=9, VECTOR=10, ANGLE=11, PHYSOBJ=12, SAVE=13, RESTORE=14, DAMAGEINFO=15, EFFECTDATA=16, MOVEDATA=17, RECIPIENTFILTER=18, USERCMD=19, SCRIPTEDVEHICLE=20, MATERIAL=21, PANEL=22, PARTICLE=23, PARTICLEEMITTER=24, TEXTURE=25, USERMSG=26, CONVAR=27, IMESH=28, MATRIX=29, SOUND=30, PIXELVISHANDLE=31, DLIGHT=32, VIDEO=33, FILE=34, LOCOMOTION=35, PATH=36, NAVAREA=37, SOUNDHANDLE=38, NAVLADDER=39, PARTICLESYSTEM=40, PROJECTEDTEXTURE=41, PHYSCOLLIDE=42, SURFACEINFO=43, COUNT=44, COLOR=255 })
enum("DMG_", { GENERIC=0, CRUSH=1, BULLET=2, SLASH=4, BURN=8, VEHICLE=16, FALL=32, BLAST=64, CLUB=128, SHOCK=256, SONIC=512, ENERGYBEAM=1024, PREVENT_PHYSICS_FORCE=2048, NEVERGIB=4096, ALWAYSGIB=8192, DROWN=16384, PARALYZE=32768, NERVEGAS=65536, POISON=131072, RADIATION=262144, DROWNRECOVER=524288, ACID=1048576, SLOWBURN=2097152, REMOVENORAGDOLL=4194304, PHYSGUN=8388608, PLASMA=16777216, AIRBOAT=33554432, DISSOLVE=67108864, BLAST_SURFACE=134217728, DIRECT=268435456, BUCKSHOT=536870912, SNIPER=1073741824, MISSILEDEFENSE=2147483648 })
enum("IN_", { ATTACK=1, JUMP=2, DUCK=4, FORWARD=8, BACK=16, USE=32, CANCEL=64, LEFT=128, RIGHT=256, MOVELEFT=512, MOVERIGHT=1024, ATTACK2=2048, RUN=4096, RELOAD=8192, ALT1=16384, ALT2=32768, SCORE=65536, SPEED=131072, WALK=262144, ZOOM=524288, WEAPON1=1048576, WEAPON2=2097152, BULLRUSH=4194304, GRENADE1=8388608, GRENADE2=16777216 })
enum("MOVETYPE_", { NONE=0, ISOMETRIC=1, WALK=2, STEP=3, FLY=4, FLYGRAVITY=5, VPHYSICS=6, PUSH=7, NOCLIP=8, LADDER=9, OBSERVER=10, CUSTOM=11 })
enum("MOVECOLLIDE_", { DEFAULT=0, FLY_BOUNCE=1, FLY_CUSTOM=2, FLY_SLIDE=3, COUNT=4 })
enum("SOLID_", { NONE=0, BSP=1, BBOX=2, OBB=3, OBB_YAW=4, CUSTOM=5, VPHYSICS=6 })
enum("FSOLID_", { CUSTOMRAYTEST=1, CUSTOMBOXTEST=2, NOT_SOLID=4, TRIGGER=8, NOT_STANDABLE=16, VOLUME_CONTENTS=32, FORCE_WORLD_ALIGNED=64, USE_TRIGGER_BOUNDS=128, ROOT_PARENT_ALIGNED=256, TRIGGER_TOUCH_DEBRIS=512, MAX_BITS=10 })
enum("COLLISION_GROUP_", { NONE=0, DEBRIS=1, DEBRIS_TRIGGER=2, INTERACTIVE_DEBRIS=3, INTERACTIVE=4, PLAYER=5, BREAKABLE_GLASS=6, VEHICLE=7, PLAYER_MOVEMENT=8, NPC=9, IN_VEHICLE=10, WEAPON=11, VEHICLE_CLIP=12, PROJECTILE=13, DOOR_BLOCKER=14, PASSABLE_DOOR=15, DISSOLVING=16, PUSHAWAY=17, NPC_ACTOR=18, NPC_SCRIPTED=19, WORLD=20 })
enum("SIM_", { NOTHING=0, LOCAL_ACCELERATION=1, LOCAL_FORCE=2, GLOBAL_ACCELERATION=3, GLOBAL_FORCE=4 })
enum("RENDERMODE_", { NORMAL=0, TRANSCOLOR=1, TRANSTEXTURE=2, GLOW=3, TRANSALPHA=4, TRANSADD=5, ENVIROMENTAL=6, TRANSADDFRAMEBLEND=7, TRANSALPHADD=8, WORLDGLOW=9, NONE=10 })
enum("RENDERGROUP_", { STATIC_HUGE=0, OPAQUE_HUGE=1, STATIC=6, OPAQUE=7, TRANSLUCENT=8, BOTH=9, VIEWMODEL=10, VIEWMODEL_TRANSLUCENT=11, OPAQUE_BRUSH=12, OTHER=13 })
enum("kRenderFx", { None=0, PulseSlow=1, PulseFast=2, PulseSlowWide=3, PulseFastWide=4, FadeSlow=5, FadeFast=6, SolidSlow=7, SolidFast=8, StrobeSlow=9, StrobeFast=10, StrobeFaster=11, FlickerSlow=12, FlickerFast=13, NoDissipation=14, Distort=15, Hologram=16, Explode=17, GlowShell=18, ClampMinScale=19, EnvRain=20, EnvSnow=21, Spotlight=22, Ragdoll=23, PulseFastWider=24 })
enum("TEXT_ALIGN_", { LEFT=0, CENTER=1, RIGHT=2, TOP=3, BOTTOM=4 })
enum("HITGROUP_", { GENERIC=0, HEAD=1, CHEST=2, STOMACH=3, LEFTARM=4, RIGHTARM=5, LEFTLEG=6, RIGHTLEG=7, GEAR=10 })
enum("NOTIFY_", { GENERIC=0, ERROR=1, UNDO=2, HINT=3, CLEANUP=4 })
enum("CHAN_", { REPLACE=-1, AUTO=0, WEAPON=1, VOICE=2, ITEM=3, BODY=4, STREAM=5, STATIC=6, VOICE2=7, VOICE_BASE=8, USER_BASE=136 })
enum("SNDLVL_", { NONE=0, ["20dB"]=20, ["25dB"]=25, ["30dB"]=30, ["35dB"]=35, ["40dB"]=40, ["45dB"]=45, ["50dB"]=50, ["55dB"]=55, IDLE=60, ["60dB"]=60, ["65dB"]=65, STATIC=66, ["70dB"]=70, NORM=75, ["75dB"]=75, ["80dB"]=80, TALKING=80, ["85dB"]=85, ["90dB"]=90, ["95dB"]=95, ["100dB"]=100, ["105dB"]=105, ["110dB"]=110, ["120dB"]=120, ["130dB"]=130, GUNFIRE=140, ["140dB"]=140, ["150dB"]=150, ["180dB"]=180 })
enum("FCVAR_", { NONE=0, UNREGISTERED=1, DEVELOPMENTONLY=2, GAMEDLL=4, CLIENTDLL=8, HIDDEN=16, PROTECTED=32, SPONLY=64, ARCHIVE=128, NOTIFY=256, USERINFO=512, PRINTABLEONLY=1024, UNLOGGED=2048, NEVER_AS_STRING=4096, REPLICATED=8192, CHEAT=16384, SS=32768, DEMO=65536, DONTRECORD=131072, SS_ADDED=262144, LUA_CLIENT=262144, LUA_SERVER=524288, RELEASE=524288, NOT_CONNECTED=4194304, MATERIAL_SYSTEM_THREAD=8388608, ARCHIVE_XBOX=16777216, ACCESSIBLE_FROM_THREADS=33554432, SERVER_CAN_EXECUTE=268435456, SERVER_CANNOT_QUERY=536870912, CLIENTCMD_CAN_EXECUTE=1073741824 })
enum("EF_", { BONEMERGE=1, BRIGHTLIGHT=2, DIMLIGHT=4, NOINTERP=8, NOSHADOW=16, NODRAW=32, NORECEIVESHADOW=64, BONEMERGE_FASTCULL=128, ITEM_BLINK=256, PARENT_ANIMATES=512, FOLLOWBONE=1024 })
enum("FL_", { FLY=2048, SWIM=4096, CONVEYOR=8192, NPC=16384, ONGROUND=1, DUCKING=2, ANIMDUCKING=4, WATERJUMP=8, ONTRAIN=16, INRAIN=32, FROZEN=64, ATCONTROLS=128, CLIENT=256, FAKECLIENT=512, INWATER=1024, GODMODE=32768, NOTARGET=65536, AIMTARGET=131072, PARTIALGROUND=262144, STATICPROP=524288, GRAPHED=1048576, GRENADE=2097152, STEPMOVEMENT=4194304, DONTTOUCH=8388608, BASEVELOCITY=16777216, WORLDBRUSH=33554432, OBJECT=67108864, KILLME=134217728, ONFIRE=268435456, DISSOLVING=536870912, TRANSRAGDOLL=1073741824, UNBLOCKABLE_BY_PLAYER=2147483648 })
enum("MASK_", { SOLID=33570827, PLAYERSOLID=33636363, NPCSOLID=33701899, WATER=16432, OPAQUE=16513, SHOT=1174421507, SHOT_HULL=100679691, SHOT_PORTAL=33570819, VISIBLE=24705, ALL=4294967295, DEADSOLID=65547, NPCWORLDSTATIC=131083, SOLID_BRUSHONLY=16395, PLAYERSOLID_BRUSHONLY=81931, NPCSOLID_BRUSHONLY=147467, SPLITAREAPORTAL=48, CURRENT=16515072, BLOCKLOS=16449, BLOCKLOS_AND_NPCS=33570881, OPAQUE_AND_NPCS=33570945, VISIBLE_AND_NPCS=33579137 })
enum("CONTENTS_", { EMPTY=0, SOLID=1, WINDOW=2, AUX=4, GRATE=8, SLIME=16, WATER=32, BLOCKLOS=64, OPAQUE=128, TESTFOGVOLUME=256, TEAM4=512, TEAM3=1024, TEAM1=2048, TEAM2=4096, IGNORE_NODRAW_OPAQUE=8192, MOVEABLE=16384, AREAPORTAL=32768, PLAYERCLIP=65536, MONSTERCLIP=131072, CURRENT_0=262144, CURRENT_90=524288, CURRENT_180=1048576, CURRENT_270=2097152, CURRENT_UP=4194304, CURRENT_DOWN=8388608, ORIGIN=16777216, MONSTER=33554432, DEBRIS=67108864, DETAIL=134217728, TRANSLUCENT=268435456, LADDER=536870912, HITBOX=1073741824 })
enum("SURF_", { LIGHT=1, SKY2D=2, SKY=4, WARP=8, TRANS=16, NOPORTAL=32, TRIGGER=64, NODRAW=128, HINT=256, SKIP=512, NOLIGHT=1024, BUMPLIGHT=2048, NOSHADOWS=4096, NODECALS=8192, NOCHOP=16384, HITBOX=32768 })
enum("MAT_", { ANTLION=65, BLOODYFLESH=66, CONCRETE=67, DIRT=68, EGGSHELL=69, FLESH=70, GRATE=71, ALIENFLESH=72, CLIP=73, SNOW=74, PLASTIC=76, METAL=77, SAND=78, FOLIAGE=79, COMPUTER=80, SLOSH=83, TILE=84, GRASS=85, VENT=86, WOOD=87, DEFAULT=88, GLASS=89, WARPSHIELD=90 })
enum("USE_", { OFF=0, ON=1, SET=2, TOGGLE=3 })
SIMPLE_USE, CONTINUOUS_USE, ONOFF_USE, DIRECTIONAL_USE = 3, 0, 1, 2
enum("TRANSMIT_", { ALWAYS=0, NEVER=1, PVS=2 })
enum("OBS_MODE_", { NONE=0, DEATHCAM=1, FREEZECAM=2, FIXED=3, IN_EYE=4, CHASE=5, ROAMING=6 })
enum("PLAYER_", { IDLE=0, WALK=1, JUMP=2, SUPERJUMP=3, DIE=4, ATTACK1=5, IN_VEHICLE=6, RELOAD=7, START_AIMING=8, LEAVE_AIMING=9 })
enum("PLAYERANIMEVENT_", { ATTACK_PRIMARY=0, ATTACK_SECONDARY=1, ATTACK_GRENADE=2, RELOAD=3, RELOAD_LOOP=4, RELOAD_END=5, JUMP=6, SWIM=7, DIE=8, FLINCH_CHEST=9, FLINCH_HEAD=10, FLINCH_LEFTARM=11, FLINCH_RIGHTARM=12, FLINCH_LEFTLEG=13, FLINCH_RIGHTLEG=14, DOUBLEJUMP=15, CANCEL=16, SPAWN=17, SNAP_YAW=18, CUSTOM=19, CUSTOM_GESTURE=20, CUSTOM_SEQUENCE=21, CUSTOM_GESTURE_SEQUENCE=22, CANCEL_RELOAD=23 })
enum("GESTURE_SLOT_", { ATTACK_AND_RELOAD=0, GRENADE=1, JUMP=2, SWIM=3, FLINCH=4, VCD=5, CUSTOM=6 })
enum("BLOOD_COLOR_", { RED=0, YELLOW=1, GREEN=2, MECH=3, ANTLION=4, ZOMBIE=5, ANTLION_WORKER=6 })
DONT_BLEED = -1
enum("TEAM_", { CONNECTING=0, UNASSIGNED=1001, SPECTATOR=1002 })
enum("BOX_", { FRONT=0, BACK=1, RIGHT=2, LEFT=3, TOP=4, BOTTOM=5 })
enum("PATTACH_", { ABSORIGIN=0, ABSORIGIN_FOLLOW=1, CUSTOMORIGIN=2, POINT=3, POINT_FOLLOW=4, WORLDORIGIN=5, ROOTBONE_FOLLOW=6 })
enum("SCHED_", { NONE=0, IDLE_STAND=1, IDLE_WALK=2, IDLE_WANDER=3, WAKE_ANGRY=4, ALERT_FACE=5, CHASE_ENEMY=17, RUN_FROM_ENEMY=32, MELEE_ATTACK1=41, RANGE_ATTACK1=43, FORCED_GO=71, FORCED_GO_RUN=72, TARGET_CHASE=19 })
enum("NPC_STATE_", { INVALID=-1, NONE=0, IDLE=1, ALERT=2, COMBAT=3, SCRIPT=4, PLAYDEAD=5, PRONE=6, DEAD=7 })
enum("D_", { ER=0, HT=1, FR=2, LI=3, NU=4 })
enum("CAP_", { SIMPLE_RADIUS_DAMAGE=2147483648, MOVE_GROUND=1, MOVE_JUMP=2, MOVE_FLY=4, MOVE_CLIMB=8, MOVE_SHOOT=64, SKIP_NAV_GROUND_CHECK=128, USE=256, AUTO_DOORS=1024, OPEN_DOORS=2048, TURN_HEAD=4096, WEAPON_RANGE_ATTACK1=8192, WEAPON_RANGE_ATTACK2=16384, WEAPON_MELEE_ATTACK1=32768, WEAPON_MELEE_ATTACK2=65536, INNATE_RANGE_ATTACK1=131072, INNATE_RANGE_ATTACK2=262144, INNATE_MELEE_ATTACK1=524288, INNATE_MELEE_ATTACK2=1048576, USE_WEAPONS=2097152, ANIMATEDFACE=8388608, USE_SHOT_REGULATOR=16777216, FRIENDLY_DMG_IMMUNE=33554432, SQUAD=67108864, DUCK=134217728, NO_HIT_PLAYER=268435456, AIM_GUN=536870912, NO_HIT_SQUADMATES=1073741824 })
enum("CLASS_", { NONE=0, PLAYER=1, PLAYER_ALLY=2, PLAYER_ALLY_VITAL=3, ANTLION=4, BARNACLE=5, BULLSEYE=6, CITIZEN_PASSIVE=7, CITIZEN_REBEL=8, COMBINE=9, COMBINE_GUNSHIP=10, CONSCRIPT=11, HEADCRAB=12, MANHACK=13, METROPOLICE=14, MILITARY=15, SCANNER=16, STALKER=17, VORTIGAUNT=18, ZOMBIE=19, PROTOSNIPER=20, MISSILE=21, FLARE=22, EARTH_FAUNA=23, HACKED_ROLLERMINE=24, COMBINE_HUNTER=25 })
enum("SF_", { NPC_WAIT_TILL_SEEN=1, NPC_GAG=2, NPC_FALL_TO_GROUND=4, NPC_DROP_HEALTHKIT=8, NPC_START_EFFICIENT=16, NPC_WAIT_FOR_SCRIPT=128, NPC_LONG_RANGE=256, NPC_FADE_CORPSE=512, NPC_ALWAYSTHINK=1024, NPC_TEMPLATE=2048, NPC_NO_WEAPON_DROP=8192, PHYSPROP_MOTIONDISABLED=8, PHYSPROP_PREVENT_PICKUP=512, PHYSPROP_START_ASLEEP=1, CITIZEN_RANDOM_HEAD=262144, CITIZEN_MEDIC=131072, CITIZEN_NOT_COMMANDABLE=1048576 })
enum("EFL_", { KILLME=1, DORMANT=2, NOCLIP_ACTIVE=4, SETTING_UP_BONES=8, KEEP_ON_RECREATE_ENTITIES=16, DIRTY_SHADOWUPDATE=32, NOTIFY=64, FORCE_CHECK_TRANSMIT=128, BOT_FROZEN=256, SERVER_ONLY=512, NO_AUTO_EDICT_ATTACH=1024, NO_THINK_FUNCTION=4194304, NO_GAME_PHYSICS_SIMULATION=8388608, NO_DAMAGE_FORCES=2147483648, IN_SKYBOX=131072, USE_PARTITION_WHEN_NOT_SOLID=262144, TOUCHING_FLUID=524288 })
enum("FVPHYSICS_", { CONSTRAINT_STATIC=1, DMG_DISSOLVE=2, DMG_SLICE=4, HEAVY_OBJECT=8, MULTIOBJECT_ENTITY=16, NO_IMPACT_DMG=32, NO_NPC_IMPACT_DMG=64, NO_PLAYER_PICKUP=128, NO_SELF_COLLISIONS=256, PART_OF_RAGDOLL=512, PENETRATING=1024, PLAYER_HELD=2048, WAS_THROWN=4096 })
enum("BLEND_", { ZERO=0, ONE=1, DST_COLOR=2, ONE_MINUS_DST_COLOR=3, SRC_ALPHA=4, ONE_MINUS_SRC_ALPHA=5, DST_ALPHA=6, ONE_MINUS_DST_ALPHA=7, SRC_ALPHA_SATURATE=8, SRC_COLOR=9, ONE_MINUS_SRC_COLOR=10 })
enum("BLENDFUNC_", { ADD=0, SUBTRACT=1, REVERSE_SUBTRACT=2, MIN=3, MAX=4 })
enum("STENCIL_", { NEVER=1, LESS=2, EQUAL=3, LESSEQUAL=4, GREATER=5, NOTEQUAL=6, GREATEREQUAL=7, ALWAYS=8, KEEP=1, ZERO=2, REPLACE=3, INCRSAT=4, DECRSAT=5, INVERT=6, INCR=7, DECR=8 })
enum("MATERIAL_", { LINES=1, LINE_STRIP=2, LINE_LOOP=3, POINTS=4, TRIANGLES=5, TRIANGLE_STRIP=6, QUADS=7, POLYGON=8, CULLMODE_CCW=0, CULLMODE_CW=1, FOG_NONE=0, FOG_LINEAR=1, FOG_LINEAR_BELOW_FOG_Z=2, LIGHT_DISABLE=0, LIGHT_POINT=1, LIGHT_DIRECTIONAL=2, LIGHT_SPOT=3, RT_DEPTH_SEPARATE=1, RT_DEPTH_SHARED=0, RT_DEPTH_NONE=2, RT_DEPTH_ONLY=3 })
enum("TEXFILTER_", { NONE=0, POINT=1, LINEAR=2, ANISOTROPIC=3 })
TEXFILTER = TEXFILTER or { NONE=0, POINT=1, LINEAR=2, ANISOTROPIC=3 }
enum("RT_SIZE_", { NO_CHANGE=0, DEFAULT=1, PICMIP=2, HDR=3, FULL_FRAME_BUFFER=4, OFFSCREEN=5, FULL_FRAME_BUFFER_ROUNDED_UP=6, REPLAY_SCREENSHOT=7, LITERAL=8, LITERAL_PICMIP=9 })
enum("IMAGE_FORMAT_", { DEFAULT=-1, RGBA8888=0, ABGR8888=1, RGB888=2, BGR888=3, RGB565=4, ARGB8888=11, BGRA8888=12, RGBA16161616=24, RGBA16161616F=25 })
enum("NAV_", { MESH_INVALID=0, MESH_CROUCH=1, MESH_JUMP=2, MESH_PRECISE=4, MESH_NO_JUMP=8, MESH_STOP=16, MESH_RUN=32, MESH_WALK=64, MESH_AVOID=128, MESH_TRANSIENT=256, MESH_DONT_HIDE=512, MESH_STAND=1024, MESH_NO_HOSTAGES=2048, MESH_STAIRS=4096, MESH_NO_MERGE=8192, MESH_OBSTACLE_TOP=16384, MESH_CLIFF=32768, MESH_FUNC_COST=536870912, MESH_HAS_ELEVATOR=1073741824, MESH_NAV_BLOCKER=2147483648, NORTH=0, EAST=1, SOUTH=2, WEST=3 })
enum("KEY_", { NONE=0, ["0"]=1, ["1"]=2, ["2"]=3, ["3"]=4, ["4"]=5, ["5"]=6, ["6"]=7, ["7"]=8, ["8"]=9, ["9"]=10, A=11, B=12, C=13, D=14, E=15, F=16, G=17, H=18, I=19, J=20, K=21, L=22, M=23, N=24, O=25, P=26, Q=27, R=28, S=29, T=30, U=31, V=32, W=33, X=34, Y=35, Z=36,
  PAD_0=37, PAD_1=38, PAD_2=39, PAD_3=40, PAD_4=41, PAD_5=42, PAD_6=43, PAD_7=44, PAD_8=45, PAD_9=46, PAD_DIVIDE=47, PAD_MULTIPLY=48, PAD_MINUS=49, PAD_PLUS=50, PAD_ENTER=51, PAD_DECIMAL=52,
  LBRACKET=53, RBRACKET=54, SEMICOLON=55, APOSTROPHE=56, BACKQUOTE=57, COMMA=58, PERIOD=59, SLASH=60, BACKSLASH=61, MINUS=62, EQUAL=63, ENTER=64, SPACE=65, BACKSPACE=66, TAB=67, CAPSLOCK=68, NUMLOCK=69, ESCAPE=70, SCROLLLOCK=71,
  INSERT=72, DELETE=73, HOME=74, END=75, PAGEUP=76, PAGEDOWN=77, BREAK=78, LSHIFT=79, RSHIFT=80, LALT=81, RALT=82, LCONTROL=83, RCONTROL=84, LWIN=85, RWIN=86, APP=87, UP=88, LEFT=89, DOWN=90, RIGHT=91,
  F1=92, F2=93, F3=94, F4=95, F5=96, F6=97, F7=98, F8=99, F9=100, F10=101, F11=102, F12=103, CAPSLOCKTOGGLE=104, NUMLOCKTOGGLE=105, SCROLLLOCKTOGGLE=106, FIRST=0, COUNT=107 })
enum("MOUSE_", { FIRST=107, LEFT=107, RIGHT=108, MIDDLE=109, ["4"]=110, ["5"]=111, WHEEL_UP=112, WHEEL_DOWN=113, LAST=113, COUNT=7 })
enum("BUTTON_CODE_", { INVALID=-1, NONE=0, LAST=171, COUNT=172 })
enum("JOYSTICK_", { FIRST=114, FIRST_BUTTON=114, LAST_BUTTON=145, FIRST_POV_BUTTON=146, LAST_POV_BUTTON=149, FIRST_AXIS_BUTTON=150, LAST_AXIS_BUTTON=161, LAST=161 })
FILL, LEFT, RIGHT, TOP, BOTTOM, NODOCK = 1, 2, 3, 4, 5, 0
HUD_PRINTNOTIFY, HUD_PRINTCONSOLE, HUD_PRINTTALK, HUD_PRINTCENTER = 1, 2, 3, 4
SND_NOFLAGS, SND_CHANGE_VOL, SND_CHANGE_PITCH, SND_STOP, SND_SPAWNING, SND_DELAY, SND_STOP_LOOPING, SND_SHOULDPAUSE, SND_IGNORE_PHONEMES, SND_IGNORE_NAME, SND_DO_NOT_OVERWRITE_EXISTING_ON_CHANNEL = 0, 1, 2, 4, 8, 16, 32, 128, 256, 512, 1024
WEAPON_PROFICIENCY_POOR, WEAPON_PROFICIENCY_AVERAGE, WEAPON_PROFICIENCY_GOOD, WEAPON_PROFICIENCY_VERY_GOOD, WEAPON_PROFICIENCY_PERFECT = 0, 1, 2, 3, 4
ANIMATION_NONE = 0
-- las ACT_ (cientos): las que más usan los addons con su número; las demás dan un número fijo distinto para cada nombre
enum("ACT_", { INVALID=-1, RESET=0, IDLE=1, TRANSITION=2, COVER=3, COVER_MED=4, COVER_LOW=5, WALK=6, WALK_AIM=7, WALK_CROUCH=8, WALK_CROUCH_AIM=9, RUN=10, RUN_AIM=11, RUN_CROUCH=12, RUN_CROUCH_AIM=13, RUN_PROTECTED=14, SCRIPT_CUSTOM_MOVE=15,
  RANGE_ATTACK1=16, RANGE_ATTACK2=17, RANGE_ATTACK1_LOW=18, RANGE_ATTACK2_LOW=19, DIESIMPLE=20, DIEBACKWARD=21, DIEFORWARD=22, DIEVIOLENT=23, DIERAGDOLL=24, FLY=25, HOVER=26, GLIDE=27, SWIM=28, JUMP=29, HOP=30, LEAP=31, LAND=32, CLIMB_UP=33, CLIMB_DOWN=34, CLIMB_DISMOUNT=35,
  SHIPLADDER_UP=36, SHIPLADDER_DOWN=37, STRAFE_LEFT=38, STRAFE_RIGHT=39, ROLL_LEFT=40, ROLL_RIGHT=41, TURN_LEFT=42, TURN_RIGHT=43, CROUCH=44, CROUCHIDLE=45, STAND=46, USE=47, SIGNAL1=52, SIGNAL2=53, SIGNAL3=54, MELEE_ATTACK1=62, MELEE_ATTACK2=63,
  VM_DRAW=171, VM_HOLSTER=172, VM_IDLE=173, VM_FIDGET=174, VM_PULLBACK=175, VM_PULLBACK_HIGH=176, VM_PULLBACK_LOW=177, VM_THROW=178, VM_PULLPIN=179, VM_PRIMARYATTACK=180, VM_SECONDARYATTACK=181, VM_RELOAD=182, VM_DRYFIRE=183, VM_HITLEFT=184, VM_HITLEFT2=185, VM_HITRIGHT=186, VM_HITRIGHT2=187, VM_HITCENTER=188, VM_HITCENTER2=189, VM_MISSLEFT=190, VM_MISSLEFT2=191, VM_MISSRIGHT=192, VM_MISSRIGHT2=193, VM_MISSCENTER=194, VM_MISSCENTER2=195, VM_HAULBACK=196, VM_SWINGHARD=197, VM_SWINGMISS=198, VM_SWINGHIT=199, VM_IDLE_TO_LOWERED=200, VM_IDLE_LOWERED=201, VM_LOWERED_TO_IDLE=202, VM_RECOIL1=203, VM_RECOIL2=204, VM_RECOIL3=205, VM_PICKUP=206, VM_RELEASE=207,
  VM_DEPLOY=1817, VM_DEPLOYED=1818, VM_IDLE_EMPTY=1819, VM_PRIMARYATTACK_EMPTY=1820, VM_RELOAD_EMPTY=1821, VM_DRAW_EMPTY=1822, VM_SPRINT_IDLE=430, VM_SPRINT_ENTER=429, VM_SPRINT_LEAVE=431,
  SHOTGUN_RELOAD_START=267, SHOTGUN_RELOAD_FINISH=268, SHOTGUN_PUMP=269,
  HL2MP_IDLE=1779, HL2MP_WALK=1780, HL2MP_RUN=1781, HL2MP_IDLE_CROUCH=1782, HL2MP_WALK_CROUCH=1783, HL2MP_GESTURE_RANGE_ATTACK=1784, HL2MP_GESTURE_RELOAD=1785, HL2MP_JUMP=1786, HL2MP_SWIM=1787, HL2MP_SIT=1788,
  GMOD_GESTURE_AGREE=1610, GMOD_GESTURE_BECON=1611, GMOD_GESTURE_BOW=1612, GMOD_GESTURE_DISAGREE=1613, GMOD_TAUNT_SALUTE=1614, GMOD_GESTURE_WAVE=1615, GMOD_TAUNT_PERSISTENCE=1616, GMOD_TAUNT_MUSCLE=1617, GMOD_TAUNT_LAUGH=1618, GMOD_GESTURE_POINT=1619, GMOD_TAUNT_CHEER=1620, GMOD_TAUNT_ROBOT=1641, GMOD_TAUNT_DANCE=1642, GMOD_GESTURE_ITEM_GIVE=1643, GMOD_GESTURE_ITEM_DROP=1644, GMOD_GESTURE_ITEM_PLACE=1645, GMOD_GESTURE_ITEM_THROW=1646, GMOD_GESTURE_MELEE_SHOVE_2HAND=1647, GMOD_GESTURE_MELEE_SHOVE_1HAND=1648, GMOD_GESTURE_TAUNT_ZOMBIE=1649, GMOD_SHOWOFF_STAND_01=1650,
  MP_STAND_IDLE=1004, MP_CROUCH_IDLE=1006, MP_RUN=1015, MP_WALK=1013, MP_JUMP=1021, MP_SWIM=1025, MP_ATTACK_STAND_PRIMARYFIRE=1056, MP_ATTACK_CROUCH_PRIMARYFIRE=1057, MP_RELOAD_STAND=1062, MP_RELOAD_CROUCH=1066, MP_GESTURE_FLINCH_CHEST=1229 })

-- ---------- string ----------
function string.Explode(sep, s, pat)
  local r, i = {}, 1
  if sep == "" then for c = 1, #s do r[c] = string.sub(s, c, c) end return r end
  local n = 1
  while true do
    local a, b = string.find(s, sep, i, not pat)
    if not a then r[n] = string.sub(s, i); break end
    r[n] = string.sub(s, i, a - 1); n = n + 1; i = b + 1
  end
  return r
end
function string.Split(s, sep) return string.Explode(sep, s) end
function string.Implode(sep, t) return table.concat(t, sep) end
function string.Trim(s, c) c = c and string.PatternSafe(c) or "%s"; return (string.match(s, "^" .. c .. "*(.-)" .. c .. "*$")) or s end
function string.TrimLeft(s, c) c = c and string.PatternSafe(c) or "%s"; return (string.gsub(s, "^" .. c .. "*", "")) end
function string.TrimRight(s, c) c = c and string.PatternSafe(c) or "%s"; return (string.gsub(s, c .. "*$", "")) end
function string.StartWith(s, p) return string.sub(s, 1, #p) == p end
string.StartsWith = string.StartWith
function string.EndsWith(s, p) return p == "" or string.sub(s, -#p) == p end
function string.Left(s, n) return string.sub(s, 1, n) end
function string.Right(s, n) return string.sub(s, -n) end
function string.SetChar(s, k, v) return string.sub(s, 1, k - 1) .. v .. string.sub(s, k + 1) end
function string.GetChar(s, k) return string.sub(s, k, k) end
function string.PatternSafe(s) return (string.gsub(s, "[%-%.%+%[%]%(%)%$%^%%%?%*]", "%%%0")) end
function string.Replace(s, a, b) local r, i = "", 1; if a == "" then return s end
  while true do local x, y = string.find(s, a, i, true); if not x then return r .. string.sub(s, i) end r = r .. string.sub(s, i, x - 1) .. b; i = y + 1 end end
function string.ToTable(s) local t = {}; for i = 1, #s do t[i] = string.sub(s, i, i) end return t end
function string.Comma(n, sep) sep = sep or ","; local s = tostring(n); local k
  repeat s, k = string.gsub(s, "^(-?%d+)(%d%d%d)", "%1" .. sep .. "%2") until k == 0; return s end
function string.NiceSize(n) n = tonumber(n) or 0; if n <= 0 then return "0" end if n < 1024 then return n .. " Bytes" end
  if n < 1048576 then return math.Round(n / 1024, 2) .. " KB" end if n < 1073741824 then return math.Round(n / 1048576, 2) .. " MB" end return math.Round(n / 1073741824, 2) .. " GB" end
function string.NiceTime(s) s = tonumber(s) or 0; if s < 60 then return math.floor(s) .. " seconds" end if s < 3600 then return math.floor(s / 60) .. " minutes" end if s < 86400 then return math.floor(s / 3600) .. " hours" end return math.floor(s / 86400) .. " days" end
function string.FormattedTime(s, fmt) s = tonumber(s) or 0; local h = math.floor(s / 3600); local m = math.floor((s / 60) % 60); local ss = math.floor(s % 60); local ms = math.floor((s - math.floor(s)) * 100)
  if fmt then return string.format(fmt, m, ss, ms) end return { h = h, m = m, s = ss, ms = ms } end
function string.ToMinutesSeconds(s) local t = string.FormattedTime(s); return string.format("%02i:%02i", t.m + t.h * 60, t.s) end
function string.ToMinutesSecondsMilliseconds(s) local t = string.FormattedTime(s); return string.format("%02i:%02i:%02i", t.m + t.h * 60, t.s, t.ms) end
function string.GetExtensionFromFilename(p) return string.match(p, "%.([^%./\\]+)$") end
function string.StripExtension(p) return (string.match(p, "^(.+)%.[^%./\\]+$")) or p end
function string.GetPathFromFilename(p) return (string.match(p, "^(.*[/\\])[^/\\]-$")) or "" end
function string.GetFileFromFilename(p) return (string.match(p, "[/\\]?([^/\\]*)$")) or p end
function string.JavascriptSafe(s) return (string.gsub(string.gsub(string.gsub(s, "\\", "\\\\"), "\n", "\\n"), "'", "\\'")) end
function string.IsValid(s) return type(s) == "string" and s ~= "" end
function string.Interpolate(s, t) return (string.gsub(s, "{([%w_]+)}", function(k) local v = t[k]; return v ~= nil and tostring(v) or "{" .. k .. "}" end)) end
function string.CardinalToOrdinal(n) local d = n % 10; local dd = n % 100; if dd >= 11 and dd <= 13 then return n .. "th" end return n .. (d == 1 and "st" or d == 2 and "nd" or d == 3 and "rd" or "th") end
function string.FromColor(c) return string.format("%i %i %i %i", c.r, c.g, c.b, c.a) end
function string.ToColor(s) local r, g, b, a = string.match(s, "(%d+) (%d+) (%d+) (%d+)"); return Color(tonumber(r) or 255, tonumber(g) or 255, tonumber(b) or 255, tonumber(a) or 255) end
function string.Count(s, p) local _, n = string.gsub(s, string.PatternSafe(p), ""); return n end
function string.utf8len(s) local _, n = string.gsub(s, "[^\128-\191]", ""); return n end
STNDRD = string.CardinalToOrdinal

-- ---------- table ----------
function table.Count(t) local n = 0; for _ in pairs(t) do n = n + 1 end return n end
function table.HasValue(t, v) for _, x in pairs(t) do if x == v then return true end end return false end
function table.KeyFromValue(t, v) for k, x in pairs(t) do if x == v then return k end end end
function table.KeysFromValue(t, v) local r = {}; for k, x in pairs(t) do if x == v then r[#r + 1] = k end end return r end
function table.RemoveByValue(t, v) for k, x in ipairs(t) do if x == v then table.remove(t, k); return k end end for k, x in pairs(t) do if x == v then t[k] = nil; return k end end return false end
function table.IsEmpty(t) return next(t) == nil end
function table.Empty(t) for k in pairs(t) do t[k] = nil end end
function table.Copy(t, seen) if type(t) ~= "table" then return t end seen = seen or {}; if seen[t] then return seen[t] end
  local r = {}; seen[t] = r; setmetatable(r, getmetatable(t))
  for k, v in pairs(t) do if type(v) == "table" then r[k] = table.Copy(v, seen) elseif isvector(v) then r[k] = Vector(v) elseif isangle(v) then r[k] = Angle(v) else r[k] = v end end
  return r end
function table.CopyFromTo(a, b) table.Empty(b); table.Merge(b, a) end
function table.Merge(a, b, forzar) for k, v in pairs(b) do if type(v) == "table" and type(a[k]) == "table" and not forzar then table.Merge(a[k], v) else a[k] = v end end return a end
function table.Add(a, b) if type(b) ~= "table" then return a end for _, v in pairs(b) do a[#a + 1] = v end return a end
function table.Inherit(t, base) for k, v in pairs(base) do if t[k] == nil then t[k] = v end end t.BaseClass = base; return t end
function table.GetKeys(t) local r = {}; for k in pairs(t) do r[#r + 1] = k end return r end
function table.ClearKeys(t, guardar) local r = {}; for k, v in pairs(t) do r[#r + 1] = v; if guardar and type(v) == "table" then v.__key = k end end return r end
function table.Random(t) local n = table.Count(t); if n == 0 then return nil end local i = math.random(1, n); for k, v in pairs(t) do i = i - 1; if i == 0 then return v, k end end end
function table.Shuffle(t) for i = #t, 2, -1 do local j = math.random(i); t[i], t[j] = t[j], t[i] end return t end
function table.Reverse(t) local r = {}; local n = #t; for i = 1, n do r[i] = t[n - i + 1] end return r end
function table.Flip(t) local r = {}; for k, v in pairs(t) do r[v] = k end return r end
function table.GetFirstKey(t) return (next(t)) end
function table.GetFirstValue(t) local _, v = next(t); return v end
function table.GetLastKey(t) local k = #t; if k > 0 then return k end for x in pairs(t) do k = x end return k end
function table.GetLastValue(t) return t[table.GetLastKey(t)] end
function table.GetWinningKey(t) local mk, mv; for k, v in pairs(t) do if mv == nil or v > mv then mk, mv = k, v end end return mk end
function table.FindNext(t, v) local f = false; for _, x in ipairs(t) do if f then return x end if x == v then f = true end end return t[1] end
function table.FindPrev(t, v) local p = t[#t]; for _, x in ipairs(t) do if x == v then return p end p = x end return t[#t] end
function table.SortByKey(t, desc) local r = table.GetKeys(t); table.sort(r, function(a, b) if desc then return t[a] < t[b] end return t[a] > t[b] end) return r end
function table.SortByMember(t, m, asc) table.sort(t, function(a, b) if asc then return a[m] < b[m] end return a[m] > b[m] end) end
function table.SortDesc(t) table.sort(t, function(a, b) return a > b end) return t end
function table.MemberValuesFromKey(t, k) local r = {}; for _, v in pairs(t) do r[#r + 1] = v[k] end return r end
function table.LowerKeyNames(t) local r = {}; for k, v in pairs(t) do if type(k) == "string" then k = string.lower(k) end if type(v) == "table" then v = table.LowerKeyNames(v) end r[k] = v end return r end
function table.ForceInsert(t, v) t = t or {}; t[#t + 1] = v; return t end
function table.Sanitise(t) return t end
function table.DeSanitise(t) return t end
function table.ToString(t, nombre, lindo) local function s(x, n) if type(x) == "table" then local p = {}; for k, v in pairs(x) do p[#p + 1] = (type(k) == "string" and k .. " = " or "[" .. tostring(k) .. "] = ") .. s(v, n + 1) end return "{" .. table.concat(p, ", ") .. "}" end if type(x) == "string" then return string.format("%q", x) end return tostring(x) end
  return (nombre and nombre .. " = " or "") .. s(t, 0) end
function table.IsSequential(t) local i = 0; for _ in pairs(t) do i = i + 1; if t[i] == nil then return false end end return true end
function table.Pack(...) return { n = select("#", ...), ... } end
table.unpack = table.unpack or unpack
table.getn = table.getn or function(t) return #t end
function table.Inherit2(t, b) return table.Inherit(t, b) end

-- ---------- math ----------
math.Max, math.Min = math.max, math.min
function math.Clamp(v, a, b) return math.min(math.max(v, a), b) end
function math.Round(n, d) local m = 10 ^ (d or 0); return math.floor(n * m + 0.5) / m end
function math.Truncate(n, d) local m = 10 ^ (d or 0); return (n < 0 and math.ceil or math.floor)(n * m) / m end
function math.Approach(c, t, d) d = math.abs(d); if c < t then return math.min(c + d, t) elseif c > t then return math.max(c - d, t) end return t end
function math.NormalizeAngle(a) return (a + 180) % 360 - 180 end
function math.AngleDifference(a, b) local d = math.NormalizeAngle(a - b); if d < 180 then return d end return d - 360 end
function math.ApproachAngle(c, t, d) local x = math.AngleDifference(t, c); if x > d then return c + d elseif x < -d then return c - d end return t end
function math.Rand(a, b) return a + (b - a) * math.random() end
function math.Dist(x1, y1, x2, y2) return math.sqrt((x2 - x1) ^ 2 + (y2 - y1) ^ 2) end
math.Distance = math.Dist
function math.DistanceSqr(x1, y1, x2, y2) return (x2 - x1) ^ 2 + (y2 - y1) ^ 2 end
function math.Remap(v, a, b, c, d) return c + (d - c) * ((v - a) / (b - a)) end
function math.TimeFraction(a, b, c) return (c - a) / (b - a) end
function math.EaseInOut(f, ei, eo) if f == 0 or f == 1 then return f end return f * f * (3 - 2 * f) end
function math.BinToInt(s) return tonumber(s, 2) end
function math.IntToBin(n) local s = ""; n = math.floor(n); repeat s = (n % 2) .. s; n = math.floor(n / 2) until n == 0; return s end
function math.SnapTo(n, m) return math.floor(n / m + 0.5) * m end
function math.IsNearlyEqual(a, b, t) return math.abs(a - b) <= (t or 1e-7) end
function math.CHSpline(t, p0, m0, p1, m1) local t2, t3 = t * t, t * t * t; return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1 end
function math.CalcBSplineN() return 0 end
function math.BSplinePoint(t, pts) return pts[1] end
math.ease = math.ease or {}
for _, n in ipairs({ "InSine", "OutSine", "InOutSine", "InQuad", "OutQuad", "InOutQuad", "InCubic", "OutCubic", "InOutCubic", "InQuart", "OutQuart", "InOutQuart", "InQuint", "OutQuint", "InOutQuint", "InExpo", "OutExpo", "InOutExpo", "InCirc", "OutCirc", "InOutCirc", "InBack", "OutBack", "InOutBack", "InElastic", "OutElastic", "InOutElastic", "InBounce", "OutBounce", "InOutBounce" }) do
  local p = string.find(n, "InOut") and 3 or string.find(n, "In") == 1 and 1 or 2
  math.ease[n] = function(x) if p == 1 then return x * x elseif p == 2 then return 1 - (1 - x) * (1 - x) end return x < 0.5 and 2 * x * x or 1 - (-2 * x + 2) ^ 2 / 2 end
end

-- ---------- globales de util.lua ----------
function Lerp(t, a, b) return a + (b - a) * t end
function isstring(x) return type(x) == "string" end
function isnumber(x) return type(x) == "number" end
function istable(x) return type(x) == "table" end
function isfunction(x) return type(x) == "function" end
function isbool(x) return type(x) == "boolean" end
function isentity(x) return TypeID(x) == TYPE_ENTITY end
IsEntity = isentity
function isvector(x) return TypeID(x) == TYPE_VECTOR end
function isangle(x) return TypeID(x) == TYPE_ANGLE end
function ismatrix(x) return TypeID(x) == TYPE_MATRIX end
function ispanel(x) return TypeID(x) == TYPE_PANEL end
function IsTableOfEntitiesValid(t) for _, e in pairs(t) do if not IsValid(e) then return false end end return true end
function tobool(v) if v == nil or v == false or v == 0 or v == "0" or v == "false" or v == "" then return false end return true end
util.tobool = tobool
function Either(c, a, b) if c then return a end return b end
function AngleRand(a, b) return Angle(math.Rand(a or -90, b or 90), math.Rand(a or -180, b or 180), math.Rand(a or -180, b or 180)) end
function ColorRand(alfa) return Color(math.random(0, 255), math.random(0, 255), math.random(0, 255), alfa and math.random(0, 255) or 255) end
function IsFriendEntityName(n) return n == "npc_alyx" or n == "npc_barney" or n == "npc_citizen" or n == "npc_dog" or n == "npc_eli" or n == "npc_kleiner" or n == "npc_monk" or n == "npc_mossman" or n == "npc_vortigaunt" or n == "npc_breen" or n == "npc_gman" end
function IsEnemyEntityName(n) return not IsFriendEntityName(n) and string.sub(n or "", 1, 4) == "npc_" end
function ValidPanel(p) return IsValid(p) end
function PrintTable(t, ind, hechos)
  ind = ind or 0; hechos = hechos or {}; hechos[t] = true
  local ks = table.GetKeys(t); table.sort(ks, function(a, b) return tostring(a) < tostring(b) end)
  for _, k in ipairs(ks) do local v = t[k]
    if type(v) == "table" and not hechos[v] then hechos[v] = true; Msg(string.rep("\t", ind) .. tostring(k) .. ":\n"); PrintTable(v, ind + 2, hechos)
    else Msg(string.rep("\t", ind) .. tostring(k) .. "\t=\t" .. tostring(v) .. "\n") end end
end
local function ordenados(t, f) local ks = {}; for k in pairs(t) do ks[#ks + 1] = k end; table.sort(ks, f); local i = 0
  return function() i = i + 1; local k = ks[i]; if k ~= nil then return k, t[k] end end end
function SortedPairs(t, desc) return ordenados(t, function(a, b) if type(a) ~= type(b) then a, b = tostring(a), tostring(b) end if desc then return a > b end return a < b end) end
function SortedPairsByValue(t, desc) return ordenados(t, function(a, b) local x, y = t[a], t[b]; if desc then return x > y end return x < y end) end
function SortedPairsByMemberValue(t, m, desc) return ordenados(t, function(a, b) local x, y = t[a][m], t[b][m]; if desc then return x > y end return x < y end) end
function RandomPairs(t) local ks = table.Shuffle(table.GetKeys(t)); local i = 0; return function() i = i + 1; local k = ks[i]; if k ~= nil then return k, t[k] end end end
function AccessorFunc(t, campo, nombre, forzar)
  t["Get" .. nombre] = function(s) return s[campo] end
  if forzar == FORCE_STRING then t["Set" .. nombre] = function(s, v) s[campo] = tostring(v) end return end
  if forzar == FORCE_NUMBER then t["Set" .. nombre] = function(s, v) s[campo] = tonumber(v) end return end
  if forzar == FORCE_BOOL then t["Set" .. nombre] = function(s, v) s[campo] = tobool(v) end return end
  t["Set" .. nombre] = function(s, v) s[campo] = v end
end
FORCE_STRING, FORCE_NUMBER, FORCE_BOOL, FORCE_ANGLE, FORCE_COLOR, FORCE_VECTOR = 1, 2, 3, 4, 5, 6
function TimedSin(f, mn, mx, off) return math.sin(f * math.pi * 2 * CurTime() + (off or 0)) * (mx - mn) * 0.5 + (mx + mn) * 0.5 end
function TimedCos(f, mn, mx, off) return math.cos(f * math.pi * 2 * CurTime() + (off or 0)) * (mx - mn) * 0.5 + (mx + mn) * 0.5 end
function UTIL_IsUselessModel(m) m = string.lower(m or ""); return m == "" or string.find(m, "_gesture") ~= nil or string.find(m, "_anim") ~= nil or string.find(m, "_shared") ~= nil end
function IsUselessModel(m) return UTIL_IsUselessModel(m) end
function Model(m) return m end
function Sound(s) return s end
function OrderVectors(a, b) local lo = Vector(math.min(a.x, b.x), math.min(a.y, b.y), math.min(a.z, b.z)); local hi = Vector(math.max(a.x, b.x), math.max(a.y, b.y), math.max(a.z, b.z)); a:Set(lo); b:Set(hi) end
function CompileFile(r) return function() return include(r) end end
function DOF_Kill() end function DOF_Start() end
function ScreenScale(n) return n * (ScrW() / 640) end
function ScreenScaleH(n) return n * (ScrH() / 480) end
SScale = ScreenScale
function DebugInfo() end
function DamageInfo2() return DamageInfo() end
function GetConVar_Internal(n) return GetConVar(n) end
function PrecacheParticleSystem() end
function ParticleEffect(n, p, a, e) local d = EffectData(); d:SetOrigin(p); util.Effect(n, d) end
function ParticleEffectAttach(n, t, e, att) if IsValid(e) then local d = EffectData(); d:SetOrigin(e:GetPos()); util.Effect(n, d) end end
function CreateParticleSystem() return setmetatable({}, { __index = function() return function() end end }) end
function game.AddParticles() end
function Derma_Message() end function Derma_Query() end function Derma_StringRequest() end function Derma_DrawBackgroundBlur() end
function Derma_Hook() end function Derma_Install_Convar_Functions() end
function RememberCursorPosition() end function RestoreCursorPosition() end
function AddOriginToPVS() end
function HTTP(t) if t and t.failed then t.failed("sin http") end return false end
function GetHUDPanel() return vgui.GetWorldPanel() end
function SuppressHostEvents() end
function EmitSound(s, p, ent, ch, vol, lvl, fl, tono) sound.Play(s, p, lvl, tono, vol) end
function EmitSentence() end
function PrintMessage(t, s) if t == HUD_PRINTCENTER or t == HUD_PRINTTALK then notification.AddLegacy(s, 0, 3) else Msg(s .. "\n") end end
function AddConsoleCommand() end
function IsInGame() return true end
function LocalToWorld2() end
function NumModelSkins() return 1 end
function GetPredictionPlayer() return LocalPlayer() end
function DisableClipping() return false end
function DrawBloom() end
function Add_NPC_Class(n) _G[n] = (_G.__npcClases or 30); _G.__npcClases = _G[n] + 1 end
function FixInvalidPhysicsObject() end

-- ---------- valores fijos de GMod ----------
vector_origin, vector_up, angle_zero = Vector(0, 0, 0), Vector(0, 0, 1), Angle(0, 0, 0)
color_white, color_black, color_transparent = Color(255, 255, 255, 255), Color(0, 0, 0, 255), Color(255, 255, 255, 0)
for _, n in ipairs({ "CMoveData", "CUserCmd", "ConVar", "IMaterial", "ITexture", "CEffectData", "CTakeDamageInfo", "CSoundPatch", "IMesh", "VMatrix", "NextBot", "CNavArea", "PathFollower", "CLuaLocomotion", "CRecipientFilter", "File", "CLuaParticle", "CLuaEmitter", "ProjectedTexture", "CNewParticleEffect", "SurfaceInfo", "bf_read", "IRestore", "ISave" }) do FindMetaTable(n) end

-- ---------- gmod, saverestore y la base de los efectos ----------
gmod = gmod or {}
function gmod.GetGamemode() return GAMEMODE end
saverestore = saverestore or {}
for _, n in ipairs({ "AddSaveHook", "AddRestoreHook", "WriteTable", "ReadTable", "WriteVar", "ReadVar", "PreSave", "PreRestore", "LoadEntity", "SaveEntity" }) do saverestore[n] = function() end end
__EFFECT_BASE = {}
-- (la de GMod, gamemodes/base/entities/effects/base.lua: desde la boca del arma de la vista, o del modelo del mundo)
function __EFFECT_BASE:GetTracerShootPos(Position, Ent, Attachment)
  self.ViewModelTracer = false
  if not IsValid(Ent) then return Position end
  if not Ent:IsWeapon() then return Position end
  if Ent:IsCarriedByLocalPlayer() and not LocalPlayer():ShouldDrawLocalPlayer() then
    local ViewModel = LocalPlayer():GetViewModel()
    if ViewModel:IsValid() then
      local att = ViewModel:GetAttachment(Attachment)
      if att then Position = att.Pos; self.ViewModelTracer = true end
    end
  else
    local att = Ent:GetAttachment(Attachment)
    if att then Position = att.Pos end
  end
  return Position
end
function __EFFECT_BASE:Render() end
function __EFFECT_BASE:Think() return false end

-- ---------- coroutine.wait de GMod ----------
function coroutine.wait(s) local t = CurTime() + (tonumber(s) or 0) while CurTime() < t do coroutine.yield() end end
-- ---------- NPC de una clase de un addon (menú de NPCs) ----------
function __gmCrearNPC(c, pos, m)
  local e = ents.Create(c) if not IsValid(e) then return end
  e:SetPos(pos) if m then e:SetModel(m) end
  e:Spawn() e:Activate() return e
end
-- ---------- list, language ----------
list = list or {}
do local L = {}
  function list.Get(n) L[n] = L[n] or {}; return table.Copy(L[n]) end
  function list.GetForEdit(n) L[n] = L[n] or {}; return L[n] end
  function list.GetTable() return table.GetKeys(L) end
  function list.Set(n, k, v) L[n] = L[n] or {}; L[n][k] = v; if __gmLista then __gmLista(n, k, v) end end
  function list.Add(n, v) L[n] = L[n] or {}; L[n][#L[n] + 1] = v end
  function list.Contains(n, k) return L[n] ~= nil and L[n][k] ~= nil end
  function list.HasEntry(n, k) return L[n] ~= nil and L[n][k] ~= nil end
end
language = language or {}
do local F = {}
  function language.Add(k, v) F[k] = v end
  function language.GetPhrase(k) if type(k) ~= "string" then return k end local s = string.gsub(k, "^#", ""); return F[s] or F[k] or s end
end

-- ---------- vgui y derma: paneles que aceptan todo (la UI de GMod no se dibuja; lo que dibuja la HUD sí) ----------
vgui = vgui or {}
do
  local PM = {}
  local panelMeta = { MetaName = "Panel", __index = function(p, k)
    local v = rawget(PM, k); if v ~= nil then return v end
    local cls = rawget(p, "__clase"); if cls then v = cls[k]; if v ~= nil then return v end end
    if type(k) == "string" and (string.sub(k, 1, 3) == "Get" or string.sub(k, 1, 2) == "Is" or string.sub(k, 1, 3) == "Has") then
      return function() return 0, 0 end
    end
    return function(s) return s end
  end, __tostring = function(p) return "Panel: [" .. tostring(rawget(p, "__nombre")) .. "]" end }
  RegisterMetaTable("Panel", PM)
  PM.MetaName = "Panel"
  local registro = {}
  function PM:IsValid() return not rawget(self, "__quitado") end
  function PM:Remove() rawset(self, "__quitado", true) end
  function PM:GetSize() return rawget(self, "__w") or 64, rawget(self, "__h") or 24 end
  function PM:SetSize(w, h) rawset(self, "__w", w); rawset(self, "__h", h) end
  function PM:GetWide() return rawget(self, "__w") or 64 end
  function PM:GetTall() return rawget(self, "__h") or 24 end
  function PM:SetWide(w) rawset(self, "__w", w) end
  function PM:SetTall(h) rawset(self, "__h", h) end
  function PM:GetPos() return rawget(self, "__x") or 0, rawget(self, "__y") or 0 end
  function PM:SetPos(x, y) rawset(self, "__x", x); rawset(self, "__y", y) end
  function PM:GetParent() return rawget(self, "__padre") end
  function PM:GetChildren() return rawget(self, "__hijos") or {} end
  function PM:GetText() return rawget(self, "__texto") or "" end
  function PM:SetText(t) rawset(self, "__texto", t) end
  function PM:GetValue() return rawget(self, "__valor") or 0 end
  function PM:SetValue(v) rawset(self, "__valor", v) end
  function PM:IsVisible() return rawget(self, "__oculto") ~= true end
  function PM:SetVisible(v) rawset(self, "__oculto", not v) end
  function PM:GetName() return rawget(self, "__nombre") or "" end
  function PM:GetClassName() return rawget(self, "__nombre") or "Panel" end
  function PM:GetTable() return self end
  function PM:Add(c) return vgui.Create(c, self) end
  function PM:GetContentSize() return 64, 24 end
  function PM:ChildCount() return #(rawget(self, "__hijos") or {}) end
  function PM:GetChild(i) return (rawget(self, "__hijos") or {})[i + 1] end
  function PM:LocalToScreen(x, y) return x, y end
  function PM:ScreenToLocal(x, y) return x, y end
  function PM:CursorPos() return 0, 0 end
  function PM:GetAlpha() return 255 end
  function PM:GetDock() return NODOCK end
  local function nuevo(clase, padre, nombre)
    local p = setmetatable({ __nombre = nombre or clase, __padre = padre, __clase = registro[clase] }, panelMeta)
    if padre and type(padre) == "table" then local h = rawget(padre, "__hijos"); if not h then h = {}; rawset(padre, "__hijos", h) end h[#h + 1] = p end
    -- (como GMod: sólo el Init de la clase, que llama al de su base con self.BaseClass.Init si quiere)
    local c = registro[clase]
    local f = c and c.Init
    if f then local ok, e = pcall(f, p); if not ok then ErrorNoHalt("vgui " .. tostring(clase) .. ": " .. tostring(e)) end end
    return p
  end
  function vgui.Create(clase, padre, nombre) return nuevo(clase, padre, nombre) end
  function vgui.CreateFromTable(t, padre, nombre) local p = nuevo(nil, padre, nombre); rawset(p, "__clase", t); if t and t.Init then pcall(t.Init, p) end return p end
  -- (la base de todo: métodos que no hacen nada, así self.BaseClass.Init/Paint/Think de un panel derivado de Panel anda)
  local panelBase = setmetatable({}, { __index = function() return function() end end })
  function vgui.Register(n, t, base) t.__base = registro[base or "Panel"]; if t.__base then setmetatable(t, { __index = t.__base }) end rawset(t, "BaseClass", t.__base or panelBase); t.Base = base or "Panel"; registro[n] = t; t.ThisClass = n; baseclass.Set(n, t); return t end
  function vgui.RegisterTable(t, base) t.__base = registro[base or "Panel"]; if t.__base then setmetatable(t, { __index = t.__base }) end rawset(t, "BaseClass", t.__base or panelBase); t.Base = base or "Panel"; return t end
  function vgui.RegisterFile() end
  function vgui.GetControlTable(n) return registro[n] end
  function vgui.Exists(n) return registro[n] ~= nil end
  local mundo = setmetatable({ __nombre = "WorldPanel" }, panelMeta)
  function vgui.GetWorldPanel() return mundo end
  function vgui.GetHoveredPanel() return nil end
  function vgui.GetKeyboardFocus() return nil end
  function vgui.CursorVisible() return false end
  function vgui.IsHoveringWorld() return true end
  function vgui.FocusedHasParent() return false end
  for _, n in ipairs({ "Panel", "EditablePanel", "DPanel", "DFrame", "DButton", "DLabel", "DImage", "DImageButton", "DTextEntry", "DNumSlider", "DCheckBox", "DCheckBoxLabel", "DComboBox", "DListView", "DScrollPanel", "DPropertySheet", "DCollapsibleCategory", "DForm", "DGrid", "DIconLayout", "DModelPanel", "DColorMixer", "DHTML", "HTML", "DMenu", "DMenuBar", "DTree", "DListLayout", "DNumberWang", "DProgress", "DBinder", "DHorizontalScroller", "DVerticalDivider", "DHorizontalDivider", "DTileLayout", "DSprite", "DShape", "DPanelList", "DCategoryList", "DAdjustableModelPanel", "DColorButton", "DRGBPicker", "DColorCube", "DAlphaBar", "DExpandButton", "DSizeToContents", "DKillIcon", "DNotify", "DTooltip", "DDrawer", "DCategoryHeader", "SpawnIcon", "ContentIcon", "Label", "Button", "TextEntry", "RichText", "ImageCheckBox", "Slider", "DSlider", "DScrollBarGrip", "DVScrollBar", "DEntityProperties", "DProperties", "DFileBrowser", "DIconBrowser", "DLabelEditable", "DLabelURL", "DMenuOption", "DMenuOptionCVar", "DListBox", "DModelSelect", "DModelSelectMulti", "DPanelSelect", "DTab", "DCheckBoxLabel", "DGrid", "ControlPanel", "DNumPad", "DImageButton", "AvatarImage", "Material", "PropSelect", "CtrlNumPad", "DTextEntry" }) do
    if not registro[n] then registro[n] = { ThisClass = n } end
  end
  derma = derma or {}
  function derma.DefineControl(n, d, t, b) t.Derma = { ClassName = n, Description = d, BaseClass = b }; local r = vgui.Register(n, t, b); _G[n] = t; return r end
  function derma.GetDefaultSkin() return {} end
  function derma.GetNamedSkin() return {} end
  function derma.DefineSkin() end
  function derma.SkinHook() end
  function derma.Color(n, p, d) return d or Color(255, 255, 255) end
  function derma.RefreshSkins() end
  function derma.GetControlList() return {} end
  function derma.SkinChangeIndex() return 0 end
  derma.Controls = {}
  function DermaMenu() return vgui.Create("DMenu") end
end

-- ---------- bases de las clases: weapon_base, base_anim, base_gmodentity, base_ai, base_nextbot ----------
do
  local SWEP = { Base = nil, Folder = "weapons/weapon_base", ClassName = "weapon_base",
    PrintName = "Scripted Weapon", Author = "", Contact = "", Purpose = "", Instructions = "", Category = "Other",
    ViewModelFOV = 62, ViewModelFlip = false, ViewModel = "models/weapons/v_pistol.mdl", WorldModel = "models/weapons/w_357.mdl",
    Spawnable = false, AdminOnly = false, AdminSpawnable = false, Slot = 0, SlotPos = 10, DrawAmmo = true, DrawCrosshair = true, Weight = 5, AutoSwitchTo = true, AutoSwitchFrom = true, BounceWeaponIcon = true, DrawWeaponInfoBox = true, SwayScale = 1, BobScale = 1, UseHands = false, m_WeaponDeploySpeed = 1,
    Primary = { ClipSize = 8, DefaultClip = 32, Automatic = false, Ammo = "Pistol" },
    Secondary = { ClipSize = 8, DefaultClip = 32, Automatic = false, Ammo = "Pistol" } }
  function SWEP:Initialize() self:SetHoldType("pistol") end
  function SWEP:PrimaryAttack()
    if not self:CanPrimaryAttack() then return end
    self:EmitSound("Weapon_AR2.Single")
    self:ShootBullet(150, 1, 0.01, self.Primary.Ammo)
    self:TakePrimaryAmmo(1)
    if IsValid(self.Owner) and self.Owner.ViewPunch then self.Owner:ViewPunch(Angle(-1, 0, 0)) end
  end
  function SWEP:SecondaryAttack()
    if not self:CanSecondaryAttack() then return end
    self:EmitSound("Weapon_Shotgun.Single")
    self:ShootBullet(150, 9, 0.2, self.Secondary.Ammo)
    self:TakeSecondaryAmmo(1)
  end
  function SWEP:Reload() self:DefaultReload(ACT_VM_RELOAD) end
  function SWEP:Think() end
  function SWEP:Holster() return true end
  function SWEP:Deploy() return true end
  function SWEP:OnRemove() end
  function SWEP:OwnerChanged() end
  function SWEP:OnDrop() end
  function SWEP:Equip() end
  function SWEP:EquipAmmo() end
  function SWEP:ShouldDropOnDie() return true end
  function SWEP:ShootEffects()
    self:SendWeaponAnim(ACT_VM_PRIMARYATTACK)
    if IsValid(self.Owner) then self.Owner:MuzzleFlash(); self.Owner:SetAnimation(PLAYER_ATTACK1) end
  end
  function SWEP:ShootBullet(dano, n, cono, municion, fuerza, trazador)
    local o = self.Owner; if not IsValid(o) then return end
    local b = { Num = n or 1, Src = o:GetShootPos(), Dir = o:GetAimVector(), Spread = Vector(cono or 0, cono or 0, 0), Tracer = trazador or 5, Force = fuerza or 1, Damage = dano or 1, AmmoType = municion or self.Primary.Ammo }
    o:FireBullets(b)
    self:ShootEffects()
  end
  function SWEP:TakePrimaryAmmo(n)
    if self:Clip1() <= 0 then if self:Ammo1() <= 0 then return end self.Owner:RemoveAmmo(n, self:GetPrimaryAmmoType()) return end
    self:SetClip1(self:Clip1() - n)
  end
  function SWEP:TakeSecondaryAmmo(n)
    if self:Clip2() <= 0 then if self:Ammo2() <= 0 then return end self.Owner:RemoveAmmo(n, self:GetSecondaryAmmoType()) return end
    self:SetClip2(self:Clip2() - n)
  end
  function SWEP:CanPrimaryAttack()
    if self:Clip1() <= 0 and self.Primary.ClipSize > 0 then self:EmitSound("Weapon_Pistol.Empty"); self:SetNextPrimaryFire(CurTime() + 0.2); self:Reload(); return false end
    return true
  end
  function SWEP:CanSecondaryAttack()
    if self:Clip2() <= 0 and self.Secondary.ClipSize > 0 then self:EmitSound("Weapon_Pistol.Empty"); self:SetNextSecondaryFire(CurTime() + 0.2); return false end
    return true
  end
  function SWEP:Ammo1() return IsValid(self.Owner) and self.Owner:GetAmmoCount(self:GetPrimaryAmmoType()) or 0 end
  function SWEP:Ammo2() return IsValid(self.Owner) and self.Owner:GetAmmoCount(self:GetSecondaryAmmoType()) or 0 end
  function SWEP:DoImpactEffect() return false end
  function SWEP:FireAnimationEvent() end
  function SWEP:DrawHUD() end
  function SWEP:DrawHUDBackground() end
  function SWEP:DrawWeaponSelection() end
  function SWEP:PrintWeaponInfo() end
  function SWEP:DrawWorldModel() self:DrawModel() end
  function SWEP:DrawWorldModelTranslucent() self:DrawModel() end
  function SWEP:GetViewModelPosition(p, a) return p, a end
  function SWEP:CalcViewModelView(vm, op, oa, p, a) return p, a end
  function SWEP:TranslateFOV(f) return f end
  function SWEP:AdjustMouseSensitivity() return nil end
  function SWEP:CustomAmmoDisplay() end
  function SWEP:FreezeMovement() return false end
  function SWEP:ViewModelDrawn() end
  function SWEP:PreDrawViewModel() end
  function SWEP:PostDrawViewModel() end
  function SWEP:HUDShouldDraw() return true end
  function SWEP:ShouldDrawViewModel() return true end
  function SWEP:SetDeploySpeed(s) self.m_WeaponDeploySpeed = tonumber(s) end
  function SWEP:SetupDataTables() end
  function SWEP:TranslateActivity(a) return -1 end
  function SWEP:NPCShoot_Primary() self:PrimaryAttack() end
  function SWEP:NPCShoot_Secondary() self:SecondaryAttack() end
  function SWEP:GetCapabilities() return 0 end
  function SWEP:OnRestore() end
  function SWEP:OnReloaded() end
  function SWEP:AcceptInput() return false end
  function SWEP:KeyValue() end
  function SWEP:Precache() end
  function SWEP:CalcView(p, pos, ang, fov) return pos, ang, fov end
  weapons.Register(SWEP, "weapon_base")

  local ENT = { Type = "anim", Base = nil, ClassName = "base_entity", PrintName = "", Author = "", Contact = "", Purpose = "", Instructions = "", Spawnable = false, AdminOnly = false, RenderGroup = RENDERGROUP_OPAQUE, AutomaticFrameAdvance = false }
  function ENT:Initialize() end
  function ENT:Think() end
  function ENT:OnRemove() end
  function ENT:Draw() self:DrawModel() end
  function ENT:DrawTranslucent() self:Draw() end
  function ENT:PhysicsCollide() end
  function ENT:PhysicsUpdate() end
  function ENT:Touch() end
  function ENT:StartTouch() end
  function ENT:EndTouch() end
  function ENT:Use() end
  function ENT:OnTakeDamage() end
  function ENT:SetupDataTables() end
  function ENT:KeyValue() end
  function ENT:AcceptInput() return false end
  function ENT:UpdateTransmitState() return TRANSMIT_PVS end
  function ENT:CanProperty() return true end
  function ENT:CanTool() return true end
  function ENT:SpawnFunction(ply, tr, clase)
    if not tr.Hit then return end
    local e = ents.Create(clase or self.ClassName)
    e:SetPos(tr.HitPos + tr.HitNormal * 16)
    e:Spawn(); e:Activate()
    return e
  end
  function ENT:OnRestore() end
  function ENT:OnReloaded() end
  function ENT:StoreOutput() end
  function ENT:TriggerOutput() end
  function ENT:PassesTriggerFilters() return true end
  function ENT:PhysicsSimulate() return SIM_NOTHING end
  function ENT:GravGunPunt() return true end
  function ENT:GravGunPickupAllowed() return true end
  function ENT:PhysgunPickup() return true end
  function ENT:ImpactTrace() end
  scripted_ents.Register(ENT, "base_entity")
  local A = table.Copy(ENT); A.ClassName = "base_anim"; A.Base = "base_entity"
  scripted_ents.Register(A, "base_anim")
  local G = table.Copy(ENT); G.ClassName = "base_gmodentity"; G.Base = "base_anim"
  function G:SetOverlayText(t) self:SetNWString("GModOverlayText", t) end
  function G:GetOverlayText() return self:GetNWString("GModOverlayText") end
  function G:SetPlayer(p) self.Founder = p end
  function G:GetPlayer() return self.Founder or NULL end
  scripted_ents.Register(G, "base_gmodentity")
  local P = table.Copy(ENT); P.ClassName = "base_point"; P.Type = "point"; P.Base = "base_entity"
  scripted_ents.Register(P, "base_point")
  local B = table.Copy(ENT); B.ClassName = "base_brush"; B.Type = "brush"; B.Base = "base_entity"
  scripted_ents.Register(B, "base_brush")
  local F = table.Copy(ENT); F.ClassName = "base_filter"; F.Type = "filter"; F.Base = "base_entity"
  scripted_ents.Register(F, "base_filter")
  local N = table.Copy(ENT); N.ClassName = "base_ai"; N.Type = "ai"; N.Base = "base_entity"; N.AutomaticFrameAdvance = true
  function N:SelectSchedule() end
  function N:StartSchedule() end
  function N:RunAI() end
  function N:TaskStart_FindEnemy() end
  function N:Task_FindEnemy() self:TaskComplete() end
  function N:TaskComplete() end
  function N:OnCondition() end
  function N:StartEngineTask() end
  function N:RunEngineTask() end
  scripted_ents.Register(N, "base_ai")
  local NB = table.Copy(ENT); NB.ClassName = "base_nextbot"; NB.Type = "nextbot"; NB.Base = "base_entity"
  function NB:RunBehaviour() end
  -- (como el base_nextbot de GMod: la corrutina de RunBehaviour, que cada cuadro sigue hasta su próximo yield)
  function NB:BehaveStart() self.BehaveThread = coroutine.create(function() self:RunBehaviour() end) end
  function NB:BehaveUpdate(fInterval)
    if not self.BehaveThread then return end
    if coroutine.status(self.BehaveThread) == "dead" then self.BehaveThread = nil return end
    local ok, message = coroutine.resume(self.BehaveThread)
    if ok == false then self.BehaveThread = nil ErrorNoHalt(tostring(self) .. " Error: " .. tostring(message) .. "\n") end
  end
  function NB:MoveToPos(pos, options)
    options = options or {}
    local path = Path("Follow")
    path:SetMinLookAheadDistance(options.lookahead or 300)
    path:SetGoalTolerance(options.tolerance or 20)
    path:Compute(self, pos)
    if not path:IsValid() then return "failed" end
    while path:IsValid() do
      path:Update(self)
      if self.loco:IsStuck() then self:HandleStuck() return "stuck" end
      if options.maxage and path:GetAge() > options.maxage then return "timeout" end
      if options.repath and path:GetAge() > options.repath then path:Compute(self, pos) end
      coroutine.yield()
    end
    return "ok"
  end
  function NB:PlaySequenceAndWait(name, speed)
    local len = self:SetSequence(name)
    speed = speed or 1
    self:ResetSequenceInfo() self:SetCycle(0) self:SetPlaybackRate(speed)
    coroutine.wait((len or 0) / speed)
  end
  function NB:HandleStuck() self.loco:ClearStuck() end
  -- (sin malla de navegación: un lugar al azar dentro del radio)
  function NB:FindSpot(type, options) options = options or {} local r = options.radius or 1000 return self:GetPos() + Vector(math.Rand(-r, r), math.Rand(-r, r), 0) end
  function NB:FindSpots(options) local t = {} for i = 1, 5 do t[i] = { vector = self:FindSpot("random", options), distance = 0 } end return t end
  function NB:BodyUpdate() end
  function NB:OnStuck() end
  function NB:OnUnStuck() end
  function NB:OnInjured() end
  function NB:OnKilled(dmg) hook.Run("OnNPCKilled", self, dmg:GetAttacker(), dmg:GetInflictor()); self:BecomeRagdoll(dmg) end
  function NB:OnOtherKilled() end
  function NB:OnContact() end
  function NB:OnLandOnGround() end
  function NB:OnLeaveGround() end
  function NB:OnNavAreaChanged() end
  scripted_ents.Register(NB, "base_nextbot")
  local V = table.Copy(ENT); V.ClassName = "base_vehicle"; V.Type = "vehicle"; V.Base = "base_entity"
  scripted_ents.Register(V, "base_vehicle")
end

-- ---------- la base de las armas de TTT (Trouble in Terrorist Town) ----------
-- Las armas hechas para TTT heredan de weapon_tttbase (y las granadas de weapon_tttbasegrenade), que vienen con ese modo
-- de juego. Acá van bases propias con lo que esas armas usan (tipos de arma, roles, mira de hierro, disparo con retroceso
-- y dispersión, granadas que se tiran y explotan): así andan en el sandbox.
WEAPON_NONE, WEAPON_MELEE, WEAPON_PISTOL, WEAPON_HEAVY, WEAPON_NADE, WEAPON_CARRY, WEAPON_EQUIP1, WEAPON_EQUIP2, WEAPON_ROLE = 0, 1, 2, 3, 4, 5, 6, 7, 8
WEAPON_EQUIP = WEAPON_EQUIP1; WEAPON_UNARMED = -1
ROLE_INNOCENT, ROLE_TRAITOR, ROLE_DETECTIVE = 0, 1, 2; ROLE_NONE = ROLE_INNOCENT
EQUIP_NONE, EQUIP_ARMOR, EQUIP_RADAR, EQUIP_DISGUISE = 0, 1, 2, 4
LANG = LANG or { AddToLanguage = function() end, GetTranslation = function(n) return n end, GetParamTranslation = function(n) return n end, TryTranslation = function(n) return n end, GetUnsafeLanguageTable = function() return {} end, GetRawTranslation = function(n) return n end }
GetTranslation = GetTranslation or function(n) return n end
GetPTranslation = GetPTranslation or function(n) return n end
do
  local P = FindMetaTable and FindMetaTable("Player")
  if P then
    local function no() return false end
    P.IsTraitor = P.IsTraitor or no; P.IsDetective = P.IsDetective or no; P.IsActiveTraitor = P.IsActiveTraitor or no; P.IsActiveDetective = P.IsActiveDetective or no
    P.IsSpecial = P.IsSpecial or no; P.IsActiveSpecial = P.IsActiveSpecial or no; P.IsSpec = P.IsSpec or no
    P.IsTerror = P.IsTerror or function(s) return s:Alive() end; P.IsActive = P.IsActive or function(s) return s:Alive() end
    P.GetRole = P.GetRole or function() return ROLE_INNOCENT end; P.IsRole = P.IsRole or function(s, r) return r == ROLE_INNOCENT end
    P.GetCredits = P.GetCredits or function() return 0 end; P.SetCredits = P.SetCredits or function() end; P.SubtractCredits = P.SubtractCredits or function() end
    P.HasEquipmentItem = P.HasEquipmentItem or no; P.GetEquipmentItems = P.GetEquipmentItems or function() return EQUIP_NONE end
    P.CanCarryType = P.CanCarryType or function() return true end
  end
end
do
  local SWEP = { Base = "weapon_base", Folder = "weapons/weapon_tttbase", ClassName = "weapon_tttbase", PrintName = "TTT", Category = "TTT",
    Spawnable = false, Kind = WEAPON_NONE, AutoSpawnable = false, AllowDrop = true, IsSilent = false, NoSights = false, HeadshotMultiplier = 2.7, DeploySpeed = 1.4,
    Primary = { Sound = "Weapon_Pistol.Single", Recoil = 1.5, Damage = 1, NumShots = 1, Cone = 0.02, Delay = 0.15, ClipSize = -1, DefaultClip = -1, Automatic = false, Ammo = "none", ClipMax = -1 },
    Secondary = { ClipSize = 1, DefaultClip = 1, Automatic = false, Ammo = "none", ClipMax = -1 } }
  function SWEP:SetIronsights(b) self.__mira = b and true or false end
  function SWEP:GetIronsights() return self.__mira == true end
  function SWEP:Initialize() if self.HoldType then self:SetHoldType(self.HoldType) end self:SetIronsights(false); if self.SetDeploySpeed then self:SetDeploySpeed(self.DeploySpeed or 1.4) end end
  function SWEP:GetPrimaryCone() local c = self.Primary.Cone or 0.2; return self:GetIronsights() and c * 0.85 or c end
  function SWEP:GetHeadshotMultiplier() return self.HeadshotMultiplier or 2.7 end
  function SWEP:IsEquipment() return self.Kind == WEAPON_EQUIP1 or self.Kind == WEAPON_EQUIP2 end
  function SWEP:PrimaryAttack(worldsnd)
    self:SetNextSecondaryFire(CurTime() + 0.1)
    self:SetNextPrimaryFire(CurTime() + (self.Primary.Delay or 0.15))
    if not self:CanPrimaryAttack() then return end
    if self.Primary.Sound then self:EmitSound(self.Primary.Sound, self.Primary.SoundLevel) end
    self:ShootBullet(self.Primary.Damage, self.Primary.Recoil, self.Primary.NumShots, self:GetPrimaryCone())
    self:TakePrimaryAmmo(1)
    local o, r = self.Owner, self.Primary.Recoil or 1
    if IsValid(o) and o.ViewPunch then o:ViewPunch(Angle(math.Rand(-0.2, -0.1) * r, math.Rand(-0.1, 0.1) * r, 0)) end
  end
  function SWEP:DryFire(setnext)
    self:EmitSound("Weapon_Pistol.Empty")
    if setnext then setnext(self, CurTime() + 0.2) end
    self:Reload()
  end
  function SWEP:CanPrimaryAttack()
    if not IsValid(self.Owner) then return false end
    if self:Clip1() <= 0 and (self.Primary.ClipSize or 0) > 0 then self:DryFire(self.SetNextPrimaryFire); return false end
    return true
  end
  function SWEP:CanSecondaryAttack()
    if not IsValid(self.Owner) then return false end
    if self:Clip2() <= 0 and (self.Secondary.ClipSize or 0) > 0 then self:DryFire(self.SetNextSecondaryFire); return false end
    return true
  end
  function SWEP:ShootBullet(dmg, recoil, numbul, cone)
    self:SendWeaponAnim(self.PrimaryAnim or ACT_VM_PRIMARYATTACK)
    local o = self.Owner; if not IsValid(o) then return end
    if o.MuzzleFlash then o:MuzzleFlash() end; if o.SetAnimation then o:SetAnimation(PLAYER_ATTACK1) end
    cone = cone or 0.01
    o:FireBullets({ Num = numbul or 1, Src = o:GetShootPos(), Dir = o:GetAimVector(), Spread = Vector(cone, cone, 0), Tracer = 4, TracerName = self.Tracer or "Tracer", Force = 10, Damage = dmg or 1 })
  end
  function SWEP:SecondaryAttack()
    if self.NoSights or not self.IronSightsPos then return end
    self:SetIronsights(not self:GetIronsights())
    self:SetNextSecondaryFire(CurTime() + 0.3)
  end
  function SWEP:Reload()
    if (self.Primary.ClipSize or 0) <= 0 or self:Clip1() >= self.Primary.ClipSize or self:Ammo1() <= 0 then return end
    self:DefaultReload(self.ReloadAnim or ACT_VM_RELOAD)
    self:SetIronsights(false)
  end
  function SWEP:Deploy() self:SetIronsights(false); return true end
  function SWEP:Holster() self:SetIronsights(false); return true end
  function SWEP:PreDrop() end
  function SWEP:DampenDrop() end
  function SWEP:WasBought() end
  function SWEP:IsDropped() return not IsValid(self.Owner) end
  function SWEP:GetViewModelPosition(pos, ang)
    local o = self.IronSightsPos
    if not o or not self:GetIronsights() then return pos, ang end
    local a = self.IronSightsAng
    if a then ang = Angle(ang.p, ang.y, ang.r); ang:RotateAroundAxis(ang:Right(), a.x); ang:RotateAroundAxis(ang:Up(), a.y); ang:RotateAroundAxis(ang:Forward(), a.z) end
    return pos + ang:Right() * o.x + ang:Forward() * o.y + ang:Up() * o.z, ang
  end
  weapons.Register(SWEP, "weapon_tttbase")

  local G = { Base = "weapon_tttbase", Folder = "weapons/weapon_tttbasegrenade", ClassName = "weapon_tttbasegrenade", PrintName = "TTT", Category = "TTT", Kind = WEAPON_NADE, IsGrenade = true, NoSights = true, detonate_timer = 5,
    ViewModel = "models/weapons/v_grenade.mdl", WorldModel = "models/weapons/w_grenade.mdl", HoldType = "grenade",
    Primary = { ClipSize = -1, DefaultClip = -1, Automatic = false, Delay = 1.0, Ammo = "none" }, Secondary = { ClipSize = -1, DefaultClip = -1, Automatic = false, Ammo = "none" } }
  function G:GetGrenadeName() return "ttt_basegrenade_proj" end
  function G:PrimaryAttack()
    self:SetNextPrimaryFire(CurTime() + (self.Primary.Delay or 1))
    self:SendWeaponAnim(ACT_VM_THROW)
    if CLIENT then return end
    local o = self.Owner; if not IsValid(o) then return end
    local g = ents.Create(self:GetGrenadeName()); if not IsValid(g) then return end
    local ang = o:EyeAngles(); g:SetPos(o:GetShootPos() + ang:Forward() * 16 + ang:Right() * 6); g:SetAngles(ang); g:SetOwner(o)
    if g.SetThrower then g:SetThrower(o) end
    if g.SetDetonateExact then g:SetDetonateExact(CurTime() + (self.detonate_timer or 5)) end
    g:Spawn(); g:Activate()
    local p = g:GetPhysicsObject(); if IsValid(p) then p:SetVelocity(ang:Forward() * 700 + Vector(0, 0, 150)) end
  end
  function G:SecondaryAttack() end
  weapons.Register(G, "weapon_tttbasegrenade")

  local E = { Type = "anim", Base = "base_anim", ClassName = "ttt_basegrenade_proj", Model = "models/weapons/w_eq_flashbang_thrown.mdl" }
  function E:Initialize()
    self:SetModel(self.Model or "models/weapons/w_grenade.mdl")
    if SERVER then self:PhysicsInit(SOLID_VPHYSICS); self:SetMoveType(MOVETYPE_VPHYSICS); self:SetSolid(SOLID_VPHYSICS); local p = self:GetPhysicsObject(); if IsValid(p) then p:Wake() end end
    self.__det = self.__det or CurTime() + 3
  end
  function E:SetDetonateExact(t) self.__det = t end
  function E:GetDetonateExact() return self.__det end
  function E:SetDetonateTimer(t) self.__det = CurTime() + (t or 3) end
  function E:SetThrower(p) self.__thr = p end
  function E:GetThrower() return self.__thr end
  function E:Think()
    if SERVER and self.__det and CurTime() > self.__det then
      self.__det = nil
      local tr = util.TraceLine({ start = self:GetPos(), endpos = self:GetPos() + Vector(0, 0, -32), filter = self })
      self:Explode(tr)
    end
    self:NextThink(CurTime() + 0.05); return true
  end
  function E:Explode(tr)
    local e = EffectData(); e:SetOrigin(self:GetPos()); util.Effect("Explosion", e, true, true)
    util.BlastDamage(self, IsValid(self:GetThrower()) and self:GetThrower() or self, self:GetPos(), 200, 50)
    self:Remove()
  end
  scripted_ents.Register(E, "ttt_basegrenade_proj")
end

-- ---------- el gamemode (sandbox): GM y GAMEMODE ----------
GM = GM or { Name = "Sandbox", FolderName = "sandbox", Author = "", IsSandboxDerived = true }
GAMEMODE = GM
function GM:Initialize() end
function GM:InitPostEntity() end
function GM:Think() end
function GM:Tick() end
function GM:HUDPaint() end
function GM:HUDShouldDraw() return true end
function GM:PlayerSpawn() end
function GM:PlayerLoadout() end
function GM:PlayerDeath() end
function GM:PlayerSay(p, t) return t end
function GM:EntityTakeDamage() end
function GM:ScalePlayerDamage() end
function GM:ScaleNPCDamage() end
function GM:PlayerShouldTakeDamage() return true end
function GM:CalcView(p, o, a, f) return { origin = o, angles = a, fov = f } end
function GM:ShouldDrawLocalPlayer() return false end
function GM:KeyPress() end
function GM:KeyRelease() end
function GM:OnEntityCreated() end
function GM:EntityRemoved() end
function GM:PlayerSpawnedProp() end
function GM:PlayerSpawnedSENT() end
function GM:PlayerSpawnedSWEP() end
function GM:PlayerGiveSWEP() return true end
function GM:PlayerSpawnSENT() return true end
function GM:PlayerSpawnProp() return true end
function GM:PlayerNoClip() return true end
function GM:PhysgunPickup() return true end
function GM:GravGunPickupAllowed() return true end
function GM:CanTool() return true end
function GM:OnNPCKilled() end
function GM:AddNotify(t, ty, d) notification.AddLegacy(t, ty, d) end
function GM:GetGameDescription() return "Sandbox" end
function GM:PostDrawOpaqueRenderables() end
function GM:PostDrawTranslucentRenderables() end
function GM:PreDrawHUD() end
function GM:PostDrawHUD() end
function GM:RenderScreenspaceEffects() end
function GM:CreateMove() end
function GM:StartCommand() end
function GM:SetupMove() end
function GM:Move() end
function GM:FinishMove() end
function GM:PlayerFootstep() end
function GM:PlayerBindPress() end
function GM:SpawnMenuOpen() return true end
function GM:ContextMenuOpen() return true end
function GM:OnSpawnMenuOpen() end
function GM:OnSpawnMenuClose() end
function GM:PopulateToolMenu() end
function GM:AddToolMenuTabs() end
function GM:AddToolMenuCategories() end
function GM:PostReloadToolsMenu() end
function GM:PlayerInitialSpawn() end
function GM:PlayerDisconnected() end
function GM:PlayerCanPickupWeapon() return true end
function GM:PlayerSwitchWeapon() return false end
function GM:ShouldCollide() return true end
function GM:PlayerUse() return true end
function GM:CanPlayerSuicide() return true end
function GM:PlayerHurt() end
function GM:DoPlayerDeath() end
function GM:PlayerDeathThink() end
function GM:GetFallDamage() return 10 end
function GM:OnPlayerHitGround() end
function GM:PlayerCanHearPlayersVoice() return true, false end
function GM:PlayerStartVoice() end
function GM:PlayerEndVoice() end
function GM:ChatText() end
function GM:OnPlayerChat() end
function GM:PreDrawViewModel() end
function GM:PostDrawViewModel() end
function GM:CalcViewModelView(w, vm, op, oa, p, a) return p, a end
function GM:AdjustMouseSensitivity() return -1 end
function GM:HUDDrawTargetID() end
function GM:HUDAmmoPickedUp() end
function GM:HUDItemPickedUp() end
function GM:HUDWeaponPickedUp() end
function GM:DrawDeathNotice() end
function GM:AddDeathNotice() end
function GM:PlayerTraceAttack() return false end
function GM:EntityKeyValue() end
function GM:EntityFireBullets() end
function GM:PlayerButtonDown() end
function GM:PlayerButtonUp() end
function GM:Restored() end
function GM:Saved() end
function GM:ShutDown() end
function GM:VehicleMove() end
function GM:UpdateAnimation() end
function GM:CalcMainActivity() return ACT_HL2MP_IDLE, -1 end
function GM:TranslateActivity(p, a) return a end
function GM:DoAnimationEvent() return ACT_INVALID end
function GM:GrabEarAnimation() end
function GM:MouthMoveAnimation() end
function GM:HandlePlayerJumping() return false end
function GM:CreateTeams() end
function GM:PreGamemodeLoaded() end
function GM:OnGamemodeLoaded() end
function GM:PostGamemodeLoaded() end
function GM:NetworkEntityCreated() end
function GM:OnContextMenuOpen() end
function GM:OnContextMenuClose() end
function GM:GUIMousePressed() end
function GM:GUIMouseReleased() end
function GM:PreventScreenClicks() return false end
function GM:ScoreboardShow() end
function GM:ScoreboardHide() end
function GM:SetupWorldFog() return false end
function GM:SetupSkyboxFog() return false end
function GM:PostProcessPermitted() return true end
function GM:PlayerTick() end
function GM:PlayerPostThink() end
function GM:SetupPlayerVisibility() end
function GM:OnViewModelChanged() end
function GM:PlayerSelectSpawn() return NULL end
function GM:IsSpawnpointSuitable() return true end
function GM:PlayerSetModel() end
function GM:PlayerSetHandsModel() end
function GM:PlayerSpawnObject() return true end
function GM:PlayerSpawnRagdoll() return true end
function GM:PlayerSpawnNPC() return true end
function GM:PlayerSpawnVehicle() return true end
function GM:PlayerSpawnEffect() return true end
function GM:PlayerSpawnSWEP() return true end
function GM:PlayerSpawnedNPC() end
function GM:PlayerSpawnedRagdoll() end
function GM:PlayerSpawnedVehicle() end
function GM:PlayerSpawnedEffect() end
function GM:PlayerAuthed() end
function GM:NetworkIDValidated() return true end
function GM:PlayerConnect() end
function GM:PlayerShouldTaunt() return true end
function GM:PlayerStartTaunt() end
function GM:AllowPlayerPickup() return true end
function GM:PlayerCanPickupItem() return true end
function GM:PlayerDroppedWeapon() end
function GM:WeaponEquip() end
function GM:PlayerAmmoChanged() end
function GM:OnDamagedByExplosion() end
function GM:CanEditVariable() return true end
function GM:CanProperty() return true end
function GM:CanDrive() return true end
function GM:CanPlayerEnterVehicle() return true end
function GM:CanExitVehicle() return true end
function GM:PlayerEnteredVehicle() end
function GM:PlayerLeaveVehicle() end
function GM:GravGunPunt() return true end
function GM:GravGunOnPickedUp() end
function GM:GravGunOnDropped() end
function GM:OnPhysgunFreeze() return true end
function GM:OnPhysgunReload() return true end
function GM:PhysgunDrop() end
function GM:OnPhysgunPickup() end
function GM:PlayerFrozeObject() end
function GM:PlayerUnfrozeObject() end
function GM:OnPlayerPhysicsPickup() end
function GM:OnPlayerPhysicsDrop() end
function GM:FindUseEntity(p, e) return e end
function GM:PlayerCanJoinTeam() return true end
function GM:PlayerRequestTeam() end
function GM:PlayerJoinTeam() end
function GM:OnPlayerChangedTeam() end
function GM:ShowHelp() end
function GM:ShowTeam() end
function GM:ShowSpare1() end
function GM:ShowSpare2() end
function GM:PlayerSilentDeath() end
function GM:PlayerDeathSound() return false end
function GM:CreateEntityRagdoll() end
function GM:EntityNetworkedVarChanged() end
function GM:EntityEmitSound() end
function GM:PlayerStepSoundTime() return 350 end
function GM:CanUndo() return true end
function GM:PreUndo() end
function GM:PostUndo() end
function GM:PostCleanupMap() end
function GM:PreCleanupMap() end
function GM:VariableEdited() end
function GM:LoadGModSave() end
function GM:PlayerFrozeObject() end
function GM:PlayerSpray() return false end
function GM:PlayerSwitchFlashlight() return true end
function GM:PlayerCanSeePlayersChat() return true end
function GM:PlayerShouldTakeDamage() return true end
function GM:OnReloaded() end
function GM:HUDPaintBackground() end
function GM:AddHint() end
-- (del sandbox: el efecto de aparecer de un prop puesto con el menú o una herramienta)
function DoPropSpawnedEffect(e) end
function GM:SuppressHint() end
function GM:HUDDrawScoreBoard() end
function GM:HUDDrawPickupHistory() end
function GM:DrawOverlay() end
function GM:DrawMonitors() end
function GM:PreDrawEffects() end
function GM:PostDrawEffects() end
function GM:PreDrawOpaqueRenderables() end
function GM:PreDrawTranslucentRenderables() end
function GM:PreDrawSkyBox() end
function GM:PostDrawSkyBox() end
function GM:PreDrawHalos() end
function GM:PostDraw2DSkyBox() end
function GM:PreDrawPlayerHands() end
function GM:PostDrawPlayerHands() end
function GM:PrePlayerDraw() end
function GM:PostPlayerDraw() end
function GM:ShouldDrawLocalPlayer() return false end
function GM:InputMouseApply() return false end
function GM:CalcVehicleView(v, p, view) return view end
function GM:PlayerClassChanged() end
function GM:FinishChat() end
function GM:StartChat() return false end
function GM:ChatTextChanged() end
function GM:OnChatTab(t) return t end
function GM:OnUndo() end
function GM:OnCleanup() end
function GM:NotifyShouldTransmit() end
function GM:OnPermissionsChanged() end
function GM:PlayerFireAnimationEvent() end
function GM:SetPlayerSpeed() end
function GM:SpawniconGenerated() end
function GM:OnCrazyPhysics() end
function GM:PlayerSpawnAsSpectator() end
function GM:CanPlayerUnfreeze() return true end
function GM:PlayerCheckLimit() return true end
function GM:IsValid() return true end

-- ---------- lo que faltaba y usan addons reales (api_falta.mjs) ----------
table.FullCopy = table.FullCopy or table.Copy
function util.StringToType(s, t)
  t = string.lower(t or "")
  if t == "number" or t == "float" or t == "int" then return tonumber(s) end
  if t == "bool" or t == "boolean" then return tobool(s) end
  if t == "vector" then return Vector(s) end
  if t == "angle" then return Angle(s) end
  if t == "entity" then return Entity(tonumber(s) or 0) end
  return s
end
function Label(texto, padre) local l = vgui.Create("DLabel", padre) if l then l:SetText(texto or "") end return l end
function TauntCamera()
  return { ShouldDrawLocalPlayer = function() return false end, CalcView = function() return false end, CreateMove = function() return false end }
end

-- ---------- clases de jugador (player_manager de GMod): RegisterClass, SetPlayerClass, RunClass, OnPlayerSpawn ----------
-- (la clase base player_default no cambia el modelo: el jugador sigue con su personaje si el modo no pone otro)
do
  local Tipos, actual, inst = {}, setmetatable({}, { __mode = "k" }), setmetatable({}, { __mode = "k" })
  local PD = { DisplayName = "Default Class", SlowWalkSpeed = 100, WalkSpeed = 200, RunSpeed = 400, CrouchedWalkSpeed = 0.3, DuckSpeed = 0.3, UnDuckSpeed = 0.3,
    JumpPower = 200, CanUseFlashlight = true, MaxHealth = 100, MaxArmor = 100, StartHealth = 100, StartArmor = 0, DropWeaponOnDie = false, TeammateNoCollide = true, AvoidPlayers = true, UseVMHands = true }
  function PD:SetupDataTables() end
  function PD:Init() end
  function PD:Spawn() end
  function PD:Loadout() self.Player:RemoveAllAmmo(); self.Player:GiveAmmo(256, "Pistol", true); self.Player:Give("weapon_pistol") end
  function PD:SetModel() end
  function PD:Death() end
  function PD:CalcView(view) end
  function PD:CreateMove() end
  function PD:ShouldDrawLocal() end
  function PD:StartMove() end
  function PD:Move() end
  function PD:FinishMove() end
  function PD:ViewModelChanged() end
  function PD:PreDrawViewModel() end
  function PD:PostDrawViewModel() end
  function PD:GetHandsModel() return player_manager.TranslatePlayerHands("") end
  Tipos.player_default = PD
  baseclass.Set("player_default", PD)
  player_manager = player_manager or {}
  function player_manager.RegisterClass(name, t, base)
    Tipos[name] = t
    local b = base and Tipos[base] or (name ~= "player_default" and PD or nil)
    if b and b ~= t then setmetatable(t, { __index = b }); if t.BaseClass == nil then t.BaseClass = b end end
    baseclass.Set(name, t)
  end
  local function instancia(ply)
    local n = actual[ply]; if not n or not Tipos[n] then return nil end
    local i = inst[ply]; if i and i.__n == n then return i end
    i = setmetatable({ Player = ply, __n = n }, { __index = Tipos[n] }); inst[ply] = i; return i
  end
  function player_manager.SetPlayerClass(ply, n)
    if not Tipos[n] then ErrorNoHalt("SetPlayerClass - attempt to use unknown player class " .. tostring(n) .. "!\n") return end
    actual[ply] = n; inst[ply] = nil
    local c = instancia(ply)   -- (como ClassChanged de GMod: la tabla de datos y el Init de la clase)
    if c then c:SetupDataTables(); c:Init() end
  end
  function player_manager.GetPlayerClass(ply) return actual[ply] or "" end
  function player_manager.GetPlayerClasses() return Tipos end
  function player_manager.GetPlayerClassTable(ply) return instancia(ply) end
  function player_manager.ClearPlayerClass(ply) actual[ply] = nil; inst[ply] = nil end
  function player_manager.RunClass(ply, f, ...)
    local c = instancia(ply); if not c then return end
    local fn = c[f]; if type(fn) ~= "function" then return end
    return fn(c, ...)
  end
  function player_manager.OnPlayerSpawn(ply, transicion)
    local c = instancia(ply); if not c then return end
    ply:SetSlowWalkSpeed(c.SlowWalkSpeed); ply:SetWalkSpeed(c.WalkSpeed); ply:SetRunSpeed(c.RunSpeed); ply:SetCrouchedWalkSpeed(c.CrouchedWalkSpeed)
    ply:SetJumpPower(c.JumpPower); ply:SetMaxHealth(c.MaxHealth); ply:SetMaxArmor(c.MaxArmor)
    if not transicion then ply:SetHealth(c.StartHealth); ply:SetArmor(c.StartArmor) end
  end
end

-- ---------- herramientas de la Tool Gun de los addons (stools): el objeto de herramienta de GMod ----------
-- (cada herramienta es su tabla TOOL con estos métodos: sus ConVars "<modo>_x", los objetos que se van clickeando
-- para las de dos clics como cuerdas y soldaduras, las etapas y el dueño)
__ToolObj = {}
do
  local T = __ToolObj
  function T:GetOwner() return self.Owner or LocalPlayer() end
  function T:GetSWEP() return self.SWEP or self:GetOwner():GetActiveWeapon() end
  T.GetWeapon = T.GetSWEP
  function T:GetMode() return self.Mode end
  function T:GetClientInfo(n) return GetConVarString(self.Mode .. "_" .. n) end
  function T:GetClientNumber(n, d) local v = tonumber(GetConVarString(self.Mode .. "_" .. n)); if v == nil then return d or 0 end return v end
  function T:GetClientBool(n, d) local v = GetConVarString(self.Mode .. "_" .. n); if v == "" then return d or false end return v ~= "0" end
  function T:GetServerInfo(n) return GetConVarString(self.Mode .. "_" .. n) end
  function T:Allowed() return true end
  function T:Init() end
  function T:CheckObjects() for k, v in pairs(self.Objects) do if not (v.Ent and (v.Ent.IsWorld and v.Ent:IsWorld())) and not IsValid(v.Ent) then self:ClearObjects() return end end end
  function T:ClearObjects() self.Objects = {}; self.Stage = 0 end
  function T:NumObjects() local n = 0 for _ in pairs(self.Objects) do n = n + 1 end return n end
  function T:SetObject(i, ent, pos, phys, bone, norm)
    local lp = pos
    if IsValid(ent) and ent.WorldToLocal and not (ent.IsWorld and ent:IsWorld()) then lp = ent:WorldToLocal(pos) end
    self.Objects[i] = { Ent = ent, Pos = pos, Phys = phys, Bone = bone or 0, Normal = norm, LocalPos = lp }
  end
  function T:GetEnt(i) local o = self.Objects[i]; return o and o.Ent or NULL end
  function T:GetPos(i) local o = self.Objects[i]; if not o then return Vector() end if IsValid(o.Ent) and o.Ent.LocalToWorld and not (o.Ent.IsWorld and o.Ent:IsWorld()) then return o.Ent:LocalToWorld(o.LocalPos) end return o.Pos end
  function T:GetLocalPos(i) local o = self.Objects[i]; return o and o.LocalPos or Vector() end
  function T:GetBone(i) local o = self.Objects[i]; return o and o.Bone or 0 end
  function T:GetNormal(i) local o = self.Objects[i]; return o and o.Normal or Vector(0, 0, 1) end
  function T:GetPhys(i) local o = self.Objects[i]; if not o then return nil end if IsValid(o.Phys) then return o.Phys end if IsValid(o.Ent) and o.Ent.GetPhysicsObject then return o.Ent:GetPhysicsObject() end end
  function T:GetStage() return self.Stage or 0 end
  function T:SetStage(s) self.Stage = s end
  function T:GetOperation() return self.Operation or 0 end
  function T:SetOperation(o) self.Operation = o end
  function T:MakeGhostEntity() end
  function T:StartGhostEntity() end
  function T:UpdateGhostEntity() end
  function T:ReleaseGhostEntity() end
  function T:GetHelpText() return "" end
  function T:Think() end
  function T:Deploy() end
  function T:Holster() end
end
function __RB_ToolNuevo(t, modo)
  local o = setmetatable({ Mode = modo, Objects = {}, Stage = 0, Operation = 0, Owner = LocalPlayer() }, { __index = function(_, k) local v = t[k]; if v ~= nil then return v end return __ToolObj[k] end })
  if t.Init then pcall(t.Init, o) end
  return o
end

-- ---------- la base de los modos de juego (gamemodes/base de GMod): de acá derivan los que no son sandbox ----------
-- (lo del sandbox más lo que hace la base de verdad: aparecer con PlayerLoadout, morir y reaparecer, cambiar de equipo)
__GM_BASE = {}
for k, v in pairs(GM) do __GM_BASE[k] = v end
do
  local B = __GM_BASE
  B.Name = "Base"; B.FolderName = "base"; B.IsSandboxDerived = false; B.TeamBased = false; B.SecondsBetweenTeamSwitches = 10
  function B:PlayerSpawn(pl)
    if GAMEMODE.TeamBased and (pl:Team() == TEAM_SPECTATOR or pl:Team() == TEAM_UNASSIGNED) then GAMEMODE:PlayerSpawnAsSpectator(pl) return end
    pl:UnSpectate()
    player_manager.OnPlayerSpawn(pl)
    player_manager.RunClass(pl, "Spawn")
    hook.Call("PlayerLoadout", GAMEMODE, pl)
    hook.Call("PlayerSetModel", GAMEMODE, pl)
  end
  function B:PlayerSpawnAsSpectator(pl)
    pl:StripWeapons()
    if pl:Team() == TEAM_UNASSIGNED then pl:Spectate(OBS_MODE_FIXED) return end
    pl:SetTeam(TEAM_SPECTATOR); pl:Spectate(OBS_MODE_ROAMING)
  end
  function B:PlayerLoadout(pl) player_manager.RunClass(pl, "Loadout") end
  function B:PlayerSetModel(pl) player_manager.RunClass(pl, "SetModel") end
  function B:PlayerInitialSpawn(pl) pl:SetTeam(TEAM_UNASSIGNED) end
  function B:DoPlayerDeath(pl, att, dmg) pl:AddDeaths(1) if IsValid(att) and att:IsPlayer() then if att == pl then att:AddFrags(-1) else att:AddFrags(1) end end end
  function B:PlayerDeath(pl, inf, att) pl.NextSpawnTime = CurTime() + 2; pl.DeathTime = CurTime(); player_manager.RunClass(pl, "Death", inf, att) end
  function B:PlayerSilentDeath(pl) pl.NextSpawnTime = CurTime() + 2; pl.DeathTime = CurTime() end
  function B:PlayerDeathThink(pl)
    if pl.NextSpawnTime and pl.NextSpawnTime > CurTime() then return end
    if pl:IsBot() or pl:KeyPressed(IN_ATTACK) or pl:KeyPressed(IN_ATTACK2) or pl:KeyPressed(IN_JUMP) then pl:Spawn() end
  end
  function B:PlayerRequestTeam(ply, id)
    if not GAMEMODE.TeamBased then return end
    if not team.Joinable(id) then ply:ChatPrint("You can't join that team") return end
    if not GAMEMODE:PlayerCanJoinTeam(ply, id) then return end
    GAMEMODE:PlayerJoinTeam(ply, id)
  end
  function B:PlayerCanJoinTeam(ply, id)
    local t = GAMEMODE.SecondsBetweenTeamSwitches or 10
    if ply.LastTeamSwitch and RealTime() - ply.LastTeamSwitch < t then
      ply:ChatPrint(Format("Please wait %i more seconds before trying to change team again", (t - (RealTime() - ply.LastTeamSwitch)) + 1)) return false
    end
    if ply:Team() == id then ply:ChatPrint("You're already on that team") return false end
    return true
  end
  function B:PlayerJoinTeam(ply, id)
    local old = ply:Team()
    if ply:Alive() then if old == TEAM_SPECTATOR or old == TEAM_UNASSIGNED then ply:KillSilent() else ply:Kill() end end
    ply:SetTeam(id); ply.LastTeamSwitch = RealTime()
    GAMEMODE:OnPlayerChangedTeam(ply, old, id)
  end
  function B:OnPlayerChangedTeam(ply, old, new)
    if new == TEAM_SPECTATOR then local p = ply:EyePos(); ply:Spawn(); ply:SetPos(p)
    elseif old == TEAM_SPECTATOR or old == TEAM_UNASSIGNED then ply:Spawn() end
    PrintMessage(HUD_PRINTTALK, Format("%s joined '%s'", ply:Nick(), team.GetName(new)))
  end
  function B:CreateTeams() end
  function B:ShowTeam() end
  function B:ShowHelp() end
  function B:ShowSpare1() end
  function B:ShowSpare2() end
  function B:GetGameDescription() return GAMEMODE.Name end
  function B:CanPlayerSuicide() return true end
  function B:PlayerNoClip() return false end
  function B:HUDDrawTargetID() end
  function B:HUDDrawScoreBoard() end
  function B:ScoreboardShow() end
  function B:ScoreboardHide() end
  function B:PlayerConnect() end
  function B:PlayerAuthed() end
  function B:PlayerSelectSpawn(pl) return nil end
  function B:PlayerSelectTeamSpawn(id, pl) return nil end
  function B:IsSpawnpointSuitable() return true end
  function B:OnReloaded() end
  function B:ShutDown() end
end

-- ---------- herramientas (lua/weapons/gmod_tool/stools): se guardan para la Tool Gun ----------
TOOL = nil
`;
if (typeof module !== 'undefined') module.exports = { GMA_PRELUDE };
