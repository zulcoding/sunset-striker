import type { AircraftLoadoutId, CameraMode, LevelId } from '../game/types';
import { AIRCRAFT_LOADOUTS, getLoadoutSpec, LEVEL_CONFIGS } from '../game/levels';

interface TitleOverlayProps {
  bestScore: number;
  selectedLevel: LevelId;
  onSelectLevel: (level: LevelId) => void;
  selectedLoadout: AircraftLoadoutId;
  onSelectLoadout: (loadout: AircraftLoadoutId) => void;
  selectedCamera: CameraMode;
  onSelectCamera: (mode: CameraMode) => void;
  invertPitch: boolean;
  onToggleInvertPitch: () => void;
  onStart: () => void;
}

const CAMERA_OPTIONS: { id: CameraMode; label: string }[] = [
  { id: 'chase', label: 'Chase' },
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'topdown', label: 'Top-Down' },
];

function StatBar({
  label,
  value,
  barColor,
}: {
  label: string;
  value: number;
  barColor: string;
}) {
  return (
    <div className="flex items-center gap-2 font-mono-hud text-[10px]">
      <span className="w-8 text-[#d7c6a9] font-semibold">{label}</span>
      <div className="flex-1 h-2 bg-[#110f1a] border border-[#ffdf9e]/20 overflow-hidden">
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${value}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-7 text-right font-bold text-[#fff4db]">{value}</span>
    </div>
  );
}

export function TitleOverlay({
  bestScore,
  selectedLevel,
  onSelectLevel,
  selectedLoadout,
  onSelectLoadout,
  selectedCamera,
  onSelectCamera,
  invertPitch,
  onToggleInvertPitch,
  onStart,
}: TitleOverlayProps) {
  const activeSpec = getLoadoutSpec(selectedLoadout);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-5 md:p-8 pointer-events-none"
      role="region"
      aria-label="Sunset Striker Title Screen"
    >
      {/* Subtle left-side contrast scrim over live 3D bay flyover */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(16, 14, 28, 0.88) 0%, rgba(16, 14, 28, 0.56) 50%, rgba(16, 14, 28, 0.08) 80%, rgba(16, 14, 28, 0.24) 100%)',
        }}
      />

      {/* Top row: quiet best-score record */}
      <div className="flex items-center justify-between">
        <div className="font-mono-hud text-xs tracking-wider text-[#ffd89b]/90">
          {bestScore > 0
            ? `HIGH SCORE · ${bestScore.toLocaleString()}`
            : 'COASTAL AIR DEFENSE CAMPAIGN · 5 SECTORS OPEN'}
        </div>
      </div>

      {/* Main asymmetric left-side Hero & Sortie Hangar Lockup */}
      <main className="max-w-[600px] pointer-events-auto my-auto">
        {/* Custom inline SVG aviation pixel crest & title lockup */}
        <div className="mb-2.5">
          <svg
            viewBox="0 0 380 100"
            className="w-full max-w-[300px] h-auto"
            role="img"
            aria-label="Sunset Striker"
          >
            <rect x="6" y="8" width="44" height="6" fill="#ffdf78" />
            <rect x="2" y="16" width="52" height="6" fill="#f7a252" />
            <rect x="0" y="24" width="56" height="6" fill="#e66b4c" />
            <rect x="4" y="32" width="48" height="5" fill="#9a4e6e" />
            <path
              d="M28 4 L32 18 L50 22 L50 26 L32 26 L31 36 L40 39 L40 42 L16 42 L16 39 L25 36 L24 26 L6 26 L6 22 L24 18 Z"
              fill="#1b1826"
              stroke="#fff4d6"
              strokeWidth="1.5"
            />
            <text
              x="68"
              y="32"
              fill="#fff5dc"
              stroke="#1b1826"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Silkscreen, monospace"
              fontWeight="700"
              fontSize="30"
              letterSpacing="1"
            >
              SUNSET
            </text>
            <text
              x="68"
              y="70"
              fill="#f8a748"
              stroke="#1b1826"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Silkscreen, monospace"
              fontWeight="700"
              fontSize="32"
              letterSpacing="1"
            >
              STRIKER
            </text>
            <rect x="68" y="82" width="224" height="3" fill="#ffdf78" />
            <rect x="68" y="87" width="142" height="2" fill="#e86a42" />
          </svg>
        </div>

        {/* All 5 Operation Sectors Open & Live-Previewable */}
        <div className="mb-3">
          <div className="font-mono-hud text-[11px] uppercase tracking-wider text-[#e9cda2] mb-1.5">
            Operation Sector (All 5 Open)
          </div>
          <div
            className="grid grid-cols-5 gap-1.5"
            role="group"
            aria-label="Campaign operation sector"
          >
            {LEVEL_CONFIGS.map((lvl) => {
              const active = selectedLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onSelectLevel(lvl.id)}
                  className={`text-left px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#f48c36] border-[#ffe399] text-[#171320]'
                      : 'bg-[#1b1826]/90 border-[#ffdf9e]/25 text-[#f0e2ca] hover:bg-[#2a253a]'
                  }`}
                >
                  <div className="font-mono-hud text-[10px] font-bold leading-tight">
                    {lvl.code}
                  </div>
                  <div className="text-[11px] font-bold leading-tight mt-0.5 whitespace-nowrap">
                    {lvl.name}
                  </div>
                  <div
                    className={`text-[9px] leading-tight mt-0.5 truncate ${
                      active ? 'text-[#2b1f14]' : 'text-[#cbb898]'
                    }`}
                  >
                    {lvl.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Aircraft Hangar Selector with Speed / Health / Power + Plus/Minus Trade-offs */}
        <div className="mb-3">
          <div className="font-mono-hud text-[11px] uppercase tracking-wider text-[#e9cda2] mb-1.5">
            Choose Aircraft
          </div>
          <div
            className="grid grid-cols-4 gap-1.5 mb-2"
            role="group"
            aria-label="Aircraft selection"
          >
            {AIRCRAFT_LOADOUTS.map((spec) => {
              const active = selectedLoadout === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => onSelectLoadout(spec.id)}
                  className={`text-left px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#283852] border-[#79e2ff] text-[#fff8e7]'
                      : 'bg-[#1b1826]/90 border-[#ffdf9e]/25 text-[#e8d9c0] hover:bg-[#2a253a]'
                  }`}
                >
                  <div className="text-xs font-bold leading-tight truncate">{spec.name}</div>
                  <div
                    className={`font-mono-hud text-[10px] leading-tight mt-0.5 truncate ${
                      active ? 'text-[#9ee8ff]' : 'text-[#bda98c]'
                    }`}
                  >
                    {spec.role}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Aircraft Specs Panel: Speed / Health / Power + Explicit Plus & Minus */}
          <div
            className="bg-[#181524]/90 border border-[#ffdf9e]/25 rounded px-3 py-2.5 pixel-panel"
            data-testid="aircraft-spec-panel"
          >
            <div className="grid grid-cols-3 gap-3 mb-2">
              <StatBar label="SPD" value={activeSpec.speedRating} barColor="#38bdf8" />
              <StatBar label="HLT" value={activeSpec.healthRating} barColor="#5be08c" />
              <StatBar label="PWR" value={activeSpec.powerRating} barColor="#f97316" />
            </div>
            <div className="flex flex-col gap-1 pt-1.5 border-t border-[#ffdf9e]/15 font-mono-hud text-[11px]">
              <div className="text-[#7dffb2]">
                <span className="font-bold mr-1.5">+</span>
                {activeSpec.pros}
              </div>
              <div className="text-[#ff9c8a]">
                <span className="font-bold mr-1.5">−</span>
                {activeSpec.cons}
              </div>
            </div>
          </div>
        </div>

        {/* Starting Camera Preference + Pitch Mode + Launch CTA Row */}
        <div className="flex flex-wrap items-end justify-between gap-3 mt-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="font-mono-hud text-[11px] uppercase tracking-wider text-[#e9cda2] mb-1.5">
                Starting Camera
              </div>
              <div
                className="inline-flex items-center gap-1 p-1 bg-[#1b1826]/90 border border-[#ffdf9e]/25 rounded"
                role="group"
                aria-label="Starting camera view"
              >
                {CAMERA_OPTIONS.map((opt) => {
                  const active = selectedCamera === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelectCamera(opt.id)}
                      className={`px-2.5 py-1.5 text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#f48c36] text-[#181421]'
                          : 'text-[#e8d9c0] hover:bg-[#2a253a] hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="font-mono-hud text-[11px] uppercase tracking-wider text-[#e9cda2] mb-1.5">
                Pitch Y (I)
              </div>
              <button
                type="button"
                onClick={onToggleInvertPitch}
                aria-pressed={invertPitch}
                className="px-3 py-2 bg-[#1b1826]/90 hover:bg-[#2a253a] border border-[#ffdf9e]/25 rounded text-xs font-mono-hud font-semibold text-[#ffe8bd] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {invertPitch ? 'Inverted (S=Up)' : 'Standard (W=Up)'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="pixel-panel px-6 py-2.5 bg-[#f48c36] hover:bg-[#ff9f4d] active:translate-y-0.5 text-[#171320] font-pixel text-sm font-bold tracking-wider rounded border-2 border-[#ffe29a] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe29a]"
            >
              Launch Sortie
            </button>
          </div>
        </div>
      </main>

      {/* Bottom flat single-line control hint */}
      <footer className="font-mono-hud text-xs text-[#f3dfbe]/90 tracking-wide hud-text-stroke">
        {invertPitch ? 'W/S Dive/Climb' : 'W/S Climb/Dive'} · A/D Bank · Space/Click Cannon ·
        F/Right-Click Rockets · B Boost · E Flares · C Cam · I Invert Y · P Pause
      </footer>
    </div>
  );
}
