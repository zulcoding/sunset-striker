import type { HudSnapshot } from '../game/types';

export const COCKPIT_WIDTH = 426;
export const COCKPIT_HEIGHT = 240;

/**
 * Renders the pixel-art 1st-person cockpit console & translucent green glass HUD combiner
 * onto a crisp 426x240 pixel canvas (matching reference frames 00:11 - 00:15 & 00:28 - 00:32):
 *  - Dark beveled canopy frame & angled side struts
 *  - Translucent green glass HUD combiner with scrolling heading tape, SPD/ALT/PWR boxes,
 *    dynamic pitch ladder, boresight reticle, and weapon/lock callouts
 *  - Lower dashboard panel with:
 *      * Circular glowing amber-orange sweep radar with live enemy/SAM blips + digital score readout
 *      * Airspeed dial, live blue/brown Artificial Horizon (pitch + roll), Altimeter, Heading & RPM gauges
 *      * Moving red Throttle Lever & status lamps
 */
export function renderPixelCockpit(
  ctx: CanvasRenderingContext2D,
  hud: HudSnapshot,
  elapsedSec: number,
  lockedNdc: { x: number; y: number; visible: boolean } | null,
): void {
  const W = COCKPIT_WIDTH;
  const H = COCKPIT_HEIGHT;

  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;

  // =========================================================================
  // 1. TRANSLUCENT GREEN GLASS HUD COMBINER (Upper Center, x: 168..258, y: 24..148)
  // =========================================================================
  const hudLeft = 166;
  const hudRight = 260;
  const hudTop = 26;
  const hudBottom = 148;
  const hudCx = Math.floor((hudLeft + hudRight) / 2);
  const hudCy = 92;

  // Subtle translucent tinted glass combiner for crisp legibility over sunset sky
  ctx.fillStyle = 'rgba(20, 42, 36, 0.22)';
  ctx.fillRect(hudLeft, hudTop, hudRight - hudLeft, hudBottom - hudTop);

  // Twin vertical dark HUD glass support posts (exact match to 00:12 - 00:15, 00:29 - 00:32!)
  ctx.fillStyle = '#202632';
  ctx.fillRect(hudLeft - 2, hudTop - 4, 2, hudBottom - hudTop + 12);
  ctx.fillRect(hudRight, hudTop - 4, 2, hudBottom - hudTop + 12);
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(hudLeft - 1, hudTop - 4, 1, hudBottom - hudTop + 10);
  ctx.fillRect(hudRight + 1, hudTop - 4, 1, hudBottom - hudTop + 10);

  // Clip HUD markings strictly inside glass combiner
  ctx.save();
  ctx.beginPath();
  ctx.rect(hudLeft + 1, hudTop + 1, hudRight - hudLeft - 2, hudBottom - hudTop - 2);
  ctx.clip();

  const hudGreen = '#88ffbd';
  const hudGreenDim = 'rgba(136, 255, 189, 0.62)';
  const hudWarn = '#ff7256';
  ctx.fillStyle = hudGreen;
  ctx.strokeStyle = hudGreen;
  ctx.font = 'bold 7px monospace';
  ctx.textBaseline = 'top';

  // --- Heading Compass Tape along top of glass ---
  const heading = hud.headingDeg;
  ctx.fillStyle = hudGreenDim;
  ctx.fillRect(hudLeft + 4, hudTop + 11, hudRight - hudLeft - 8, 1);
  // Center Lubber Caret
  ctx.fillStyle = hudGreen;
  ctx.fillRect(hudCx, hudTop + 12, 1, 3);
  ctx.fillRect(hudCx - 1, hudTop + 14, 3, 1);

  const pxPerDeg = 1.15;
  const startDeg = Math.floor((heading - 42) / 10) * 10;
  for (let d = startDeg; d <= heading + 42; d += 10) {
    const x = Math.round(hudCx + (d - heading) * pxPerDeg);
    if (x < hudLeft + 4 || x > hudRight - 4) continue;
    const norm = ((d % 360) + 360) % 360;
    const isMajor = norm % 30 === 0;
    ctx.fillStyle = hudGreen;
    ctx.fillRect(x, hudTop + (isMajor ? 8 : 9), 1, isMajor ? 3 : 2);
    if (isMajor) {
      let label = String(Math.floor(norm / 10)).padStart(2, '0');
      if (norm === 0) label = 'N';
      else if (norm === 90) label = 'E';
      else if (norm === 180) label = 'S';
      else if (norm === 270) label = 'W';
      ctx.fillText(label, x - (label.length > 1 ? 4 : 2), hudTop + 1);
    }
  }

  // --- Dynamic Pitch Ladder & Horizon Line (rotates with aircraft roll, shifts with pitch!) ---
  ctx.save();
  ctx.translate(hudCx, hudCy);
  ctx.rotate(hud.rollRad);
  const pitchOffsetPx = Math.round(hud.pitchRad * 68);
  ctx.translate(0, pitchOffsetPx);

  // Horizon line (0 deg)
  ctx.fillStyle = hudGreenDim;
  ctx.fillRect(-34, 0, 22, 1);
  ctx.fillRect(12, 0, 22, 1);

  // +10 / -10 pitch rungs
  for (const deg of [-20, -10, 10, 20]) {
    const y = Math.round((-deg * Math.PI) / 180 * 68);
    ctx.fillStyle = hudGreenDim;
    ctx.fillRect(-18, y, 10, 1);
    ctx.fillRect(8, y, 10, 1);
    // End ticks pointing toward horizon
    const tickDir = deg > 0 ? 2 : -2;
    ctx.fillRect(-18, y, 1, tickDir);
    ctx.fillRect(17, y, 1, tickDir);
  }
  ctx.restore();

  // --- Center Boresight / Flight-Path Reticle (-o-) ---
  ctx.strokeStyle = hudGreen;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hudCx + 0.5, hudCy + 0.5, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hudGreen;
  ctx.fillRect(hudCx - 11, hudCy, 6, 1);
  ctx.fillRect(hudCx + 6, hudCy, 6, 1);
  ctx.fillRect(hudCx, hudCy - 8, 1, 4);

  // --- Left SPD Box + PWR Bar ---
  ctx.fillStyle = hudGreen;
  ctx.fillText('SPD', hudLeft + 5, hudCy - 12);
  ctx.fillStyle = 'rgba(14, 30, 26, 0.52)';
  ctx.fillRect(hudLeft + 4, hudCy - 4, 23, 12);
  ctx.strokeStyle = hudGreen;
  ctx.strokeRect(hudLeft + 4.5, hudCy - 3.5, 22, 11);
  ctx.fillStyle = hudGreen;
  ctx.fillText(String(hud.speedKnots).padStart(3, '0'), hudLeft + 7, hudCy - 1);

  ctx.fillStyle = hud.afterburnerActive ? '#63f0ff' : '#ffe588';
  ctx.fillText(hud.afterburnerActive ? 'A/B' : 'PWR', hudLeft + 5, hudCy + 11);
  const pwrBlocks = Math.round(
    ((hud.afterburnerActive ? hud.afterburnerPct : hud.throttlePct) / 100) * 6,
  );
  for (let b = 0; b < 6; b++) {
    ctx.fillStyle =
      b < pwrBlocks
        ? hud.afterburnerActive
          ? '#63f0ff'
          : '#ffe588'
        : 'rgba(255,229,136,0.22)';
    ctx.fillRect(hudLeft + 5 + b * 3, hudCy + 19, 2, 3);
  }

  // --- Right ALT Box ---
  ctx.fillStyle = hudGreen;
  ctx.fillText('ALT', hudRight - 22, hudCy - 12);
  ctx.fillStyle = 'rgba(14, 30, 26, 0.52)';
  ctx.fillRect(hudRight - 27, hudCy - 4, 23, 12);
  ctx.strokeStyle = hudGreen;
  ctx.strokeRect(hudRight - 26.5, hudCy - 3.5, 22, 11);
  ctx.fillStyle = hudGreen;
  ctx.fillText(String(hud.altitudeFeet).padStart(3, '0'), hudRight - 24, hudCy - 1);

  // Bottom HUD Ordnance & Warning Readout
  ctx.fillStyle = hud.missileWarning || hud.lockWarning ? hudWarn : hudGreen;
  if (hud.missileWarning) {
    ctx.fillText('!! MISSILE !!', hudCx - 26, hudBottom - 12);
  } else if (hud.lockWarning) {
    ctx.fillText('SAM LOCK', hudCx - 18, hudBottom - 12);
  } else {
    ctx.fillText(`RKT ${hud.rockets}`, hudLeft + 6, hudBottom - 12);
    ctx.fillText(`FLR ${hud.flares}`, hudRight - 28, hudBottom - 12);
  }

  ctx.restore();

  // Target lock diamond anywhere on windshield
  if (lockedNdc && lockedNdc.visible) {
    const tx = Math.round((lockedNdc.x * 0.5 + 0.5) * W);
    const ty = Math.round((-lockedNdc.y * 0.5 + 0.5) * H);
    if (ty < 146 && tx > 12 && tx < W - 12) {
      ctx.strokeStyle = '#ff6b4a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 6);
      ctx.lineTo(tx + 6, ty);
      ctx.lineTo(tx, ty + 6);
      ctx.lineTo(tx - 6, ty);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // =========================================================================
  // 2. CANOPY FRAME & ANGLED SIDE STRUTS
  // =========================================================================
  ctx.fillStyle = '#1d2430';
  // Top thin canopy bow
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, 18);
  ctx.lineTo(W - 24, 10);
  ctx.lineTo(24, 10);
  ctx.lineTo(0, 18);
  ctx.closePath();
  ctx.fill();

  // Left angled canopy strut
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(20, 0);
  ctx.lineTo(36, 152);
  ctx.lineTo(0, 156);
  ctx.closePath();
  ctx.fill();

  // Right angled canopy strut
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(W - 20, 0);
  ctx.lineTo(W - 36, 152);
  ctx.lineTo(W, 156);
  ctx.closePath();
  ctx.fill();

  // =========================================================================
  // 3. MAIN INSTRUMENT CONSOLE DASHBOARD (y: 148..240)
  // =========================================================================
  // Curved glare shield lip
  ctx.fillStyle = '#181e28';
  ctx.beginPath();
  ctx.moveTo(0, 156);
  ctx.lineTo(74, 147);
  ctx.lineTo(W - 74, 147);
  ctx.lineTo(W, 156);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Subtle top bevel edge highlight along glare shield
  ctx.fillStyle = '#384354';
  ctx.fillRect(74, 147, W - 148, 2);

  // Inner instrument panel faceplate
  ctx.fillStyle = '#252d3a';
  ctx.fillRect(80, 154, W - 160, 84);
  ctx.strokeStyle = '#141922';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 154, W - 160, 84);

  // Corner rivet screws
  ctx.fillStyle = '#4e5b70';
  for (const [rx, ry] of [
    [85, 159],
    [W - 87, 159],
    [85, 231],
    [W - 87, 231],
  ]) {
    ctx.fillRect(rx, ry, 2, 2);
  }

  // --- A. CIRCULAR AMBER-ORANGE RADAR SCOPE (x: 118, y: 186, r: 24) ---
  drawRadarScope(ctx, 119, 186, 23, hud, elapsedSec);

  // Digital amber score/range readout box beneath radar (matches `0000` in reference!)
  ctx.fillStyle = '#10141c';
  ctx.fillRect(102, 217, 34, 11);
  ctx.strokeStyle = '#3f4c5e';
  ctx.lineWidth = 1;
  ctx.strokeRect(102.5, 217.5, 33, 10);
  ctx.fillStyle = '#f8a836';
  ctx.font = 'bold 7px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(String(Math.min(99999, hud.score)).padStart(5, '0'), 105, 219);

  // --- B. AIRSPEED DIAL (x: 174, y: 176, r: 15) ---
  const spdAngle = -Math.PI * 0.75 + ((hud.speedKnots - 180) / 380) * Math.PI * 1.5;
  drawAnalogGauge(ctx, 174, 176, 15, spdAngle, 'KTS', '#ffffff');

  // --- C. LIVE ARTIFICIAL HORIZON / ATTITUDE INDICATOR (x: 213, y: 177, r: 17) ---
  drawAttitudeIndicator(ctx, 213, 177, 17, hud.pitchRad, hud.rollRad);

  // --- D. ALTIMETER DIAL (x: 252, y: 176, r: 15) ---
  const altAngle = -Math.PI * 0.5 + ((hud.altitudeFeet % 1000) / 1000) * Math.PI * 2;
  drawAnalogGauge(ctx, 252, 176, 15, altAngle, 'ALT', '#9be7ff');

  // --- E. LOWER ROW GAUGES (Heading Compass & Vertical Climb / Hull) ---
  const hdgAngle = ((hud.headingDeg - 90) * Math.PI) / 180;
  drawAnalogGauge(ctx, 186, 214, 13, hdgAngle, 'HDG', '#ffdf78');

  const hullAngle = -Math.PI * 0.75 + (hud.hull / hud.maxHull) * Math.PI * 1.5;
  drawAnalogGauge(ctx, 224, 214, 13, hullAngle, 'HUL', hud.hull < 35 ? '#ff5947' : '#7dffb2');

  // --- F. RIGHT ENGINE MINI-DIALS (2x) ---
  const rpmAngle = -Math.PI * 0.75 + (hud.throttlePct / 100) * Math.PI * 1.45;
  drawAnalogGauge(ctx, 294, 170, 9, rpmAngle, '', '#ffd166');
  drawAnalogGauge(ctx, 318, 170, 9, rpmAngle * 0.96, '', '#ffd166');

  // Clock / Fuel dial
  const clkAngle = -Math.PI * 0.5 + (elapsedSec * 0.4);
  drawAnalogGauge(ctx, 294, 200, 9, clkAngle, '', '#ffffff');

  // --- G. MOVING VERTICAL THROTTLE LEVER (x: 317, y: 192..224) ---
  ctx.fillStyle = '#12161e';
  ctx.fillRect(315, 190, 5, 34);
  ctx.fillStyle = '#384354';
  ctx.fillRect(317, 192, 1, 30);
  // Red/orange throttle handle synced to throttlePct
  const leverY = Math.round(219 - (hud.throttlePct / 100) * 25);
  ctx.fillStyle = '#e84a36';
  ctx.fillRect(311, leverY, 13, 5);
  ctx.fillStyle = '#ff9a6e';
  ctx.fillRect(312, leverY + 1, 11, 1);

  // Status indicator lamps (Hull OK / Lock Warning / Flare Ready)
  const lamps = [
    { x: 288, y: 220, on: hud.hull > 30, color: '#5be38c' },
    { x: 296, y: 220, on: hud.flareReady, color: '#f8c64e' },
    { x: 304, y: 220, on: hud.missileWarning || hud.lockWarning, color: '#ff4f42' },
  ];
  for (const lamp of lamps) {
    ctx.fillStyle = '#10141c';
    ctx.fillRect(lamp.x - 1, lamp.y - 1, 6, 6);
    ctx.fillStyle = lamp.on ? lamp.color : '#2b3240';
    ctx.fillRect(lamp.x, lamp.y, 4, 4);
  }
}

