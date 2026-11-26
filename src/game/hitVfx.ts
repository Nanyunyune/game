import { AssetManager } from './assetManager';
import { Easing, FLOOR_Y, clamp, lerp } from './constants';
import type {
  Boss,
  Enemy,
  HitGhostVfx,
  MonsterMaterial,
  Player,
  VfxBucket,
} from './types';

function createPolygonPoints(sides: number, radius: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const r = radius * (0.55 + Math.random() * 0.55);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export interface MonsterHitVfxParams {
  vfx: VfxBucket;
  x: number;
  y: number;
  dir: 1 | -1;
  damage: number;
  isHeavy: boolean;
  comboStep: 1 | 2 | 3;
  material: MonsterMaterial;
  isParryHit?: boolean;
  bossPhase?: 1 | 2;
}

export function spawnMonsterHitVfx(params: MonsterHitVfxParams): void {
  const { vfx, x, y, dir, damage, isHeavy, comboStep, material, isParryHit, bossPhase } = params;

  const isBoss = material === 'boss';
  const isWisp = material === 'wisp';
  const isGoldTier = isHeavy || isParryHit || (isBoss && bossPhase === 2);

  const primaryColor = isParryHit
    ? '#67e8f9'
    : isGoldTier
      ? '#fde047'
      : isWisp
        ? '#a5f3fc'
        : '#67e8f9';

  const secondaryColor = isBoss
    ? '#f59e0b'
    : isWisp
      ? '#fcd34d'
      : '#6ee7b7';

  // 1. Directional slash scar & anamorphic starburst
  const baseAngle =
    comboStep === 1
      ? dir > 0
        ? -0.42
        : Math.PI + 0.42
      : comboStep === 2
        ? dir > 0
          ? 0.48
          : Math.PI - 0.48
        : dir > 0
          ? -0.22
          : Math.PI + 0.22;

  vfx.scars.push({
    x,
    y,
    angle: baseAngle + (Math.random() - 0.5) * 0.14,
    length: isHeavy ? (isBoss ? 132 : 108) : isBoss ? 88 : 70,
    thickness: isHeavy ? 10.5 : 6.8,
    color: primaryColor,
    coreColor: '#ffffff',
    crossFlare: isHeavy || Boolean(isParryHit),
    starPoints: isHeavy ? 6 : 4,
    starRadius: isHeavy ? (isBoss ? 54 : 44) : 28,
    life: isHeavy ? 0.24 : 0.17,
    maxLife: isHeavy ? 0.24 : 0.17,
  });

  if (isHeavy) {
    vfx.scars.push({
      x,
      y,
      angle: baseAngle + Math.PI * 0.48,
      length: isBoss ? 96 : 78,
      thickness: 6.8,
      color: secondaryColor,
      coreColor: '#fffbeb',
      crossFlare: false,
      starPoints: 4,
      starRadius: 22,
      life: 0.19,
      maxLife: 0.19,
    });
  }

  // 2. Soft localized contact bloom flash
  vfx.flashes.push({
    x,
    y,
    color: primaryColor,
    radius: isHeavy ? (isBoss ? 120 : 92) : 58,
    intensity: isHeavy ? 0.64 : 0.44,
    life: isHeavy ? 0.17 : 0.12,
    maxLife: isHeavy ? 0.17 : 0.12,
  });

  // 3. Material-specific concentric shockwave rings
  if (isBoss) {
    vfx.rings.push({
      x,
      y,
      r0: 10,
      r1: isHeavy ? 100 : 66,
      w0: isHeavy ? 4.6 : 3.2,
      color: isGoldTier ? '#fde047' : '#e6c687',
      style: 'rune_sigil',
      rot: Math.random() * Math.PI * 2,
      vrot: dir * (isHeavy ? 2.4 : 1.6),
      squashY: 1,
      life: isHeavy ? 0.35 : 0.25,
      maxLife: isHeavy ? 0.35 : 0.25,
    });
    vfx.rings.push({
      x,
      y,
      r0: 6,
      r1: isHeavy ? 72 : 46,
      w0: 2.5,
      color: '#67e8f9',
      style: 'chime_arcs',
      rot: Math.random() * Math.PI,
      vrot: -dir * 2.8,
      squashY: 0.78,
      life: 0.23,
      maxLife: 0.23,
    });
  } else if (isWisp) {
    vfx.rings.push({
      x,
      y,
      r0: 6,
      r1: isHeavy ? 80 : 54,
      w0: isHeavy ? 3.8 : 2.8,
      color: isHeavy ? '#fde047' : '#a5f3fc',
      style: 'chime_arcs',
      rot: Math.random() * Math.PI * 2,
      vrot: dir * 3.2,
      squashY: 0.85,
      life: isHeavy ? 0.3 : 0.22,
      maxLife: isHeavy ? 0.3 : 0.22,
    });
    vfx.rings.push({
      x,
      y,
      r0: 4,
      r1: isHeavy ? 54 : 34,
      w0: 2.2,
      color: '#fcd34d',
      style: 'solid',
      rot: 0,
      vrot: 0,
      squashY: 1,
      life: 0.18,
      maxLife: 0.18,
    });
  } else {
    vfx.rings.push({
      x,
      y,
      r0: 6,
      r1: isHeavy ? 76 : 48,
      w0: isHeavy ? 4.2 : 2.8,
      color: primaryColor,
      style: 'solid',
      rot: 0,
      vrot: 0,
      squashY: 0.88,
      life: isHeavy ? 0.27 : 0.19,
      maxLife: isHeavy ? 0.27 : 0.19,
    });
    if (isHeavy) {
      vfx.rings.push({
        x,
        y,
        r0: 8,
        r1: 94,
        w0: 2.4,
        color: '#6ee7b7',
        style: 'chime_arcs',
        rot: Math.random() * Math.PI,
        vrot: dir * 1.9,
        squashY: 0.72,
        life: 0.28,
        maxLife: 0.28,
      });
    }
  }

  // 4. Curved trailing sparks
  const sparkCount = isHeavy ? (isBoss ? 22 : 17) : isBoss ? 14 : 11;
  for (let i = 0; i < sparkCount; i++) {
    const forwardBurst = i < sparkCount * 0.78;
    const spread = forwardBurst ? 1.35 : 1.8;
    const baseDirAng = forwardBurst ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI : 0;
    const ang = baseDirAng + (Math.random() - 0.5) * spread - 0.18;
    const spd =
      (forwardBurst ? 220 + Math.random() * 340 : 90 + Math.random() * 140) *
      (isHeavy ? 1.25 : 1.0);
    const maxLife = 0.2 + Math.random() * 0.18;
    const sparkColor =
      i % 4 === 0 ? '#ffffff' : i % 3 === 0 ? secondaryColor : primaryColor;

    vfx.sparks.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 45,
      gravity: 540 + Math.random() * 240,
      drag: 0.94,
      width: isHeavy ? 2.6 + Math.random() * 1.6 : 1.8 + Math.random() * 1.2,
      color: sparkColor,
      coreColor: '#ffffff',
      canBounce: i % 2 === 0,
      bounced: false,
      trail: [{ x, y }],
      life: maxLife,
      maxLife,
    });
  }

  // 5. Dark fairy-tale ink/ichor droplets
  const inkCount = isHeavy ? 10 : 6;
  for (let i = 0; i < inkCount; i++) {
    const ang = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.9 - 0.25;
    const spd = (110 + Math.random() * 210) * (isHeavy ? 1.2 : 1);
    const maxLife = 0.28 + Math.random() * 0.2;
    vfx.inkSplashes.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 65,
      r: isHeavy ? 3.5 + Math.random() * 3.8 : 2.5 + Math.random() * 2.8,
      fill: isWisp ? '#141e27' : '#091118',
      rim: i % 2 === 0 ? primaryColor : secondaryColor,
      stretch: 1.5 + Math.random() * 1.1,
      gravity: 480,
      drag: 0.95,
      life: maxLife,
      maxLife,
    });
  }

  // 6. Material-specific shards & bioluminescent wisps
  if (material === 'beetle') {
    const shardCount = isHeavy ? 9 : 5;
    for (let i = 0; i < shardCount; i++) {
      const isMoss = i % 3 === 0;
      const size = isMoss ? 4 + Math.random() * 3.5 : 4.5 + Math.random() * 5;
      const maxLife = 0.48 + Math.random() * 0.34;
      vfx.shards.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 14,
        vx: dir * (70 + Math.random() * 170) + (Math.random() - 0.5) * 90,
        vy: -110 - Math.random() * 195,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 14,
        size,
        kind: isMoss ? 'moss' : 'stone',
        color: isMoss ? '#4f7a56' : '#4a6566',
        highlight: isMoss ? '#9be0a5' : '#94b3b6',
        points: createPolygonPoints(isMoss ? 4 : 5, size),
        bounced: false,
        life: maxLife,
        maxLife,
      });
    }
    const sporeCount = isHeavy ? 8 : 4;
    for (let i = 0; i < sporeCount; i++) {
      const maxLife = 0.55 + Math.random() * 0.4;
      vfx.wisps.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y - 10 + (Math.random() - 0.5) * 12,
        vx: dir * (20 + Math.random() * 45) + (Math.random() - 0.5) * 35,
        vy: -42 - Math.random() * 58,
        r: 2.2 + Math.random() * 2.4,
        phase: Math.random() * Math.PI * 2,
        swirlAmp: 22 + Math.random() * 20,
        color: i % 2 === 0 ? '#a7f3d0' : '#bae6fd',
        life: maxLife,
        maxLife,
      });
    }
  } else if (material === 'wisp') {
    const shardCount = isHeavy ? 8 : 5;
    for (let i = 0; i < shardCount; i++) {
      const isScale = i % 2 === 0;
      const size = isScale ? 5 + Math.random() * 4 : 4 + Math.random() * 4;
      const maxLife = isScale ? 0.65 + Math.random() * 0.35 : 0.45 + Math.random() * 0.25;
      vfx.shards.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: dir * (55 + Math.random() * 140) + (Math.random() - 0.5) * 80,
        vy: isScale ? -40 - Math.random() * 90 : -100 - Math.random() * 160,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * (isScale ? 8 : 16),
        size,
        kind: isScale ? 'scale' : 'bronze',
        color: isScale ? '#7ea2a8' : '#8a764c',
        highlight: isScale ? '#e0f2fe' : '#fde68a',
        glow: isScale ? 'rgba(165, 243, 252, 0.35)' : undefined,
        points: createPolygonPoints(isScale ? 4 : 3, size),
        bounced: false,
        life: maxLife,
        maxLife,
      });
    }
    const wispCount = isHeavy ? 7 : 4;
    for (let i = 0; i < wispCount; i++) {
      const maxLife = 0.5 + Math.random() * 0.35;
      vfx.wisps.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 18,
        vx: dir * (30 + Math.random() * 50),
        vy: -55 - Math.random() * 65,
        r: 2.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        swirlAmp: 28 + Math.random() * 20,
        color: i % 2 === 0 ? '#67e8f9' : '#fef08a',
        life: maxLife,
        maxLife,
      });
    }
  } else {
    const shardCount = isHeavy ? 13 : 7;
    for (let i = 0; i < shardCount; i++) {
      const isBronze = i % 2 === 0;
      const size = 5 + Math.random() * 6.5;
      const maxLife = 0.52 + Math.random() * 0.38;
      vfx.shards.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 32,
        vx: dir * (90 + Math.random() * 210) + (Math.random() - 0.5) * 110,
        vy: -130 - Math.random() * 220,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 15,
        size,
        kind: isBronze ? 'bronze' : 'stone',
        color: isBronze ? '#8f723f' : '#324852',
        highlight: isBronze ? '#fef08a' : '#89a8b2',
        points: createPolygonPoints(isBronze ? 4 : 5, size),
        bounced: false,
        life: maxLife,
        maxLife,
      });
    }
    const emberCount = isHeavy ? 10 : 5;
    for (let i = 0; i < emberCount; i++) {
      const maxLife = 0.6 + Math.random() * 0.45;
      vfx.wisps.push({
        x: x + (Math.random() - 0.5) * 36,
        y: y + (Math.random() - 0.5) * 34,
        vx: dir * (25 + Math.random() * 60),
        vy: -60 - Math.random() * 85,
        r: 2.6 + Math.random() * 3.0,
        phase: Math.random() * Math.PI * 2,
        swirlAmp: 30 + Math.random() * 22,
        color: bossPhase === 2 || i % 2 === 0 ? '#fde047' : '#67e8f9',
        life: maxLife,
        maxLife,
      });
    }
  }

  // 7. Combo-tiered damage number
  if (damage > 0) {
    vfx.dmgNums.push({
      text: isHeavy ? `-${damage}!` : `-${damage}`,
      x: x + (Math.random() - 0.5) * 16,
      y: y - (isBoss ? 28 : 18),
      vx: dir * (32 + Math.random() * 36),
      vy: isHeavy ? -175 : -128,
      isHeavy,
      isParry: isParryHit,
      comboStep,
      tilt: dir * (isHeavy ? 0.14 : 0.08) + (Math.random() - 0.5) * 0.06,
      life: isHeavy ? 0.78 : 0.65,
      maxLife: isHeavy ? 0.78 : 0.65,
    });
  }
}

