import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Palette, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { AssetWorkshop } from './components/AssetWorkshop';
import { GameModal } from './components/GameModal';
import { AssetManager } from './game/assetManager';
import { AudioSys } from './game/audio';
import { VIEW_H, VIEW_W } from './game/constants';
import { RuinsBladeEngine } from './game/engine';
import type { InputKeys, ModalSnapshot } from './game/types';

const INITIAL_MODAL: ModalSnapshot = {
  visible: false,
  mode: 'victory',
  rank: 'S',
  title: '',
  subtitle: '',
  gold: 0,
  hp: 100,
  timeSec: 0,
  primaryLabel: '再次挑战',
};

function CornerFiligree({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 28"
      fill="none"
      className={`pointer-events-none absolute h-6 w-6 text-[#e6c687]/75 ${className}`}
    >
      <path d="M2 26V8C2 4.686 4.686 2 8 2H26" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 20V10C6 7.79 7.79 6 10 6H20" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.45" />
      <path d="M6 6L10.5 10.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.55" />
      <rect x="4.5" y="4.5" width="3" height="3" transform="rotate(45 6 6)" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RuinsBladeEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [assetVersion, setAssetVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [modal, setModal] = useState<ModalSnapshot>(INITIAL_MODAL);

  const showToast = useCallback((msg: string, duration = 2200) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, duration);
  }, []);

  useEffect(() => {
    AssetManager.setToastHandler(showToast);
    const unsubscribe = AssetManager.subscribe(() => {
      setAssetVersion(AssetManager.getVersion());
    });
    return () => {
      unsubscribe();
      AssetManager.setToastHandler(null);
    };
  }, [showToast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new RuinsBladeEngine(canvas, {
      onToast: showToast,
      onModalChange: setModal,
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [showToast]);

  const toggleSound = () => {
    const next = !soundEnabled;
    AudioSys.enabled = next;
    setSoundEnabled(next);
    if (next) AudioSys.unlock();
  };

  const handleTouchHold = (prop: keyof InputKeys, active: boolean) => {
    engineRef.current?.setTouchHold(prop, active);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center px-4 pt-3.5 pb-8">
      {/* 顶部三区导航条 */}
      <header className="ruin-panel mb-3 flex w-full max-w-[1060px] items-center justify-between gap-6 rounded-xl border border-[#ceae72]/35 px-4 py-2.5">
        {/* 左区：游戏徽标标题 */}
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rotate-45 border border-[#e6c687] bg-[#67e8f9]/30 shadow-[0_0_8px_rgba(103,232,249,0.5)]"
          />
          <h1 className="font-display whitespace-nowrap text-base font-bold tracking-[0.14em] text-[#ebd09a]">
            遗迹剑影
          </h1>
        </div>

        {/* 中区：简洁操作键位指南 */}
        <div className="hidden flex-1 items-center justify-center gap-3 overflow-hidden text-xs text-[#9cb3bc] lg:flex">
          <span className="whitespace-nowrap">
            <kbd className="rounded border border-[#ceae72]/35 bg-[#0c161e] px-1.5 py-0.5 font-mono-num text-[11px] font-semibold text-[#ebd09a]">
              A/D
            </kbd>{' '}
            移动
          </span>
          <span aria-hidden="true" className="text-[#ceae72]/30">
            ·
          </span>
          <span className="whitespace-nowrap">
            <kbd className="rounded border border-[#ceae72]/35 bg-[#0c161e] px-1.5 py-0.5 font-mono-num text-[11px] font-semibold text-[#ebd09a]">
              W/Space
            </kbd>{' '}
            跳跃
          </span>
          <span aria-hidden="true" className="text-[#ceae72]/30">
            ·
          </span>
          <span className="whitespace-nowrap">
            <kbd className="rounded border border-[#ceae72]/35 bg-[#0c161e] px-1.5 py-0.5 font-mono-num text-[11px] font-semibold text-[#ebd09a]">
              J/左键
            </kbd>{' '}
            三连斩与弹反
          </span>
          <span aria-hidden="true" className="text-[#ceae72]/30">
            ·
          </span>
          <span className="whitespace-nowrap">
            <kbd className="rounded border border-[#ceae72]/35 bg-[#0c161e] px-1.5 py-0.5 font-mono-num text-[11px] font-semibold text-[#ebd09a]">
              Shift/右键
            </kbd>{' '}
            冲刺
          </span>
          <span aria-hidden="true" className="text-[#ceae72]/30">
            ·
          </span>
          <span className="whitespace-nowrap">
            <kbd className="rounded border border-[#ceae72]/35 bg-[#0c161e] px-1.5 py-0.5 font-mono-num text-[11px] font-semibold text-[#ebd09a]">
              S+跳
            </kbd>{' '}
            下穿
          </span>
        </div>

        {/* 右区：功能控制组 */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            className="ruin-btn inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#ceae72]/35 px-3 py-1.5 text-xs font-semibold text-[#e2edf0] transition-all duration-150 hover:border-[#e6c687] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6c687]"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-[#e6c687]" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-[#7c949e]" />
            )}
            {soundEnabled ? '音效开' : '静音'}
          </button>

          <button
            type="button"
            onClick={() => setWorkshopOpen((v) => !v)}
            aria-expanded={workshopOpen}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9] ${
              workshopOpen
                ? 'border-[#67e8f9] bg-[#163442] text-[#ecfeff] shadow-[0_0_16px_rgba(103,232,249,0.2)]'
                : 'ruin-btn border-[#67e8f9]/45 text-[#cffafe] hover:border-[#67e8f9]'
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-[#67e8f9]" />
            美术工坊
          </button>

          <button
            type="button"
            onClick={() => engineRef.current?.warpToBossCorridor()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#fbbf24]/50 bg-gradient-to-b from-[#2b2a1d] to-[#191a14] px-3 py-1.5 text-xs font-semibold text-[#fef3c7] shadow-[inset_0_1px_0_rgba(253,224,71,0.14)] transition-all duration-150 hover:border-[#fbbf24] hover:from-[#363422] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24]"
          >
            <Bell className="h-3.5 w-3.5 text-[#fbbf24]" />
            直达Boss房
          </button>

          <button
            type="button"
            onClick={() => engineRef.current?.buildLevel(true)}
            className="ruin-btn inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#ceae72]/35 px-3 py-1.5 text-xs font-semibold text-[#e2edf0] transition-all duration-150 hover:border-[#e6c687] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6c687]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#e6c687]" />
            重开本关
          </button>
        </div>
      </header>

      {/* 游戏主舞台（鎏金雕纹边框） */}
      <main className="relative aspect-[16/9] w-full max-w-[1060px] overflow-hidden rounded-[14px] border border-[#ceae72]/50 bg-[#050a0f] shadow-[0_24px_64px_rgba(0,0,0,0.72),0_0_0_1px_rgba(103,232,249,0.08),0_0_48px_rgba(20,56,68,0.22)]">
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="block h-full w-full cursor-crosshair touch-none"
        />

        {/* 四角鎏金雕纹饰角 */}
        <CornerFiligree className="top-1.5 left-1.5 z-10" />
        <CornerFiligree className="top-1.5 right-1.5 z-10 scale-x-[-1]" />
        <CornerFiligree className="bottom-1.5 left-1.5 z-10 scale-y-[-1]" />
        <CornerFiligree className="right-1.5 bottom-1.5 z-10 -scale-x-100 -scale-y-100" />

        {/* 居中卷轴提示吐司 */}
        <div
          aria-live="polite"
          className={`pointer-events-none absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap border-y border-[#e6c687]/60 bg-gradient-to-r from-[#071118]/15 via-[#091620]/92 to-[#071118]/15 px-6 py-1.5 text-[13px] font-semibold tracking-wider text-[#fef3c7] shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xs transition-all duration-200 ${
            toastVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
          }`}
        >
          <span aria-hidden="true" className="text-[10px] text-[#e6c687]">
            ✦
          </span>
          <span className="font-display">{toastMsg}</span>
          <span aria-hidden="true" className="text-[10px] text-[#e6c687]">
            ✦
          </span>
        </div>

        {/* 结算 / 阵亡弹窗 */}
        <GameModal
          modal={modal}
          onPrimary={() => engineRef.current?.handleModalPrimary()}
          onBossWarp={() => engineRef.current?.warpToBossCorridor()}
        />
      </main>

      {/* 窄屏底部操作提示（桌面端已集成在顶部） */}
      <div className="mt-2.5 flex w-full max-w-[1060px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#88a1ab] lg:hidden">
        <span>A/D 移动</span>
        <span aria-hidden="true">·</span>
        <span>W/Space 跳跃</span>
        <span aria-hidden="true">·</span>
        <span>J/左键 连斩弹反</span>
        <span aria-hidden="true">·</span>
        <span>Shift/右键 冲刺</span>
        <span aria-hidden="true">·</span>
        <span>S+跳 下穿</span>
      </div>

      {/* 移动端触控快捷条 */}
      <div className="mt-3 flex w-full max-w-[1060px] items-center justify-between gap-2.5 md:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouchHold('left', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouchHold('left', false);
            }}
            onTouchCancel={() => handleTouchHold('left', false)}
            className="ruin-btn h-12 min-w-[52px] touch-none rounded-xl border border-[#ceae72]/45 px-3 text-sm font-bold text-[#ebd09a] active:border-[#e6c687] active:text-white"
          >
            ◀
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouchHold('right', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouchHold('right', false);
            }}
            onTouchCancel={() => handleTouchHold('right', false)}
            className="ruin-btn h-12 min-w-[52px] touch-none rounded-xl border border-[#ceae72]/45 px-3 text-sm font-bold text-[#ebd09a] active:border-[#e6c687] active:text-white"
          >
            ▶
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouchHold('down', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouchHold('down', false);
            }}
            onTouchCancel={() => handleTouchHold('down', false)}
            className="ruin-btn h-12 min-w-[52px] touch-none rounded-xl border border-[#ceae72]/45 px-3 text-sm font-bold text-[#ebd09a] active:border-[#e6c687] active:text-white"
          >
            ▼
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouchHold('jumpHeld', true);
              engineRef.current?.triggerJump();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouchHold('jumpHeld', false);
            }}
            onTouchCancel={() => handleTouchHold('jumpHeld', false)}
            className="ruin-btn h-12 min-w-[52px] touch-none rounded-xl border border-[#ceae72]/45 px-3 text-sm font-bold text-[#ebd09a] active:border-[#e6c687] active:text-white"
          >
            跳
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              engineRef.current?.triggerDash();
            }}
            className="ruin-btn h-12 min-w-[54px] touch-none rounded-xl border border-[#ceae72]/45 px-3 text-sm font-bold text-[#ebd09a] active:border-[#e6c687] active:text-white"
          >
            冲刺
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              engineRef.current?.triggerAttack();
            }}
            className="h-12 min-w-[54px] touch-none rounded-xl border border-[#67e8f9]/55 bg-gradient-to-b from-[#173644] to-[#0f232d] px-3 text-sm font-bold text-[#cffafe] active:border-[#67e8f9] active:text-white"
          >
            斩击
          </button>
        </div>
      </div>

      {/* 可折叠美术素材工坊 */}
      <AssetWorkshop open={workshopOpen} version={assetVersion} />
    </div>
  );
}