function drawRadarScope(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  hud: HudSnapshot,
  elapsedSec: number,
): void {
  // Bezel ring
  ctx.fillStyle = '#11151d';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#4a566b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Warm amber-brown CRT radar face (matches reference 00:11 - 00:15!)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#3c1e0c';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Concentric range rings & crosshairs
  ctx.strokeStyle = 'rgba(235, 145, 52, 0.28)';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.floor(r * 0.5), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(235, 145, 52, 0.25)';
  ctx.fillRect(cx - r, cy, r * 2, 1);
  ctx.fillRect(cx, cy - r, 1, r * 2);

  // Rotating amber radar sweep wedge
  const sweep = (elapsedSec * 2.1) % (Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 178, 68, 0.28)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, sweep - 0.5, sweep);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffbe55';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
  ctx.stroke();

  // Live Enemy, Boss, Pickup & Incoming Missile Blips
  for (let i = 0; i < hud.radarBlips.length; i++) {
    const b = hud.radarBlips[i];
    const bx = Math.round(cx + b.relX * (r - 3));
    const by = Math.round(cy + b.relZ * (r - 3));
    if (b.kind === 'sam_missile') {
      ctx.fillStyle = '#ff4b3e';
      ctx.fillRect(bx - 1, by - 1, 3, 3);
    } else if (b.kind === 'carrier') {
      ctx.fillStyle = '#ff4560';
      ctx.fillRect(bx - 2, by - 2, 5, 5);
    } else if (b.kind === 'pickup') {
      ctx.fillStyle = '#5ef29b';
      ctx.fillRect(bx - 1, by - 1, 2, 2);
    } else if (b.locked) {
      ctx.fillStyle = '#fff4b0';
      ctx.fillRect(bx - 1, by - 1, 3, 3);
    } else {
      ctx.fillStyle = '#ffae3d';
      ctx.fillRect(bx - 1, by - 1, 2, 2);
    }
  }

  // Own aircraft center pip
  ctx.fillStyle = '#fff5d1';
  ctx.fillRect(cx - 1, cy - 1, 2, 2);

  ctx.restore();
}