export function spawnMonsterHitGhost(
  vfx: VfxBucket,
  target: Enemy | Boss,
  kind: 'beetle' | 'wisp' | 'boss',
  dir: 1 | -1,
  isHeavy: boolean
): void {
  const sheetKey =
    kind === 'boss'
      ? target.aiState.includes('windup') || target.aiState.includes('strike')
        ? 'boss_attack'
        : 'boss_walk'
      : kind === 'beetle'
        ? target.aiState === 'charge' || target.aiState === 'windup'
          ? 'beetle_attack'
          : 'beetle_walk'
        : target.aiState === 'charge'
          ? 'wisp_attack'
          : 'wisp_walk';

  const frameIdx = Math.floor(target.animTime * 10);
  const targetH = kind === 'boss' ? 166 : kind === 'wisp' ? 62 : 56;
  const bossPhase = kind === 'boss' ? (target as Boss).phase : undefined;

  vfx.hitGhosts.push({
    kind,
    x: target.x + dir * 4,
    y: target.y,
    vx: dir * (isHeavy ? 145 : 85),
    vy: isHeavy ? -18 : 0,
    facing: target.facing,
    color: isHeavy ? 'gold' : 'cyan',
    sheetKey,
    frameIdx,
    targetH,
    animTime: target.animTime,
    phase: bossPhase,
    life: isHeavy ? 0.22 : 0.16,
    maxLife: isHeavy ? 0.22 : 0.16,
  });

  if (isHeavy) {
    vfx.hitGhosts.push({
      kind,
      x: target.x - dir * 5,
      y: target.y,
      vx: -dir * 65,
      vy: 0,
      facing: target.facing,
      color: 'cyan',
      sheetKey,
      frameIdx,
      targetH,
      animTime: target.animTime,
      phase: bossPhase,
      life: 0.19,
      maxLife: 0.19,
    });
  }
}

