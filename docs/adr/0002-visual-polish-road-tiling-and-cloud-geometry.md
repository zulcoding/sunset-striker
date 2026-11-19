# ADR 0002: Visual Polish — Block-Aligned Road Tiling, Cumulus Cloud Geometry & Cockpit HUD Contrast

- **Status**: Accepted
- **Date**: 2026-11-19
- **Context**: First-round browser visual verification revealed four visual fidelity gaps against the reference pixel-art flight game: moiré static on tiled city street textures, boxy rectangular cloud silhouettes, minor hillside tree trunk overhang on steep ridges, and low-contrast green HUD readouts over bright sunset sky gradients.

## Decisions

1. **1×1 Per-Block Road UV Mapping (`textures.ts`)**:
   - Replace the 14×14 repeated street texture with a 1×1 per-block texture featuring dark charcoal perimeter avenues, dashed lane markers along block seams, and a recessed concrete sidewalk pad inside each 24m city block.
   - **Rationale**: Eliminates pixel aliasing and moiré shimmer in Top-Down and Chase cameras while matching crisp overhead street grids.

2. **3-Puff Rounded Cumulus Cloud Instancing (`FlightViewport.ts`, `pixelShaders.ts`)**:
   - Replace `BoxGeometry` cloud slabs with 3 overlapping flattened `SphereGeometry` ellipsoid puffs per cloud instance and brighten the cream-peach upper Bayer-dithered lighting band.

3. **Slope-Anchored Foliage & Craggy Ridge Noise (`worldGen.ts`, `FlightViewport.ts`)**:
   - Anchor tree trunks into sloped mountain terrain with vertical depth overlap and add dual-frequency ridge modulation to coastal peaks.

4. **Dark-Backed Cockpit Glass Readouts (`cockpitCanvas.ts`)**:
   - Add subtle dark translucent backing behind the green glass `SPD` and `ALT` numeric boxes and deepen the combiner tint for 100% readability against bright sunset horizons.

## Consequences

- Clean, readable street geometry across all three camera perspectives, organic sunset clouds, grounded hillside foliage, and crisp cockpit HUD instrumentation.
