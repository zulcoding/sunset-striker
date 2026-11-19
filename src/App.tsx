import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyInput, FlightSimulation } from './game/simulation';
import { LEVEL_CONFIGS } from './game/levels';
import type {
  AircraftLoadoutId,
  CameraMode,
  HudSnapshot,
  InputState,
  LevelId,
  RunSummary,
  TargetReticleHint,
} from './game/types';
import { FlightViewport } from './engine/FlightViewport';
import { TitleOverlay } from './components/TitleOverlay';
import { FlightHud } from './components/FlightHud';
import { StatusModal } from './components/StatusModal';

const BEST_SCORE_STORAGE_KEY = 'sunset_striker_best_score_v1';
const INVERT_PITCH_STORAGE_KEY = 'sunset_striker_invert_pitch_v1';

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.round(score)));
  } catch {
    // ignore storage errors in restricted environments
  }
}

function loadInvertPitch(): boolean {
  try {
    return window.localStorage.getItem(INVERT_PITCH_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveInvertPitch(inverted: boolean): void {
  try {
    window.localStorage.setItem(INVERT_PITCH_STORAGE_KEY, inverted ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function parseLevelId(raw: string | null): LevelId | null {
  if (raw === '1') return 1;
  if (raw === '2') return 2;
  if (raw === '3') return 3;
  if (raw === '4') return 4;
  if (raw === '5') return 5;
  return null;
}

function parseLoadoutId(raw: string | null): AircraftLoadoutId | null {
  if (raw === 'warthog' || raw === 'falcon' || raw === 'rook' || raw === 'raptor') return raw;
  return null;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<FlightSimulation | null>(null);
  const viewportRef = useRef<FlightViewport | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseFireRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const inputScratchRef = useRef<InputState>(createEmptyInput());

  const [selectedLevel, setSelectedLevel] = useState<LevelId>(1);
  const [selectedLoadout, setSelectedLoadout] = useState<AircraftLoadoutId>('warthog');
  const [selectedCamera, setSelectedCamera] = useState<CameraMode>('chase');
  const [hud, setHud] = useState<HudSnapshot>(() => {
    const tmp = new FlightSimulation(undefined, loadBestScore(), 1);
    return tmp.getHudSnapshot();
  });
  const [targetHint, setTargetHint] = useState<TargetReticleHint | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [muted, setMuted] = useState(false);
  const [invertPitch, setInvertPitch] = useState<boolean>(() => loadInvertPitch());
  const invertPitchRef = useRef<boolean>(invertPitch);
  invertPitchRef.current = invertPitch;
  const [contextLost, setContextLost] = useState(false);

  const clearInputs = useCallback(() => {
    keysRef.current.clear();
    mouseFireRef.current.left = false;
    mouseFireRef.current.right = false;
  }, []);

  const handleStart = useCallback(
    (overrides?: {
      cameraMode?: CameraMode;
      levelId?: LevelId;
      loadout?: AircraftLoadoutId;
    }) => {
      const sim = simRef.current;
      const vp = viewportRef.current;
      if (!sim || !vp) return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      clearInputs();
      vp.audio.unlock();
      const targetLevel = overrides?.levelId ?? selectedLevel;
      const targetLoadout = overrides?.loadout ?? selectedLoadout;
      const targetCam = overrides?.cameraMode ?? selectedCamera;
      sim.startGame({
        cameraMode: targetCam,
        levelId: targetLevel,
        loadout: targetLoadout,
      });
      document.body.dataset.state = 'playing';
      document.body.dataset.camera = sim.cameraMode;
      document.body.dataset.level = String(sim.levelConfig.id);
      setRunSummary(null);
      setTargetHint(null);
      setHud(sim.getHudSnapshot());
    },
    [clearInputs, selectedCamera, selectedLevel, selectedLoadout],
  );

  const handleSelectLevel = useCallback((level: LevelId) => {
    setSelectedLevel(level);
    const sim = simRef.current;
    if (sim) {
      sim.selectLevel(level);
      document.body.dataset.level = String(level);
      setHud(sim.getHudSnapshot());
    }
  }, []);

  const handleSelectLoadout = useCallback((loadout: AircraftLoadoutId) => {
    setSelectedLoadout(loadout);
    const sim = simRef.current;
    if (sim) {
      sim.selectLoadout(loadout);
      setHud(sim.getHudSnapshot());
    }
  }, []);

  const handleNextLevel = useCallback(() => {
    const nextId = Math.min(LEVEL_CONFIGS.length, selectedLevel + 1) as LevelId;
    setSelectedLevel(nextId);
    handleStart({ levelId: nextId, cameraMode: selectedCamera, loadout: selectedLoadout });
  }, [handleStart, selectedCamera, selectedLevel, selectedLoadout]);

  const handleResume = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.phase !== 'paused') return;
    clearInputs();
    sim.togglePause();
    document.body.dataset.state = 'playing';
    setHud(sim.getHudSnapshot());
  }, [clearInputs]);

  const handleTogglePause = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (sim.phase === 'playing' || sim.phase === 'paused') {
      clearInputs();
      sim.togglePause();
      document.body.dataset.state = sim.phase;
      setHud(sim.getHudSnapshot());
    }
  }, [clearInputs]);

  const handleReturnTitle = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    clearInputs();
    sim.returnToTitle();
    document.body.dataset.state = 'title';
    setRunSummary(null);
    setTargetHint(null);
    setHud(sim.getHudSnapshot());
  }, [clearInputs]);

  const handleCycleCamera = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const next = sim.cycleCameraMode();
    setSelectedCamera(next);
    document.body.dataset.camera = next;
    setHud(sim.getHudSnapshot());
  }, []);

  const handleSelectCamera = useCallback((mode: CameraMode) => {
    setSelectedCamera(mode);
    const sim = simRef.current;
    if (sim) {
      sim.setCameraMode(mode);
      document.body.dataset.camera = mode;
      setHud(sim.getHudSnapshot());
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.audio.unlock();
    const next = !vp.audio.isMuted();
    vp.audio.setMuted(next);
    setMuted(next);
  }, []);

  const handleToggleInvertPitch = useCallback(() => {
    setInvertPitch((prev) => {
      const next = !prev;
      invertPitchRef.current = next;
      saveInvertPitch(next);
      document.body.dataset.pitch = next ? 'inverted' : 'standard';
      return next;
    });
  }, []);

  // Store latest handlers in refs so WebGL mount effect runs strictly once
  const handlersRef = useRef({
    handleStart,
    handleTogglePause,
    handleCycleCamera,
    handleSelectCamera,
    handleToggleMute,
    handleToggleInvertPitch,
  });
  handlersRef.current = {
    handleStart,
    handleTogglePause,
    handleCycleCamera,
    handleSelectCamera,
    handleToggleMute,
    handleToggleInvertPitch,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const levelParam = parseLevelId(params.get('level'));
    const initLevel: LevelId = levelParam ?? 1;
    const loadoutParam = parseLoadoutId(params.get('loadout'));
    const initLoadout: AircraftLoadoutId = loadoutParam ?? 'warthog';
    const camParam = params.get('camera');
    const initCam: CameraMode =
      camParam === 'cockpit' || camParam === 'topdown' || camParam === 'chase'
        ? camParam
        : 'chase';
    const waveParam = Number.parseInt(params.get('wave') ?? '', 10);
    const initWaveIndex = Number.isFinite(waveParam) && waveParam >= 1 ? waveParam - 1 : 0;

    const sim = new FlightSimulation(undefined, loadBestScore(), initLevel);
    sim.selectLoadout(initLoadout);
    sim.setCameraMode(initCam);
    simRef.current = sim;

    setSelectedLevel(initLevel);
    setSelectedLoadout(initLoadout);
    setSelectedCamera(initCam);

    if (params.get('autostart') === '1') {
      sim.startGame({
        cameraMode: initCam,
        levelId: initLevel,
        loadout: initLoadout,
        startWaveIndex: initWaveIndex,
      });
    }

    document.body.dataset.state = sim.phase;
    document.body.dataset.camera = sim.cameraMode;
    document.body.dataset.level = String(sim.levelConfig.id);
    document.body.dataset.pitch = invertPitchRef.current ? 'inverted' : 'standard';
    setHud(sim.getHudSnapshot());

    const readInput = (): InputState => {
      const keys = keysRef.current;
      const inp = inputScratchRef.current;
      const inverted = invertPitchRef.current;
      inp.pitchUp = inverted
        ? keys.has('KeyS') || keys.has('ArrowDown')
        : keys.has('KeyW') || keys.has('ArrowUp');
      inp.pitchDown = inverted
        ? keys.has('KeyW') || keys.has('ArrowUp')
        : keys.has('KeyS') || keys.has('ArrowDown');
      inp.rollLeft = keys.has('KeyA') || keys.has('ArrowLeft');
      inp.rollRight = keys.has('KeyD') || keys.has('ArrowRight');
      inp.yawLeft = keys.has('KeyZ');
      inp.yawRight = keys.has('KeyX');
      inp.throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal');
      inp.throttleDown = keys.has('KeyQ') || keys.has('Minus');
      inp.afterburner = keys.has('KeyB') || keys.has('Tab');
      inp.fireCannon = keys.has('Space') || mouseFireRef.current.left;
      inp.fireRocket = keys.has('KeyF') || mouseFireRef.current.right;
      inp.deployFlare = keys.has('KeyE');
      inp.pointerSteerX = 0;
      inp.pointerSteerY = 0;
      return inp;
    };

    const viewport = new FlightViewport(container, sim, readInput, {
      onHudUpdate: (snapshot, hint) => {
        setHud(snapshot);
        setTargetHint(hint);
        if (snapshot.bestScore > loadBestScore()) {
          saveBestScore(snapshot.bestScore);
        }
      },
      onRunSummary: (summary) => {
        setRunSummary(summary);
        if (summary && summary.bestScore > loadBestScore()) {
          saveBestScore(summary.bestScore);
        }
      },
      onContextLost: (lost) => setContextLost(lost),
    });
    viewportRef.current = viewport;

    // Unified Window Keyboard & Mouse Input Hub
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' ||
        e.code === 'Tab' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      const activeSim = simRef.current;
      if (!activeSim) return;

      if (activeSim.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        if (!e.repeat) handlersRef.current.handleStart();
        return;
      }

      if (!e.repeat) {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          handlersRef.current.handleTogglePause();
          return;
        }
        if (e.code === 'KeyC' || e.code === 'KeyV') {
          handlersRef.current.handleCycleCamera();
          return;
        }
        if (e.code === 'Digit1') {
          handlersRef.current.handleSelectCamera('chase');
          return;
        }
        if (e.code === 'Digit2') {
          handlersRef.current.handleSelectCamera('cockpit');
          return;
        }
        if (e.code === 'Digit3') {
          handlersRef.current.handleSelectCamera('topdown');
          return;
        }
        if (e.code === 'KeyM') {
          handlersRef.current.handleToggleMute();
          return;
        }
        if (e.code === 'KeyI') {
          handlersRef.current.handleToggleInvertPitch();
          return;
        }
        if (e.code === 'KeyR' && activeSim.phase === 'playing') {
          handlersRef.current.handleStart({ cameraMode: activeSim.cameraMode });
          return;
        }
      }

      keysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button')) return;
      if (simRef.current?.phase !== 'playing') return;
      viewport.audio.unlock();
      if (e.button === 0) mouseFireRef.current.left = true;
      if (e.button === 2) mouseFireRef.current.right = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseFireRef.current.left = false;
      if (e.button === 2) mouseFireRef.current.right = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (simRef.current?.phase === 'playing') {
        e.preventDefault();
      }
    };

    const onBlurOrHidden = () => {
      keysRef.current.clear();
      mouseFireRef.current.left = false;
      mouseFireRef.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlurOrHidden);
    document.addEventListener('visibilitychange', onBlurOrHidden);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlurOrHidden);
      document.removeEventListener('visibilitychange', onBlurOrHidden);
      viewport.dispose();
      viewportRef.current = null;
      simRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1b1826]">
      {/* Isolated WebGL & Pixel Cockpit Viewport Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        aria-label="Sunset Striker 3D Flight Viewport"
      />

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1b1826]/95 p-6 text-center">
          <div className="max-w-sm border border-[#f4a456]/40 rounded p-5 bg-[#241f34]">
            <h2 className="font-pixel text-lg text-[#ffe29a] mb-2">Graphics Context Interrupted</h2>
            <p className="text-sm text-[#e6d7be] mb-4">
              The 3D flight viewport is recovering. Reload if graphics do not resume automatically.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#f48c36] text-[#171320] font-pixel text-xs font-bold rounded cursor-pointer"
            >
              Reload Viewport
            </button>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {hud.phase === 'title' && (
        <TitleOverlay
          bestScore={hud.bestScore}
          selectedLevel={selectedLevel}
          onSelectLevel={handleSelectLevel}
          selectedLoadout={selectedLoadout}
          onSelectLoadout={handleSelectLoadout}
          selectedCamera={selectedCamera}
          onSelectCamera={handleSelectCamera}
          invertPitch={invertPitch}
          onToggleInvertPitch={handleToggleInvertPitch}
          onStart={() => handleStart()}
        />
      )}

      {/* Live Playing HUD */}
      {hud.phase === 'playing' && (
        <FlightHud
          hud={hud}
          targetHint={targetHint}
          muted={muted}
          onCycleCamera={handleCycleCamera}
          onSelectCamera={handleSelectCamera}
          onToggleMute={handleToggleMute}
          onPause={handleTogglePause}
          onRestart={() => handleStart({ cameraMode: hud.cameraMode })}
        />
      )}

      {/* Pause / Victory / Defeat Modal */}
      <StatusModal
        phase={hud.phase}
        summary={runSummary}
        levelCode={hud.levelCode}
        levelName={hud.levelName}
        currentScore={hud.score}
        currentWave={hud.wave}
        maxWaves={hud.maxWaves}
        invertPitch={invertPitch}
        onToggleInvertPitch={handleToggleInvertPitch}
        onResume={handleResume}
        onRestart={() => handleStart({ cameraMode: hud.cameraMode })}
        onNextLevel={handleNextLevel}
        onTitle={handleReturnTitle}
      />
    </div>
  );
}