export function spawnMonsterDeathVfx(
  vfx: VfxBucket,
  x: number,
  y: number,
  material: MonsterMaterial
): void {
  const isBoss = material === 'boss';
  const mainColor = isBoss ? '#fde047' : material === 'wisp' ? '#a5f3fc' : '#6ee7b7';

  vfx.rings.push({
    x,
    y,
    r0: 10,
    r1: isBoss ? 195 : 105,
    w0: isBoss ? 6 : 4.2,
    color: mainColor,
    style: 'soul_burst',
    rot: Math.random() * Math.PI,
    vrot: 1.8,
    squashY: 1,
    life: isBoss ? 0.56 : 0.38,
    maxLife: isBoss ? 0.56 : 0.38,
  });

  vfx.rings.push({
    x,
    y,
    r0: 8,
    r1: isBoss ? 145 : 74,
    w0: isBoss ? 4.5 : 3,
    color: '#ffffff',
    style: isBoss ? 'rune_sigil' : 'chime_arcs',
    rot: Math.random() * Math.PI,
    vrot: -2.4,
    squashY: 0.85,
    life: isBoss ? 0.48 : 0.3,
    maxLife: isBoss ? 0.48 : 0.3,
  });

  vfx.flashes.push({
    x,
    y,
    color: mainColor,
    radius: isBoss ? 175 : 98,
    intensity: isBoss ? 0.85 : 0.65,
    life: isBoss ? 0.28 : 0.19,
    maxLife: isBoss ? 0.28 : 0.19,
  });

  vfx.scars.push({
    x,
    y,
    angle: -0.35,
    length: isBoss ? 185 : 105,
    thickness: isBoss ? 12 : 8,
    color: mainColor,
    coreColor: '#ffffff',
    crossFlare: true,
    starPoints: 6,
    starRadius: isBoss ? 78 : 44,
    life: isBoss ? 0.34 : 0.24,
    maxLife: isBoss ? 0.34 : 0.24,
  });

  const wispCount = isBoss ? 32 : 15;
  for (let i = 0; i < wispCount; i++) {
    const a = (i / wispCount) * Math.PI * 2 + Math.random() * 0.4;
    const spd = 40 + Math.random() * (isBoss ? 180 : 105);
    const maxLife = 0.65 + Math.random() * 0.65;
    vfx.wisps.push({
      x: x + Math.cos(a) * (Math.random() * 18),
      y: y + Math.sin(a) * (Math.random() * 18),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd * 0.5 - (70 + Math.random() * 90),
      r: (isBoss ? 3.2 : 2.5) + Math.random() * 3.0,
      phase: Math.random() * Math.PI * 2,
      swirlAmp: 26 + Math.random() * 30,
      color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? mainColor : '#67e8f9',
      life: maxLife,
      maxLife,
    });
  }

  const inkCount = isBoss ? 22 : 12;
  for (let i = 0; i < inkCount; i++) {
    const a = (i / inkCount) * Math.PI * 2 + Math.random() * 0.3;
    const spd = 110 + Math.random() * (isBoss ? 240 : 160);
    const maxLife = 0.36 + Math.random() * 0.24;
    vfx.inkSplashes.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 60,
      r: 3.5 + Math.random() * 4.5,
      fill: '#081018',
      rim: mainColor,
      stretch: 1.8,
      gravity: 440,
      drag: 0.94,
      life: maxLife,
      maxLife,
    });
  }

  const shardCount = isBoss ? 26 : 12;
  for (let i = 0; i < shardCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 90 + Math.random() * (isBoss ? 270 : 190);
    const size = (isBoss ? 6 : 4.5) + Math.random() * 5.5;
    const isBronze = material === 'wisp' || (isBoss && i % 2 === 0);
    const maxLife = 0.6 + Math.random() * 0.45;
    vfx.shards.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y + (Math.random() - 0.5) * 24,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 140,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 16,
      size,
      kind: isBronze ? 'bronze' : material === 'beetle' && i % 3 === 0 ? 'moss' : 'stone',
      color: isBronze ? '#8f723f' : material === 'beetle' && i % 3 === 0 ? '#527a57' : '#4a6566',
      highlight: isBronze ? '#fef08a' : '#a7f3d0',
      points: createPolygonPoints(isBronze ? 4 : 5, size),
      bounced: false,
      life: maxLife,
      maxLife,
    });
  }
}

