import React, { useRef, useState } from 'react';
import { RotateCcw, Upload, X } from 'lucide-react';
import { AssetManager } from '../game/assetManager';
import { ASSET_SLOTS } from '../game/constants';
import type { AssetSlotDef, AssetTab, SheetGrid } from '../game/types';

interface AssetWorkshopProps {
  open: boolean;
  version: number;
}

const TABS: { id: AssetTab; label: string }[] = [
  { id: 'player', label: '主角动作帧 (4)' },
  { id: 'monsters', label: '三种怪物动作帧 (6)' },
  { id: 'vfx', label: '三段挥剑特效 (3)' },
  { id: 'env', label: '背景与地形装饰 (11)' },
  { id: 'props', label: '交互物、门与补给 (6)' },
];

interface AssetSlotCardProps {
  slot: AssetSlotDef;
  version: number;
}

function AssetSlotCard({ slot }: AssetSlotCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const loaded = AssetManager.get(slot.key);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) AssetManager.loadFile(slot.key, f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) AssetManager.loadFile(slot.key, f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col gap-2 rounded-[10px] p-2.5 transition-colors duration-150 ${
        dragOver
          ? 'border border-[#fde047] bg-[#172734]'
          : loaded
            ? 'border border-[#67e8f9]/60 bg-[#0e161e]'
            : 'border border-dashed border-[#ceae72]/35 bg-[#0e161e]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-semibold text-[#e2edf0]">{slot.name}</span>
        <span className="shrink-0 text-[11px] text-[#67e8f9]/85">{slot.tag}</span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="checkerboard-bg group flex h-[74px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[6px] p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6c687]"
      >
        {loaded?.previewUrl ? (
          <img
            src={loaded.previewUrl}
            alt={slot.name}
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-[11px] leading-snug text-[#7994a0] transition-colors group-hover:text-[#cfe2ea]">
            <Upload className="h-3.5 w-3.5 opacity-75" />
            <span>点击选图或拖入</span>
          </div>
        )}
      </button>

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[#8ea5ad]">
          {loaded ? loaded.status || '已生效' : '默认手绘'}
        </span>
        {loaded && (
          <button
            type="button"
            onClick={() => AssetManager.clearSlot(slot.key)}
            className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-[#fca5a5] transition-colors hover:bg-[#f87171]/15"
          >
            <X className="h-3 w-3" />
            清除
          </button>
        )}
      </div>
    </div>
  );
}

export function AssetWorkshop({ open, version }: AssetWorkshopProps) {
  const [activeTab, setActiveTab] = useState<AssetTab>('player');
  const [autoKey, setAutoKey] = useState(AssetManager.autoKey);
  const [tolerance, setTolerance] = useState(AssetManager.tolerance);
  const [grid, setGrid] = useState<SheetGrid>(AssetManager.grid);

  if (!open) return null;

  const visibleSlots = ASSET_SLOTS.filter((s) => s.tab === activeTab);

  return (
    <section
      aria-label="美术素材工坊"
      className="ruin-panel mt-3.5 w-full max-w-[1060px] rounded-xl border border-[#ceae72]/35 p-4"
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#ceae72]/20 pb-3">
        <div>
          <h2 className="font-display text-sm font-bold tracking-wider text-[#ebd09a]">
            美术素材工坊
          </h2>
          <p className="mt-0.5 text-xs text-[#8ea5ad]">
            支持点击选图或直接拖拽 PNG / JPG · 自动边缘去背、躯干重心对齐与受击青金残影烘焙
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9cb2ba]">
          <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              checked={autoKey}
              onChange={(e) => {
                setAutoKey(e.target.checked);
                AssetManager.setAutoKey(e.target.checked);
              }}
              className="accent-[#e6c687]"
            />
            智能边缘去背
          </label>

          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span>去背容差</span>
            <input
              type="range"
              min={10}
              max={85}
              value={tolerance}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTolerance(v);
                AssetManager.setTolerance(v, false);
              }}
              onMouseUp={() => AssetManager.rebuildAll()}
              onTouchEnd={() => AssetManager.rebuildAll()}
              className="w-20 accent-[#e6c687]"
            />
            <span className="font-mono-num w-6 text-right text-[#e2edf0]">{tolerance}</span>
          </label>

          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span>动作表网格</span>
            <select
              value={grid}
              onChange={(e) => {
                const next = e.target.value as SheetGrid;
                setGrid(next);
                AssetManager.setGrid(next);
              }}
              className="rounded-md border border-[#ceae72]/40 bg-[#0d161e] px-2 py-1 text-xs text-[#e2edf0] focus-visible:outline-2 focus-visible:outline-[#e6c687]"
            >
              <option value="2x5">2行 × 5列 (10帧)</option>
              <option value="2x4">2行 × 4列 (8帧)</option>
              <option value="1x4">1行 × 4列 (4帧)</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => AssetManager.clearAll()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#ceae72]/40 bg-[#172530] px-3 py-1.5 text-xs font-semibold text-[#e2edf0] transition-colors hover:border-[#e6c687] hover:bg-[#1e3140]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#e6c687]" />
            恢复内置美术包
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-[#e6c687] bg-[#1c3140] text-[#e6c687]'
                  : 'border-[#94a3b8]/25 bg-[#0f1922] text-[#8ea5ad] hover:border-[#ceae72]/45 hover:text-[#e2edf0]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleSlots.map((slot) => (
          <AssetSlotCard key={slot.key} slot={slot} version={version} />
        ))}
      </div>
    </section>
  );
}
