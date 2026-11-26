import { AssetManager } from './assetManager';
import { AudioSys } from './audio';
import {
  BOSS_ARENA_LEFT,
  BOSS_ARENA_RIGHT,
  BOSS_TRIGGER_X,
  COMBO_CFG,
  Easing,
  FLOOR_Y,
  VIEW_H,
  VIEW_W,
  WORLD_W,
  clamp,
  lerp,
  rectsOverlap,
} from './constants';
import {
  drawEnhancedHitVfx,
  drawMonsterHitGhosts,
  spawnDashVfx,
  spawnMonsterDeathVfx,
  spawnMonsterHitGhost,
  spawnMonsterHitVfx,
  spawnPropBreakShards,
  spawnPropHitVfx,
  updateAllHitVfx,
} from './hitVfx';
import type {
  BgSpore,
  Boss,
  BossArenaState,
  ComboStepConfig,
  Crate,
  Enemy,
  FragilePlatform,
  Fruit,
  GameMode,
  GoldOrb,
  InputKeys,
  LoadedAsset,
  ModalSnapshot,
  Platform,
  Player,
  Pot,
  Projectile,
  Shockwave,
  Shrine,
  VfxBucket,
} from './types';

interface EngineCallbacks {
  onToast: (msg: string, duration?: number) => void;
  onModalChange: (modal: ModalSnapshot) => void;
}

interface GameState {
  mode: GameMode;
  elapsed: number;
  runTime: number;
  gold: number;
  goldPulse: number;
  coinCombo: number;
  coinComboTimer: number;
  pitFade: number;
  bossGateClosed: boolean;
  bossGateDrop: number;
  bossGateSlammed: boolean;
  victoryGateOpen: boolean;
  checkpoint: { x: number; y: number };
  time: { hitStop: number; slowTimer: number; slowDur: number; slowMin: number; scale: number };
  camera: {
    x: number;
    bossLocked: boolean;
    shakeTime: number;
    shakeDur: number;
    shakeAmp: number;
    shakeX: number;
    shakeY: number;
  };
  bossArena: BossArenaState;
  bgSpores: BgSpore[];
  platforms: Platform[];
  fragiles: FragilePlatform[];
  shrines: Shrine[];
  crates: Crate[];
  pots: Pot[];
  fruits: Fruit[];
  enemies: Enemy[];
  boss: Boss | null;
  projectiles: Projectile[];
  shockwaves: Shockwave[];
  orbs: GoldOrb[];
  vfx: VfxBucket;
  player: Player;
}

function createEmptyVfx(): VfxBucket {
  return {
    slashes: [],
    scars: [],
    sparks: [],
    inkSplashes: [],
    shards: [],
    rings: [],
    wisps: [],
    hitGhosts: [],
    dust: [],
    streaks: [],
    dmgNums: [],
    afterimages: [],
    flashes: [],
  };
}

function createBossArenaState(): BossArenaState {
  return {
    phaseBlend: 0,
    centerRise: 0,
    cracks: [],
    geysers: [
      { x: 6335, w: 68, state: 'idle', timer: 0, maxTimer: 1.15, hitDone: false },
      { x: 6665, w: 68, state: 'idle', timer: 0, maxTimer: 1.15, hitDone: false },
    ],
    geyserCycleTimer: 2.6,
    geyserIndex: 0,
    ambientEmberTimer: 0,
  };
}

function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    w: 30,
    h: 58,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    coyote: 0,
    jumpBuffer: 0,
    dropThrough: 0,
    lastSafeX: x,
    lastSafeY: y,
    hp: 100,
    maxHp: 100,
    whiteHp: 100,
    whiteHold: 0,
    hpShake: 0,
    hurtInvuln: 0,
    hurtFlash: 0,
    heartbeatTimer: 0,
    dashTimer: 0,
    dashDir: 1,
    dashCd: 0,
    dashInvuln: 0,
    dashGhostTimer: 0,
    airDashUsed: false,
    atkActive: false,
    atkStep: 1,
    atkPhase: 'windup',
    atkTimer: 0,
    atkCd: 0,
    atkBuffer: false,
    hitTargets: new Set(),
    comboWindow: 0,
    squashX: 1,
    squashY: 1,
    animTime: 0,
    runAnimTime: 0,
    runDustTimer: 0,
    chargeSparkTimer: 0,
  };
}

function createBeetle(x: number, y: number, minX: number, maxX: number): Enemy {
  return {
    kind: 'beetle',
    x,
    y,
    baseY: y,
    w: 48,
    h: 42,
    vx: 0,
    facing: -1,
    minX,
    maxX,
    hp: 50,
    maxHp: 50,
    whiteHp: 50,
    whiteHold: 0,
    hpShake: 0,
    flash: 0,
    hitTintTimer: 0,
    hitTintColor: 'cyan',
    hitJitter: 0,
    hitJitterDir: 1,
    crackGlow: 0,
    squashTimer: 0,
    hurtExpr: 0,
    animTime: Math.random() * 4,
    aiState: 'patrol',
    aiTimer: 0,
    vfxTick: 0,
    dead: false,
    isSummon: false,
  };
}

function createWisp(x: number, y: number, isSummon = false): Enemy {
  return {
    kind: 'wisp',
    x,
    y,
    baseY: y,
    w: 38,
    h: 46,
    vx: 0,
    facing: -1,
    minX: 0,
    maxX: WORLD_W,
    hp: 30,
    maxHp: 30,
    whiteHp: 30,
    whiteHold: 0,
    hpShake: 0,
    flash: 0,
    hitTintTimer: 0,
    hitTintColor: 'cyan',
    hitJitter: 0,
    hitJitterDir: 1,
    crackGlow: 0,
    squashTimer: 0,
    hurtExpr: 0,
    animTime: Math.random() * 4,
    aiState: 'hover',
    aiTimer: 0.75,
    vfxTick: 0,
    dead: false,
    isSummon,
  };
}

function createBoss(x: number, y: number): Boss {
  return {
    x,
    y,
    w: 88,
    h: 132,
    vx: 0,
    facing: -1,
    hp: 250,
    maxHp: 250,
    whiteHp: 250,
    whiteHold: 0,
    hpShake: 0,
    flash: 0,
    hitTintTimer: 0,
    hitTintColor: 'gold',
    hitJitter: 0,
    hitJitterDir: 1,
    crackGlow: 0,
    squashTimer: 0,
    animTime: 0,
    active: false,
    dead: false,
    phase: 1,
    aiState: 'idle',
    aiTimer: 1.2,
    aiStateDur: 1.2,
    stepSoundTimer: 0.75,
    summonTimer: 15,
    auraTimer: 0,
    attackHitDone: false,
    deathBurstTimer: 0,
    deathBurstsLeft: 0,
  };
}