export function spawnPropHitVfx(
  vfx: VfxBucket,
  x: number,
  y: number,
  dir: 1 | -1,
  mat: 'wood' | 'stone'
): void {
  const color = mat === 'wood' ? '#e6c687' : '#cbd5e1';
  vfx.scars.push({
    x,
    y,
    angle: dir > 0 ? -0.4 : Math.PI + 0.4,
    length: 44,
    thickness: 4.5,
    color,
    coreColor: '#ffffff',
    crossFlare: false,
    starPoints: 4,
    starRadius: 16,
    life: 0.13,
    maxLife: 0.13,
  });
  vfx.rings.push({
    x,
    y,
    r0: 4,
    r1: 32,
    w0: 2.2,
    color,
    style: 'solid',
    rot: 0,
    vrot: 0,
    squashY: 1,
    life: 0.15,
    maxLife: 0.15,
  });
  for (let i = 0; i < 6; i++) {
    const ang = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.5;
    const spd = 120 + Math.random() * 170;
    const maxLife = 0.18 + Math.random() * 0.12;
    vfx.sparks.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 45,
      gravity: 500,
      drag: 0.93,
      width: 1.8,
      color,
      coreColor: '#ffffff',
      canBounce: false,
      bounced: false,
      trail: [{ x, y }],
      life: maxLife,
      maxLife,
    });
  }
}

