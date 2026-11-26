export type GameMode = 'playing' | 'dead' | 'victory';

export type AssetTab = 'player' | 'monsters' | 'vfx' | 'env' | 'props';
export type AssetKind = 'sheet' | 'vfx_2x3' | 'single' | 'bg' | 'batch_tiles';
export type SheetGrid = '2x5' | '2x4' | '1x4';

export interface AssetSlotDef {
  key: string;
  tab: AssetTab;
  name: string;
  tag: string;
  kind: AssetKind;
  removeInteriorWhite?: boolean;
  maskCornerWatermark?: boolean;
}

export interface SpriteFrame {
  canvas: HTMLCanvasElement;
  white: HTMLCanvasElement;
  cyan: HTMLCanvasElement;
  gold: HTMLCanvasElement;
  w: number;
  h: number;
  anchorX?: number;
  footLift?: number;
}

export interface LoadedAsset {
  canvas?: HTMLCanvasElement;
  white?: HTMLCanvasElement;
  cyan?: HTMLCanvasElement;
  gold?: HTMLCanvasElement;
  w?: number;
  h?: number;
  refH?: number;
  isBuiltin?: boolean;
  frames?: SpriteFrame[];
  previewUrl: string;
  status?: string;
}

export interface ComboStepConfig {
  windup: number;
  slash: number;
  recovery: number;
  damage: number;
  isHeavy: boolean;
  knockback: number;
  radius: number;
  hitStop: number;
  shakeAmp: number;
  shakeDur: number;
  slashVfxDur: number;
}

export interface InputKeys {
  left: boolean;
  right: boolean;
  down: boolean;
  jumpHeld: boolean;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'solid' | 'oneway';
  ground?: boolean;
  suspended?: boolean;
  fragileRef?: FragilePlatform;
  /** Boss arena dynamic platform behavior */
  bossDynamic?: 'side_float' | 'center_sanctuary';
  baseY?: number;
  floatPhase?: number;
  active?: boolean;
}

export interface FragilePlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  state: 'solid' | 'shaking' | 'broken';
  timer: number;
}

export interface Shrine {
  x: number;
  y: number;
  w: number;
  pool: number;
  maxPool: number;
  fullOnce: boolean;
  cd: number;
  standTime: number;
  healTick: number;
  ambientTimer: number;
}

export interface Crate {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  broken: boolean;
  flash: number;
}

export interface Pot {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  broken: boolean;
  flash: number;
}

export interface Fruit {
  x: number;
  y: number;
  vy: number;
  bob: number;
}

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  dropThrough: number;
  lastSafeX: number;
  lastSafeY: number;
  hp: number;
  maxHp: number;
  whiteHp: number;
  whiteHold: number;
  hpShake: number;
  hurtInvuln: number;
  hurtFlash: number;
  heartbeatTimer: number;
  dashTimer: number;
  dashDir: 1 | -1;
  dashCd: number;
  dashInvuln: number;
  dashGhostTimer: number;
  airDashUsed: boolean;
  atkActive: boolean;
  atkStep: 1 | 2 | 3;
  atkPhase: 'windup' | 'slash' | 'recovery';
  atkTimer: number;
  atkCd: number;
  atkBuffer: boolean;
  hitTargets: Set<object>;
  comboWindow: number;
  squashX: number;
  squashY: number;
  animTime: number;
  runAnimTime: number;
  runDustTimer: number;
  chargeSparkTimer: number;
  forceSheetKey?: string;
  forceFrameIdx?: number;
}

export type MonsterMaterial = 'beetle' | 'wisp' | 'boss';

export interface Enemy {
  kind: 'beetle' | 'wisp';
  x: number;
  y: number;
  baseY: number;
  w: number;
  h: number;
  vx: number;
  facing: 1 | -1;
  minX: number;
  maxX: number;
  hp: number;
  maxHp: number;
  whiteHp: number;
  whiteHold: number;
  hpShake: number;
  flash: number;
  hitTintTimer: number;
  hitTintColor: 'cyan' | 'gold';
  hitJitter: number;
  hitJitterDir: number;
  crackGlow: number;
  squashTimer: number;
  hurtExpr: number;
  animTime: number;
  aiState: string;
  aiTimer: number;
  vfxTick: number;
  dead: boolean;
  isSummon: boolean;
}

export interface Boss {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  whiteHp: number;
  whiteHold: number;
  hpShake: number;
  flash: number;
  hitTintTimer: number;
  hitTintColor: 'cyan' | 'gold';
  hitJitter: number;
  hitJitterDir: number;
  crackGlow: number;
  squashTimer: number;
  animTime: number;
  active: boolean;
  dead: boolean;
  phase: 1 | 2;
  aiState: string;
  aiTimer: number;
  aiStateDur: number;
  stepSoundTimer: number;
  summonTimer: number;
  auraTimer: number;
  attackHitDone: boolean;
  deathBurstTimer: number;
  deathBurstsLeft: number;
}