export class RuinsBladeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private keys: InputKeys = { left: false, right: false, down: false, jumpHeld: false };
  private state: GameState;
  private rafId: number | null = null;
  private lastTime = 0;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundContextMenu: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    // Auto-load all built-in dark-fairy-tale art assets & 3 sword slash VFX sheets
    AssetManager.loadBuiltinAssets();

    this.state = {
      mode: 'playing',
      elapsed: 0,
      runTime: 0,
      gold: 0,
      goldPulse: 0,
      coinCombo: 0,
      coinComboTimer: 0,
      pitFade: 0,
      bossGateClosed: false,
      bossGateDrop: 0,
      bossGateSlammed: false,
      victoryGateOpen: false,
      checkpoint: { x: 110, y: FLOOR_Y },
      time: { hitStop: 0, slowTimer: 0, slowDur: 0.28, slowMin: 0.18, scale: 1.0 },
      camera: { x: 0, bossLocked: false, shakeTime: 0, shakeDur: 0.12, shakeAmp: 0, shakeX: 0, shakeY: 0 },
      bossArena: createBossArenaState(),
      bgSpores: [],
      platforms: [],
      fragiles: [],
      shrines: [],
      crates: [],
      pots: [],
      fruits: [],
      enemies: [],
      boss: null,
      projectiles: [],
      shockwaves: [],
      orbs: [],
      vfx: createEmptyVfx(),
      player: createPlayer(110, FLOOR_Y),
    };

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundBlur = this.onBlur.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('contextmenu', this.boundContextMenu);

    this.buildLevel(true);
    this.startLoop();
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
  }

  public setTouchHold(prop: keyof InputKeys, active: boolean): void {
    this.keys[prop] = active;
  }

  public handleModalPrimary(): void {
    if (this.state.mode === 'dead') {
      this.respawnAtCheckpoint();
    } else {
      this.buildLevel(true);
    }
  }

  private triggerTimeRamp(minScale: number, dur: number): void {
    const t = this.state.time;
    if (t.slowTimer <= 0 || minScale < t.slowMin) {
      t.slowMin = minScale;
      t.slowDur = dur;
      t.slowTimer = dur;
    }
  }

  public buildLevel(resetGold = true): void {
    this.hideModal();
    const s = this.state;
    s.mode = 'playing';
    s.runTime = 0;
    if (resetGold) s.gold = 0;
    s.goldPulse = 0;
    s.coinCombo = 0;
    s.coinComboTimer = 0;
    s.pitFade = 0;
    s.bossGateClosed = false;
    s.bossGateDrop = 0;
    s.bossGateSlammed = false;
    s.victoryGateOpen = false;
    s.checkpoint = { x: 110, y: FLOOR_Y };
    s.time = { hitStop: 0, slowTimer: 0, slowDur: 0.28, slowMin: 0.18, scale: 1.0 };
    s.camera = { x: 0, bossLocked: false, shakeTime: 0, shakeDur: 0.12, shakeAmp: 0, shakeX: 0, shakeY: 0 };
    s.bossArena = createBossArenaState();

    s.bgSpores = [];
    for (let i = 0; i < 42; i++) {
      s.bgSpores.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        vy: 8 + Math.random() * 15,
        r: 1.2 + Math.random() * 2.4,
        alpha: 0.22 + Math.random() * 0.48,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 地形平台（已彻底移除区域1楼梯，并加入Boss战动态变化平台）
    s.platforms = [
      // 区域 1：遗迹入口（连贯平地 + 侧边石台 + 单向铁艺跳台）
      { x: 0, y: FLOOR_Y, w: 1164, h: 140, type: 'solid', ground: true },
      { x: 375, y: FLOOR_Y - 120, w: 145, h: 22, type: 'solid' },
      { x: 840, y: FLOOR_Y - 94, w: 200, h: 14, type: 'oneway' },
      // 窄沟壑 (1164 ~ 1290)
      { x: 1290, y: FLOOR_Y, w: 490, h: 140, type: 'solid', ground: true },

      // 区域 2：断桥跳台
      { x: 2310, y: FLOOR_Y - 62, w: 175, h: 26, type: 'solid', suspended: true },

      // 区域 3：密林长廊
      { x: 2820, y: FLOOR_Y, w: 1560, h: 140, type: 'solid', ground: true },
      { x: 3150, y: FLOOR_Y - 100, w: 220, h: 14, type: 'oneway' },
      { x: 3490, y: FLOOR_Y - 130, w: 260, h: 14, type: 'oneway' },
      { x: 3870, y: FLOOR_Y - 100, w: 220, h: 14, type: 'oneway' },
      // 小裂谷 (4380 ~ 4505)
      { x: 4505, y: FLOOR_Y, w: 955, h: 140, type: 'solid', ground: true },

      // 区域 4：钟楼祭坛前廊 & Boss 房（含二阶段浮空侧台 + 升起的中央符文石台）
      { x: 5460, y: FLOOR_Y, w: 1600, h: 140, type: 'solid', ground: true },
      {
        x: 6160,
        y: FLOOR_Y - 96,
        baseY: FLOOR_Y - 96,
        floatPhase: 0,
        bossDynamic: 'side_float',
        w: 155,
        h: 14,
        type: 'oneway',
        active: true,
      },
      {
        x: 6685,
        y: FLOOR_Y - 96,
        baseY: FLOOR_Y - 96,
        floatPhase: Math.PI,
        bossDynamic: 'side_float',
        w: 155,
        h: 14,
        type: 'oneway',
        active: true,
      },
      {
        x: 6415,
        y: FLOOR_Y + 30,
        baseY: FLOOR_Y - 148,
        bossDynamic: 'center_sanctuary',
        w: 170,
        h: 16,
        type: 'oneway',
        active: false,
      },
    ];

    s.fragiles = [
      { x: 1875, y: FLOOR_Y - 10, w: 115, h: 20, state: 'solid', timer: 0 },
      { x: 2090, y: FLOOR_Y - 40, w: 115, h: 20, state: 'solid', timer: 0 },
      { x: 2595, y: FLOOR_Y - 34, w: 115, h: 20, state: 'solid', timer: 0 },
      { x: 6085, y: FLOOR_Y - 188, w: 105, h: 20, state: 'solid', timer: 0 },
      { x: 6810, y: FLOOR_Y - 188, w: 105, h: 20, state: 'solid', timer: 0 },
    ];

    // 仅保留唯一一个回血祭坛，位于 Boss 战前廊（无汉字标注）
    s.shrines = [
      {
        x: 5720,
        y: FLOOR_Y,
        w: 112,
        pool: 100,
        maxPool: 100,
        fullOnce: true,
        cd: 0,
        standTime: 0,
        healTick: 0,
        ambientTimer: 0,
      },
    ];

    s.crates = [
      { x: 335, y: FLOOR_Y, w: 42, h: 42, vx: 0, vy: 0, hp: 20, broken: false, flash: 0 },
      { x: 3110, y: FLOOR_Y, w: 42, h: 42, vx: 0, vy: 0, hp: 20, broken: false, flash: 0 },
      { x: 3730, y: FLOOR_Y, w: 42, h: 42, vx: 0, vy: 0, hp: 20, broken: false, flash: 0 },
    ];

    s.pots = [
      { x: 235, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 270, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 575, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 420, y: FLOOR_Y - 120, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 465, y: FLOOR_Y - 120, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 925, y: FLOOR_Y - 94, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 2350, y: FLOOR_Y - 62, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 2445, y: FLOOR_Y - 62, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 3260, y: FLOOR_Y - 100, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 3620, y: FLOOR_Y - 130, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 4720, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 5560, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 5600, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 5860, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
      { x: 5900, y: FLOOR_Y, w: 26, h: 30, hp: 20, broken: false, flash: 0 },
    ];

    s.fruits = [];
    s.projectiles = [];
    s.shockwaves = [];
    s.orbs = [];
    s.vfx = createEmptyVfx();

    s.enemies = [
      createBeetle(1530, FLOOR_Y, 1325, 1745),
      createWisp(2420, 218, false),
      createBeetle(3350, FLOOR_Y, 2980, 3680),
      createBeetle(3980, FLOOR_Y, 3680, 4340),
      createWisp(3630, 185, false),
    ];

    s.boss = createBoss(6760, FLOOR_Y);
    s.player = createPlayer(110, FLOOR_Y);
    this.callbacks.onToast('第一关：森林遗迹 · 向前探索击败朽钟守林巨像');
  }

  private resetBossArenaPlatforms(): void {
    this.state.bossArena = createBossArenaState();
    for (const pl of this.state.platforms) {
      if (pl.bossDynamic === 'side_float' && pl.baseY !== undefined) {
        pl.y = pl.baseY;
        pl.active = true;
      } else if (pl.bossDynamic === 'center_sanctuary') {
        pl.y = FLOOR_Y + 30;
        pl.active = false;
      }
    }
  }

  public respawnAtCheckpoint(): void {
    this.hideModal();
    const s = this.state;
    s.mode = 'playing';
    s.projectiles = [];
    s.shockwaves = [];
    s.bossGateClosed = false;
    s.bossGateDrop = 0;
    s.bossGateSlammed = false;
    s.camera.bossLocked = false;
    this.resetBossArenaPlatforms();
    if (s.boss && !s.boss.dead) {
      s.boss = createBoss(6760, FLOOR_Y);
    }
    s.enemies = s.enemies.filter((e) => !e.isSummon);
    s.player = createPlayer(s.checkpoint.x, s.checkpoint.y);
    s.camera.x = clamp(s.player.x - VIEW_W * 0.35, 0, WORLD_W - VIEW_W);
    this.callbacks.onToast('已在复活点重生');
  }

  public warpToBossCorridor(): void {
    this.hideModal();
    const s = this.state;
    if (s.mode !== 'playing' || !s.boss || s.boss.dead) {
      this.buildLevel(false);
    }
    s.bossGateClosed = false;
    s.bossGateDrop = 0;
    s.bossGateSlammed = false;
    s.camera.bossLocked = false;
    this.resetBossArenaPlatforms();
    s.projectiles = [];
    s.shockwaves = [];
    s.enemies = s.enemies.filter((e) => !e.isSummon);
    s.boss = createBoss(6760, FLOOR_Y);
    s.checkpoint = { x: 5720, y: FLOOR_Y };
    s.player = createPlayer(5820, FLOOR_Y);
    s.camera.x = clamp(s.player.x - VIEW_W * 0.35, 0, WORLD_W - VIEW_W);
    this.callbacks.onToast('已传送至钟楼祭坛前廊 · 向右踏入 Boss 战');
  }

  private hideModal(): void {
    this.callbacks.onModalChange({
      visible: false,
      mode: 'victory',
      rank: 'S',
      title: '',
      subtitle: '',
      gold: 0,
      hp: 100,
      timeSec: 0,
      primaryLabel: '再次挑战',
    });
  }

  private handlePlayerDeath(): void {
    const s = this.state;
    s.mode = 'dead';
    this.callbacks.onModalChange({
      visible: true,
      mode: 'dead',
      rank: '☠',
      title: '剑折遗迹',
      subtitle: '黑暗吞噬了微光……但遗迹仍为你保留着一线生机。',
      gold: s.gold,
      hp: 0,
      timeSec: Math.floor(s.runTime),
      primaryLabel: '从复活点重生',
    });
  }

  private handleVictory(): void {
    const s = this.state;
    if (s.mode === 'victory') return;
    s.mode = 'victory';
    const hp = Math.ceil(s.player.hp);
    const rank = hp >= 70 && s.gold >= 75 ? 'S' : hp >= 40 || s.gold >= 50 ? 'A' : 'B';
    AudioSys.playHeal();
    this.callbacks.onModalChange({
      visible: true,
      mode: 'victory',
      rank,
      title: '遗迹通关',
      subtitle: '朽钟守林巨像已倒下，森林遗迹的古老封印彻底解除。',
      gold: s.gold,
      hp,
      timeSec: Math.floor(s.runTime),
      primaryLabel: '再次挑战本关',
    });
  }

  private addScreenShake(amp: number, dur: number): void {
    const cam = this.state.camera;
    if (amp >= cam.shakeAmp || cam.shakeTime <= 0) {
      cam.shakeAmp = amp;
      cam.shakeDur = dur;
      cam.shakeTime = dur;
    }
  }

  private spawnDust(x: number, y: number, count = 6, color = 'rgba(180, 210, 215, 0.52)'): void {
    for (let i = 0; i < count; i++) {
      this.state.vfx.dust.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 2,
        vx: (Math.random() - 0.5) * 95,
        vy: -25 - Math.random() * 60,
        r: 2 + Math.random() * 3.2,
        life: 0.25 + Math.random() * 0.22,
        maxLife: 0.47,
        color,
      });
    }
  }

  private spawnOrbs(x: number, y: number, count: number): void {
    const floorY = Math.min(FLOOR_Y, y + 28);
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const spd = 90 + Math.random() * 180;
      this.state.orbs.push({
        phase: 'scatter',
        timer: 0,
        scatterDur: 0.24 + Math.random() * 0.12,
        pauseDur: 0.18 + Math.random() * 0.24,
        flyDur: 0.44 + Math.random() * 0.18,
        wx: x,
        wy: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        floorY,
        sx: 0,
        sy: 0,
        scrX: 0,
        scrY: 0,
        cx: 0,
        cy: 0,
        trail: [],
      });
    }
  }

  private getActiveSolidRects(): Platform[] {
    const list: Platform[] = this.state.platforms.filter((pl) => pl.active !== false);
    for (const fr of this.state.fragiles) {
      if (fr.state !== 'broken') {
        list.push({ x: fr.x, y: fr.y, w: fr.w, h: fr.h, type: 'solid', fragileRef: fr });
      }
    }
    return list;
  }

  private damagePlayer(dmg: number, srcX: number): void {
    const p = this.state.player;
    if (!p || this.state.mode !== 'playing') return;
    if (p.hurtInvuln > 0 || p.dashInvuln > 0) return;

    p.hp = Math.max(0, p.hp - dmg);
    p.whiteHold = 0.25;
    p.hpShake = 0.22;
    p.hurtInvuln = 1.0;
    p.hurtFlash = 0.28;
    const knockDir: 1 | -1 = p.x >= srcX ? 1 : -1;
    p.vx = knockDir * 240;
    p.vy = -210;
    p.onGround = false;

    AudioSys.playHurt();
    this.addScreenShake(6.5, 0.2);
    this.state.vfx.dmgNums.push({
      text: `-${dmg}`,
      x: p.x,
      y: p.y - 62,
      vx: knockDir * 28,
      vy: -120,
      isHeavy: false,
      tilt: knockDir * 0.08,
      life: 0.65,
      maxLife: 0.65,
    });

    if (p.hp <= 0) this.handlePlayerDeath();
  }

  private hitEnemy(
    e: Enemy,
    cfg: Pick<ComboStepConfig, 'damage' | 'isHeavy' | 'knockback'>,
    dir: 1 | -1,
    comboStep: 1 | 2 | 3,
    isParryHit = false
  ): void {
    e.hp = Math.max(0, e.hp - cfg.damage);
    e.whiteHold = 0.3;
    e.hpShake = cfg.isHeavy ? 0.24 : 0.15;
    e.flash = cfg.isHeavy ? 0.095 : 0.075;
    e.hitTintTimer = cfg.isHeavy ? 0.26 : 0.18;
    e.hitTintColor = cfg.isHeavy ? 'gold' : 'cyan';
    e.hitJitter = cfg.isHeavy ? 0.16 : 0.11;
    e.hitJitterDir = dir;
    e.crackGlow = Math.min(1, e.crackGlow + (cfg.isHeavy ? 0.85 : 0.5));
    e.squashTimer = 0.42;
    e.hurtExpr = 0.45;
    e.vx = dir * cfg.knockback;

    if (e.kind === 'wisp' && e.aiState === 'charge') {
      e.aiState = 'cooldown';
      e.aiTimer = 1.1;
    }

    AudioSys.playHit(cfg.isHeavy, e.kind === 'wisp' ? 'bronze' : 'stone');

    const impactX = e.x - dir * 10;
    const impactY = e.y - e.h * 0.55;
    spawnMonsterHitGhost(this.state.vfx, e, e.kind, dir, cfg.isHeavy || isParryHit);
    spawnMonsterHitVfx({
      vfx: this.state.vfx,
      x: impactX,
      y: impactY,
      dir,
      damage: cfg.damage,
      isHeavy: cfg.isHeavy,
      comboStep,
      material: e.kind,
      isParryHit,
    });

    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      const dropCount =
        e.kind === 'beetle' ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4);
      this.spawnOrbs(e.x, e.y - 18, dropCount);
      spawnMonsterDeathVfx(this.state.vfx, e.x, e.y - e.h * 0.5, e.kind);
      AudioSys.playMonsterKill(false);
    }
  }

  private hitBoss(
    b: Boss,
    cfg: Pick<ComboStepConfig, 'damage' | 'isHeavy' | 'knockback'>,
    dir: 1 | -1,
    comboStep: 1 | 2 | 3,
    isParryHit = false
  ): void {
    b.hp = Math.max(0, b.hp - cfg.damage);
    b.whiteHold = 0.3;
    b.hpShake = cfg.isHeavy ? 0.24 : 0.15;
    b.flash = cfg.isHeavy ? 0.095 : 0.075;
    b.hitTintTimer = cfg.isHeavy ? 0.28 : 0.18;
    b.hitTintColor = cfg.isHeavy || b.phase === 2 ? 'gold' : 'cyan';
    b.hitJitter = cfg.isHeavy ? 0.17 : 0.11;
    b.hitJitterDir = dir;
    b.crackGlow = Math.min(1, b.crackGlow + (cfg.isHeavy ? 0.85 : 0.45));
    b.squashTimer = 0.3;

    AudioSys.playHit(cfg.isHeavy, 'boss');

    const impactX = b.x - dir * 24;
    const impactY = b.y - 72;
    spawnMonsterHitGhost(this.state.vfx, b, 'boss', dir, cfg.isHeavy || isParryHit);
    spawnMonsterHitVfx({
      vfx: this.state.vfx,
      x: impactX,
      y: impactY,
      dir,
      damage: cfg.damage,
      isHeavy: cfg.isHeavy,
      comboStep,
      material: 'boss',
      isParryHit,
      bossPhase: b.phase,
    });

    if (b.phase === 1 && b.hp > 0 && b.hp <= b.maxHp * 0.5) {
      b.phase = 2;
      b.summonTimer = 5.5;
      AudioSys.playBossBell();
      AudioSys.playBossSlam();
      this.addScreenShake(12, 0.46);
      this.triggerTimeRamp(0.24, 0.4);

      // Activate Boss Phase-2 Map Transformation!
      const centerPl = this.state.platforms.find((pl) => pl.bossDynamic === 'center_sanctuary');
      if (centerPl) {
        centerPl.active = true;
      }
      this.state.bossArena.cracks.push(
        { x: 6335, w: 92, alpha: 1 },
        { x: 6665, w: 92, alpha: 1 }
      );
      this.spawnDust(6500, FLOOR_Y, 22, 'rgba(253, 224, 71, 0.55)');

      this.state.vfx.rings.push({
        x: b.x,
        y: b.y - 72,
        r0: 14,
        r1: 185,
        w0: 6,
        color: '#fde047',
        style: 'rune_sigil',
        rot: 0,
        vrot: 2.2,
        squashY: 1,
        life: 0.52,
        maxLife: 0.52,
      });
      this.callbacks.onToast('朽钟共鸣！祭坛裂地异变 · 浮空石台升起！', 3000);
    }

    if (b.hp <= 0 && !b.dead) {
      b.dead = true;
      b.deathBurstsLeft = 4;
      b.deathBurstTimer = 0.08;
      this.state.victoryGateOpen = true;
      this.state.camera.bossLocked = false;
      for (const g of this.state.bossArena.geysers) {
        g.state = 'idle';
        g.timer = 0;
      }
      for (const e of this.state.enemies) {
        if (e.isSummon && !e.dead) {
          e.dead = true;
          this.spawnOrbs(e.x, e.y - 16, 4);
          spawnMonsterDeathVfx(this.state.vfx, e.x, e.y - 20, 'wisp');
        }
      }
      this.spawnOrbs(b.x, b.y - 60, 60);
      spawnMonsterDeathVfx(this.state.vfx, b.x, b.y - 68, 'boss');
      AudioSys.playBossBell();
      AudioSys.playBossSlam();
      AudioSys.playMonsterKill(true);
      this.state.time.hitStop = 0.16;
      this.triggerTimeRamp(0.16, 0.52);
      this.callbacks.onToast('朽钟守林巨像已陨落！前往右侧通关之门！', 3800);
    }
  }

  private startPlayerAttack(step: 1 | 2 | 3): void {
    const p = this.state.player;
    p.atkActive = true;
    p.atkStep = step;
    p.atkPhase = 'windup';
    p.atkTimer = 0;
    p.chargeSparkTimer = 0;
    p.hitTargets = new Set();
    if (this.keys.left && !this.keys.right) p.facing = -1;
    else if (this.keys.right && !this.keys.left) p.facing = 1;
  }

  public triggerJump(): void {
    AudioSys.unlock();
    if (this.state.mode !== 'playing') return;
    const p = this.state.player;
    if (this.keys.down && p.onGround) {
      p.dropThrough = 0.22;
      p.y += 4;
      p.onGround = false;
      return;
    }
    p.jumpBuffer = 0.11;
  }

  public triggerAttack(): void {
    AudioSys.unlock();
    if (this.state.mode !== 'playing') return;
    const p = this.state.player;
    if (p.dashTimer > 0) return;

    if (!p.atkActive) {
      if (p.atkCd > 0) {
        p.atkBuffer = true;
        return;
      }
      const nextStep = (p.comboWindow > 0 ? (p.atkStep % 3) + 1 : 1) as 1 | 2 | 3;
      this.startPlayerAttack(nextStep);
    } else if (
      p.atkPhase === 'recovery' ||
      (p.atkPhase === 'slash' && p.atkTimer >= COMBO_CFG[p.atkStep].slash * 0.45)
    ) {
      p.atkBuffer = true;
    }
  }

  public triggerDash(): void {
    AudioSys.unlock();
    if (this.state.mode !== 'playing') return;
    const p = this.state.player;
    if (p.dashCd > 0 || p.dashTimer > 0) return;
    if (!p.onGround && p.airDashUsed) return;

    if (this.keys.left && !this.keys.right) p.facing = -1;
    else if (this.keys.right && !this.keys.left) p.facing = 1;

    p.dashDir = p.facing;
    p.dashTimer = 0.18;
    p.dashInvuln = 0.13;
    p.dashCd = 0.8;
    p.dashGhostTimer = 0;
    if (!p.onGround) p.airDashUsed = true;
    if (p.atkActive && p.atkPhase === 'recovery') p.atkActive = false;

    AudioSys.playDash();
    this.spawnDust(p.x, p.y, 7);
    spawnDashVfx(this.state.vfx, p.x, p.y, p.facing);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.down = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyK') {
      if (!this.keys.jumpHeld) this.triggerJump();
      this.keys.jumpHeld = true;
    }
    if (e.code === 'KeyJ' && !e.repeat) this.triggerAttack();
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') && !e.repeat) {
      this.triggerDash();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.down = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyK') {
      this.keys.jumpHeld = false;
    }
  }

  private onBlur(): void {
    this.keys.left = false;
    this.keys.right = false;
    this.keys.down = false;
    this.keys.jumpHeld = false;
  }

  private onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    if (e.button === 0) this.triggerAttack();
    if (e.button === 2) this.triggerDash();
  }

  private updatePlayer(dt: number): void {
    const s = this.state;
    const p = s.player;
    p.animTime += dt;
    if (p.onGround && Math.abs(p.vx) > 35 && !p.atkActive && p.dashTimer <= 0) {
      const spdFactor = clamp(Math.abs(p.vx) / 285, 0.55, 1.15);
      p.runAnimTime += dt * spdFactor;
    } else if (Math.abs(p.vx) <= 20) {
      p.runAnimTime = 0;
    }
    p.squashX = lerp(p.squashX, 1, Math.min(1, dt * 14));
    p.squashY = lerp(p.squashY, 1, Math.min(1, dt * 14));

    if (p.jumpBuffer > 0) p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    if (p.dropThrough > 0) p.dropThrough = Math.max(0, p.dropThrough - dt);
    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.dashInvuln > 0) p.dashInvuln = Math.max(0, p.dashInvuln - dt);
    if (p.hurtInvuln > 0) p.hurtInvuln = Math.max(0, p.hurtInvuln - dt);
    if (p.hurtFlash > 0) p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    if (p.hpShake > 0) p.hpShake = Math.max(0, p.hpShake - dt);
    if (p.atkCd > 0) p.atkCd = Math.max(0, p.atkCd - dt);
    if (p.comboWindow > 0) p.comboWindow = Math.max(0, p.comboWindow - dt);

    if (p.whiteHp > p.hp) {
      if (p.whiteHold > 0) p.whiteHold = Math.max(0, p.whiteHold - dt);
      else p.whiteHp = Math.max(p.hp, p.whiteHp - Math.max(36, (p.whiteHp - p.hp) * 6) * dt);
    }

    if (p.hp > 0 && p.hp < 25) {
      p.heartbeatTimer -= dt;
      if (p.heartbeatTimer <= 0) {
        p.heartbeatTimer = 0.83;
        AudioSys.playHeartbeat();
      }
    }

    // Running footstep dust
    if (p.onGround && Math.abs(p.vx) > 130 && p.dashTimer <= 0) {
      p.runDustTimer -= dt;
      if (p.runDustTimer <= 0) {
        p.runDustTimer = 0.14;
        s.vfx.dust.push({
          x: p.x - p.facing * 8 + (Math.random() - 0.5) * 6,
          y: p.y - 2,
          vx: -p.facing * (35 + Math.random() * 35),
          vy: -14 - Math.random() * 26,
          r: 1.8 + Math.random() * 2.2,
          life: 0.22 + Math.random() * 0.14,
          maxLife: 0.36,
          color: 'rgba(165, 205, 198, 0.45)',
        });
      }
    }

    // 3-Hit Combo State Machine with Slow-Fast-Slow Rhythm
    if (p.atkActive) {
      const cfg = COMBO_CFG[p.atkStep];
      p.atkTimer += dt;
      if (p.atkPhase === 'windup') {
        // Golden anticipation gathering sparks on heavy Combo 3 windup
        if (p.atkStep === 3) {
          p.chargeSparkTimer -= dt;
          if (p.chargeSparkTimer <= 0) {
            p.chargeSparkTimer = 0.045;
            const ang = Math.random() * Math.PI * 2;
            const dist = 24 + Math.random() * 22;
            const sx = p.x - p.facing * 6 + Math.cos(ang) * dist;
            const sy = p.y - 34 + Math.sin(ang) * dist;
            s.vfx.wisps.push({
              x: sx,
              y: sy,
              vx: -Math.cos(ang) * 75,
              vy: -Math.sin(ang) * 75,
              r: 2 + Math.random() * 1.8,
              phase: Math.random() * Math.PI * 2,
              swirlAmp: 8,
              color: '#fde047',
              life: 0.22,
              maxLife: 0.22,
            });
          }
        }

        if (p.atkTimer >= cfg.windup) {
          p.atkPhase = 'slash';
          p.atkTimer = 0;
          p.hitTargets = new Set();
          // Subtle forward lunge on strike frame for weighty game feel
          if (p.onGround) {
            p.vx += p.facing * (p.atkStep === 3 ? 170 : 95);
          }
          AudioSys.playSlash(p.atkStep);

          const offX = p.facing * (p.atkStep === 3 ? 42 : 34);
          const offY = p.atkStep === 3 ? -36 : -33;
          s.vfx.slashes.push({
            x: p.x + offX,
            y: p.y + offY,
            facing: p.facing,
            step: p.atkStep,
            radius: cfg.radius,
            life: cfg.slashVfxDur,
            maxLife: cfg.slashVfxDur,
            followPlayer: true,
            offsetX: offX,
            offsetY: offY,
          });

          // Emit trailing blade embers synced with the 3-hit slash art
          const emberCount = p.atkStep === 3 ? 9 : 4;
          for (let i = 0; i < emberCount; i++) {
            const a = (p.facing > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.4;
            const spd = 95 + Math.random() * 165;
            s.vfx.wisps.push({
              x: p.x + offX + (Math.random() - 0.5) * 26,
              y: p.y + offY + (Math.random() - 0.5) * 32,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd - 20,
              r: p.atkStep === 3 ? 2.4 + Math.random() * 2 : 1.8 + Math.random() * 1.5,
              phase: Math.random() * Math.PI * 2,
              swirlAmp: 16,
              color: p.atkStep === 3 ? '#fde047' : '#67e8f9',
              life: 0.26 + Math.random() * 0.16,
              maxLife: 0.42,
            });
          }
        }
      } else if (p.atkPhase === 'slash') {
        const reach = cfg.isHeavy ? 104 : 84;
        const atkBox = {
          x: p.facing > 0 ? p.x - 6 : p.x + 6 - reach,
          y: p.y - 72,
          w: reach,
          h: 72,
        };
        let hitSomething = false;

        // 1) Parry wisp projectiles
        for (const pr of s.projectiles) {
          if (pr.deflected) continue;
          const prBox = {
            x: pr.x - pr.r - 6,
            y: pr.y - pr.r - 6,
            w: (pr.r + 6) * 2,
            h: (pr.r + 6) * 2,
          };
          if (rectsOverlap(atkBox, prBox)) {
            pr.deflected = true;
            pr.dmg = 22;
            pr.life = 2.4;
            pr.trail = [{ x: pr.x, y: pr.y }];
            let tx: number = p.facing;
            let ty = 0;
            if (pr.owner && !pr.owner.dead) {
              const dx = pr.owner.x - pr.x;
              const dy = pr.owner.y - pr.owner.h * 0.5 - pr.y;
              const len = Math.max(1, Math.hypot(dx, dy));
              tx = dx / len;
              ty = dy / len;
            }
            pr.vx = tx * 490;
            pr.vy = ty * 490;
            AudioSys.playParry();
            s.time.hitStop = Math.max(s.time.hitStop, 0.068);
            this.triggerTimeRamp(0.35, 0.18);
            this.addScreenShake(5.8, 0.15);
            s.vfx.rings.push({
              x: pr.x,
              y: pr.y,
              r0: 6,
              r1: 64,
              w0: 3.8,
              color: '#67e8f9',
              style: 'chime_arcs',
              rot: 0,
              vrot: 3.2,
              squashY: 1,
              life: 0.24,
              maxLife: 0.24,
            });
            s.vfx.scars.push({
              x: pr.x,
              y: pr.y,
              angle: 0,
              length: 76,
              thickness: 7,
              color: '#67e8f9',
              coreColor: '#ffffff',
              crossFlare: true,
              starPoints: 4,
              starRadius: 34,
              life: 0.18,
              maxLife: 0.18,
            });
            s.vfx.dmgNums.push({
              text: '弹反!',
              x: pr.x,
              y: pr.y - 16,
              vx: 0,
              vy: -105,
              isParry: true,
              tilt: 0,
              life: 0.68,
              maxLife: 0.68,
            });
          }
        }

        // 2) Hit enemies
        for (const e of s.enemies) {
          if (e.dead || p.hitTargets.has(e)) continue;
          const eb = { x: e.x - e.w * 0.55, y: e.y - e.h - 4, w: e.w * 1.1, h: e.h + 8 };
          if (rectsOverlap(atkBox, eb)) {
            p.hitTargets.add(e);
            this.hitEnemy(e, cfg, p.facing, p.atkStep, false);
            hitSomething = true;
          }
        }

        // 3) Hit Boss
        const b = s.boss;
        if (b && b.active && !b.dead && !p.hitTargets.has(b)) {
          const bb = { x: b.x - b.w * 0.5, y: b.y - b.h, w: b.w, h: b.h };
          if (rectsOverlap(atkBox, bb)) {
            p.hitTargets.add(b);
            this.hitBoss(b, cfg, p.facing, p.atkStep, false);
            hitSomething = true;
          }
        }

        // 4) Break crates
        for (const c of s.crates) {
          if (c.broken || p.hitTargets.has(c)) continue;
          const cb = { x: c.x - c.w * 0.5, y: c.y - c.h, w: c.w, h: c.h };
          if (rectsOverlap(atkBox, cb)) {
            p.hitTargets.add(c);
            c.hp -= 10;
            c.flash = 0.09;
            c.vx = p.facing * 120;
            AudioSys.playHit(false, 'wood');
            spawnPropHitVfx(s.vfx, c.x, c.y - c.h * 0.5, p.facing, 'wood');
            if (c.hp <= 0) {
              c.broken = true;
              spawnPropBreakShards(s.vfx, c.x, c.y - 20, 12, 'wood');
              this.spawnOrbs(c.x, c.y - 20, 2 + Math.floor(Math.random() * 4));
              if (Math.random() < 0.3) s.fruits.push({ x: c.x, y: c.y - 24, vy: -180, bob: 0 });
            }
          }
        }

        // 5) Break pots
        for (const pot of s.pots) {
          if (pot.broken || p.hitTargets.has(pot)) continue;
          const pb = { x: pot.x - pot.w * 0.55, y: pot.y - pot.h, w: pot.w * 1.1, h: pot.h };
          if (rectsOverlap(atkBox, pb)) {
            p.hitTargets.add(pot);
            pot.hp -= 10;
            pot.flash = 0.09;
            AudioSys.playHit(false, 'stone');
            spawnPropHitVfx(s.vfx, pot.x, pot.y - 14, p.facing, 'stone');
            if (pot.hp <= 0) {
              pot.broken = true;
              spawnPropBreakShards(s.vfx, pot.x, pot.y - 14, 10, 'stone');
              if (Math.random() < 0.7) this.spawnOrbs(pot.x, pot.y - 16, 1 + Math.floor(Math.random() * 3));
              if (Math.random() < 0.5) s.fruits.push({ x: pot.x, y: pot.y - 18, vy: -165, bob: 0 });
            }
          }
        }

        if (hitSomething) {
          s.time.hitStop = Math.max(s.time.hitStop, cfg.hitStop);
          this.addScreenShake(cfg.shakeAmp, cfg.shakeDur);
          if (cfg.isHeavy) {
            this.triggerTimeRamp(0.15, 0.34);
          } else {
            // Subtle fast-slow punctuation even on light combo hits 1 & 2
            this.triggerTimeRamp(0.46, 0.1);
          }
        }

        if (p.atkTimer >= cfg.slash) {
          p.atkPhase = 'recovery';
          p.atkTimer = 0;
        }
      } else {
        if (p.atkBuffer && p.atkTimer >= cfg.recovery * 0.34) {
          p.atkBuffer = false;
          this.startPlayerAttack(((p.atkStep % 3) + 1) as 1 | 2 | 3);
        } else if (p.atkTimer >= cfg.recovery) {
          p.atkActive = false;
          p.comboWindow = 0.88;
          p.atkCd = p.atkStep === 3 ? 0.24 : 0.08;
        }
      }
    } else if (p.atkBuffer && p.atkCd <= 0) {
      p.atkBuffer = false;
      this.startPlayerAttack((p.comboWindow > 0 ? (p.atkStep % 3) + 1 : 1) as 1 | 2 | 3);
    }

    // Dash & horizontal motion
    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.vx = p.dashDir * 1180;
      p.vy = 0;
      p.dashGhostTimer -= dt;
      if (p.dashGhostTimer <= 0) {
        p.dashGhostTimer = 0.026;
        const ghostSheetKey = AssetManager.get('player_run') ? 'player_run' : 'player_idle';
        const ghostFrameIdx = Math.floor(p.animTime * 14);
        s.vfx.afterimages.push({
          x: p.x,
          y: p.y,
          facing: p.facing,
          sheetKey: ghostSheetKey,
          frameIdx: ghostFrameIdx,
          animTime: p.animTime,
          life: 0.26,
          maxLife: 0.26,
        });
      }
    } else {
      const moveDir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      if (moveDir !== 0) {
        if (!p.atkActive) p.facing = moveDir as 1 | -1;
        const targetSpd = moveDir * (p.atkActive ? 112 : 285);
        p.vx = lerp(p.vx, targetSpd, Math.min(1, dt * 22));
      } else {
        p.vx = lerp(p.vx, 0, Math.min(1, dt * 24));
        if (Math.abs(p.vx) < 4) p.vx = 0;
      }

      let grav = 1480;
      if (p.vy < 0 && !this.keys.jumpHeld) grav = 2650;
      if (Math.abs(p.vy) < 65 && !p.onGround) grav = 980;
      p.vy = Math.min(820, p.vy + grav * dt);
    }

    if (p.onGround) {
      p.coyote = 0.1;
      p.airDashUsed = false;
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
    }

    if (p.jumpBuffer > 0 && p.coyote > 0 && p.dashTimer <= 0) {
      p.vy = -575;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.squashX = 0.82;
      p.squashY = 1.22;
      AudioSys.playJump();
      this.spawnDust(p.x, p.y, 7);
      s.vfx.rings.push({
        x: p.x,
        y: p.y - 2,
        r0: 4,
        r1: 24,
        w0: 2.2,
        color: 'rgba(186, 230, 253, 0.7)',
        style: 'solid',
        rot: 0,
        vrot: 0,
        squashY: 0.34,
        life: 0.18,
        maxLife: 0.18,
      });
    }

    const prevY = p.y;
    const prevVy = p.vy;
    const wasOnGround = p.onGround;

    p.x += p.vx * dt;
    const minBound = s.bossGateClosed ? BOSS_ARENA_LEFT + 18 : 22;
    const maxBound = s.bossGateClosed ? BOSS_ARENA_RIGHT - 18 : WORLD_W - 22;
    p.x = clamp(p.x, minBound, maxBound);

    for (const c of s.crates) {
      if (c.broken) continue;
      const pb = { x: p.x - p.w * 0.5, y: p.y - p.h + 6, w: p.w, h: p.h - 10 };
      const cb = { x: c.x - c.w * 0.5, y: c.y - c.h, w: c.w, h: c.h };
      if (rectsOverlap(pb, cb)) {
        if (p.x < c.x) {
          if (this.keys.right) c.vx = 105;
          p.x = c.x - c.w * 0.5 - p.w * 0.5;
        } else {
          if (this.keys.left) c.vx = -105;
          p.x = c.x + c.w * 0.5 + p.w * 0.5;
        }
      }
    }

    p.y += p.vy * dt;
    p.onGround = false;
    const solids = this.getActiveSolidRects();

    for (const c of s.crates) {
      if (c.broken) continue;
      if (p.vy >= 0 && Math.abs(p.x - c.x) < (c.w + p.w) * 0.46) {
        const topY = c.y - c.h;
        if (prevY <= topY + 10 && p.y >= topY) {
          p.y = topY;
          p.vy = 0;
          p.onGround = true;
        }
      }
    }

    for (const pl of solids) {
      if (p.x + p.w * 0.42 <= pl.x || p.x - p.w * 0.42 >= pl.x + pl.w) continue;
      if (pl.type === 'oneway') {
        if (p.dropThrough <= 0 && p.vy >= 0 && prevY <= pl.y + 10 && p.y >= pl.y) {
          p.y = pl.y;
          p.vy = 0;
          p.onGround = true;
        }
      } else if (p.vy >= 0 && prevY <= pl.y + 14 && p.y >= pl.y) {
        p.y = pl.y;
        p.vy = 0;
        p.onGround = true;
        if (pl.fragileRef) {
          if (pl.fragileRef.state === 'solid') {
            pl.fragileRef.state = 'shaking';
            pl.fragileRef.timer = 0.8;
            AudioSys.playHit(false, 'stone');
          }
        } else {
          p.lastSafeX = clamp(p.x, pl.x + 28, pl.x + pl.w - 28);
          p.lastSafeY = pl.y;
        }
      }
    }

    if (!wasOnGround && p.onGround) {
      p.squashX = 1.24;
      p.squashY = 0.8;
      this.spawnDust(p.x, p.y, prevVy > 420 ? 10 : 6);
      if (prevVy > 420) {
        s.vfx.rings.push({
          x: p.x,
          y: p.y - 2,
          r0: 6,
          r1: 34,
          w0: 2.4,
          color: 'rgba(186, 230, 253, 0.55)',
          style: 'solid',
          rot: 0,
          vrot: 0,
          squashY: 0.3,
          life: 0.2,
          maxLife: 0.2,
        });
      }
    }

    if (!s.bossGateClosed && s.boss && !s.boss.dead && p.x > BOSS_TRIGGER_X) {
      s.bossGateClosed = true;
      s.bossGateDrop = 0;
      s.bossGateSlammed = false;
      s.camera.bossLocked = true;
      s.boss.active = true;
      s.boss.aiState = 'march';
      s.boss.aiTimer = 1.25;
      s.boss.aiStateDur = 1.25;
      AudioSys.playBossBell();
      this.addScreenShake(7, 0.32);
      this.callbacks.onToast('巨型石门砸落闭锁 · 朽钟守林巨像苏醒！');
    }

    if (s.victoryGateOpen && Math.abs(p.x - 6925) < 42 && Math.abs(p.y - FLOOR_Y) < 40) {
      this.handleVictory();
    }

    if (p.y > VIEW_H + 80) {
      s.pitFade = 0.35;
      p.hp = Math.max(0, p.hp - 20);
      p.whiteHold = 0.25;
      AudioSys.playHurt();
      if (p.hp <= 0) {
        this.handlePlayerDeath();
      } else {
        p.x = p.lastSafeX;
        p.y = p.lastSafeY - 6;
        p.vx = 0;
        p.vy = 0;
        p.hurtInvuln = 1.0;
        this.callbacks.onToast('坠入深渊裂谷！扣除 20 点血量并传回安全石台');
      }
    }
  }

  private updateBossArena(dt: number): void {
    const s = this.state;
    const b = s.boss;
    const arena = s.bossArena;
    const isPhase2Active = Boolean(b && b.active && !b.dead && b.phase === 2);

    // Smooth atmospheric lighting shift
    const targetBlend = isPhase2Active ? 1 : 0;
    arena.phaseBlend = lerp(arena.phaseBlend, targetBlend, Math.min(1, dt * (isPhase2Active ? 1.5 : 0.8)));

    // Center sanctuary platform rises smoothly in Phase 2
    if (isPhase2Active) {
      arena.centerRise = Math.min(1, arena.centerRise + dt * 1.15);
    }
    for (const pl of s.platforms) {
      if (pl.bossDynamic === 'center_sanctuary' && pl.active && pl.baseY !== undefined) {
        pl.y = lerp(FLOOR_Y + 30, pl.baseY, Easing.easeOutCubic(arena.centerRise));
      } else if (pl.bossDynamic === 'side_float' && pl.baseY !== undefined) {
        const amp = isPhase2Active ? 26 : 0;
        const targetY = pl.baseY + Math.sin(s.elapsed * 1.65 + (pl.floatPhase ?? 0)) * amp;
        pl.y = lerp(pl.y, targetY, Math.min(1, dt * 4));
      }
    }

    // Phase-2 ambient golden embers across the Boss arena
    if (isPhase2Active) {
      arena.ambientEmberTimer -= dt;
      if (arena.ambientEmberTimer <= 0) {
        arena.ambientEmberTimer = 0.14;
        s.vfx.wisps.push({
          x: BOSS_ARENA_LEFT + 30 + Math.random() * (BOSS_ARENA_RIGHT - BOSS_ARENA_LEFT - 60),
          y: FLOOR_Y - 4,
          vx: (Math.random() - 0.5) * 28,
          vy: -48 - Math.random() * 68,
          r: 1.8 + Math.random() * 2.2,
          phase: Math.random() * Math.PI * 2,
          swirlAmp: 18 + Math.random() * 16,
          color: Math.random() < 0.65 ? '#fde047' : '#f97316',
          life: 1.2 + Math.random() * 0.9,
          maxLife: 2.1,
        });
      }

      // Alternating floor rune bell-fire geysers
      arena.geyserCycleTimer -= dt;
      if (arena.geyserCycleTimer <= 0) {
        const g = arena.geysers[arena.geyserIndex % arena.geysers.length];
        arena.geyserIndex += 1;
        arena.geyserCycleTimer = 5.2;
        if (g.state === 'idle') {
          g.state = 'warn';
          g.maxTimer = 1.15;
          g.timer = 1.15;
          g.hitDone = false;
          AudioSys.playBossBell();
        }
      }
    }

    const p = s.player;
    const pBox = { x: p.x - p.w * 0.5, y: p.y - p.h, w: p.w, h: p.h };
    for (const g of arena.geysers) {
      if (g.state === 'warn') {
        g.timer -= dt;
        if (Math.random() < 0.35) {
          s.vfx.wisps.push({
            x: g.x + (Math.random() - 0.5) * g.w * 0.8,
            y: FLOOR_Y - 4,
            vx: 0,
            vy: -95 - Math.random() * 75,
            r: 2 + Math.random() * 1.8,
            phase: Math.random() * Math.PI * 2,
            swirlAmp: 8,
            color: '#fde047',
            life: 0.32,
            maxLife: 0.32,
          });
        }
        if (g.timer <= 0) {
          g.state = 'erupt';
          g.maxTimer = 0.68;
          g.timer = 0.68;
          AudioSys.playBossSlam();
          this.addScreenShake(6.5, 0.22);
          this.spawnDust(g.x, FLOOR_Y, 14, 'rgba(253, 224, 71, 0.62)');
          s.vfx.rings.push({
            x: g.x,
            y: FLOOR_Y - 6,
            r0: 10,
            r1: 72,
            w0: 4,
            color: '#fde047',
            style: 'rune_sigil',
            rot: 0,
            vrot: 2.4,
            squashY: 0.35,
            life: 0.32,
            maxLife: 0.32,
          });
        }
      } else if (g.state === 'erupt') {
        g.timer -= dt;
        const gBox = { x: g.x - g.w * 0.42, y: FLOOR_Y - 210, w: g.w * 0.84, h: 210 };
        if (!g.hitDone && rectsOverlap(gBox, pBox)) {
          this.damagePlayer(15, g.x);
          g.hitDone = true;
        }
        if (g.timer <= 0) {
          g.state = 'idle';
        }
      }
    }
  }

  private updateFragilesAndShrines(dt: number): void {
    const s = this.state;
    const p = s.player;
    for (const fr of s.fragiles) {
      if (fr.state === 'shaking') {
        fr.timer -= dt;
        if (fr.timer <= 0) {
          fr.state = 'broken';
          fr.timer = 2.6;
          AudioSys.playHit(true, 'stone');
          spawnPropBreakShards(s.vfx, fr.x + fr.w * 0.5, fr.y + 8, 12, 'stone');
        }
      } else if (fr.state === 'broken') {
        fr.timer -= dt;
        if (fr.timer <= 0) fr.state = 'solid';
      }
    }

    for (const sh of s.shrines) {
      if (sh.cd > 0) {
        sh.cd = Math.max(0, sh.cd - dt);
        if (sh.cd <= 0 && !sh.fullOnce) sh.pool = sh.maxPool;
      }

      // Rich ambient healing fireflies around active shrine
      if (sh.pool > 0) {
        sh.ambientTimer -= dt;
        if (sh.ambientTimer <= 0) {
          sh.ambientTimer = 0.24;
          s.vfx.wisps.push({
            x: sh.x + (Math.random() - 0.5) * sh.w * 0.8,
            y: sh.y - 12 - Math.random() * 14,
            vx: (Math.random() - 0.5) * 14,
            vy: -28 - Math.random() * 34,
            r: 2 + Math.random() * 1.8,
            phase: Math.random() * Math.PI * 2,
            swirlAmp: 14,
            color: Math.random() < 0.65 ? '#fef08a' : '#86efac',
            life: 0.75 + Math.random() * 0.45,
            maxLife: 1.2,
          });
        }
      }

      const standing = p.onGround && Math.abs(p.x - sh.x) < sh.w * 0.55 && Math.abs(p.y - sh.y) < 12;
      if (standing && sh.pool > 0) {
        sh.standTime += dt;
        s.checkpoint = { x: sh.x, y: sh.y };
        if (sh.standTime >= 0.4 && p.hp < p.maxHp) {
          const heal = p.maxHp - p.hp;
          p.hp = p.maxHp;
          p.whiteHp = p.maxHp;
          sh.pool = 0;
          AudioSys.playHeal();
          s.vfx.rings.push({
            x: sh.x,
            y: sh.y - 10,
            r0: 12,
            r1: 88,
            w0: 4,
            color: '#fef08a',
            style: 'rune_sigil',
            rot: 0,
            vrot: 2.0,
            squashY: 0.35,
            life: 0.48,
            maxLife: 0.48,
          });
          for (let i = 0; i < 16; i++) {
            s.vfx.wisps.push({
              x: p.x + (Math.random() - 0.5) * 44,
              y: p.y - Math.random() * 20,
              vx: (Math.random() - 0.5) * 32,
              vy: -85 - Math.random() * 95,
              r: 2.6 + Math.random() * 2.2,
              phase: Math.random() * Math.PI * 2,
              swirlAmp: 22,
              color: i % 2 === 0 ? '#fef08a' : '#86efac',
              life: 0.8 + Math.random() * 0.4,
              maxLife: 1.2,
            });
          }
          s.vfx.dmgNums.push({
            text: `+${Math.ceil(heal)}`,
            x: p.x,
            y: p.y - 68,
            vx: 0,
            vy: -70,
            isHeal: true,
            tilt: 0,
            life: 0.85,
            maxLife: 0.85,
          });
        }
      } else {
        sh.standTime = 0;
      }
    }
  }

  private updateCratesAndFruits(dt: number): void {
    const s = this.state;
    const p = s.player;
    for (const c of s.crates) {
      if (c.broken) continue;
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt);
      c.vx = lerp(c.vx, 0, Math.min(1, dt * 10));
      c.vy = Math.min(720, c.vy + 1400 * dt);
      c.x += c.vx * dt;
      const prevY = c.y;
      c.y += c.vy * dt;
      for (const pl of s.platforms) {
        if (pl.type !== 'solid') continue;
        if (c.x > pl.x && c.x < pl.x + pl.w && prevY <= pl.y + 10 && c.y >= pl.y) {
          c.y = pl.y;
          c.vy = 0;
        }
      }
    }

    for (const pot of s.pots) {
      if (!pot.broken && pot.flash > 0) pot.flash = Math.max(0, pot.flash - dt);
    }

    for (let i = s.fruits.length - 1; i >= 0; i--) {
      const f = s.fruits[i];
      f.bob += dt * 5;
      f.vy = Math.min(500, f.vy + 900 * dt);
      f.y += f.vy * dt;
      for (const pl of s.platforms) {
        if (f.x > pl.x && f.x < pl.x + pl.w && f.y >= pl.y - 12 && f.y <= pl.y + 20) {
          f.y = pl.y - 12;
          f.vy = 0;
        }
      }
      if (Math.hypot(p.x - f.x, p.y - 30 - f.y) < 34) {
        const heal = Math.min(10, p.maxHp - p.hp);
        p.hp = Math.min(p.maxHp, p.hp + 10);
        p.whiteHp = Math.max(p.whiteHp, p.hp);
        AudioSys.playHeal();
        s.vfx.rings.push({
          x: f.x,
          y: f.y,
          r0: 4,
          r1: 30,
          w0: 2.5,
          color: '#86efac',
          style: 'solid',
          rot: 0,
          vrot: 0,
          squashY: 1,
          life: 0.22,
          maxLife: 0.22,
        });
        s.vfx.dmgNums.push({
          text: `+${Math.max(10, Math.round(heal))}`,
          x: f.x,
          y: f.y - 12,
          vx: 0,
          vy: -75,
          isHeal: true,
          tilt: 0,
          life: 0.75,
          maxLife: 0.75,
        });
        s.fruits.splice(i, 1);
      }
    }
  }

  private updateEnemies(dt: number): void {
    const s = this.state;
    const p = s.player;
    for (const e of s.enemies) {
      if (e.dead) continue;
      e.animTime += dt;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      if (e.hitTintTimer > 0) e.hitTintTimer = Math.max(0, e.hitTintTimer - dt);
      if (e.hitJitter > 0) e.hitJitter = Math.max(0, e.hitJitter - dt);
      if (e.crackGlow > 0) e.crackGlow = Math.max(0, e.crackGlow - dt * 1.45);
      if (e.squashTimer > 0) e.squashTimer = Math.max(0, e.squashTimer - dt);
      if (e.hurtExpr > 0) e.hurtExpr = Math.max(0, e.hurtExpr - dt);
      if (e.hpShake > 0) e.hpShake = Math.max(0, e.hpShake - dt);
      if (e.whiteHp > e.hp) {
        if (e.whiteHold > 0) e.whiteHold = Math.max(0, e.whiteHold - dt);
        else e.whiteHp = Math.max(e.hp, e.whiteHp - Math.max(38, (e.whiteHp - e.hp) * 6.5) * dt);
      }

      if (e.kind === 'beetle') {
        const dx = p.x - e.x;
        const dy = Math.abs(p.y - e.y);
        if (e.aiState === 'patrol') {
          e.vx = lerp(e.vx, e.facing * 58, Math.min(1, dt * 8));
          if (e.x <= e.minX) e.facing = 1;
          if (e.x >= e.maxX) e.facing = -1;
          if (Math.abs(dx) < 250 && dy < 70) {
            e.facing = dx >= 0 ? 1 : -1;
            e.aiState = 'windup';
            e.aiTimer = 0.42;
            e.vx = 0;
          }
        } else if (e.aiState === 'windup') {
          e.vx = lerp(e.vx, 0, Math.min(1, dt * 12));
          e.aiTimer -= dt;
          e.vfxTick -= dt;
          if (e.vfxTick <= 0) {
            e.vfxTick = 0.12;
            this.spawnDust(e.x - e.facing * 16, e.y, 2, 'rgba(253, 224, 71, 0.45)');
          }
          if (e.aiTimer <= 0) {
            e.aiState = 'charge';
            e.aiTimer = 0.46;
            e.vx = e.facing * 310;
          }
        } else if (e.aiState === 'charge') {
          e.aiTimer -= dt;
          e.vfxTick -= dt;
          if (e.vfxTick <= 0) {
            e.vfxTick = 0.06;
            this.spawnDust(e.x - e.facing * 18, e.y, 2);
          }
          if (e.aiTimer <= 0) {
            e.aiState = 'recover';
            e.aiTimer = 0.6;
          }
        } else {
          e.vx = lerp(e.vx, 0, Math.min(1, dt * 10));
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.aiState = 'patrol';
        }

        e.x = clamp(e.x + e.vx * dt, e.minX, e.maxX);
        if (Math.abs(p.x - e.x) < 34 && Math.abs(p.y - 28 - (e.y - 20)) < 32) {
          this.damagePlayer(10, e.x);
        }
      } else {
        const dx = p.x - e.x;
        const dy = p.y - 34 - (e.y - 20);
        e.facing = dx >= 0 ? 1 : -1;
        e.y = e.baseY + Math.sin(e.animTime * 2.8) * 14;
        e.vx = lerp(e.vx, 0, Math.min(1, dt * 6));
        e.x += e.vx * dt;

        if (e.aiState === 'hover') {
          if (Math.abs(dx) < 420) {
            e.aiTimer -= dt;
            if (e.aiTimer <= 0) {
              e.aiState = 'charge';
              e.aiTimer = 0.52;
            }
          }
        } else if (e.aiState === 'charge') {
          e.aiTimer -= dt;
          e.vfxTick -= dt;
          if (e.vfxTick <= 0) {
            e.vfxTick = 0.09;
            const ang = Math.random() * Math.PI * 2;
            s.vfx.wisps.push({
              x: e.x + Math.cos(ang) * 24,
              y: e.y - 16 + Math.sin(ang) * 24,
              vx: -Math.cos(ang) * 60,
              vy: -Math.sin(ang) * 60,
              r: 1.8,
              phase: 0,
              swirlAmp: 6,
              color: '#fde047',
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.aiTimer <= 0) {
            const len = Math.max(1, Math.hypot(dx, dy));
            s.projectiles.push({
              x: e.x + e.facing * 12,
              y: e.y - 16,
              vx: (dx / len) * 235,
              vy: (dy / len) * 235,
              r: 7,
              dmg: 5,
              life: 3.4,
              owner: e,
              deflected: false,
              trail: [{ x: e.x + e.facing * 12, y: e.y - 16 }],
            });
            e.aiState = 'cooldown';
            e.aiTimer = 1.75;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.aiState = 'hover';
            e.aiTimer = 0.75;
          }
        }
      }
    }
  }

  private updateBoss(dt: number): void {
    const s = this.state;
    const b = s.boss;
    if (!b) return;

    if (b.dead && b.deathBurstsLeft > 0) {
      b.deathBurstTimer -= dt;
      if (b.deathBurstTimer <= 0) {
        b.deathBurstTimer = 0.14;
        b.deathBurstsLeft -= 1;
        const ox = (Math.random() - 0.5) * 76;
        const oy = -24 - Math.random() * 96;
        spawnMonsterDeathVfx(s.vfx, b.x + ox, b.y + oy, 'boss');
        this.addScreenShake(7, 0.16);
      }
      return;
    }

    if (!b.active || b.dead) return;
    const p = s.player;
    b.animTime += dt;
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
    if (b.hitTintTimer > 0) b.hitTintTimer = Math.max(0, b.hitTintTimer - dt);
    if (b.hitJitter > 0) b.hitJitter = Math.max(0, b.hitJitter - dt);
    if (b.crackGlow > 0) b.crackGlow = Math.max(0, b.crackGlow - dt * 1.15);
    if (b.squashTimer > 0) b.squashTimer = Math.max(0, b.squashTimer - dt);
    if (b.hpShake > 0) b.hpShake = Math.max(0, b.hpShake - dt);
    if (b.whiteHp > b.hp) {
      if (b.whiteHold > 0) b.whiteHold = Math.max(0, b.whiteHold - dt);
      else b.whiteHp = Math.max(b.hp, b.whiteHp - Math.max(40, (b.whiteHp - b.hp) * 6) * dt);
    }

    const speedMul = b.phase === 2 ? 1.16 : 1.0;

    // Phase 2 smoldering aura sparks around the Colossus
    if (b.phase === 2) {
      b.auraTimer -= dt;
      if (b.auraTimer <= 0) {
        b.auraTimer = 0.16;
        s.vfx.wisps.push({
          x: b.x + (Math.random() - 0.5) * 72,
          y: b.y - 25 - Math.random() * 88,
          vx: (Math.random() - 0.5) * 24,
          vy: -42 - Math.random() * 48,
          r: 2.2 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
          swirlAmp: 16,
          color: '#fde047',
          life: 0.65,
          maxLife: 0.65,
        });
      }

      b.summonTimer -= dt;
      if (b.summonTimer <= 0) {
        b.summonTimer = 15;
        const liveSummons = s.enemies.filter((e) => e.isSummon && !e.dead).length;
        if (liveSummons < 2) {
          const sx = clamp(
            b.x + (Math.random() < 0.5 ? -160 : 160),
            BOSS_ARENA_LEFT + 90,
            BOSS_ARENA_RIGHT - 90
          );
          s.enemies.push(createWisp(sx, 210, true));
          AudioSys.playBossBell();
          s.vfx.rings.push({
            x: sx,
            y: 210,
            r0: 8,
            r1: 68,
            w0: 3.4,
            color: '#67e8f9',
            style: 'chime_arcs',
            rot: 0,
            vrot: 2.5,
            squashY: 1,
            life: 0.34,
            maxLife: 0.34,
          });
        }
      }
    }

    // Slower, monumental Slow-Fast-Slow Boss attack choreography
    const dx = p.x - b.x;
    if (b.aiState === 'march') {
      b.facing = dx >= 0 ? 1 : -1;
      b.vx = b.facing * 62 * speedMul;
      b.x = clamp(b.x + b.vx * dt, BOSS_ARENA_LEFT + 75, BOSS_ARENA_RIGHT - 75);
      b.stepSoundTimer -= dt;
      if (b.stepSoundTimer <= 0) {
        b.stepSoundTimer = 0.78 / speedMul;
        this.addScreenShake(2.6, 0.1);
        this.spawnDust(b.x, FLOOR_Y, 6);
      }
      b.aiTimer -= dt * speedMul;
      if (b.aiTimer <= 0) {
        b.attackHitDone = false;
        if (Math.abs(dx) < 138 && Math.random() < 0.55) {
          b.aiState = 'sweep_windup';
          b.aiStateDur = 0.78 / speedMul;
          b.aiTimer = b.aiStateDur;
        } else {
          b.aiState = 'slam_windup';
          b.aiStateDur = 1.05 / speedMul;
          b.aiTimer = b.aiStateDur;
        }
      }
    } else if (b.aiState === 'sweep_windup') {
      const prevProg = 1 - b.aiTimer / Math.max(0.01, b.aiStateDur);
      b.aiTimer -= dt;
      const curProg = 1 - b.aiTimer / Math.max(0.01, b.aiStateDur);
      // Telegraph amber warning ring near peak of slow windup
      if (prevProg < 0.65 && curProg >= 0.65) {
        s.vfx.rings.push({
          x: b.x + b.facing * 24,
          y: b.y - 68,
          r0: 36,
          r1: 8,
          w0: 3.4,
          color: '#fde047',
          style: 'chime_arcs',
          rot: 0,
          vrot: 4,
          squashY: 1,
          life: 0.24,
          maxLife: 0.24,
        });
      }
      if (b.aiTimer <= 0) {
        // Sudden fast strike!
        b.aiState = 'sweep_strike';
        b.aiStateDur = 0.15;
        b.aiTimer = b.aiStateDur;
        AudioSys.playSlash(3);
        this.addScreenShake(6, 0.16);
        this.triggerTimeRamp(0.55, 0.14);
        s.vfx.slashes.push({
          x: b.x + b.facing * 64,
          y: b.y - 56,
          facing: b.facing,
          step: 3,
          radius: 102,
          life: 0.34,
          maxLife: 0.34,
          isBoss: true,
        });
      }
    } else if (b.aiState === 'sweep_strike') {
      if (!b.attackHitDone) {
        const sb = { x: b.facing > 0 ? b.x : b.x - 140, y: b.y - 102, w: 140, h: 102 };
        const pb = { x: p.x - p.w * 0.5, y: p.y - p.h, w: p.w, h: p.h };
        if (rectsOverlap(sb, pb)) {
          this.damagePlayer(15, b.x);
          b.attackHitDone = true;
        }
      }
      b.aiTimer -= dt;
      if (b.aiTimer <= 0) {
        b.aiState = 'recover';
        b.aiStateDur = 0.96 / speedMul;
        b.aiTimer = b.aiStateDur;
      }
    } else if (b.aiState === 'slam_windup') {
      const prevProg = 1 - b.aiTimer / Math.max(0.01, b.aiStateDur);
      if (prevProg < 0.55) {
        b.facing = dx >= 0 ? 1 : -1;
      }
      b.aiTimer -= dt;
      const curProg = 1 - b.aiTimer / Math.max(0.01, b.aiStateDur);
      // Monumental top-of-swing pause telegraph flash!
      if (prevProg < 0.68 && curProg >= 0.68) {
        AudioSys.playBossBell();
        s.vfx.rings.push({
          x: b.x + b.facing * 10,
          y: b.y - 130,
          r0: 10,
          r1: 62,
          w0: 4,
          color: '#fde047',
          style: 'rune_sigil',
          rot: 0,
          vrot: 3,
          squashY: 1,
          life: 0.32,
          maxLife: 0.32,
        });
      }
      if (b.aiTimer <= 0) {
        // Lightning-fast slam impact!
        b.aiState = 'slam_strike';
        b.aiStateDur = 0.16;
        b.aiTimer = b.aiStateDur;
        AudioSys.playBossSlam();
        this.addScreenShake(10.5, 0.32);
        this.triggerTimeRamp(0.32, 0.22);
        const slamX = clamp(b.x + b.facing * 56, BOSS_ARENA_LEFT + 40, BOSS_ARENA_RIGHT - 40);
        this.spawnDust(slamX, FLOOR_Y, 20, 'rgba(220, 232, 236, 0.68)');
        spawnPropBreakShards(s.vfx, slamX, FLOOR_Y - 6, 10, 'stone');
        s.bossArena.cracks.push({ x: slamX, w: 78, alpha: 1 });
        if (s.bossArena.cracks.length > 8) s.bossArena.cracks.shift();

        s.vfx.rings.push({
          x: slamX,
          y: FLOOR_Y - 6,
          r0: 12,
          r1: 94,
          w0: 5,
          color: b.phase === 2 ? '#fde047' : '#67e8f9',
          style: 'rune_sigil',
          rot: 0,
          vrot: 2.2,
          squashY: 0.32,
          life: 0.34,
          maxLife: 0.34,
        });

        const dirs: (1 | -1)[] = b.phase === 2 ? [-1, 1] : [b.facing];
        for (const d of dirs) {
          s.shockwaves.push({
            x: b.x + d * 48,
            y: FLOOR_Y,
            dir: d,
            speed: b.phase === 2 ? 395 : 335,
            w: 42,
            h: 40,
            life: 2.4,
            dustTimer: 0,
          });
        }
      }
    } else if (b.aiState === 'slam_strike') {
      if (!b.attackHitDone) {
        const sb = { x: b.facing > 0 ? b.x - 10 : b.x - 130, y: b.y - 118, w: 140, h: 118 };
        const pb = { x: p.x - p.w * 0.5, y: p.y - p.h, w: p.w, h: p.h };
        if (rectsOverlap(sb, pb)) {
          this.damagePlayer(25, b.x);
          b.attackHitDone = true;
        }
      }
      b.aiTimer -= dt;
      if (b.aiTimer <= 0) {
        b.aiState = 'recover';
        b.aiStateDur = 1.18 / speedMul;
        b.aiTimer = b.aiStateDur;
      }
    } else {
      b.aiTimer -= dt;
      if (b.aiTimer <= 0) {
        b.aiState = 'march';
        b.aiStateDur = 1.45 / speedMul;
        b.aiTimer = b.aiStateDur;
      }
    }

    if (Math.abs(p.x - b.x) < 46 && p.y > b.y - b.h + 15) {
      this.damagePlayer(15, b.x);
    }
  }

  private updateProjectilesAndWaves(dt: number): void {
    const s = this.state;
    const p = s.player;
    const pBox = { x: p.x - p.w * 0.5, y: p.y - p.h, w: p.w, h: p.h };

    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const pr = s.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.trail.push({ x: pr.x, y: pr.y });
      if (pr.trail.length > (pr.deflected ? 10 : 6)) pr.trail.shift();

      if (pr.life <= 0) {
        s.projectiles.splice(i, 1);
        continue;
      }

      if (pr.deflected) {
        const pb = { x: pr.x - pr.r - 4, y: pr.y - pr.r - 4, w: (pr.r + 4) * 2, h: (pr.r + 4) * 2 };
        const parryCfg = { damage: pr.dmg, isHeavy: true, knockback: 260 };
        const dir: 1 | -1 = Math.sign(pr.vx) >= 0 ? 1 : -1;
        let hitTarget = false;
        for (const e of s.enemies) {
          if (e.dead) continue;
          const eb = { x: e.x - e.w * 0.55, y: e.y - e.h - 4, w: e.w * 1.1, h: e.h + 8 };
          if (rectsOverlap(pb, eb)) {
            this.hitEnemy(e, parryCfg, dir, 3, true);
            s.time.hitStop = Math.max(s.time.hitStop, 0.068);
            this.addScreenShake(6.8, 0.17);
            hitTarget = true;
            break;
          }
        }
        if (!hitTarget && s.boss && s.boss.active && !s.boss.dead) {
          const b = s.boss;
          const bb = { x: b.x - b.w * 0.5, y: b.y - b.h, w: b.w, h: b.h };
          if (rectsOverlap(pb, bb)) {
            this.hitBoss(b, parryCfg, dir, 3, true);
            s.time.hitStop = Math.max(s.time.hitStop, 0.078);
            this.addScreenShake(7.8, 0.19);
            hitTarget = true;
          }
        }
        if (hitTarget) s.projectiles.splice(i, 1);
        continue;
      }

      const pb = { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
      let blocked = false;
      for (const c of s.crates) {
        if (c.broken) continue;
        const cb = { x: c.x - c.w * 0.5, y: c.y - c.h, w: c.w, h: c.h };
        if (rectsOverlap(pb, cb)) {
          spawnPropHitVfx(s.vfx, pr.x, pr.y, pr.vx >= 0 ? -1 : 1, 'stone');
          blocked = true;
          break;
        }
      }
      if (blocked) {
        s.projectiles.splice(i, 1);
        continue;
      }

      if (rectsOverlap(pb, pBox)) {
        this.damagePlayer(pr.dmg, pr.x);
        s.projectiles.splice(i, 1);
      }
    }

    for (let i = s.shockwaves.length - 1; i >= 0; i--) {
      const sw = s.shockwaves[i];
      sw.life -= dt;
      sw.x += sw.dir * sw.speed * dt;
      sw.dustTimer -= dt;
      if (sw.dustTimer <= 0) {
        sw.dustTimer = 0.045;
        s.vfx.wisps.push({
          x: sw.x - sw.dir * 8,
          y: sw.y - 6 - Math.random() * 14,
          vx: -sw.dir * 40,
          vy: -38 - Math.random() * 44,
          r: 2 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          swirlAmp: 10,
          color: this.state.boss?.phase === 2 ? '#fde047' : '#67e8f9',
          life: 0.28,
          maxLife: 0.28,
        });
      }
      if (sw.life <= 0 || sw.x < BOSS_ARENA_LEFT || sw.x > BOSS_ARENA_RIGHT) {
        s.shockwaves.splice(i, 1);
        continue;
      }
      const sb = { x: sw.x - sw.w * 0.5, y: sw.y - sw.h, w: sw.w, h: sw.h };
      if (rectsOverlap(sb, pBox)) {
        this.damagePlayer(25, sw.x);
      }
    }
  }

  private updateOrbs(rawDt: number): void {
    const s = this.state;
    if (s.goldPulse > 0) s.goldPulse = Math.max(0, s.goldPulse - rawDt);
    if (s.coinComboTimer > 0) {
      s.coinComboTimer -= rawDt;
      if (s.coinComboTimer <= 0) s.coinCombo = 0;
    }
    const targetX = 36;
    const targetY = 58;

    for (let i = s.orbs.length - 1; i >= 0; i--) {
      const o = s.orbs[i];
      o.timer += rawDt;
      if (o.phase === 'scatter') {
        o.vy += 680 * rawDt;
        o.wx += o.vx * rawDt;
        o.wy += o.vy * rawDt;
        if (o.wy >= o.floorY - 4) {
          o.wy = o.floorY - 4;
          o.vy = -Math.abs(o.vy) * 0.42;
          o.vx *= 0.65;
        }
        if (o.timer >= o.scatterDur) {
          o.phase = 'pause';
          o.timer = 0;
        }
      } else if (o.phase === 'pause') {
        if (o.timer >= o.pauseDur) {
          o.phase = 'fly';
          o.timer = 0;
          o.sx = o.wx - s.camera.x;
          o.sy = o.wy;
          o.scrX = o.sx;
          o.scrY = o.sy;
          o.cx = (o.sx + targetX) * 0.5 + (Math.random() - 0.5) * 140;
          o.cy = Math.min(o.sy, targetY) - 85 - Math.random() * 65;
          o.trail = [{ x: o.scrX, y: o.scrY }];
        }
      } else {
        const t = clamp(o.timer / o.flyDur, 0, 1);
        const e = Easing.easeInQuad(t);
        const omt = 1 - e;
        o.scrX = omt * omt * o.sx + 2 * omt * e * o.cx + e * e * targetX;
        o.scrY = omt * omt * o.sy + 2 * omt * e * o.cy + e * e * targetY;
        o.trail.push({ x: o.scrX, y: o.scrY });
        if (o.trail.length > 8) o.trail.shift();

        if (t >= 1) {
          s.gold += 1;
          s.goldPulse = 0.16;
          s.coinComboTimer = 0.55;
          AudioSys.playCoin(s.coinCombo++);
          s.orbs.splice(i, 1);
        }
      }
    }
  }

  private updateCamera(rawDt: number): void {
    const s = this.state;
    const cam = s.camera;
    const p = s.player;
    const targetX = cam.bossLocked
      ? BOSS_ARENA_LEFT - 12
      : clamp(p.x - VIEW_W * 0.38 + p.facing * 55, 0, WORLD_W - VIEW_W);
    cam.x = lerp(cam.x, targetX, Math.min(1, rawDt * 7.5));

    if (cam.shakeTime > 0) {
      cam.shakeTime = Math.max(0, cam.shakeTime - rawDt);
      const mag = cam.shakeAmp * (cam.shakeTime / Math.max(0.001, cam.shakeDur));
      const a = Math.random() * Math.PI * 2;
      cam.shakeX = Math.cos(a) * mag;
      cam.shakeY = Math.sin(a) * mag;
    } else {
      cam.shakeX = 0;
      cam.shakeY = 0;
      cam.shakeAmp = 0;
    }
  }

  private updateGame(rawDt: number): void {
    const s = this.state;
    s.elapsed += rawDt;
    if (s.pitFade > 0) s.pitFade = Math.max(0, s.pitFade - rawDt);

    for (const sp of s.bgSpores) {
      sp.y -= sp.vy * rawDt;
      if (sp.y < -10) {
        sp.y = VIEW_H - 40;
        sp.x = Math.random() * VIEW_W;
      }
    }

    if (s.time.hitStop > 0) {
      s.time.hitStop = Math.max(0, s.time.hitStop - rawDt);
      updateAllHitVfx(s.vfx, rawDt, true, s.player);
      this.updateCamera(rawDt);
      this.updateOrbs(rawDt);
      return;
    }

    if (s.time.slowTimer > 0) {
      s.time.slowTimer = Math.max(0, s.time.slowTimer - rawDt);
      const prog = 1 - s.time.slowTimer / Math.max(0.001, s.time.slowDur);
      s.time.scale = lerp(s.time.slowMin, 1.0, Easing.easeInCubic(prog));
    } else {
      s.time.scale = 1.0;
    }

    const dt = rawDt * s.time.scale;
    if (s.mode === 'playing') {
      s.runTime += rawDt;
      if (s.bossGateClosed && s.bossGateDrop < 1) {
        s.bossGateDrop = Math.min(1, s.bossGateDrop + dt / 0.16);
        if (s.bossGateDrop >= 1 && !s.bossGateSlammed) {
          s.bossGateSlammed = true;
          this.addScreenShake(9, 0.28);
          AudioSys.playBossSlam();
          this.spawnDust(BOSS_ARENA_LEFT - 4, FLOOR_Y, 14);
        }
      }
      this.updatePlayer(dt);
      this.updateBossArena(dt);
      this.updateFragilesAndShrines(dt);
      this.updateCratesAndFruits(dt);
      this.updateEnemies(dt);
      this.updateBoss(dt);
      this.updateProjectilesAndWaves(dt);
    }

    updateAllHitVfx(s.vfx, dt, false, s.player);
    this.updateOrbs(rawDt);
    this.updateCamera(rawDt);
  }

  /* ============================================================
     Rendering System (Enriched Hand-Crafted Ruin Visuals + Dynamic Boss Arena)
     ============================================================ */
  private drawBackground(): void {
    const ctx = this.ctx;
    const s = this.state;
    const pBlend = s.bossArena.phaseBlend;
    const bgAsset = AssetManager.get('bg_forest');

    if (bgAsset && bgAsset.canvas && bgAsset.w && bgAsset.h) {
      const scaleH = VIEW_H / Math.max(1, bgAsset.h);
      const drawW = Math.max(VIEW_W, bgAsset.w * scaleH);
      const scrollX = (s.camera.x * 0.28) % (drawW * 2);
      ctx.save();
      for (let i = -1; i <= 2; i++) {
        const x = i * drawW - scrollX;
        if (x > VIEW_W + 40 || x + drawW < -40) continue;
        ctx.save();
        if (Math.abs(i) % 2 === 1) {
          ctx.translate(x + drawW, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(bgAsset.canvas, 0, 0, drawW + 1, VIEW_H);
        } else {
          ctx.drawImage(bgAsset.canvas, x, 0, drawW + 1, VIEW_H);
        }
        ctx.restore();
      }
      ctx.fillStyle = `rgba(5, 11, 16, ${lerp(0.18, 0.3, pBlend)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    } else {
      // Dark fairy-tale parallax sky (shifts smoothly into gilded amber twilight in Boss Phase 2)
      const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      sky.addColorStop(0, pBlend > 0.05 ? `rgb(${Math.round(lerp(7, 26, pBlend))}, ${Math.round(lerp(17, 18, pBlend))}, ${Math.round(lerp(24, 16, pBlend))})` : '#071118');
      sky.addColorStop(0.55, pBlend > 0.05 ? `rgb(${Math.round(lerp(15, 44, pBlend))}, ${Math.round(lerp(34, 30, pBlend))}, ${Math.round(lerp(44, 24, pBlend))})` : '#0f222c');
      sky.addColorStop(1, '#08131a');
      ctx.fillStyle = sky;
      ctx.fillRect(-30, -30, VIEW_W + 60, VIEW_H + 60);

      // Volumetric canopy god-rays
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const bx =
          (((i * 340 - s.camera.x * 0.14) % (VIEW_W + 360)) + (VIEW_W + 360)) % (VIEW_W + 360) - 120;
        const g = ctx.createLinearGradient(bx, 0, bx + 90, VIEW_H);
        g.addColorStop(
          0,
          pBlend > 0.1
            ? `rgba(${Math.round(lerp(120, 253, pBlend))}, ${Math.round(lerp(220, 210, pBlend))}, ${Math.round(lerp(225, 110, pBlend))}, ${lerp(0.085, 0.15, pBlend)})`
            : 'rgba(120, 220, 225, 0.085)'
        );
        g.addColorStop(1, 'rgba(120, 220, 225, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx + 75, 0);
        ctx.lineTo(bx + 185, VIEW_H);
        ctx.lineTo(bx + 55, VIEW_H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Far ancient trees & hanging bronze bells
      const farShift = s.camera.x * 0.22;
      ctx.fillStyle = '#09151d';
      for (let i = 0; i < 16; i++) {
        const tx =
          (((i * 155 - farShift) % (VIEW_W + 280)) + (VIEW_W + 280)) % (VIEW_W + 280) - 100;
        const tw = 26 + (i % 3) * 14;
        ctx.fillRect(tx, 0, tw, VIEW_H);
        if (i % 4 === 2) {
          const bellSway = Math.sin(s.elapsed * (1.2 + pBlend * 1.4) + i) * (4 + pBlend * 9);
          ctx.strokeStyle = pBlend > 0.2 ? '#4d3f26' : '#182c36';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx + tw + 44, 0);
          ctx.lineTo(tx + tw + 44 + bellSway, 115 + pBlend * 18);
          ctx.stroke();
          ctx.fillStyle = '#10212b';
          ctx.beginPath();
          ctx.arc(tx + tw + 44 + bellSway, 145 + pBlend * 18, 28, Math.PI, 0);
          ctx.lineTo(tx + tw + 78 + bellSway, 185 + pBlend * 18);
          ctx.lineTo(tx + tw + 10 + bellSway, 185 + pBlend * 18);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#09151d';
        }
      }

      // Mid-ground ruined stone arches & hanging forest vines (fills bare backdrop)
      const midShift = s.camera.x * 0.42;
      ctx.save();
      for (let i = 0; i < 10; i++) {
        const ax =
          (((i * 290 - midShift) % (VIEW_W + 380)) + (VIEW_W + 380)) % (VIEW_W + 380) - 140;
        // Weathered broken stone pillar
        ctx.fillStyle = 'rgba(13, 27, 35, 0.72)';
        ctx.fillRect(ax, 195 + (i % 2) * 35, 22, VIEW_H - 195);
        ctx.fillRect(ax - 5, 190 + (i % 2) * 35, 32, 9);
        // Hanging moss vines from canopy
        ctx.strokeStyle = 'rgba(42, 74, 62, 0.52)';
        ctx.lineWidth = 1.6;
        const vineSway = Math.sin(s.elapsed * 1.1 + i * 1.7) * 5;
        ctx.beginPath();
        ctx.moveTo(ax + 80, 0);
        ctx.quadraticCurveTo(ax + 80 + vineSway, 75, ax + 76 + vineSway * 1.4, 140 + (i % 3) * 30);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Phase-2 Boss Sanctuary golden twilight wash overlay (works even with custom bg_forest!)
    if (pBlend > 0.02) {
      ctx.save();
      const wash = ctx.createRadialGradient(
        VIEW_W * 0.5,
        VIEW_H * 0.25,
        30,
        VIEW_W * 0.5,
        VIEW_H * 0.5,
        VIEW_W * 0.7
      );
      wash.addColorStop(0, `rgba(251, 191, 36, ${0.14 * pBlend})`);
      wash.addColorStop(0.55, `rgba(180, 83, 9, ${0.1 * pBlend})`);
      wash.addColorStop(1, `rgba(12, 10, 14, ${0.24 * pBlend})`);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }

    // Subtle drifting mist near the forest floor
    const mist = ctx.createLinearGradient(0, FLOOR_Y - 70, 0, FLOOR_Y + 20);
    mist.addColorStop(0, 'rgba(120, 210, 215, 0)');
    mist.addColorStop(
      1,
      pBlend > 0.1
        ? `rgba(${Math.round(lerp(80, 220, pBlend))}, ${Math.round(lerp(150, 155, pBlend))}, ${Math.round(lerp(160, 75, pBlend))}, 0.14)`
        : 'rgba(80, 150, 160, 0.11)'
    );
    ctx.fillStyle = mist;
    ctx.fillRect(0, FLOOR_Y - 70, VIEW_W, 90);

    // Floating glowing forest spores / Phase-2 embers
    for (const sp of s.bgSpores) {
      const sx = sp.x + Math.sin(s.elapsed * 1.4 + sp.phase) * 12;
      ctx.fillStyle =
        pBlend > 0.35
          ? `rgba(253, 224, 71, ${sp.alpha * 1.1})`
          : `rgba(186, 250, 245, ${sp.alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBossArenaDecor(): void {
    const ctx = this.ctx;
    const s = this.state;
    const arena = s.bossArena;
    const pBlend = arena.phaseBlend;
    const pillarAsset = AssetManager.get('decor_boss_pillar');
    const bellAsset = AssetManager.get('decor_boss_bell');

    // Scattered mossy ruined stone pillars along the forest ruin path for architectural cohesion
    if (pillarAsset && pillarAsset.canvas && pillarAsset.w && pillarAsset.h) {
      const pathPillars = [
        { x: 640, h: 255, alpha: 0.72, flip: 1 },
        { x: 1620, h: 235, alpha: 0.68, flip: -1 },
        { x: 3060, h: 265, alpha: 0.7, flip: 1 },
        { x: 4220, h: 245, alpha: 0.68, flip: -1 },
        { x: 5560, h: 275, alpha: 0.78, flip: 1 },
        { x: 5890, h: 275, alpha: 0.78, flip: -1 },
      ];
      for (const pp of pathPillars) {
        if (pp.x < s.camera.x - 200 || pp.x > s.camera.x + VIEW_W + 200) continue;
        const dw = (pillarAsset.w / Math.max(1, pillarAsset.h)) * pp.h;
        ctx.save();
        ctx.globalAlpha = pp.alpha;
        ctx.translate(pp.x, FLOOR_Y + 8);
        ctx.scale(pp.flip, 1);
        ctx.drawImage(pillarAsset.canvas, -dw * 0.5, -pp.h, dw, pp.h);
        ctx.restore();
      }
    }

    if (s.camera.x + VIEW_W < BOSS_ARENA_LEFT - 120) return;

    ctx.save();
    // Grand cathedral bell-sanctuary pillars & suspended ritual bells inside Boss room
    const bellPositions = [6240, 6500, 6760];
    bellPositions.forEach((bx, idx) => {
      const sway = Math.sin(s.elapsed * (1.3 + pBlend * 1.9) + idx * 1.6) * (3 + pBlend * 11);
      const dropY = pBlend * 22;

      // Stone sanctuary column behind arena (hand-drawn vine pillar sprite when loaded)
      if (pillarAsset && pillarAsset.canvas && pillarAsset.w && pillarAsset.h) {
        const ph = 330;
        const pw = (pillarAsset.w / Math.max(1, pillarAsset.h)) * ph;
        ctx.save();
        ctx.globalAlpha = lerp(0.82, 0.94, pBlend);
        ctx.translate(bx, FLOOR_Y + 10);
        ctx.scale(idx % 2 === 0 ? 1 : -1, 1);
        ctx.drawImage(pillarAsset.canvas, -pw * 0.5, -ph, pw, ph);
        if (pBlend > 0.15 && pillarAsset.gold) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = pBlend * 0.18;
          ctx.drawImage(pillarAsset.gold, -pw * 0.5, -ph, pw, ph);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = pBlend > 0.2 ? 'rgba(34, 28, 24, 0.58)' : 'rgba(15, 29, 36, 0.52)';
        ctx.fillRect(bx - 16, 40, 32, FLOOR_Y - 40);
        ctx.strokeStyle = pBlend > 0.2 ? `rgba(253, 224, 71, ${0.26 * pBlend})` : 'rgba(103, 232, 249, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 16, 40, 32, FLOOR_Y - 40);
      }

      // Upper suspension chain anchored to ceiling
      ctx.strokeStyle = pBlend > 0.2 ? '#785a28' : '#263b45';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + sway, 44 + dropY);
      ctx.stroke();

      ctx.save();
      ctx.translate(bx + sway, 42 + dropY);
      ctx.rotate(sway * 0.014);

      if (bellAsset && bellAsset.canvas && bellAsset.w && bellAsset.h) {
        const bh = idx === 1 ? 114 : 98;
        const bw = (bellAsset.w / Math.max(1, bellAsset.h)) * bh;
        ctx.drawImage(bellAsset.canvas, -bw * 0.5, -8, bw, bh);
        if (pBlend > 0.1) {
          const glow = ctx.createRadialGradient(0, bh * 0.78, 3, 0, bh * 0.78, 48);
          glow.addColorStop(0, `rgba(253, 224, 71, ${0.48 * pBlend})`);
          glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, bh * 0.78, 48, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = pBlend > 0.2 ? '#3f311b' : '#162730';
        ctx.beginPath();
        ctx.arc(0, 24, 24, Math.PI, 0);
        ctx.lineTo(30, 56);
        ctx.lineTo(-30, 56);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pBlend > 0.2 ? `rgba(253, 224, 71, ${0.55 * pBlend})` : 'rgba(103, 232, 249, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    });

    // Cracked floor rune fissures from Boss slams & Phase 2 rift
    for (const cr of arena.cracks) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = pBlend > 0.2 ? 'rgba(253, 224, 71, 0.65)' : 'rgba(103, 232, 249, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cr.x - cr.w * 0.5, FLOOR_Y + 2);
      ctx.lineTo(cr.x - cr.w * 0.15, FLOOR_Y + 9);
      ctx.lineTo(cr.x + cr.w * 0.18, FLOOR_Y + 4);
      ctx.lineTo(cr.x + cr.w * 0.5, FLOOR_Y + 11);
      ctx.stroke();
      ctx.restore();
    }

    // Phase-2 Floor Rune Bell-Fire Geysers
    for (const g of arena.geysers) {
      if (g.state === 'warn') {
        const prog = 1 - g.timer / g.maxTimer;
        const pulse = 0.55 + 0.45 * Math.sin(s.elapsed * 26);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Warning floor sigil
        const wg = ctx.createRadialGradient(g.x, FLOOR_Y, 4, g.x, FLOOR_Y, g.w * 0.7);
        wg.addColorStop(0, `rgba(253, 224, 71, ${0.55 * pulse})`);
        wg.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.ellipse(g.x, FLOOR_Y, g.w * 0.7, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Thin rising telegraph column
        ctx.strokeStyle = `rgba(253, 224, 71, ${0.35 + prog * 0.5})`;
        ctx.lineWidth = 1.5 + prog * 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(g.x - g.w * 0.35, FLOOR_Y);
        ctx.lineTo(g.x - g.w * 0.35, FLOOR_Y - 210 * prog);
        ctx.moveTo(g.x + g.w * 0.35, FLOOR_Y);
        ctx.lineTo(g.x + g.w * 0.35, FLOOR_Y - 210 * prog);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (g.state === 'erupt') {
        const ratio = clamp(g.timer / g.maxTimer, 0, 1);
        const colW = g.w * (0.72 + 0.28 * Math.sin(s.elapsed * 42));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pg = ctx.createLinearGradient(g.x - colW * 0.5, FLOOR_Y, g.x + colW * 0.5, FLOOR_Y);
        pg.addColorStop(0, 'rgba(245, 158, 11, 0)');
        pg.addColorStop(0.25, `rgba(253, 224, 71, ${0.75 * ratio})`);
        pg.addColorStop(0.5, `rgba(255, 255, 255, ${0.95 * ratio})`);
        pg.addColorStop(0.75, `rgba(103, 232, 249, ${0.7 * ratio})`);
        pg.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = pg;
        ctx.fillRect(g.x - colW * 0.5, FLOOR_Y - 215, colW, 215);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawTerrainAndGates(): void {
    const ctx = this.ctx;
    const s = this.state;
    const viewL = s.camera.x - 100;
    const viewR = s.camera.x + VIEW_W + 100;

    const groundTile = AssetManager.get('tile_ground');
    const solidTile = AssetManager.get('tile_solid');
    const suspendTile = AssetManager.get('tile_suspend');
    const onewayTile = AssetManager.get('tile_oneway');
    const bossAltarTile = AssetManager.get('tile_boss_altar');
    const fragileTile = AssetManager.get('tile_fragile');
    const shrineTile = AssetManager.get('tile_shrine');

    for (const pl of s.platforms) {
      if (pl.active === false) continue;
      if (pl.x + pl.w < viewL || pl.x > viewR) continue;

      if (pl.type === 'oneway') {
        const isDynamicLit =
          (pl.bossDynamic === 'side_float' && s.bossArena.phaseBlend > 0.1) ||
          pl.bossDynamic === 'center_sanctuary';

        if (isDynamicLit) {
          // Glowing levitation rune aura beneath shifting Boss arena platforms
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const ag = ctx.createRadialGradient(
            pl.x + pl.w * 0.5,
            pl.y + pl.h,
            6,
            pl.x + pl.w * 0.5,
            pl.y + pl.h,
            pl.w * 0.65
          );
          ag.addColorStop(0, 'rgba(253, 224, 71, 0.38)');
          ag.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = ag;
          ctx.beginPath();
          ctx.ellipse(pl.x + pl.w * 0.5, pl.y + pl.h + 4, pl.w * 0.6, 16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        const chosenTile =
          pl.bossDynamic === 'center_sanctuary' && bossAltarTile?.canvas ? bossAltarTile : onewayTile;

        if (chosenTile && chosenTile.canvas && chosenTile.w && chosenTile.h) {
          const drawW = pl.w + 16;
          const aspectH = (chosenTile.h / Math.max(1, chosenTile.w)) * drawW;
          const drawH = clamp(aspectH, 34, pl.bossDynamic === 'center_sanctuary' ? 76 : 64);
          ctx.drawImage(chosenTile.canvas, pl.x - 8, pl.y - 4, drawW, drawH);
        } else {
          ctx.fillStyle = isDynamicLit ? '#2c363a' : '#1d2d37';
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.strokeStyle = isDynamicLit ? '#fde047' : '#64838d';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = isDynamicLit ? '#fef08a' : '#99d5de';
          ctx.fillRect(pl.x + 2, pl.y, pl.w - 4, 2.5);
          ctx.strokeStyle = isDynamicLit ? 'rgba(253, 224, 71, 0.5)' : 'rgba(130, 170, 180, 0.45)';
          ctx.lineWidth = 1.2;
          for (let gx = pl.x + 16; gx < pl.x + pl.w - 10; gx += 22) {
            ctx.beginPath();
            ctx.moveTo(gx, pl.y + 2);
            ctx.lineTo(gx, pl.y + pl.h);
            ctx.stroke();
          }
        }
      } else {
        if (pl.suspended && suspendTile && suspendTile.canvas && suspendTile.w && suspendTile.h) {
          const drawW = pl.w + 18;
          const aspectH = (suspendTile.h / Math.max(1, suspendTile.w)) * drawW;
          ctx.drawImage(suspendTile.canvas, pl.x - 9, pl.y - 6, drawW, clamp(aspectH, 48, 108));
        } else if (pl.ground && groundTile && groundTile.canvas && groundTile.w && groundTile.h) {
          const grad = ctx.createLinearGradient(0, pl.y, 0, pl.y + Math.min(pl.h, 150));
          grad.addColorStop(0, '#121d22');
          grad.addColorStop(1, '#060a0e');
          ctx.fillStyle = grad;
          ctx.fillRect(pl.x, pl.y + 10, pl.w, Math.max(0, pl.h - 10));

          const tileH = Math.max(pl.h + 14, 146);
          const segW = Math.max(180, Math.round((groundTile.w / Math.max(1, groundTile.h)) * tileH));
          ctx.save();
          ctx.beginPath();
          ctx.rect(pl.x - 2, pl.y - 18, pl.w + 4, pl.h + 32);
          ctx.clip();
          for (let tx = pl.x; tx < pl.x + pl.w; tx += segW - 6) {
            ctx.drawImage(groundTile.canvas, tx, pl.y - 12, segW, tileH);
          }
          ctx.restore();
        } else if (!pl.ground && solidTile && solidTile.canvas && solidTile.w && solidTile.h) {
          const drawW = pl.w + 14;
          const aspectH = (solidTile.h / Math.max(1, solidTile.w)) * drawW;
          ctx.drawImage(solidTile.canvas, pl.x - 7, pl.y - 6, drawW, clamp(aspectH, 38, 76));
        } else {
          const grad = ctx.createLinearGradient(0, pl.y, 0, pl.y + Math.min(pl.h, 120));
          grad.addColorStop(0, '#33494f');
          grad.addColorStop(0.28, '#203138');
          grad.addColorStop(1, '#0e171d');
          ctx.fillStyle = grad;
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = '#4c7056';
          ctx.fillRect(pl.x, pl.y, pl.w, 6);
          ctx.strokeStyle = '#101820';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
        }
      }
    }

    // Fragile regenerating platforms
    for (const fr of s.fragiles) {
      if (fr.x + fr.w < viewL || fr.x > viewR) continue;
      ctx.save();
      if (fr.state === 'broken') {
        const prog = 1 - fr.timer / 2.6;
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.28 + prog * 0.45})`;
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.6;
        ctx.strokeRect(fr.x, fr.y, fr.w, fr.h);
        ctx.fillStyle = 'rgba(103, 232, 249, 0.14)';
        ctx.fillRect(fr.x, fr.y, fr.w * prog, fr.h);
      } else {
        const jx = fr.state === 'shaking' ? (Math.random() - 0.5) * 6 : 0;
        const jy = fr.state === 'shaking' ? (Math.random() - 0.5) * 3 : 0;
        if (fragileTile && fragileTile.canvas && fragileTile.w && fragileTile.h) {
          const drawW = fr.w + 14;
          const aspectH = (fragileTile.h / Math.max(1, fragileTile.w)) * drawW;
          if (fr.state === 'shaking') {
            ctx.shadowColor = '#67e8f9';
            ctx.shadowBlur = 10;
          }
          ctx.drawImage(fragileTile.canvas, fr.x + jx - 7, fr.y + jy - 5, drawW, clamp(aspectH, 40, 74));
        } else {
          ctx.fillStyle = fr.state === 'shaking' ? '#3a545d' : '#2a3d45';
          ctx.fillRect(fr.x + jx, fr.y + jy, fr.w, fr.h);
          ctx.strokeStyle = fr.state === 'shaking' ? '#a5f3fc' : '#67e8f9';
          ctx.lineWidth = fr.state === 'shaking' ? 2.2 : 1.4;
          ctx.strokeRect(fr.x + jx, fr.y + jy, fr.w, fr.h);
        }
      }
      ctx.restore();
    }

    // Healing Shrine (ONLY ONE before Boss room, ZERO Chinese text!)
    for (const sh of s.shrines) {
      if (sh.x + sh.w < viewL || sh.x - sh.w > viewR) continue;
      ctx.save();
      const active = sh.pool > 0;

      if (active) {
        const pulse = 0.85 + 0.15 * Math.sin(s.elapsed * 3.2);
        const g = ctx.createRadialGradient(sh.x, sh.y - 24, 4, sh.x, sh.y - 24, 78 * pulse);
        g.addColorStop(0, 'rgba(165, 243, 252, 0.36)');
        g.addColorStop(0.45, 'rgba(134, 239, 172, 0.18)');
        g.addColorStop(1, 'rgba(103, 232, 249, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y - 24, 78 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Soft vertical sanctuary light pillar
        const pillar = ctx.createLinearGradient(0, sh.y - 135, 0, sh.y);
        pillar.addColorStop(0, 'rgba(165, 243, 252, 0)');
        pillar.addColorStop(1, 'rgba(165, 243, 252, 0.18)');
        ctx.fillStyle = pillar;
        ctx.fillRect(sh.x - 42, sh.y - 135, 84, 135);
      }

      if (shrineTile && shrineTile.canvas && shrineTile.w && shrineTile.h) {
        const dw = 172;
        const dh = (shrineTile.h / Math.max(1, shrineTile.w)) * dw;
        ctx.globalAlpha = active ? 1 : 0.48;
        ctx.drawImage(shrineTile.canvas, sh.x - dw * 0.5, sh.y - dh + 14, dw, dh);
      } else {
        ctx.fillStyle = '#25363d';
        ctx.fillRect(sh.x - sh.w * 0.5, sh.y - 12, sh.w, 12);
        ctx.strokeStyle = active ? '#e6c687' : '#475569';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(sh.x - sh.w * 0.5, sh.y - 12, sh.w, 12);
      }
      ctx.restore();
    }

    // Boss falling stone gate
    if (s.bossGateClosed) {
      const bossGateAsset = AssetManager.get('gate_boss');
      const gateH = FLOOR_Y - 120;
      const dropEase = Easing.easeInQuad(clamp(s.bossGateDrop, 0, 1));
      const gateTopY = lerp(120 - gateH - 40, 120, dropEase);
      ctx.save();
      if (bossGateAsset && bossGateAsset.canvas && bossGateAsset.w && bossGateAsset.h) {
        const drawH = gateH + 14;
        const drawW = clamp((bossGateAsset.w / Math.max(1, bossGateAsset.h)) * drawH, 58, 126);
        ctx.drawImage(bossGateAsset.canvas, BOSS_ARENA_LEFT - drawW * 0.5 - 8, gateTopY - 4, drawW, drawH);
      } else {
        const gxGate = BOSS_ARENA_LEFT - 16;
        const gwGate = 24;
        ctx.fillStyle = '#2b3e47';
        ctx.fillRect(gxGate, gateTopY, gwGate, gateH);
        ctx.strokeStyle = '#0b1116';
        ctx.lineWidth = 2;
        ctx.strokeRect(gxGate, gateTopY, gwGate, gateH);
      }
      ctx.restore();
    }

    // Exit Gate
    const gx = 6925;
    const exitClosedAsset = AssetManager.get('gate_exit_closed');
    const exitOpenAsset = AssetManager.get('gate_exit_open');
    ctx.save();
    if (s.victoryGateOpen && exitOpenAsset && exitOpenAsset.canvas && exitOpenAsset.w && exitOpenAsset.h) {
      const pg = ctx.createRadialGradient(gx, FLOOR_Y - 64, 10, gx, FLOOR_Y - 64, 74);
      pg.addColorStop(0, 'rgba(254, 249, 195, 0.75)');
      pg.addColorStop(0.55, 'rgba(103, 232, 249, 0.42)');
      pg.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(gx, FLOOR_Y - 64, 74, 0, Math.PI * 2);
      ctx.fill();
      const dh = 152;
      const dw = (exitOpenAsset.w / Math.max(1, exitOpenAsset.h)) * dh;
      ctx.drawImage(exitOpenAsset.canvas, gx - dw * 0.5, FLOOR_Y - dh + 4, dw, dh);
    } else if (!s.victoryGateOpen && exitClosedAsset && exitClosedAsset.canvas && exitClosedAsset.w && exitClosedAsset.h) {
      const dh = 152;
      const dw = (exitClosedAsset.w / Math.max(1, exitClosedAsset.h)) * dh;
      ctx.drawImage(exitClosedAsset.canvas, gx - dw * 0.5, FLOOR_Y - dh + 4, dw, dh);
    } else {
      // Detailed carved stone portal arch
      ctx.fillStyle = '#1b2932';
      ctx.fillRect(gx - 46, FLOOR_Y - 118, 12, 118);
      ctx.fillRect(gx + 34, FLOOR_Y - 118, 12, 118);
      ctx.fillStyle = s.victoryGateOpen ? '#15343f' : '#111922';
      ctx.beginPath();
      ctx.moveTo(gx - 34, FLOOR_Y);
      ctx.lineTo(gx - 34, FLOOR_Y - 82);
      ctx.quadraticCurveTo(gx, FLOOR_Y - 134, gx + 34, FLOOR_Y - 82);
      ctx.lineTo(gx + 34, FLOOR_Y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = s.victoryGateOpen ? '#fde047' : '#475569';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (!s.victoryGateOpen) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        for (const ox of [-16, 0, 16]) {
          ctx.beginPath();
          ctx.moveTo(gx + ox, FLOOR_Y - 94);
          ctx.lineTo(gx + ox, FLOOR_Y);
          ctx.stroke();
        }
      } else {
        const pg = ctx.createRadialGradient(gx, FLOOR_Y - 54, 6, gx, FLOOR_Y - 54, 54);
        pg.addColorStop(0, '#fef9c3');
        pg.addColorStop(0.5, 'rgba(103, 232, 249, 0.7)');
        pg.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(gx, FLOOR_Y - 54, 54, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawProps(): void {
    const ctx = this.ctx;
    const s = this.state;
    const crateAsset = AssetManager.get('prop_crate');
    const potAsset = AssetManager.get('prop_pot');
    const fruitAsset = AssetManager.get('prop_fruit');

    for (const c of s.crates) {
      if (c.broken) continue;
      ctx.save();
      if (crateAsset && crateAsset.canvas) {
        const img = c.flash > 0 && crateAsset.white ? crateAsset.white : crateAsset.canvas;
        ctx.drawImage(img, c.x - c.w * 0.5 - 2, c.y - c.h - 2, c.w + 4, c.h + 4);
      } else {
        ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#6c492d';
        ctx.fillRect(c.x - c.w * 0.5, c.y - c.h, c.w, c.h);
        ctx.strokeStyle = '#24170e';
        ctx.lineWidth = 2;
        ctx.strokeRect(c.x - c.w * 0.5, c.y - c.h, c.w, c.h);
        ctx.beginPath();
        ctx.moveTo(c.x - c.w * 0.5, c.y - c.h);
        ctx.lineTo(c.x + c.w * 0.5, c.y);
        ctx.moveTo(c.x + c.w * 0.5, c.y - c.h);
        ctx.lineTo(c.x - c.w * 0.5, c.y);
        ctx.stroke();
        if (c.flash <= 0) {
          // Oxidized bronze corner studs
          ctx.fillStyle = '#9c7c46';
          ctx.fillRect(c.x - c.w * 0.5 + 2, c.y - c.h + 2, 5, 5);
          ctx.fillRect(c.x + c.w * 0.5 - 7, c.y - c.h + 2, 5, 5);
          ctx.fillRect(c.x - c.w * 0.5 + 2, c.y - 7, 5, 5);
          ctx.fillRect(c.x + c.w * 0.5 - 7, c.y - 7, 5, 5);
        }
      }
      ctx.restore();
    }

    for (const pot of s.pots) {
      if (pot.broken) continue;
      ctx.save();
      if (potAsset && potAsset.canvas && potAsset.w && potAsset.h) {
        const img = pot.flash > 0 && potAsset.white ? potAsset.white : potAsset.canvas;
        const dh = pot.h + 10;
        const dw = (potAsset.w / Math.max(1, potAsset.h)) * dh;
        ctx.drawImage(img, pot.x - dw * 0.5, pot.y - dh + 2, dw, dh);
      } else {
        ctx.fillStyle = pot.flash > 0 ? '#ffffff' : '#4a5d66';
        ctx.beginPath();
        ctx.ellipse(pot.x, pot.y - 13, 13, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#152028';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = pot.flash > 0 ? '#ffffff' : '#687f8a';
        ctx.fillRect(pot.x - 8, pot.y - 30, 16, 5);
      }
      ctx.restore();
    }

    for (const f of s.fruits) {
      const fy = f.y + Math.sin(f.bob) * 3;
      ctx.save();
      const g = ctx.createRadialGradient(f.x, fy, 1, f.x, fy, 22);
      g.addColorStop(0, '#ecfeff');
      g.addColorStop(0.5, 'rgba(103, 232, 249, 0.65)');
      g.addColorStop(1, 'rgba(74, 222, 128, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, fy, 22, 0, Math.PI * 2);
      ctx.fill();
      if (fruitAsset && fruitAsset.canvas && fruitAsset.w && fruitAsset.h) {
        const dh = 30;
        const dw = (fruitAsset.w / Math.max(1, fruitAsset.h)) * dh;
        ctx.drawImage(fruitAsset.canvas, f.x - dw * 0.5, fy - dh * 0.5, dw, dh);
      } else {
        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(f.x, fy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawMiniHpBar(
    x: number,
    y: number,
    w: number,
    hp: number,
    whiteHp: number,
    maxHp: number,
    shakeTimer: number
  ): void {
    const ctx = this.ctx;
    const sx = shakeTimer > 0 ? Math.sin(this.state.elapsed * 95) * 3.5 : 0;
    const bx = x - w * 0.5 + sx;
    ctx.fillStyle = 'rgba(8, 14, 20, 0.85)';
    ctx.fillRect(bx - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, y, w * clamp(whiteHp / maxHp, 0, 1), 5);
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(bx, y, w * clamp(hp / maxHp, 0, 1), 5);
  }

  private drawSheetFrame(
    sheet: LoadedAsset | null,
    frameIdx: number,
    x: number,
    y: number,
    targetH: number,
    facing: 1 | -1,
    isFlash: boolean,
    tintOverlay?: { color: 'cyan' | 'gold'; alpha: number },
    centerVertical = false
  ): boolean {
    if (!sheet || !sheet.frames || sheet.frames.length === 0) return false;
    const ctx = this.ctx;
    const f = sheet.frames[frameIdx % sheet.frames.length];
    // Uniform scale + cubic-weighted torso anchorX + stabilized footLift so characters never twitch
    const scale = targetH / Math.max(1, sheet.refH || f.h);
    const drawH = f.h * scale;
    const drawW = f.w * scale;
    const anchorX = (f.anchorX ?? f.w * 0.5) * scale;
    const liftY = centerVertical ? 0 : (f.footLift ?? 0) * scale;
    const drawY = centerVertical ? -targetH * 0.5 - drawH * 0.5 : -drawH - liftY;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    if (isFlash) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 16;
      ctx.drawImage(f.white, -anchorX, drawY, drawW, drawH);
    } else {
      ctx.drawImage(f.canvas, -anchorX, drawY, drawW, drawH);
      if (tintOverlay && tintOverlay.alpha > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = tintOverlay.alpha * 0.65;
        ctx.shadowColor = tintOverlay.color === 'gold' ? '#fde047' : '#67e8f9';
        ctx.shadowBlur = 10;
        const tc = tintOverlay.color === 'gold' ? f.gold : f.cyan;
        ctx.drawImage(tc, -anchorX, drawY, drawW, drawH);
      }
    }
    ctx.restore();
    return true;
  }

  private drawEnemiesAndBoss(): void {
    const ctx = this.ctx;
    const s = this.state;

    drawMonsterHitGhosts(ctx, s.vfx.hitGhosts);

    for (const e of s.enemies) {
      if (e.dead) continue;
      ctx.save();

      let jx = 0;
      let jy = 0;
      if (e.hitJitter > 0) {
        const amp = (e.hitJitter / 0.16) * 5.2;
        jx = Math.sin(s.elapsed * 155) * amp * e.hitJitterDir;
        jy = Math.cos(s.elapsed * 130) * amp * 0.35;
      }

      let sx = 1;
      let sy = 1;
      if (e.squashTimer > 0) {
        const prog = 1 - e.squashTimer / 0.42;
        const wave = Math.cos(prog * Math.PI * 2.5) * Math.exp(-prog * 3.2);
        sx = 1 - wave * 0.25;
        sy = 1 + wave * 0.28;
      }

      ctx.translate(e.x + jx, e.y + jy);
      ctx.scale(sx, sy);

      const tintOverlay =
        e.hitTintTimer > 0
          ? { color: e.hitTintColor, alpha: clamp(e.hitTintTimer / 0.24, 0, 1) }
          : undefined;

      if (e.kind === 'beetle') {
        const sheet = AssetManager.get(
          e.aiState === 'charge' || e.aiState === 'windup' ? 'beetle_attack' : 'beetle_walk'
        );
        const idx = Math.floor(e.animTime * 10);
        if (!this.drawSheetFrame(sheet, idx, 0, 0, 56, e.facing, e.flash > 0, tintOverlay)) {
          ctx.scale(e.facing, 1);
          if (e.flash > 0) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 16;
          } else if (tintOverlay) {
            ctx.shadowColor = tintOverlay.color === 'gold' ? '#fde047' : '#67e8f9';
            ctx.shadowBlur = 12 * tintOverlay.alpha;
          }
          const walk = Math.sin(e.animTime * 12) * 3;
          ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#090d11';
          ctx.beginPath();
          ctx.ellipse(0, -14, 24, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          for (const lx of [-16, -6, 6, 15]) {
            ctx.fillRect(lx - 2, -8, 4, 8 + (lx > 0 ? walk : -walk) * 0.5);
          }
          ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#4a6566';
          ctx.beginPath();
          ctx.arc(0, -16, 25, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle =
            tintOverlay && tintOverlay.alpha > 0.1
              ? tintOverlay.color === 'gold'
                ? '#fde047'
                : '#67e8f9'
              : '#101a20';
          ctx.lineWidth = tintOverlay ? 2.4 : 2;
          ctx.stroke();

          if (e.flash <= 0 && e.crackGlow > 0.02) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle =
              e.hitTintColor === 'gold'
                ? `rgba(253, 224, 71, ${e.crackGlow})`
                : `rgba(103, 232, 249, ${e.crackGlow})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-10, -34);
            ctx.lineTo(-3, -25);
            ctx.lineTo(-9, -18);
            ctx.moveTo(-3, -25);
            ctx.lineTo(8, -22);
            ctx.stroke();
            ctx.restore();
          }

          if (e.flash <= 0) {
            ctx.fillStyle = '#5c8459';
            ctx.beginPath();
            ctx.ellipse(-7, -38, 12, 5, -0.2, 0, Math.PI * 2);
            ctx.fill();
            const budGlow = e.aiState === 'windup' ? '#fde047' : '#e0f2fe';
            ctx.fillStyle = budGlow;
            ctx.beginPath();
            ctx.arc(-11, -48, 3.8, 0, Math.PI * 2);
            ctx.arc(-2, -45, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.strokeStyle = e.flash > 0 ? '#0f172a' : '#e0f2fe';
          ctx.fillStyle = e.flash > 0 ? '#0f172a' : '#e0f2fe';
          if (e.hurtExpr > 0) {
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(8, -17);
            ctx.lineTo(13, -14);
            ctx.lineTo(8, -11);
            ctx.moveTo(20, -17);
            ctx.lineTo(15, -14);
            ctx.lineTo(20, -11);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(11, -14, 2.8, 0, Math.PI * 2);
            ctx.arc(19, -14, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        const sheet = AssetManager.get(e.aiState === 'charge' ? 'wisp_attack' : 'wisp_walk');
        const idx = Math.floor(e.animTime * 10);
        if (!this.drawSheetFrame(sheet, idx, 0, 0, 62, e.facing, e.flash > 0, tintOverlay, true)) {
          ctx.scale(e.facing, 1);
          if (e.flash > 0) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 16;
          } else if (tintOverlay) {
            ctx.shadowColor = tintOverlay.color === 'gold' ? '#fde047' : '#67e8f9';
            ctx.shadowBlur = 12 * tintOverlay.alpha;
          }
          const flap = Math.sin(e.animTime * 11) * 10;
          ctx.fillStyle = e.flash > 0 ? '#ffffff' : 'rgba(122, 152, 158, 0.72)';
          ctx.beginPath();
          ctx.moveTo(-4, -26);
          ctx.quadraticCurveTo(-26, -42 + flap, -22, -16);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(4, -26);
          ctx.quadraticCurveTo(24, -40 - flap, 20, -16);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#6c624b';
          ctx.beginPath();
          ctx.arc(0, -24, 15, Math.PI, 0);
          ctx.lineTo(17, -10);
          ctx.lineTo(-17, -10);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle =
            tintOverlay && tintOverlay.alpha > 0.1
              ? tintOverlay.color === 'gold'
                ? '#fde047'
                : '#a5f3fc'
              : '#161b20';
          ctx.lineWidth = tintOverlay ? 2.2 : 1.8;
          ctx.stroke();

          if (e.flash <= 0 && e.crackGlow > 0.02) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(253, 224, 71, ${e.crackGlow})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(-4, -34);
            ctx.lineTo(2, -23);
            ctx.lineTo(-2, -13);
            ctx.stroke();
            ctx.restore();
          }

          ctx.fillStyle = e.aiState === 'charge' ? '#fde047' : '#a5f3fc';
          ctx.beginPath();
          ctx.arc(0, -11, e.aiState === 'charge' ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      if (e.hp < e.maxHp) {
        this.drawMiniHpBar(e.x, e.y - e.h - 14, 46, e.hp, e.whiteHp, e.maxHp, e.hpShake);
      }
    }

    // Boss: 朽钟守林巨像 (with Slow-Fast-Slow animation curve on both sprite sheet & vector blade)
    const b = s.boss;
    if (b && !b.dead) {
      ctx.save();
      let bjx = 0;
      let bjy = 0;
      if (b.hitJitter > 0) {
        const amp = (b.hitJitter / 0.17) * 6.5;
        bjx = Math.sin(s.elapsed * 165) * amp * b.hitJitterDir;
        bjy = Math.cos(s.elapsed * 135) * amp * 0.35;
      }

      let bsx = 1;
      let bsy = 1;
      if (b.squashTimer > 0) {
        const prog = 1 - b.squashTimer / 0.3;
        const wave = Math.cos(prog * Math.PI * 2.2) * Math.exp(-prog * 3.4);
        bsx = 1 - wave * 0.12;
        bsy = 1 + wave * 0.14;
      }

      ctx.translate(b.x + bjx, b.y + bjy);
      ctx.scale(bsx, bsy);

      const isAtk = b.aiState.includes('windup') || b.aiState.includes('strike') || b.aiState === 'recover';
      const bSheet = AssetManager.get(isAtk ? 'boss_attack' : 'boss_walk');

      // Slow-Fast-Slow sprite-sheet frame mapping for Boss attacks
      let idx = Math.floor(b.animTime * 6.5);
      if (isAtk && bSheet?.frames?.length) {
        const total = bSheet.frames.length;
        const p = clamp(1 - b.aiTimer / Math.max(0.01, b.aiStateDur), 0, 1);
        if (b.aiState.includes('windup')) {
          // Slow rise easing into a tense pause near frame ~35%
          idx = Math.floor(Easing.easeOutCubic(p) * total * 0.38);
        } else if (b.aiState.includes('strike')) {
          // Fast whip through strike frames 40%..72%
          idx = Math.floor(lerp(total * 0.4, total * 0.74, Easing.easeOutExpo(p)));
        } else {
          // Slow heavy recovery through frames 74%..99%
          idx = Math.floor(lerp(total * 0.74, total - 0.01, Easing.easeInOutCubic(p)));
        }
      }

      const bTint =
        b.hitTintTimer > 0
          ? { color: b.hitTintColor, alpha: clamp(b.hitTintTimer / 0.28, 0, 1) }
          : undefined;

      if (!this.drawSheetFrame(bSheet, idx, 0, 0, 166, b.facing, b.flash > 0, bTint)) {
        ctx.scale(b.facing, 1);
        if (b.flash > 0) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 22;
        } else if (bTint) {
          ctx.shadowColor = bTint.color === 'gold' ? '#fde047' : '#67e8f9';
          ctx.shadowBlur = 16 * bTint.alpha;
        }
        const bob = Math.sin(b.animTime * 4.2) * 3;
        ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#1b2b33';
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.lineTo(-42, -88 + bob);
        ctx.lineTo(42, -88 + bob);
        ctx.lineTo(36, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle =
          bTint && bTint.alpha > 0.1
            ? bTint.color === 'gold'
              ? '#fde047'
              : '#67e8f9'
            : '#091015';
        ctx.lineWidth = bTint ? 3 : 2.5;
        ctx.stroke();

        ctx.fillStyle = b.flash > 0 ? '#ffffff' : b.phase === 2 ? '#8f723f' : '#6f5c3a';
        ctx.beginPath();
        ctx.arc(0, -96 + bob, 32, Math.PI, 0);
        ctx.lineTo(38, -66 + bob);
        ctx.lineTo(-38, -66 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (b.flash <= 0 && (b.crackGlow > 0.02 || b.phase === 2)) {
          const glowA = Math.max(b.crackGlow, b.phase === 2 ? 0.35 + 0.2 * Math.sin(s.elapsed * 6) : 0);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle =
            b.phase === 2 || b.hitTintColor === 'gold'
              ? `rgba(253, 224, 71, ${glowA})`
              : `rgba(103, 232, 249, ${glowA})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(-16, -108 + bob);
          ctx.lineTo(-4, -90 + bob);
          ctx.lineTo(-14, -72 + bob);
          ctx.moveTo(-4, -90 + bob);
          ctx.lineTo(14, -84 + bob);
          ctx.moveTo(-22, -62 + bob);
          ctx.lineTo(4, -44 + bob);
          ctx.lineTo(-12, -24 + bob);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = b.phase === 2 ? '#fde047' : '#67e8f9';
        ctx.beginPath();
        ctx.arc(12, -74 + bob, 4.5, 0, Math.PI * 2);
        ctx.arc(24, -74 + bob, 4, 0, Math.PI * 2);
        ctx.fill();

        // Great thorn blade with Smooth Slow-Fast-Slow motion curve
        ctx.save();
        ctx.translate(22, -62 + bob);
        const pProg = clamp(1 - b.aiTimer / Math.max(0.01, b.aiStateDur), 0, 1);
        let swordAng = 0.22;
        if (b.aiState === 'slam_windup') {
          // Slow dramatic hoist, pausing near top from 0.68..1.0
          const hoist = Easing.easeOutCubic(clamp(pProg / 0.72, 0, 1));
          swordAng = lerp(0.22, -2.35, hoist) - (pProg > 0.72 ? Math.sin((pProg - 0.72) * 35) * 0.04 : 0);
        } else if (b.aiState === 'slam_strike') {
          swordAng = lerp(-2.35, 0.72, Easing.easeOutExpo(pProg));
        } else if (b.aiState === 'sweep_windup') {
          swordAng = lerp(0.22, -1.65, Easing.easeOutCubic(pProg));
        } else if (b.aiState === 'sweep_strike') {
          swordAng = lerp(-1.65, 1.05, Easing.easeOutExpo(pProg));
        } else if (b.aiState === 'recover') {
          swordAng = lerp(0.75, 0.22, Easing.easeInOutCubic(pProg));
        }
        ctx.rotate(swordAng);
        ctx.fillStyle = b.aiState.includes('windup') ? '#fef08a' : '#8da3ad';
        ctx.fillRect(0, -6, 86, 12);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -6, 86, 12);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  private drawPlayerSprite(p: Player, alpha = 1, tint: string | null = null): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.scale(p.squashX, p.squashY);

    let sheetKey = p.forceSheetKey || 'player_idle';
    let frameIdx = Number.isInteger(p.forceFrameIdx)
      ? (p.forceFrameIdx as number)
      : Math.floor(p.animTime * 5.5);

    if (!p.forceSheetKey) {
      if (p.atkActive) {
        sheetKey = 'player_attack';
        const cfg = COMBO_CFG[p.atkStep];
        // Slow-Fast-Slow non-linear frame pacing on player attack sheet
        let prog = 0;
        if (p.atkPhase === 'windup') {
          prog = Easing.easeOutCubic(clamp(p.atkTimer / cfg.windup, 0, 1)) * 0.28;
        } else if (p.atkPhase === 'slash') {
          prog = 0.28 + Easing.easeOutExpo(clamp(p.atkTimer / cfg.slash, 0, 1)) * 0.4;
        } else {
          prog = 0.68 + Easing.easeInOutCubic(clamp(p.atkTimer / cfg.recovery, 0, 1)) * 0.32;
        }
        frameIdx = clamp(Math.floor(prog * 10), 0, 9);
      } else if (!p.onGround) {
        // Hold clean rising/falling airborne stride poses instead of frantic ground running in mid-air
        sheetKey = 'player_run';
        frameIdx = p.vy < -35 ? 0 : 2;
      } else if (Math.abs(p.vx) > 35) {
        sheetKey = 'player_run';
        const runSheet = AssetManager.get('player_run');
        if (runSheet?.isBuiltin && runSheet.frames && runSheet.frames.length >= 5) {
          // Cohesive Row-1 5-frame stride loop (skips Row-2 upright Frame-5 glitch & popping sword blade)
          const cleanRunSeq = [2, 3, 0, 1, 4];
          frameIdx = cleanRunSeq[Math.floor(p.runAnimTime * 9.2) % cleanRunSeq.length];
        } else {
          frameIdx = Math.floor(p.runAnimTime * 10);
        }
      } else {
        sheetKey = 'player_idle';
        const idleSheet = AssetManager.get('player_idle');
        if (idleSheet?.isBuiltin && idleSheet.frames && idleSheet.frames.length >= 10) {
          // Skip Frame 0 (missing scarf) on built-in idle sheet for seamless scarf flutter
          frameIdx = 1 + (Math.floor(p.animTime * 5.5) % (idleSheet.frames.length - 1));
        } else {
          frameIdx = Math.floor(p.animTime * 6);
        }
      }
    }

    // Dedicated forward-lunge dash sprite when actively dashing
    if (!p.forceSheetKey && p.dashTimer > 0) {
      const dashSingle = AssetManager.get('player_dash');
      if (dashSingle && dashSingle.canvas && dashSingle.w && dashSingle.h) {
        const drawH = 74;
        const drawW = (dashSingle.w / Math.max(1, dashSingle.h)) * drawH;
        const img = Boolean(tint) || p.hurtFlash > 0.14 ? dashSingle.white || dashSingle.canvas : dashSingle.canvas;
        ctx.scale(p.facing, 1);
        ctx.drawImage(img, -drawW * 0.5, -drawH, drawW, drawH);
        ctx.restore();
        return;
      }
    }

    const sheet =
      AssetManager.get(sheetKey) ||
      (tint ? AssetManager.get('player_run') || AssetManager.get('player_idle') : null);
    if (sheet && sheet.frames && sheet.frames.length > 0) {
      const targetH = sheetKey === 'player_attack' ? 76 : 74;
      const runBobY =
        sheetKey === 'player_run' && p.onGround && !p.atkActive
          ? -Math.abs(Math.sin(p.runAnimTime * 9.2 * Math.PI * 0.4)) * 2.2
          : 0;
      this.drawSheetFrame(sheet, frameIdx, 0, runBobY, targetH, p.facing, Boolean(tint) || p.hurtFlash > 0.14);
      ctx.restore();
      return;
    }

    ctx.scale(p.facing, 1);
    if (tint) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
      ctx.shadowBlur = 10;
    }
    const runBob =
      Math.abs(p.vx) > 25 && p.onGround
        ? Math.abs(Math.sin(p.animTime * 14)) * 3.5
        : Math.sin(p.animTime * 3.5) * 1.5;

    ctx.fillStyle = tint || '#586d7a';
    const wave = Math.sin(p.animTime * 10) * 5;
    ctx.beginPath();
    ctx.moveTo(-4, -36 - runBob);
    ctx.quadraticCurveTo(-24, -38 - runBob + wave, -34, -29 - runBob - wave * 0.5);
    ctx.lineTo(-10, -28 - runBob);
    ctx.closePath();
    ctx.fill();

    const legSwing = Math.abs(p.vx) > 25 ? Math.sin(p.animTime * 16) * 8 : 0;
    ctx.fillStyle = tint || '#090d11';
    ctx.fillRect(-7 + legSwing * 0.5, -14, 5, 14);
    ctx.fillRect(2 - legSwing * 0.5, -14, 5, 14);

    ctx.fillStyle = tint || '#c9c5b2';
    ctx.beginPath();
    ctx.moveTo(-10, -36 - runBob);
    ctx.lineTo(10, -36 - runBob);
    ctx.lineTo(15, -11 - runBob);
    ctx.lineTo(5, -14 - runBob);
    ctx.lineTo(-2, -10 - runBob);
    ctx.lineTo(-16, -12 - runBob);
    ctx.closePath();
    ctx.fill();
    if (!tint) {
      ctx.strokeStyle = '#141c22';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.fillStyle = tint || '#070a0e';
    ctx.beginPath();
    ctx.arc(1, -43 - runBob, 11, 0, Math.PI * 2);
    ctx.fill();
    if (!tint) {
      ctx.fillStyle = '#d6fcff';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(4, -43 - runBob, 2.3, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(9.5, -43 - runBob, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = tint || '#1b222a';
    ctx.beginPath();
    ctx.moveTo(-19, -48 - runBob);
    ctx.quadraticCurveTo(2, -55 - runBob, 22, -49 - runBob);
    ctx.quadraticCurveTo(3, -44 - runBob, -19, -48 - runBob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -49 - runBob);
    ctx.quadraticCurveTo(-14, -67 - runBob, -2, -70 - runBob);
    ctx.quadraticCurveTo(-8, -73 - runBob, -18, -64 - runBob);
    ctx.quadraticCurveTo(-4, -63 - runBob, 9, -49 - runBob);
    ctx.closePath();
    ctx.fill();
    if (!tint) {
      ctx.strokeStyle = '#0a0f14';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (!tint) {
      ctx.save();
      if (p.atkActive) {
        ctx.translate(6, -30 - runBob);
        const cfg = COMBO_CFG[p.atkStep];
        let ang = -0.6;
        if (p.atkPhase === 'windup') {
          const wp = Easing.easeOutCubic(clamp(p.atkTimer / cfg.windup, 0, 1));
          ang = p.atkStep === 2 ? lerp(-0.4, 1.35, wp) : lerp(-0.5, -2.3, wp);
        } else if (p.atkPhase === 'slash') {
          const t = Easing.easeOutExpo(clamp(p.atkTimer / cfg.slash, 0, 1));
          ang = p.atkStep === 2 ? lerp(1.35, -1.9, t) : lerp(-2.3, 1.05, t);
        } else {
          const rp = Easing.easeInOutCubic(clamp(p.atkTimer / cfg.recovery, 0, 1));
          ang = p.atkStep === 2 ? lerp(-1.9, -1.35, rp) : lerp(1.05, 0.65, rp);
        }
        ctx.rotate(ang);
        if (p.atkStep === 3 && p.atkPhase === 'windup') {
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 12;
        }
        ctx.fillStyle = p.atkStep === 3 ? '#fef08a' : '#cbd5e1';
        ctx.fillRect(0, -2.5, 44, 5);
        ctx.fillStyle = '#b48a4e';
        ctx.fillRect(-3, -7, 5, 14);
      } else {
        ctx.translate(-8, -32 - runBob);
        ctx.rotate(-2.3);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-10, -2, 34, 4);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawAfterimages(): void {
    const ctx = this.ctx;
    const dashSingle = AssetManager.get('player_dash');
    for (const g of this.state.vfx.afterimages) {
      const ratio = clamp(g.life / g.maxLife, 0, 1);
      const alpha = Easing.easeOutQuad(ratio) * 0.72;

      if (dashSingle && dashSingle.white && dashSingle.w && dashSingle.h) {
        const drawH = 74;
        const drawW = (dashSingle.w / Math.max(1, dashSingle.h)) * drawH;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(g.x, g.y);
        ctx.scale(g.facing, 1);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowBlur = 10;
        ctx.drawImage(dashSingle.white, -drawW * 0.5, -drawH, drawW, drawH);
        ctx.restore();
      } else {
        this.drawPlayerSprite(
          {
            ...this.state.player,
            x: g.x,
            y: g.y,
            vx: g.facing * 300,
            facing: g.facing,
            animTime: g.animTime ?? this.state.player.animTime,
            forceSheetKey: g.sheetKey,
            forceFrameIdx: g.frameIdx,
            atkActive: false,
            squashX: 1,
            squashY: 1,
          },
          alpha,
          '#ffffff'
        );
      }
    }
  }

  private drawProjectilesWavesAndOrbsWorld(): void {
    const ctx = this.ctx;
    const s = this.state;

    for (const pr of s.projectiles) {
      ctx.save();
      if (pr.trail.length >= 2) {
        ctx.lineCap = 'round';
        for (let t = 1; t < pr.trail.length; t++) {
          const frac = t / (pr.trail.length - 1);
          ctx.strokeStyle = pr.deflected
            ? `rgba(253, 224, 71, ${frac * 0.88})`
            : `rgba(103, 232, 249, ${frac * 0.55})`;
          ctx.lineWidth = pr.r * (pr.deflected ? 1.5 : 0.95) * frac;
          ctx.beginPath();
          ctx.moveTo(pr.trail[t - 1].x, pr.trail[t - 1].y);
          ctx.lineTo(pr.trail[t].x, pr.trail[t].y);
          ctx.stroke();
        }
      }
      const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, pr.r * (pr.deflected ? 3.0 : 2.5));
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.42, pr.deflected ? '#fde047' : '#67e8f9');
      g.addColorStop(1, pr.deflected ? 'rgba(250, 204, 21, 0)' : 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r * (pr.deflected ? 3.0 : 2.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const sw of s.shockwaves) {
      const isP2 = s.boss?.phase === 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(sw.x, sw.y);
      ctx.scale(sw.dir, 1);
      const g = ctx.createLinearGradient(0, -sw.h, 0, 0);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.42, isP2 ? '#fde047' : '#67e8f9');
      g.addColorStop(1, isP2 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(56, 189, 248, 0.12)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.quadraticCurveTo(6, -sw.h * 1.35, 24, 0);
      ctx.closePath();
      ctx.fill();
      // Trailing wave fin
      ctx.fillStyle = isP2 ? 'rgba(253, 224, 71, 0.45)' : 'rgba(103, 232, 249, 0.45)';
      ctx.beginPath();
      ctx.moveTo(-38, 0);
      ctx.quadraticCurveTo(-12, -sw.h * 0.78, 4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const o of s.orbs) {
      if (o.phase === 'fly') continue;
      const g = ctx.createRadialGradient(o.wx, o.wy, 1, o.wx, o.wy, 11);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, '#fde047');
      g.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.wx, o.wy, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawScreenHudAndEffects(): void {
    const ctx = this.ctx;
    const s = this.state;
    const p = s.player;

    for (const o of s.orbs) {
      if (o.phase !== 'fly') continue;
      if (!Number.isFinite(o.scrX) || !Number.isFinite(o.scrY)) continue;
      if (o.trail.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let t = 1; t < o.trail.length; t++) {
          const frac = t / (o.trail.length - 1);
          ctx.strokeStyle = `rgba(253, 224, 71, ${frac * 0.78})`;
          ctx.lineWidth = 5.5 * frac;
          ctx.beginPath();
          ctx.moveTo(o.trail[t - 1].x, o.trail[t - 1].y);
          ctx.lineTo(o.trail[t].x, o.trail[t].y);
          ctx.stroke();
        }
        ctx.restore();
      }
      const g = ctx.createRadialGradient(o.scrX, o.scrY, 1, o.scrX, o.scrY, 12);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, '#fde047');
      g.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.scrX, o.scrY, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle painted edge vignette for atmospheric framing
    ctx.save();
    const edgeVig = ctx.createRadialGradient(
      VIEW_W * 0.5,
      VIEW_H * 0.48,
      VIEW_H * 0.36,
      VIEW_W * 0.5,
      VIEW_H * 0.5,
      VIEW_W * 0.68
    );
    edgeVig.addColorStop(0, 'rgba(3, 8, 12, 0)');
    edgeVig.addColorStop(1, 'rgba(3, 8, 12, 0.36)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();

    if ((p.hp > 0 && p.hp < 25) || p.hurtFlash > 0) {
      const pulse = p.hp < 25 ? 0.28 + 0.18 * Math.sin(s.elapsed * 7.5) : 0;
      const hitA = p.hurtFlash > 0 ? (p.hurtFlash / 0.28) * 0.36 : 0;
      const alpha = Math.min(0.65, Math.max(pulse, hitA));
      const vg = ctx.createRadialGradient(
        VIEW_W * 0.5,
        VIEW_H * 0.5,
        VIEW_H * 0.28,
        VIEW_W * 0.5,
        VIEW_H * 0.5,
        VIEW_W * 0.65
      );
      vg.addColorStop(0, 'rgba(185, 28, 28, 0)');
      vg.addColorStop(1, `rgba(185, 28, 28, ${alpha})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // === Top-Left Ornate Gothic Relic HUD ===
    const shakeX = p.hpShake > 0 ? Math.sin(s.elapsed * 90) * 4 : 0;
    ctx.save();
    ctx.translate(18 + shakeX, 16);

    // Sculpted chamfered HP track connected to the Relic Soul Medallion
    const barX = 36;
    const barY = 7;
    const barW = 210;
    const barH = 16;

    // Back plate shadow + beveled dark obsidian bar housing
    ctx.fillStyle = 'rgba(6, 13, 19, 0.86)';
    ctx.beginPath();
    ctx.moveTo(barX - 4, barY - 3);
    ctx.lineTo(barX + barW + 10, barY - 3);
    ctx.lineTo(barX + barW + 4, barY + barH + 3);
    ctx.lineTo(barX - 4, barY + barH + 3);
    ctx.closePath();
    ctx.fill();

    // Delayed white damage bar
    const whiteFrac = clamp(p.whiteHp / p.maxHp, 0, 1);
    const hpFrac = clamp(p.hp / p.maxHp, 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barW + 4, barY);
    ctx.lineTo(barX + barW, barY + barH);
    ctx.lineTo(barX, barY + barH);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(barX, barY, (barW + 4) * whiteFrac, barH);

    const hg = ctx.createLinearGradient(barX, barY, barX + barW, barY + barH);
    if (p.hp < 25) {
      hg.addColorStop(0, '#881337');
      hg.addColorStop(0.55, '#e11d48');
      hg.addColorStop(1, '#fb7185');
    } else {
      hg.addColorStop(0, '#7f1d1d');
      hg.addColorStop(0.5, '#be123c');
      hg.addColorStop(1, '#f43f5e');
    }
    ctx.fillStyle = hg;
    ctx.fillRect(barX, barY, (barW + 4) * hpFrac, barH);

    // Specular upper glass rim on life fill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(barX, barY, (barW + 4) * hpFrac, 4);

    // Subtle 25% tick etchings
    ctx.strokeStyle = 'rgba(8, 14, 20, 0.35)';
    ctx.lineWidth = 1;
    for (let t = 1; t <= 3; t++) {
      const tx = barX + (barW * t) / 4;
      ctx.beginPath();
      ctx.moveTo(tx, barY);
      ctx.lineTo(tx, barY + barH);
      ctx.stroke();
    }
    ctx.restore();

    // Antique-gold filigree border around HP blade
    ctx.strokeStyle = 'rgba(230, 198, 135, 0.82)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(barX - 4, barY - 3);
    ctx.lineTo(barX + barW + 10, barY - 3);
    ctx.lineTo(barX + barW + 4, barY + barH + 3);
    ctx.lineTo(barX - 4, barY + barH + 3);
    ctx.closePath();
    ctx.stroke();

    // Ornamental right diamond tip
    ctx.fillStyle = '#e6c687';
    ctx.beginPath();
    ctx.moveTo(barX + barW + 12, barY + barH * 0.5);
    ctx.lineTo(barX + barW + 16, barY + barH * 0.5 - 3.5);
    ctx.lineTo(barX + barW + 20, barY + barH * 0.5);
    ctx.lineTo(barX + barW + 16, barY + barH * 0.5 + 3.5);
    ctx.closePath();
    ctx.fill();

    // HP numeric readout
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4;
    ctx.font = '800 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, barX + barW * 0.5, barY + 12);
    ctx.shadowBlur = 0;

    // Left Soul Crest Medallion (Diamond Relic Seal)
    const cx = 19;
    const cy = 19;
    const isLow = p.hp < 25;
    const crestPulse = 0.72 + 0.28 * Math.sin(s.elapsed * (isLow ? 8 : 2.8));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#09131a';
    ctx.strokeStyle = isLow ? '#fb7185' : '#e6c687';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(19, 0);
    ctx.lineTo(0, 19);
    ctx.lineTo(-19, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner rune ring
    ctx.strokeStyle = isLow ? 'rgba(251, 113, 133, 0.5)' : 'rgba(103, 232, 249, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.stroke();

    // Glowing witch-eye / spirit core inside medallion
    const coreG = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    coreG.addColorStop(0, '#ffffff');
    coreG.addColorStop(0.5, isLow ? `rgba(244, 63, 94, ${crestPulse})` : `rgba(103, 232, 249, ${crestPulse})`);
    coreG.addColorStop(1, 'rgba(103, 232, 249, 0)');
    ctx.fillStyle = coreG;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // === Under-Bar Clean Telemetry Strip (Gold Relics + Dash Spirit Gauge) ===
    const stripY = 35;

    // Gold counter (clean, sculptural, no heavy boxy pill)
    const gScale = 1 + (s.goldPulse / 0.16) * 0.2;
    ctx.save();
    ctx.translate(barX + 6, stripY + 7);
    ctx.scale(gScale, gScale);
    const coinGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    coinGlow.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
    coinGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = coinGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(-1.8, -1.8, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fef08a';
    ctx.font = '800 13px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${s.gold}`, 12, 4.5);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Dash Spirit Gauge (sleek animated cyan charge bar)
    const dashX = barX + 86;
    const dashW = 122;
    const dashFrac = clamp(1 - p.dashCd / 0.8, 0, 1);
    const dashReady = p.dashCd <= 0;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 13, 19, 0.78)';
    ctx.beginPath();
    ctx.roundRect(dashX, stripY + 1, dashW, 13, 3);
    ctx.fill();

    if (dashFrac > 0) {
      const dg = ctx.createLinearGradient(dashX, stripY, dashX + dashW, stripY);
      dg.addColorStop(0, dashReady ? '#0891b2' : '#334155');
      dg.addColorStop(1, dashReady ? '#67e8f9' : '#64748b');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.roundRect(dashX + 1.5, stripY + 2.5, (dashW - 3) * dashFrac, 10, 2);
      ctx.fill();
    }

    ctx.strokeStyle = dashReady ? 'rgba(103, 232, 249, 0.78)' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(dashX, stripY + 1, dashW, 13, 3);
    ctx.stroke();

    ctx.fillStyle = dashReady ? '#ecfeff' : '#cbd5e1';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 3;
    ctx.font = '700 10px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dashReady ? '✦ 灵影冲刺就绪' : `冲刺充能 ${p.dashCd.toFixed(1)}s`, dashX + dashW * 0.5, stripY + 11);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();

    // === Top-Right Tapered Ink-Ribbon Zone Banner ===
    const zoneName =
      p.x < 1760
        ? '区域 1 · 遗迹入口'
        : p.x < 3040
          ? '区域 2 · 断桥跳台'
          : p.x < 5450
            ? '区域 3 · 密林长廊'
            : '区域 4 · 钟楼祭坛';
    ctx.save();
    const rx = VIEW_W - 196;
    const ry = 16;
    const rw = 180;
    const rh = 28;
    const ribGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry);
    ribGrad.addColorStop(0, 'rgba(6, 13, 19, 0)');
    ribGrad.addColorStop(0.18, 'rgba(6, 13, 19, 0.82)');
    ribGrad.addColorStop(0.88, 'rgba(6, 13, 19, 0.82)');
    ribGrad.addColorStop(1, 'rgba(6, 13, 19, 0)');
    ctx.fillStyle = ribGrad;
    ctx.fillRect(rx, ry, rw, rh);

    // Top & bottom tapered gold hairlines
    const lineGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry);
    lineGrad.addColorStop(0, 'rgba(230, 198, 135, 0)');
    lineGrad.addColorStop(0.25, 'rgba(230, 198, 135, 0.65)');
    lineGrad.addColorStop(0.75, 'rgba(230, 198, 135, 0.65)');
    lineGrad.addColorStop(1, 'rgba(230, 198, 135, 0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + 8, ry);
    ctx.lineTo(rx + rw - 8, ry);
    ctx.moveTo(rx + 18, ry + rh);
    ctx.lineTo(rx + rw - 8, ry + rh);
    ctx.stroke();

    ctx.fillStyle = '#e6c687';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.font = '700 12px "Noto Serif SC", "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`✦  ${zoneName}  ✦`, rx + rw * 0.52, ry + 18.5);
    ctx.shadowBlur = 0;
    ctx.restore();

    // === Bottom-Center Grand Boss Encounter Bar ===
    const b = s.boss;
    if (b && b.active && !b.dead) {
      const bw = 510;
      const bx = (VIEW_W - bw) * 0.5 + (b.hpShake > 0 ? Math.sin(s.elapsed * 95) * 4 : 0);
      const by = VIEW_H - 42;
      const isP2 = b.phase === 2;
      ctx.save();

      // Atmospheric dark backdrop behind Boss title + bar
      const bgGrad = ctx.createLinearGradient(bx - 40, by, bx + bw + 40, by);
      bgGrad.addColorStop(0, 'rgba(5, 10, 15, 0)');
      bgGrad.addColorStop(0.12, 'rgba(5, 10, 15, 0.86)');
      bgGrad.addColorStop(0.88, 'rgba(5, 10, 15, 0.86)');
      bgGrad.addColorStop(1, 'rgba(5, 10, 15, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(bx - 40, by - 28, bw + 80, 52);

      // Boss Name & HP Numerals
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = isP2 ? '#fef08a' : '#e6c687';
      ctx.font = '700 13px "Noto Serif SC", "Cinzel", Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(isP2 ? '✦ 朽钟守林巨像 · 裂地异变' : '✦ 朽钟守林巨像 · 森林守卫', bx + 2, by - 9);
      ctx.textAlign = 'right';
      ctx.font = '700 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = isP2 ? '#fde047' : '#cbd5e1';
      ctx.fillText(`${Math.ceil(b.hp)} / ${b.maxHp}`, bx + bw - 2, by - 9);
      ctx.shadowBlur = 0;

      // Sculpted Bar Housing
      ctx.fillStyle = '#0c151d';
      ctx.fillRect(bx, by, bw, 13);

      // Delayed white bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(bx, by, bw * clamp(b.whiteHp / b.maxHp, 0, 1), 13);

      // Main Boss HP gradient fill
      const bFill = ctx.createLinearGradient(bx, by, bx + bw, by);
      if (isP2) {
        bFill.addColorStop(0, '#b45309');
        bFill.addColorStop(0.55, '#f59e0b');
        bFill.addColorStop(1, '#fef08a');
      } else {
        bFill.addColorStop(0, '#7f1d1d');
        bFill.addColorStop(0.6, '#dc2626');
        bFill.addColorStop(1, '#fb7185');
      }
      ctx.fillStyle = bFill;
      ctx.fillRect(bx, by, bw * clamp(b.hp / b.maxHp, 0, 1), 13);

      // Specular highlight along top of Boss bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.fillRect(bx, by, bw * clamp(b.hp / b.maxHp, 0, 1), 3.5);

      // 50% Phase-2 Threshold Diamond Marker
      const midX = bx + bw * 0.5;
      ctx.strokeStyle = isP2 ? '#fde047' : 'rgba(230, 198, 135, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midX, by - 2);
      ctx.lineTo(midX, by + 15);
      ctx.stroke();

      // Ornate bronze-gold frame & left/right diamond finials
      ctx.strokeStyle = isP2 ? '#fde047' : 'rgba(230, 198, 135, 0.82)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(bx - 1, by - 1, bw + 2, 15);

      ctx.fillStyle = isP2 ? '#fde047' : '#e6c687';
      for (const endX of [bx - 8, bx + bw + 8]) {
        ctx.beginPath();
        ctx.moveTo(endX, by + 6.5 - 5);
        ctx.lineTo(endX + 5, by + 6.5);
        ctx.lineTo(endX, by + 6.5 + 5);
        ctx.lineTo(endX - 5, by + 6.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (s.pitFade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${clamp(s.pitFade / 0.35, 0, 1) * 0.88})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const s = this.state;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawBackground();

    ctx.save();
    ctx.translate(-Math.round(s.camera.x) + s.camera.shakeX, s.camera.shakeY);
    this.drawBossArenaDecor();
    this.drawTerrainAndGates();
    this.drawProps();
    this.drawEnemiesAndBoss();
    this.drawAfterimages();
    const p = s.player;
    const blink = p.hurtInvuln > 0 && Math.floor(s.elapsed * 20) % 2 === 0;
    this.drawPlayerSprite(p, blink ? 0.45 : 1);
    this.drawProjectilesWavesAndOrbsWorld();
    drawEnhancedHitVfx(ctx, s.vfx);
    ctx.restore();

    this.drawScreenHudAndEffects();
  }

  private startLoop(): void {
    const tick = (ts: number) => {
      if (!this.lastTime) this.lastTime = ts;
      const rawDt = Math.min(0.05, Math.max(0.001, (ts - this.lastTime) / 1000));
      this.lastTime = ts;
      this.updateGame(rawDt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