export function spawnPropBreakShards(
  vfx: VfxBucket,
  x: number,
  y: number,
  count: number,
  mat: 'wood' | 'stone'
): void {
  for (let i = 0; i < count; i++) {
    const size = 4 + Math.random() * 5.5;
    const maxLife = 0.45 + Math.random() * 0.35;
    vfx.shards.push({
      x: x + (Math.random() - 0.5) * 22,
      y: y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 240,
      vy: -120 - Math.random() * 200,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 12,
      size,
      kind: mat === 'wood' ? 'wood' : 'stone',
      color: mat === 'wood' ? '#7c5230' : '#526570',
      highlight: mat === 'wood' ? '#d4a373' : '#94a3b8',
      points: createPolygonPoints(mat === 'wood' ? 4 : 5, size),
      bounced: false,
      life: maxLife,
      maxLife,
    });
  }
}

export function spawnDashVfx(vfx: VfxBucket, x: number, y: number, dir: 1 | -1): void {
  vfx.rings.push({
    x: x - dir * 8,
    y: y - 28,
    r0: 6,
    r1: 38,
    w0: 2.8,
    color: '#a5f3fc',
    style: 'chime_arcs',
    rot: 0,
    vrot: dir * 2.2,
    squashY: 1.25,
    life: 0.2,
    maxLife: 0.2,
  });
  for (let i = 0; i < 8; i++) {
    vfx.streaks.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y - 10 - Math.random() * 44,
      vx: -dir * (240 + Math.random() * 240),
      len: 22 + Math.random() * 34,
      color: i % 3 === 0 ? '#ffffff' : '#67e8f9',
      life: 0.16 + Math.random() * 0.1,
      maxLife: 0.26,
    });
  }
}

export function updateAllHitVfx(vfx: VfxBucket, dt: number, isHitStop = false, player?: Player): void {
  if (isHitStop) {
    for (let i = vfx.flashes.length - 1; i >= 0; i--) {
      vfx.flashes[i].life -= dt * 0.25;
      if (vfx.flashes[i].life <= 0) vfx.flashes.splice(i, 1);
    }
    return;
  }

  for (let i = vfx.slashes.length - 1; i >= 0; i--) {
    const sl = vfx.slashes[i];
    sl.life -= dt;
    if (sl.followPlayer && player && sl.life > sl.maxLife * 0.5) {
      sl.x = player.x + (sl.offsetX ?? 0);
      sl.y = player.y + (sl.offsetY ?? 0);
    }
    if (sl.life <= 0) vfx.slashes.splice(i, 1);
  }

  for (let i = vfx.scars.length - 1; i >= 0; i--) {
    vfx.scars[i].life -= dt;
    if (vfx.scars[i].life <= 0) vfx.scars.splice(i, 1);
  }

  for (let i = vfx.flashes.length - 1; i >= 0; i--) {
    vfx.flashes[i].life -= dt;
    if (vfx.flashes[i].life <= 0) vfx.flashes.splice(i, 1);
  }

  for (let i = vfx.rings.length - 1; i >= 0; i--) {
    const r = vfx.rings[i];
    r.life -= dt;
    r.rot += r.vrot * dt;
    if (r.life <= 0) vfx.rings.splice(i, 1);
  }

  for (let i = vfx.sparks.length - 1; i >= 0; i--) {
    const s = vfx.sparks[i];
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const damp = Math.pow(s.drag, dt * 60);
    s.vx *= damp;
    s.vy = s.vy * damp + s.gravity * dt;

    if (s.canBounce && !s.bounced && s.y >= FLOOR_Y - 2 && s.vy > 0) {
      s.y = FLOOR_Y - 2;
      s.vy = -Math.abs(s.vy) * 0.44;
      s.vx *= 0.72;
      s.bounced = true;
    }

    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 6) s.trail.shift();
    if (s.life <= 0) vfx.sparks.splice(i, 1);
  }

  for (let i = vfx.inkSplashes.length - 1; i >= 0; i--) {
    const d = vfx.inkSplashes[i];
    d.life -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const damp = Math.pow(d.drag, dt * 60);
    d.vx *= damp;
    d.vy = d.vy * damp + d.gravity * dt;
    if (d.life <= 0) vfx.inkSplashes.splice(i, 1);
  }

  for (let i = vfx.shards.length - 1; i >= 0; i--) {
    const sh = vfx.shards[i];
    sh.life -= dt;
    if (sh.kind === 'scale' || sh.kind === 'moss') {
      sh.vy = Math.min(95, sh.vy + 210 * dt);
      sh.vx = lerp(sh.vx, Math.sin(sh.life * 14 + sh.rot) * 42, Math.min(1, dt * 3.5));
    } else {
      sh.vy += 760 * dt;
    }
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    sh.rot += sh.vrot * dt;

    if (!sh.bounced && sh.kind !== 'scale' && sh.y >= FLOOR_Y - 2 && sh.vy > 0) {
      sh.y = FLOOR_Y - 2;
      sh.vy = -Math.abs(sh.vy) * 0.36;
      sh.vx *= 0.62;
      sh.vrot *= 0.55;
      sh.bounced = true;
    }

    if (sh.life <= 0) vfx.shards.splice(i, 1);
  }

  for (let i = vfx.wisps.length - 1; i >= 0; i--) {
    const w = vfx.wisps[i];
    w.life -= dt;
    w.phase += dt * 7.5;
    w.vx *= Math.pow(0.95, dt * 60);
    w.x += (w.vx + Math.sin(w.phase) * w.swirlAmp) * dt;
    w.y += w.vy * dt;
    if (w.life <= 0) vfx.wisps.splice(i, 1);
  }

  for (let i = vfx.hitGhosts.length - 1; i >= 0; i--) {
    const g = vfx.hitGhosts[i];
    g.life -= dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vx *= Math.pow(0.86, dt * 60);
    if (g.life <= 0) vfx.hitGhosts.splice(i, 1);
  }

  for (let i = vfx.dust.length - 1; i >= 0; i--) {
    const d = vfx.dust[i];
    d.life -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.life <= 0) vfx.dust.splice(i, 1);
  }

  for (let i = vfx.streaks.length - 1; i >= 0; i--) {
    const st = vfx.streaks[i];
    st.life -= dt;
    st.x += st.vx * dt;
    st.vx *= Math.pow(0.9, dt * 60);
    if (st.life <= 0) vfx.streaks.splice(i, 1);
  }

  for (let i = vfx.dmgNums.length - 1; i >= 0; i--) {
    const n = vfx.dmgNums[i];
    n.life -= dt;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.vx *= Math.pow(0.96, dt * 60);
    n.vy += 290 * dt;
    if (n.life <= 0) vfx.dmgNums.splice(i, 1);
  }

  for (let i = vfx.afterimages.length - 1; i >= 0; i--) {
    vfx.afterimages[i].life -= dt;
    if (vfx.afterimages[i].life <= 0) vfx.afterimages.splice(i, 1);
  }
}