function drawAttitudeIndicator(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pitchRad: number,
  rollRad: number,
): void {
  // Bezel
  ctx.fillStyle = '#11151d';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Rotate & translate sky/earth split dynamically with roll & pitch
  ctx.translate(cx, cy);
  ctx.rotate(rollRad);
  const pitchShift = Math.round(pitchRad * 26);
  ctx.translate(0, pitchShift);

  // Sky-blue upper half
  ctx.fillStyle = '#3388d9';
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 2);
  // Warm earth-brown lower half
  ctx.fillStyle = '#995e33';
  ctx.fillRect(-r * 2, 0, r * 4, r * 2);
  // Crisp white horizon line & pitch ticks
  ctx.fillStyle = '#f4f7fc';
  ctx.fillRect(-r * 2, 0, r * 4, 1);
  ctx.fillRect(-5, -6, 10, 1);
  ctx.fillRect(-5, 6, 10, 1);
  ctx.restore();

  // Fixed center orange gull-wing aircraft symbol
  ctx.fillStyle = '#ff9f38';
  ctx.fillRect(cx - 9, cy, 6, 2);
  ctx.fillRect(cx + 4, cy, 6, 2);
  ctx.fillRect(cx - 1, cy, 3, 2);

  // Outer bezel ring highlight
  ctx.strokeStyle = '#536075';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAnalogGauge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  needleAngle: number,
  label: string,
  needleColor: string,
): void {
  // Bezel & dark dial face
  ctx.fillStyle = '#12161f';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#191f2b';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Tick marks around perimeter
  ctx.fillStyle = '#b9c4d6';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tx = Math.round(cx + Math.cos(a) * (r - 2.5));
    const ty = Math.round(cy + Math.sin(a) * (r - 2.5));
    ctx.fillRect(tx, ty, 1, 1);
  }

  if (label && r >= 12) {
    ctx.fillStyle = '#7e8ba3';
    ctx.font = 'bold 5px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx - 5, cy + 4);
  }

  // Crisp needle
  ctx.strokeStyle = needleColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(
    Math.round(cx + Math.cos(needleAngle) * (r - 3)),
    Math.round(cy + Math.sin(needleAngle) * (r - 3)),
  );
  ctx.stroke();

  // Center pin
  ctx.fillStyle = '#d4dbe6';
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}
