import type { CameraMode, HudSnapshot, TargetReticleHint } from '../game/types';

interface FlightHudProps {
  hud: HudSnapshot;
  targetHint: TargetReticleHint | null;
  muted: boolean;
  onCycleCamera: () => void;
  onSelectCamera: (mode: CameraMode) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

const HULL_SEGMENTS = 10;

export function FlightHud({
  hud,
  targetHint,
  muted,
  onCycleCamera,
  onSelectCamera,
  onToggleMute,
  onPause,
  onRestart,
}: FlightHudProps) {
  const hullRatio = Math.max(0, Math.min(1, hud.hull / Math.max(1, hud.maxHull)));
  const hullFilled = Math.ceil(hullRatio * HULL_SEGMENTS);
  const lowHull = hullRatio <= 0.3;
  const isCockpit = hud.cameraMode === 'cockpit';
  const isChase = hud.cameraMode === 'chase';
  const bossPct =
    hud.bossName && hud.bossMaxHp > 0
      ? Math.max(0, Math.min(100, Math.round((hud.bossHp / hud.bossMaxHp) * 100)))
      : 0;

  // Smooth rotating sweep angle for transparent Chase Radar
  const sweepRad = (hud.elapsedTime * 2.2) % (Math.PI * 2);
  const sweepX = 50 + Math.sin(sweepRad) * 44;
  const sweepY = 50 - Math.cos(sweepRad) * 44;

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-5"
      aria-label="Flight HUD"
    >
      {/* Peripheral critical low-hull vignette */}
      {lowHull && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(235, 58, 42, 0.58)',
          }}
        />
      )}

      {/* Projected Screen-Space Target Lock Diamond (Chase view) */}
      {isChase && targetHint && targetHint.visible && (
        <div
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${targetHint.screenX}%`,
            top: `${targetHint.screenY}%`,
          }}
          data-testid="target-lock-diamond"
          aria-hidden="true"
        >
          <div className="relative flex flex-col items-center">
            <svg viewBox="0 0 40 40" className="w-9 h-9">
              <polygon
                points="20,3 37,20 20,37 3,20"
                fill="none"
                stroke="#ff8b4d"
                strokeWidth="2"
              />
              <circle cx="20" cy="20" r="2" fill="#ffe38a" />
            </svg>
            <div className="mt-0.5 px-1.5 py-0.5 bg-[#191422]/85 border border-[#ff8b4d]/70 rounded font-mono-hud text-[9px] font-bold text-[#ffd8a8] whitespace-nowrap">
              {targetHint.label} · {targetHint.distanceM}M
            </div>
          </div>
        </div>
      )}

      {/* TOP PERIMETER CLUSTER */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Operation / Wave Objective + Hull Vitality Pips */}
        <div className="bg-[#191624]/84 border border-[#ffdfa0]/25 rounded px-3.5 py-2.5 pixel-panel min-w-[230px]">
          <div className="flex items-baseline justify-between gap-4 mb-1.5">
            <span className="font-mono-hud text-[11px] font-semibold text-[#f8c471]">
              {hud.levelCode} · W{hud.wave}/{hud.maxWaves} · {hud.waveName}
            </span>
            <span className="font-mono-hud text-xs font-bold text-[#fff4dc] whitespace-nowrap">
              {hud.enemiesRemaining} LEFT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono-hud text-[10px] font-bold text-[#d7c6a9] w-8">HULL</span>
            <div
              className="flex items-center gap-1 flex-1"
              aria-label={`Hull ${hud.hull} of ${hud.maxHull}`}
            >
              {Array.from({ length: HULL_SEGMENTS }).map((_, idx) => {
                const filled = idx < hullFilled;
                const partial = idx === hullFilled - 1 && hullRatio < 0.99;
                return (
                  <div
                    key={idx}
                    className={`h-2.5 flex-1 border ${
                      filled
                        ? lowHull
                          ? 'bg-[#ef4d3d] border-[#ffb09f]'
                          : partial
                            ? 'bg-[#f4a836] border-[#ffe39a]'
                            : 'bg-[#5be08c] border-[#baf7cf]'
                        : 'bg-[#12101c] border-[#4c4663]'
                    }`}
                  />
                );
              })}
            </div>
            <span className="font-mono-hud text-xs font-bold text-[#fff5df] min-w-[46px] text-right">
              {hud.hull}/{hud.maxHull}
            </span>
          </div>
        </div>

        {/* Center Top: Sky Carrier Boss Integrity Bar + Wave Announcements + Missile Warning */}
        <div className="flex flex-col items-center gap-1.5 mt-0.5">
          {hud.bossName && (
            <div
              className="bg-[#23121c]/90 border border-[#ff6b57]/75 rounded px-3.5 py-2 pixel-panel min-w-[260px] md:min-w-[320px]"
              data-testid="boss-hp-bar"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1 font-mono-hud text-[10px] font-bold">
                <span className="text-[#ff9c8a] tracking-wider">{hud.bossName}</span>
                <span className="text-[#fff2db]">
                  {hud.bossHp}/{hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#120b12] border border-[#ff7c6b]/45 overflow-hidden">
                <div
                  className="h-full bg-[#e8453c] transition-[width] duration-100"
                  style={{ width: `${bossPct}%` }}
                />
              </div>
            </div>
          )}

          {hud.bannerText && (
            <div className="bg-[#1b1726]/88 border border-[#ffd88a]/45 px-4 py-1.5 rounded font-pixel text-xs md:text-sm text-[#ffe6a3] tracking-wider">
              {hud.bannerText}
            </div>
          )}

          {(hud.missileWarning || hud.lockWarning) && !isCockpit && (
            <div className="bg-[#5a1614]/92 border border-[#ff7b6b] px-3.5 py-1 rounded font-mono-hud text-xs font-bold text-[#ffd6d1] tracking-wider">
              {hud.missileWarning
                ? 'INCOMING SAM · PRESS E FOR FLARES'
                : 'RADAR LOCK DETECTED'}
            </div>
          )}
        </div>

        {/* Top-Right: Score + Combo + Compact Square Icon Utility Buttons */}
        <div className="flex items-start gap-2.5">
          <div className="bg-[#191624]/84 border border-[#ffdfa0]/25 rounded px-3.5 py-2 pixel-panel text-right">
            <div className="flex items-baseline justify-end gap-2">
              <span className="font-mono-hud text-[10px] font-semibold text-[#d7c6a9]">SCORE</span>
              {hud.combo > 1 && (
                <span className="font-mono-hud text-xs font-bold text-[#ffbe55]">
                  x{hud.combo}
                </span>
              )}
            </div>
            <div
              className="font-pixel text-lg md:text-xl text-[#fff4db] leading-tight"
              data-testid="hud-score"
            >
              {hud.score.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Cycle camera view (C)"
              title="Cycle Camera (C)"
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="w-9 h-9 bg-[#191624]/88 hover:bg-[#2c2640] border border-[#ffdfa0]/30 rounded flex items-center justify-center text-[#ffe3ad] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 8h3l2-2h6l2 2h3v10H4V8z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 bg-[#191624]/88 hover:bg-[#2c2640] border border-[#ffdfa0]/30 rounded flex items-center justify-center text-[#ffe3ad] cursor-pointer"
            >
              {muted ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path d="M22 9l-6 6M16 9l6 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
                </svg>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause sortie (P)"
              title="Pause (P)"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 bg-[#191624]/88 hover:bg-[#2c2640] border border-[#ffdfa0]/30 rounded flex items-center justify-center text-[#ffe3ad] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart sortie (R)"
              title="Restart (R)"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-9 h-9 bg-[#191624]/88 hover:bg-[#2c2640] border border-[#ffdfa0]/30 rounded flex items-center justify-center text-[#ffe3ad] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* CENTER RETICLE (Chase mode only — Cockpit draws its own diegetic green glass reticle!) */}
      {isChase && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" className="w-11 h-11 opacity-80">
            <circle
              cx="24"
              cy="24"
              r="11"
              fill="none"
              stroke={hud.lockedTargetId ? '#ff8b4d' : '#fff0c2'}
              strokeWidth="1.5"
              strokeDasharray={hud.lockedTargetId ? 'none' : '4 4'}
            />
            <line x1="6" y1="24" x2="15" y2="24" stroke="#fff0c2" strokeWidth="1.5" />
            <line x1="33" y1="24" x2="42" y2="24" stroke="#fff0c2" strokeWidth="1.5" />
            <line x1="24" y1="9" x2="24" y2="15" stroke="#fff0c2" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="1.5" fill="#ffdf78" />
          </svg>
        </div>
      )}

      {/* BOTTOM COMPACT PERIMETER DOCK (Hidden in Cockpit mode so pixel dashboard takes center stage) */}
      <div className="flex items-end justify-between gap-4">
        {!isCockpit ? (
          <>
            {/* Bottom-Left: Transparent Chase Radar + Flight Telemetry (SPD / ALT / HDG) */}
            <div className="flex flex-col items-start gap-2.5">
              {isChase && (
                <div
                  className="relative w-[118px] h-[118px] rounded-full border border-[#7ce0ff]/50 bg-[#0b1522]/48"
                  data-testid="chase-radar"
                  aria-label="Tactical Chase Radar"
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Outer & inner transparent range rings */}
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="rgba(124, 224, 255, 0.38)"
                      strokeWidth="1"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="28"
                      fill="none"
                      stroke="rgba(124, 224, 255, 0.28)"
                      strokeWidth="0.9"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="13"
                      fill="none"
                      stroke="rgba(124, 224, 255, 0.22)"
                      strokeWidth="0.8"
                    />
                    {/* Axis crosshairs & forward cone */}
                    <line
                      x1="50"
                      y1="5"
                      x2="50"
                      y2="95"
                      stroke="rgba(124, 224, 255, 0.16)"
                      strokeWidth="0.8"
                    />
                    <line
                      x1="5"
                      y1="50"
                      x2="95"
                      y2="50"
                      stroke="rgba(124, 224, 255, 0.16)"
                      strokeWidth="0.8"
                    />
                    <path
                      d="M50 50 L28 11 A45 45 0 0 1 72 11 Z"
                      fill="rgba(124, 224, 255, 0.08)"
                    />
                    {/* Rotating sweep beam */}
                    <line
                      x1="50"
                      y1="50"
                      x2={sweepX}
                      y2={sweepY}
                      stroke="rgba(124, 240, 255, 0.55)"
                      strokeWidth="1.2"
                    />

                    {/* Live Radar Blips (Enemies, Boss, SAM Missiles, Pickups) */}
                    {hud.radarBlips.map((blip, idx) => {
                      const bx = 50 + blip.relX * 42;
                      const by = 50 + blip.relZ * 42;
                      if (blip.kind === 'carrier') {
                        return (
                          <polygon
                            key={idx}
                            points={`${bx},${by - 4.2} ${bx + 4.2},${by} ${bx},${by + 4.2} ${bx - 4.2},${by}`}
                            fill="#ff4848"
                            stroke="#fff1d6"
                            strokeWidth="0.9"
                          />
                        );
                      }
                      if (blip.kind === 'pickup') {
                        return (
                          <polygon
                            key={idx}
                            points={`${bx},${by - 3} ${bx + 3},${by} ${bx},${by + 3} ${bx - 3},${by}`}
                            fill="#4ee88e"
                          />
                        );
                      }
                      if (blip.kind === 'sam_missile') {
                        return <circle key={idx} cx={bx} cy={by} r="2.2" fill="#ff5a52" />;
                      }
                      return (
                        <g key={idx}>
                          {blip.locked && (
                            <circle
                              cx={bx}
                              cy={by}
                              r="4.5"
                              fill="none"
                              stroke="#ff9c42"
                              strokeWidth="1.1"
                            />
                          )}
                          <circle
                            cx={bx}
                            cy={by}
                            r={blip.locked ? '2.5' : '2.1'}
                            fill={blip.locked ? '#ff9c42' : '#ffd875'}
                          />
                        </g>
                      );
                    })}

                    {/* Player Aircraft Center Chevron */}
                    <polygon points="50,45 53.5,53 50,51 46.5,53" fill="#e8fbff" />
                  </svg>
                  <span className="absolute top-1 left-1/2 -translate-x-1/2 font-mono-hud text-[8px] font-bold text-[#9be7ff]/80">
                    FWD
                  </span>
                </div>
              )}

              <div className="bg-[#191624]/84 border border-[#ffdfa0]/25 rounded px-3.5 py-2 pixel-panel flex items-center gap-4 font-mono-hud">
                <div>
                  <div className="text-[10px] text-[#d7c6a9]">SPD</div>
                  <div
                    className={`text-sm font-bold ${
                      hud.afterburnerActive ? 'text-[#66f2ff]' : 'text-[#fff4db]'
                    }`}
                  >
                    {hud.speedKnots} KT
                  </div>
                </div>
                <div className="h-6 w-px bg-[#ffdfa0]/20" />
                <div>
                  <div className="text-[10px] text-[#d7c6a9]">ALT</div>
                  <div className="text-sm font-bold text-[#9be7ff]">{hud.altitudeFeet} FT</div>
                </div>
                <div className="h-6 w-px bg-[#ffdfa0]/20" />
                <div>
                  <div className="text-[10px] text-[#d7c6a9]">HDG</div>
                  <div className="text-sm font-bold text-[#ffdf78]">
                    {String(hud.headingDeg).padStart(3, '0')}°
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom-Center: Interactive Camera Mode Switcher */}
            <div
              className="pointer-events-auto hidden md:flex items-center gap-1 p-1 bg-[#191624]/86 border border-[#ffdfa0]/25 rounded pixel-panel"
              role="group"
              aria-label="Camera perspective"
            >
              {(
                [
                  { id: 'chase', label: '1 Chase' },
                  { id: 'cockpit', label: '2 Cockpit' },
                  { id: 'topdown', label: '3 Top-Down' },
                ] as const
              ).map((cam) => {
                const active = hud.cameraMode === cam.id;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectCamera(cam.id);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-mono-hud font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#f48c36] text-[#171320]'
                        : 'text-[#e8d9c0] hover:bg-[#2a253a]'
                    }`}
                  >
                    {cam.label}
                  </button>
                );
              })}
            </div>

            {/* Bottom-Right: Afterburner Boost + Live Ordnance Readout */}
            <div className="bg-[#191624]/84 border border-[#ffdfa0]/25 rounded px-3.5 py-2 pixel-panel flex items-center gap-3.5 font-mono-hud">
              <div className="min-w-[68px]" data-testid="afterburner-gauge">
                <div className="flex items-center justify-between text-[10px] text-[#d7c6a9]">
                  <span>[B] BST</span>
                  <span
                    className={
                      hud.afterburnerOverheated
                        ? 'text-[#ff6f61] font-bold'
                        : hud.afterburnerActive
                          ? 'text-[#66f2ff] font-bold'
                          : 'text-[#9be7ff]'
                    }
                  >
                    {hud.afterburnerOverheated ? 'HOT' : `${hud.afterburnerPct}%`}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full bg-[#12101c] border border-[#4c4663] overflow-hidden">
                  <div
                    className={`h-full ${
                      hud.afterburnerOverheated
                        ? 'bg-[#ef4d3d]'
                        : hud.afterburnerActive
                          ? 'bg-[#5ef2ff]'
                          : 'bg-[#38bdf8]'
                    }`}
                    style={{ width: `${hud.afterburnerPct}%` }}
                  />
                </div>
              </div>
              <div className="h-6 w-px bg-[#ffdfa0]/20" />
              <div>
                <div className="text-[10px] text-[#d7c6a9]">[F] RKT</div>
                <div
                  className={`text-sm font-bold ${
                    hud.lockedTargetId ? 'text-[#ff8b4d]' : 'text-[#ffe399]'
                  }`}
                >
                  {hud.rockets}/{hud.maxRockets}
                </div>
              </div>
              <div className="h-6 w-px bg-[#ffdfa0]/20" />
              <div>
                <div className="text-[10px] text-[#d7c6a9]">[E] FLR</div>
                <div
                  className={`text-sm font-bold ${
                    hud.flareReady ? 'text-[#7dffb2]' : 'text-[#8c859e]'
                  }`}
                >
                  {hud.flares}/{hud.maxFlares}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Minimal subtle camera switch tab in Cockpit mode so user can jump back effortlessly */
          <div className="pointer-events-auto ml-auto flex items-center gap-1 p-1 bg-[#141822]/85 border border-[#ffdfa0]/25 rounded">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="px-2.5 py-1 text-[11px] font-mono-hud font-semibold text-[#ffe3ad] hover:bg-[#283142] rounded cursor-pointer whitespace-nowrap"
            >
              [C] View: Cockpit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