export function drawMonsterHitGhosts(ctx: CanvasRenderingContext2D, ghosts: HitGhostVfx[]): void {
  for (const g of ghosts) {
    const ratio = clamp(g.life / g.maxLife, 0, 1);
    const alpha = Easing.easeOutQuad(ratio) * 0.62;
    const sheet = AssetManager.get(g.sheetKey);
    const tintHex = g.color === 'gold' ? '#fde047' : '#67e8f9';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.translate(g.x, g.y);

    if (sheet && sheet.frames && sheet.frames.length > 0) {
      const f = sheet.frames[g.frameIdx % sheet.frames.length];
      const scale = g.targetH / Math.max(1, sheet.refH || f.h);
      const drawH = f.h * scale;
      const drawW = f.w * scale;
      const anchorX = (f.anchorX ?? f.w * 0.5) * scale;
      const liftY = g.kind === 'wisp' ? 0 : (f.footLift ?? 0) * scale;
      ctx.scale(g.facing, 1);
      ctx.shadowColor = tintHex;
      ctx.shadowBlur = 12;
      const tintCanvas = g.color === 'gold' ? f.gold : f.cyan;
      const drawY = g.kind === 'wisp' ? -g.targetH * 0.5 - drawH * 0.5 : -drawH - liftY;
      ctx.drawImage(tintCanvas, -anchorX, drawY, drawW, drawH);
    } else {
      ctx.scale(g.facing, 1);
      ctx.fillStyle = tintHex;
      ctx.shadowColor = tintHex;
      ctx.shadowBlur = 14;
      if (g.kind === 'beetle') {
        ctx.beginPath();
        ctx.arc(0, -16, 25, Math.PI, 0);
        ctx.ellipse(0, -14, 24, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (g.kind === 'wisp') {
        ctx.beginPath();
        ctx.arc(0, -24, 15, Math.PI, 0);
        ctx.lineTo(17, -10);
        ctx.lineTo(-17, -10);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.lineTo(-42, -88);
        ctx.lineTo(42, -88);
        ctx.lineTo(36, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -96, 32, Math.PI, 0);
        ctx.lineTo(38, -66);
        ctx.lineTo(-38, -66);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/**
 * Fast-Slow frame mapping for 6-frame sword slash VFX sheets:
 * - Frames 0, 1, 2 whip rapidly during the first 38% of duration (snappy strike)
 * - Frames 3, 4, 5 linger gracefully across the remaining 62% (smoky ember dissipate)
 */
function pickSlashFrameIndex(progress: number, totalFrames: number): number {
  if (totalFrames <= 1) return 0;
  const p = clamp(progress, 0, 0.999);
  if (totalFrames === 6) {
    if (p < 0.11) return 0;
    if (p < 0.24) return 1;
    if (p < 0.4) return 2;
    if (p < 0.6) return 3;
    if (p < 0.8) return 4;
    return 5;
  }
  return clamp(Math.floor(Easing.easeOutQuad(p) * totalFrames), 0, totalFrames - 1);
}

export function drawEnhancedHitVfx(ctx: CanvasRenderingContext2D, vfx: VfxBucket): void {
  // Layer 1: Localized additive impact glow flashes
  for (const f of vfx.flashes) {
    const t = clamp(f.life / f.maxLife, 0, 1);
    const rad = f.radius * lerp(1.18, 0.72, t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, rad);
    g.addColorStop(0, `rgba(255, 255, 255, ${f.intensity * t})`);
    g.addColorStop(0.35, f.color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = f.intensity * t;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Layer 1.5: Dash & wind speed streaks
  for (const st of vfx.streaks) {
    const a = clamp(st.life / st.maxLife, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.78;
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 2.2 * a;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(st.x, st.y);
    ctx.lineTo(st.x - Math.sign(st.vx) * st.len * a, st.y);
    ctx.stroke();
    ctx.restore();
  }

  // Layer 2: 3-Hit Animated Sprite-Sheet Sword Slash VFX (with procedural fallback for Boss/unloaded)
  for (const s of vfx.slashes) {
    const progress = clamp(1 - s.life / s.maxLife, 0, 1);
    const alpha = progress > 0.78 ? clamp((1 - progress) / 0.22, 0, 1) : 1;
    const sheetKey = s.isBoss
      ? 'vfx_slash_3'
      : s.step === 1
        ? 'vfx_slash_1'
        : s.step === 2
          ? 'vfx_slash_2'
          : 'vfx_slash_3';
    const sheet = AssetManager.get(sheetKey);

    if (sheet && sheet.frames && sheet.frames.length > 0) {
      const fIdx = pickSlashFrameIndex(progress, sheet.frames.length);
      const frame = sheet.frames[fIdx];
      const baseSize = s.isBoss ? s.radius * 2.55 : s.step === 3 ? 210 : 158;
      const aspect = frame.w / Math.max(1, frame.h);
      const drawH = baseSize;
      const drawW = baseSize * aspect;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.translate(s.x, s.y);
      ctx.scale(s.facing, 1);
      // Slight subtle pop-in scale on the early fast frames
      const scalePop = progress < 0.25 ? lerp(0.88, 1.04, Easing.easeOutQuad(progress / 0.25)) : 1.04;
      ctx.scale(scalePop, scalePop);
      ctx.drawImage(frame.canvas, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();
    } else {
      const a = clamp(s.life / s.maxLife, 0, 1);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.facing, s.step === 2 ? -1 : 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = s.step === 3 ? '#fde047' : '#67e8f9';
      ctx.shadowBlur = s.step === 3 ? 18 : 11;
      ctx.strokeStyle =
        s.step === 3
          ? `rgba(253, 224, 71, ${a})`
          : s.step === 2
            ? `rgba(125, 211, 252, ${a})`
            : `rgba(103, 232, 249, ${a})`;
      ctx.lineWidth = (s.step === 3 ? 18 : 12) * a;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, -1.35, 1.05);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
      ctx.lineWidth = (s.step === 3 ? 5.5 : 4) * a;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius - 2, -1.2, 0.9);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Layer 3: Dust motes
  for (const d of vfx.dust) {
    ctx.globalAlpha = clamp(d.life / d.maxLife, 0, 1);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Layer 4: Faceted shards
  for (const sh of vfx.shards) {
    const a = clamp((sh.life / sh.maxLife) * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.rot);
    if (sh.glow) {
      ctx.shadowColor = sh.glow;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    sh.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = sh.color;
    ctx.fill();
    if (sh.points.length >= 2) {
      ctx.strokeStyle = sh.highlight;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(sh.points[0].x, sh.points[0].y);
      ctx.lineTo(sh.points[1].x, sh.points[1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Layer 5: Dark fairy-tale ink/ichor droplets
  for (const d of vfx.inkSplashes) {
    const ratio = clamp(d.life / d.maxLife, 0, 1);
    const ang = Math.atan2(d.vy, d.vx);
    const speed = Math.hypot(d.vx, d.vy);
    const sx = 1 + Math.min(1.6, (speed / 240) * (d.stretch - 1));
    const sy = 1 / Math.sqrt(sx);

    ctx.save();
    ctx.globalAlpha = clamp(ratio * 1.4, 0, 1);
    ctx.translate(d.x, d.y);
    ctx.rotate(ang);
    ctx.scale(sx, sy);
    ctx.fillStyle = d.fill;
    ctx.strokeStyle = d.rim;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, d.r * (0.45 + 0.55 * ratio), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Layer 6: Shockwave rings
  for (const r of vfx.rings) {
    const t = 1 - r.life / r.maxLife;
    const ease = Easing.easeOutCubic(t);
    const rad = lerp(r.r0, r.r1, ease);
    const alpha = Math.pow(1 - t, 1.15);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(r.x, r.y);
    ctx.scale(1, r.squashY);
    ctx.rotate(r.rot);
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 10;

    if (r.style === 'solid') {
      ctx.lineWidth = Math.max(0.7, r.w0 * (1 - t));
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
    } else if (r.style === 'chime_arcs') {
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.8, r.w0 * (1 - t * 0.85));
      for (let k = 0; k < 3; k++) {
        const a0 = (k * Math.PI * 2) / 3 + 0.2;
        const a1 = a0 + 1.15;
        ctx.beginPath();
        ctx.arc(0, 0, rad, a0, a1);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(0.6, r.w0 * 0.45 * (1 - t));
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.72, 0.5, 2.3);
      ctx.stroke();
    } else if (r.style === 'rune_sigil') {
      ctx.lineWidth = Math.max(0.9, r.w0 * (1 - t * 0.8));
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = Math.max(0.6, r.w0 * 0.5 * (1 - t));
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.76, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rad * 0.76, Math.sin(a) * rad * 0.76);
        ctx.lineTo(Math.cos(a) * rad * 1.04, Math.sin(a) * rad * 1.04);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = Math.max(1, r.w0 * (1 - t));
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rad * 0.55, Math.sin(a) * rad * 0.55);
        ctx.lineTo(Math.cos(a) * rad * 1.16, Math.sin(a) * rad * 1.16);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Layer 7: Swirling soul wisps
  for (const w of vfx.wisps) {
    const a = clamp((w.life / w.maxLife) * 1.35, 0, 1);
    const rad = w.r * (0.45 + 0.55 * (w.life / w.maxLife));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(w.x, w.y, 0.5, w.x, w.y, rad * 2.8);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, w.color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w.x, w.y, rad * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Layer 8: Curved ribbon sparks
  for (const s of vfx.sparks) {
    const a = clamp(s.life / s.maxLife, 0, 1);
    if (s.trail.length < 2) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = s.color;
    ctx.globalAlpha = a * 0.9;
    ctx.lineWidth = Math.max(0.8, s.width * a);
    ctx.beginPath();
    s.trail.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    const last = s.trail[s.trail.length - 1];
    const prev = s.trail[s.trail.length - 2];
    ctx.strokeStyle = s.coreColor;
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(0.6, s.width * 0.48 * a);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  // Layer 9: Impact scars & starbursts
  for (const sc of vfx.scars) {
    const t = 1 - sc.life / sc.maxLife;
    const alpha = Math.pow(1 - t, 0.8);
    const len = sc.length * (0.45 + 0.65 * Easing.easeOutExpo(t));
    const thick = sc.thickness * Math.pow(1 - t, 1.35);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sc.x, sc.y);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = sc.color;
    ctx.shadowBlur = 14;

    ctx.save();
    ctx.rotate(sc.angle);
    ctx.fillStyle = sc.color;
    ctx.beginPath();
    ctx.moveTo(-len * 0.52, 0);
    ctx.quadraticCurveTo(0, -thick, len * 0.52, 0);
    ctx.quadraticCurveTo(0, thick, -len * 0.52, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = sc.coreColor;
    ctx.beginPath();
    ctx.moveTo(-len * 0.44, 0);
    ctx.quadraticCurveTo(0, -thick * 0.44, len * 0.44, 0);
    ctx.quadraticCurveTo(0, thick * 0.44, -len * 0.44, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const starR = sc.starRadius * (1 - t * 0.55);
    const innerR = starR * 0.14;
    ctx.fillStyle = sc.coreColor;
    ctx.beginPath();
    for (let i = 0; i < sc.starPoints * 2; i++) {
      const r = i % 2 === 0 ? starR : innerR;
      const a = (i * Math.PI) / sc.starPoints + sc.angle * 0.25;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    if (sc.crossFlare) {
      const needleLen = len * 1.15 * (1 - t * 0.3);
      const needleThick = Math.max(0.8, thick * 0.32);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-needleLen * 0.5, 0);
      ctx.quadraticCurveTo(0, -needleThick, needleLen * 0.5, 0);
      ctx.quadraticCurveTo(0, needleThick, -needleLen * 0.5, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // Layer 10: Dynamic damage / heal / parry numbers
  for (const n of vfx.dmgNums) {
    const progress = 1 - n.life / n.maxLife;
    const popScale =
      progress < 0.22
        ? lerp(0.55, n.isHeavy || n.isParry ? 1.28 : 1.08, Easing.easeOutBack(progress / 0.22))
        : lerp(n.isHeavy || n.isParry ? 1.18 : 1.0, 0.92, (progress - 0.22) / 0.78);
    const alpha = clamp((n.life / n.maxLife) * 1.55, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(n.x, n.y);
    ctx.rotate(n.tilt * (1 - progress * 0.5));
    ctx.scale(popScale, popScale);

    ctx.font =
      n.isHeavy || n.isParry
        ? '900 22px "JetBrains Mono", ui-monospace, monospace'
        : '800 16px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (n.isHeavy || n.isParry) {
      ctx.shadowColor = n.isParry ? '#67e8f9' : '#f59e0b';
      ctx.shadowBlur = 12;
    }

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#091118';
    ctx.strokeText(n.text, 0, 0);

    ctx.fillStyle = n.isParry
      ? '#67e8f9'
      : n.isHeal
        ? '#86efac'
        : n.isHeavy
          ? '#fde047'
          : n.comboStep === 2
            ? '#bae6fd'
            : '#f8fafc';
    ctx.fillText(n.text, 0, 0);
    ctx.restore();
  }
}
