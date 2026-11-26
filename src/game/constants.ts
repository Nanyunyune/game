import type { AssetSlotDef, ComboStepConfig } from './types';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const FLOOR_Y = 440;
export const WORLD_W = 7060;
export const BOSS_ARENA_LEFT = 6020;
export const BOSS_ARENA_RIGHT = 6990;
export const BOSS_TRIGGER_X = 6135;

export const BUILTIN_SLASH_VFX_URLS: Record<'vfx_slash_1' | 'vfx_slash_2' | 'vfx_slash_3', string> = {
  vfx_slash_1: '/assets/aistudio/05549360fb699cb36b7f673d9fae44ec_7e1f6d4c.png',
  vfx_slash_2: '/assets/aistudio/be7fe2a09e805f6f5f8f7149fd57b90e_3c125a5f.png',
  vfx_slash_3: '/assets/aistudio/d756120f867a4a7c3217b68a307bd171_66390bac.png',
};

export const BUILTIN_ASSET_URLS: Record<string, string> = {
  // 主角动作帧 (4)
  player_idle: '/assets/aistudio/_____6c04474a.PNG',
  player_run: '/assets/aistudio/_____88e77bc9.PNG',
  player_attack: '/assets/aistudio/_____b8c60169.PNG',
  player_dash: '/src/assets/images/player_dash_sprite_1795720347258.jpg',
  // 三种怪物动作帧 (6)
  beetle_walk: '/assets/aistudio/_______91edd28b.PNG',
  beetle_attack: '/assets/aistudio/_______602e5b48.PNG',
  wisp_walk: '/assets/aistudio/_______8e22bc80.PNG',
  wisp_attack: '/assets/aistudio/_______02d59474.PNG',
  boss_walk: '/assets/aistudio/_______b630c2d2.PNG',
  boss_attack: '/assets/aistudio/_______720ac443.PNG',
  // 三段挥剑特效 (3)
  ...BUILTIN_SLASH_VFX_URLS,
  // 背景、地形台阶与圣殿装饰 (10)
  bg_forest: '/assets/aistudio/_____9ed5d6e3.png',
  tile_ground: '/assets/aistudio/_____69b7cdfd.PNG',
  tile_solid: '/assets/aistudio/_____6237f131.PNG',
  tile_suspend: '/assets/aistudio/_____40a67e37.PNG',
  tile_oneway: '/src/assets/images/tile_oneway_iron_platform_1795720344448.jpg',
  tile_fragile: '/assets/aistudio/_______7b08a2a6.png',
  tile_shrine: '/assets/aistudio/_______cce0c5f2.PNG',
  tile_boss_altar: '/src/assets/images/tile_boss_rune_altar_platform_1795720349983.jpg',
  decor_boss_pillar: '/assets/aistudio/Boss______2a615e44.PNG',
  decor_boss_bell: '/src/assets/images/decor_boss_sanctuary_bell_1795720350372.jpg',
  // 交互物、机关门与补给 (6)
  prop_crate: '/assets/aistudio/___7e5a6f8a.PNG',
  prop_pot: '/assets/aistudio/______9fc12397.PNG',
  prop_fruit: '/assets/aistudio/_____fa7e3633.PNG',
  gate_boss: '/src/assets/images/gate_boss_stone_portcullis_1795720346821.jpg',
  gate_exit_closed: '/assets/aistudio/__________cd054265.PNG',
  gate_exit_open: '/assets/aistudio/__________aaefd125.PNG',
};

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const rectsOverlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const Easing = {
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInQuad: (t: number) => t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t: number) => t * t * t,
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/**
 * Deliberate Slow-Fast-Slow (慢蓄力 → 疾速挥斩 → 慢收招) 3-hit combo pacing
 */
export const COMBO_CFG: Record<1 | 2 | 3, ComboStepConfig> = {
  1: {
    windup: 0.11,
    slash: 0.08,
    recovery: 0.21,
    damage: 10,
    isHeavy: false,
    knockback: 190,
    radius: 58,
    hitStop: 0.06,
    shakeAmp: 4.8,
    shakeDur: 0.14,
    slashVfxDur: 0.28,
  },
  2: {
    windup: 0.105,
    slash: 0.08,
    recovery: 0.22,
    damage: 12,
    isHeavy: false,
    knockback: 220,
    radius: 62,
    hitStop: 0.068,
    shakeAmp: 5.6,
    shakeDur: 0.16,
    slashVfxDur: 0.29,
  },
  3: {
    windup: 0.285,
    slash: 0.09,
    recovery: 0.32,
    damage: 26,
    isHeavy: true,
    knockback: 325,
    radius: 82,
    hitStop: 0.14,
    shakeAmp: 10.2,
    shakeDur: 0.28,
    slashVfxDur: 0.38,
  },
};

