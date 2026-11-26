import type { ModalSnapshot } from '../game/types';

interface GameModalProps {
  modal: ModalSnapshot;
  onPrimary: () => void;
  onBossWarp: () => void;
}

export function GameModal({ modal, onPrimary, onBossWarp }: GameModalProps) {
  if (!modal.visible) return null;

  const isVictory = modal.mode === 'victory';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-modal-title"
      className="absolute inset-0 z-25 flex items-center justify-center bg-[#04090e]/82 p-4 backdrop-blur-sm"
    >
      <div className="ruin-panel relative w-full max-w-[436px] overflow-hidden rounded-2xl border border-[#e6c687]/65 px-7 py-7 text-center">
        {/* 顶部鎏金微光线条 */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${
            isVictory ? 'via-[#fde047]' : 'via-[#f43f5e]'
          } to-transparent opacity-80`}
        />

        {/* 徽章等级印记 */}
        <div className="mx-auto mb-3.5 flex h-16 w-16 rotate-45 items-center justify-center border border-[#e6c687]/75 bg-[#09131b] shadow-[0_0_24px_rgba(230,198,135,0.22)]">
          <span
            className={`font-display -rotate-45 text-3xl font-extrabold ${
              isVictory
                ? 'text-[#fde047] drop-shadow-[0_0_12px_rgba(250,204,21,0.55)]'
                : 'text-[#fb7185] drop-shadow-[0_0_12px_rgba(244,63,94,0.55)]'
            }`}
          >
            {modal.rank}
          </span>
        </div>

        <h2
          id="game-modal-title"
          className="font-display mb-1.5 text-2xl font-extrabold tracking-[0.16em] text-[#ebd09a]"
        >
          {modal.title}
        </h2>
        <p className="mx-auto mb-6 max-w-[32ch] text-[13px] leading-relaxed text-[#9bb3bc]">
          {modal.subtitle}
        </p>

        {/* 简洁无嵌套数据分隔栏 */}
        <div className="mb-6 grid grid-cols-3 divide-x divide-[#ceae72]/20 border-y border-[#ceae72]/20 py-3">
          <div className="px-2">
            <div className="mb-1 text-[11px] text-[#88a1ab]">收集金币</div>
            <div className="font-mono-num text-lg font-extrabold text-[#fef08a]">{modal.gold}</div>
          </div>
          <div className="px-2">
            <div className="mb-1 text-[11px] text-[#88a1ab]">剩余血量</div>
            <div className="font-mono-num text-lg font-extrabold text-[#f8fafc]">{modal.hp}</div>
          </div>
          <div className="px-2">
            <div className="mb-1 text-[11px] text-[#88a1ab]">通关耗时</div>
            <div className="font-mono-num text-lg font-extrabold text-[#cffafe]">
              {modal.timeSec}s
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onPrimary}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-[#67e8f9]/65 bg-gradient-to-b from-[#1a3a4a] to-[#102530] px-5 py-2 text-[13px] font-semibold text-[#ecfeff] shadow-[inset_0_1px_0_rgba(165,243,252,0.2)] transition-all duration-150 hover:border-[#67e8f9] hover:from-[#21485b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
          >
            {modal.primaryLabel}
          </button>
          <button
            type="button"
            onClick={onBossWarp}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-[#fbbf24]/55 bg-gradient-to-b from-[#2e2c1e] to-[#1a1a13] px-5 py-2 text-[13px] font-semibold text-[#fef3c7] shadow-[inset_0_1px_0_rgba(253,224,71,0.16)] transition-all duration-150 hover:border-[#fbbf24] hover:from-[#3a3724] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24]"
          >
            直达Boss房
          </button>
        </div>
      </div>
    </div>
  );
}
