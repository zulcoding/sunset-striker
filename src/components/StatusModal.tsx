import type { GamePhase, RunSummary } from '../game/types';

interface StatusModalProps {
  phase: GamePhase;
  summary: RunSummary | null;
  levelCode: string;
  levelName: string;
  currentScore: number;
  currentWave: number;
  maxWaves: number;
  invertPitch: boolean;
  onToggleInvertPitch: () => void;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onTitle: () => void;
}

export function StatusModal({
  phase,
  summary,
  levelCode,
  levelName,
  currentScore,
  currentWave,
  maxWaves,
  invertPitch,
  onToggleInvertPitch,
  onResume,
  onRestart,
  onNextLevel,
  onTitle,
}: StatusModalProps) {
  if (phase !== 'paused' && phase !== 'gameover') {
    return null;
  }

  const isPaused = phase === 'paused';
  const isVictory = !isPaused && Boolean(summary?.victory);
  const canAdvance = isVictory && Boolean(summary?.hasNextLevel);
  const showBossRemaining = !isPaused && !isVictory && Boolean(summary && summary.bossHpRemaining > 0);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#120f1c]/75"
      role="dialog"
      aria-modal="true"
      aria-label={
        isPaused ? 'Sortie Paused' : isVictory ? 'Mission Accomplished' : 'Aircraft Downed'
      }
    >
      <div className="w-full max-w-md bg-[#1d192b] border-2 border-[#f4a456]/60 rounded p-6 pixel-panel text-[#fff5e1]">
        <div className="font-mono-hud text-xs tracking-wider text-[#f8b768] mb-1">
          {isPaused
            ? `${levelCode} · ${levelName.toUpperCase()} · W${currentWave}/${maxWaves}`
            : isVictory
              ? summary?.hasNextLevel
                ? `${summary.levelName.toUpperCase()} SECURED · NEXT SECTOR UNLOCKED`
                : 'CAMPAIGN COMPLETE · AEGIS-09 DESTROYED'
              : `SHOT DOWN · ${summary?.levelName.toUpperCase() ?? levelName.toUpperCase()} W${summary?.waveReached ?? currentWave}/${summary?.maxWaves ?? maxWaves}`}
        </div>

        <h2 className="font-pixel text-2xl text-[#fff5de] mb-5">
          {isPaused
            ? 'Sortie Paused'
            : isVictory
              ? canAdvance
                ? 'Mission Clear'
                : 'Campaign Clear'
              : 'Aircraft Down'}
        </h2>

        {/* Frozen tabular-nums telemetry tiles */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <div className="bg-[#14111f] border border-[#ffdf9e]/20 rounded p-3">
            <div className="font-mono-hud text-[10px] text-[#cbb898] mb-1">SCORE</div>
            <div className="font-mono-hud text-base font-bold text-[#fff4db]">
              {(summary?.score ?? currentScore).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#14111f] border border-[#ffdf9e]/20 rounded p-3">
            <div className="font-mono-hud text-[10px] text-[#cbb898] mb-1">
              {isPaused ? 'WAVE' : 'TARGETS'}
            </div>
            <div className="font-mono-hud text-base font-bold text-[#ffcf78]">
              {isPaused ? `${currentWave}/${maxWaves}` : `${summary?.kills ?? 0}`}
            </div>
          </div>
          <div className="bg-[#14111f] border border-[#ffdf9e]/20 rounded p-3">
            <div className="font-mono-hud text-[10px] text-[#cbb898] mb-1">
              {isVictory ? 'TIME' : showBossRemaining ? 'BOSS HP' : 'BEST'}
            </div>
            <div
              className={`font-mono-hud text-base font-bold ${
                showBossRemaining ? 'text-[#ff7d6e]' : 'text-[#7dffb2]'
              }`}
            >
              {isVictory
                ? `${summary?.elapsedSeconds ?? 0}s`
                : showBossRemaining
                  ? `${summary?.bossHpRemaining ?? 0}`
                  : (summary?.bestScore ?? currentScore).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Mid-sortie Pitch Y preference when paused */}
        {isPaused && (
          <div className="flex items-center justify-between gap-3 mb-5 px-3 py-2 bg-[#14111f] border border-[#ffdf9e]/20 rounded">
            <span className="font-mono-hud text-xs text-[#dfd0b8]">PITCH CONTROLS (I)</span>
            <button
              type="button"
              onClick={onToggleInvertPitch}
              aria-pressed={invertPitch}
              className="px-3 py-1 bg-[#2a243b] hover:bg-[#38304f] text-[#ffe5b8] font-mono-hud text-xs font-semibold rounded border border-[#ffdf9e]/30 cursor-pointer whitespace-nowrap"
            >
              {invertPitch ? 'Inverted (S=Up)' : 'Standard (W=Up)'}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="flex-1 px-5 py-2.5 bg-[#f48c36] hover:bg-[#ff9f4d] text-[#171320] font-pixel text-xs font-bold rounded border border-[#ffe29a] cursor-pointer whitespace-nowrap"
            >
              Resume
            </button>
          ) : canAdvance ? (
            <button
              type="button"
              data-start="true"
              onClick={onNextLevel}
              className="flex-1 px-5 py-2.5 bg-[#f48c36] hover:bg-[#ff9f4d] text-[#171320] font-pixel text-xs font-bold rounded border border-[#ffe29a] cursor-pointer whitespace-nowrap"
            >
              Next Mission
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 px-5 py-2.5 bg-[#f48c36] hover:bg-[#ff9f4d] text-[#171320] font-pixel text-xs font-bold rounded border border-[#ffe29a] cursor-pointer whitespace-nowrap"
            >
              {isVictory ? 'Fly Again' : 'Try Again'}
            </button>
          )}

          {(isPaused || canAdvance) && (
            <button
              type="button"
              onClick={onRestart}
              className="px-4 py-2.5 bg-[#2a243b] hover:bg-[#38304f] text-[#ffe5b8] font-mono-hud text-xs font-semibold rounded border border-[#ffdf9e]/30 cursor-pointer whitespace-nowrap"
            >
              {canAdvance ? 'Replay' : 'Restart'}
            </button>
          )}

          <button
            type="button"
            onClick={onTitle}
            className="px-4 py-2.5 bg-[#151220] hover:bg-[#262138] text-[#dfd0b8] font-mono-hud text-xs font-semibold rounded border border-[#ffdf9e]/20 cursor-pointer whitespace-nowrap"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
}