export const ASSET_SLOTS: AssetSlotDef[] = [
  // 主角动作帧 (4)
  { key: 'player_idle', tab: 'player', name: '主角 · 待机', tag: '动作表', kind: 'sheet' },
  { key: 'player_run', tab: 'player', name: '主角 · 行走', tag: '动作表', kind: 'sheet' },
  { key: 'player_attack', tab: 'player', name: '主角 · 攻击', tag: '动作表', kind: 'sheet' },
  { key: 'player_dash', tab: 'player', name: '主角 · 冲刺剪影(可选)', tag: '单图', kind: 'single' },
  // 三种怪物动作帧 (6)
  { key: 'beetle_walk', tab: 'monsters', name: '苔石甲虫 · 行走', tag: '动作表', kind: 'sheet' },
  { key: 'beetle_attack', tab: 'monsters', name: '苔石甲虫 · 冲撞', tag: '动作表', kind: 'sheet' },
  { key: 'wisp_walk', tab: 'monsters', name: '残铃浮灵 · 悬浮', tag: '动作表', kind: 'sheet' },
  { key: 'wisp_attack', tab: 'monsters', name: '残铃浮灵 · 攻击', tag: '动作表', kind: 'sheet' },
  { key: 'boss_walk', tab: 'monsters', name: '朽钟巨像 · 重步', tag: '动作表', kind: 'sheet' },
  { key: 'boss_attack', tab: 'monsters', name: '朽钟巨像 · 攻击', tag: '动作表', kind: 'sheet' },
  // 挥剑三段刀光特效 (3)
  { key: 'vfx_slash_1', tab: 'vfx', name: '一段斩 · 青焰下劈 (2×3)', tag: '6帧特效', kind: 'vfx_2x3' },
  { key: 'vfx_slash_2', tab: 'vfx', name: '二段斩 · 灵弧逆挑 (2×3)', tag: '6帧特效', kind: 'vfx_2x3' },
  { key: 'vfx_slash_3', tab: 'vfx', name: '三段斩 · 烈焰金月 (2×3)', tag: '6帧特效', kind: 'vfx_2x3' },
  // 背景与地形台阶 (11) - 已移除楼梯槽位，新增 Boss 圣殿柱/悬钟/符文圣坛台
  { key: 'bg_forest', tab: 'env', name: '森林遗迹 · 游戏背景', tag: '背景图', kind: 'bg' },
  { key: 'tile_sheet_2x3', tab: 'env', name: '一键导入 2×3 台阶合集', tag: '自动切6', kind: 'batch_tiles' },
  { key: 'tile_ground', tab: 'env', name: '基础平地（主干道）', tag: '平铺', kind: 'single' },
  { key: 'tile_solid', tab: 'env', name: '实心台阶（独立高台）', tag: '台阶', kind: 'single' },
  { key: 'tile_suspend', tab: 'env', name: '悬浮跳台', tag: '跳台', kind: 'single', removeInteriorWhite: true },
  { key: 'tile_oneway', tab: 'env', name: '单向铁艺踏板', tag: '单向板', kind: 'single', removeInteriorWhite: true },
  { key: 'tile_fragile', tab: 'env', name: '易碎再生地块', tag: '易碎台', kind: 'single', removeInteriorWhite: true },
  { key: 'tile_shrine', tab: 'env', name: '回血祭坛石台', tag: '祭坛', kind: 'single', maskCornerWatermark: true },
  { key: 'tile_boss_altar', tab: 'env', name: 'Boss 二阶段符文圣坛台', tag: 'Boss台', kind: 'single', removeInteriorWhite: true },
  { key: 'decor_boss_pillar', tab: 'env', name: '遗迹藤蔓石柱', tag: '装饰柱', kind: 'single', removeInteriorWhite: true },
  { key: 'decor_boss_bell', tab: 'env', name: '圣殿青铜悬钟', tag: '悬钟', kind: 'single', removeInteriorWhite: true },
  // 交互物、门与补给 (6)
  { key: 'prop_crate', tab: 'props', name: '可推/击碎木箱', tag: '交互物', kind: 'single' },
  { key: 'prop_pot', tab: 'props', name: '遗迹石罐子', tag: '交互物', kind: 'single' },
  { key: 'prop_fruit', tab: 'props', name: '回血果实（孢子果）', tag: '补给', kind: 'single' },
  { key: 'gate_boss', tab: 'props', name: 'Boss 战砸落石门', tag: '机关门', kind: 'single', removeInteriorWhite: true },
  { key: 'gate_exit_closed', tab: 'props', name: '通关之门（封锁态）', tag: '关底门', kind: 'single', removeInteriorWhite: true },
  { key: 'gate_exit_open', tab: 'props', name: '通关之门（开启态）', tag: '关底门', kind: 'single' },
];