/** Boss arena Phase-2 floor rune geyser hazard */
export interface ArenaGeyser {
  x: number;
  w: number;
  state: 'idle' | 'warn' | 'erupt';
  timer: number;
  maxTimer: number;
  hitDone: boolean;
}

export interface BossArenaState {
  phaseBlend: number;
  centerRise: number;
  cracks: { x: number; w: number; alpha: number }[];
  geysers: ArenaGeyser[];
  geyserCycleTimer: number;
  geyserIndex: number;
  ambientEmberTimer: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  owner: Enemy | null;
  deflected: boolean;
  trail: { x: number; y: number }[];
}

export interface Shockwave {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  w: number;
  h: number;
  life: number;
  dustTimer: number;
}

export interface GoldOrb {
  phase: 'scatter' | 'pause' | 'fly';
  timer: number;
  scatterDur: number;
  pauseDur: number;
  flyDur: number;
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  floorY: number;
  sx: number;
  sy: number;
  scrX: number;
  scrY: number;
  cx: number;
  cy: number;
  trail: { x: number; y: number }[];
}

export interface BgSpore {
  x: number;
  y: number;
  vy: number;
  r: number;
  alpha: number;
  phase: number;
}

/* ============================================================
   Enhanced Slash, Environment & Monster Hit-Impact VFX Types
   ============================================================ */

export interface SlashArcVfx {
  x: number;
  y: number;
  facing: 1 | -1;
  step: 1 | 2 | 3;
  radius: number;
  life: number;
  maxLife: number;
  isBoss?: boolean;
  /** Follow player slightly during early active strike frames */
  followPlayer?: boolean;
  offsetX?: number;
  offsetY?: number;
}

export interface ImpactScarVfx {
  x: number;
  y: number;
  angle: number;
  length: number;
  thickness: number;
  color: string;
  coreColor: string;
  crossFlare: boolean;
  starPoints: 4 | 6;
  starRadius: number;
  life: number;
  maxLife: number;
}

export interface TrailSparkVfx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  width: number;
  color: string;
  coreColor: string;
  canBounce: boolean;
  bounced: boolean;
  trail: { x: number; y: number }[];
  life: number;
  maxLife: number;
}

export interface InkSplashVfx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fill: string;
  rim: string;
  stretch: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
}

export interface MaterialShardVfx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  kind: 'stone' | 'moss' | 'bronze' | 'scale' | 'wood';
  color: string;
  highlight: string;
  glow?: string;
  points: { x: number; y: number }[];
  bounced: boolean;
  life: number;
  maxLife: number;
}

export interface ImpactRingVfx {
  x: number;
  y: number;
  r0: number;
  r1: number;
  w0: number;
  color: string;
  style: 'solid' | 'chime_arcs' | 'rune_sigil' | 'soul_burst';
  rot: number;
  vrot: number;
  squashY: number;
  life: number;
  maxLife: number;
}

export interface SoulWispVfx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  swirlAmp: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface HitGhostVfx {
  kind: 'beetle' | 'wisp' | 'boss';
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  color: 'cyan' | 'gold';
  sheetKey: string;
  frameIdx: number;
  targetH: number;
  animTime: number;
  phase?: 1 | 2;
  life: number;
  maxLife: number;
}

export interface DustVfx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface SpeedStreakVfx {
  x: number;
  y: number;
  vx: number;
  len: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface DamageNumberVfx {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHeavy?: boolean;
  isParry?: boolean;
  isHeal?: boolean;
  comboStep?: 1 | 2 | 3;
  tilt: number;
  life: number;
  maxLife: number;
}

export interface AfterimageVfx {
  x: number;
  y: number;
  facing: 1 | -1;
  sheetKey: string;
  frameIdx: number;
  animTime: number;
  life: number;
  maxLife: number;
}

export interface ImpactFlashVfx {
  x: number;
  y: number;
  color: string;
  radius: number;
  intensity: number;
  life: number;
  maxLife: number;
}

export interface VfxBucket {
  slashes: SlashArcVfx[];
  scars: ImpactScarVfx[];
  sparks: TrailSparkVfx[];
  inkSplashes: InkSplashVfx[];
  shards: MaterialShardVfx[];
  rings: ImpactRingVfx[];
  wisps: SoulWispVfx[];
  hitGhosts: HitGhostVfx[];
  dust: DustVfx[];
  streaks: SpeedStreakVfx[];
  dmgNums: DamageNumberVfx[];
  afterimages: AfterimageVfx[];
  flashes: ImpactFlashVfx[];
}

export interface ModalSnapshot {
  visible: boolean;
  mode: 'dead' | 'victory';
  rank: string;
  title: string;
  subtitle: string;
  gold: number;
  hp: number;
  timeSec: number;
  primaryLabel: string;
}
