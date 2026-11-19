import * as THREE from 'three';

export interface HeroAircraftRig {
  group: THREE.Group;
  exhaustLeft: THREE.Mesh;
  exhaustRight: THREE.Mesh;
  exhaustMat: THREE.MeshBasicMaterial;
  primaryMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  muzzleFlash: THREE.Mesh;
  hullMaterials: THREE.MeshStandardMaterial[];
  shadowMesh: THREE.Mesh;
}

/**
 * Composite 11-part procedural ground-attack aircraft (THREE.Group)
 * with dynamic loadout livery colors and afterburner exhaust flare support.
 */
export function createHeroAircraftRig(): HeroAircraftRig {
  const group = new THREE.Group();

  const matteBodyMat = new THREE.MeshStandardMaterial({
    color: 0xd4dbe3,
    roughness: 0.74,
    metalness: 0.18,
    flatShading: true,
  });
  const darkSlateMat = new THREE.MeshStandardMaterial({
    color: 0x3a4356,
    roughness: 0.68,
    metalness: 0.28,
    flatShading: true,
  });
  const accentOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf47b2a,
    roughness: 0.58,
    metalness: 0.14,
    flatShading: true,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x16263d,
    roughness: 0.14,
    metalness: 0.62,
    flatShading: true,
  });
  const exhaustGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,
  });

  // 1. Primary fuselage core
  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.15, 7.2), matteBodyMat);
  fuselage.position.set(0, 0, 0.2);
  group.add(fuselage);

  // 2. Tapered nose cone (-Z is forward)
  const noseGeo = new THREE.ConeGeometry(0.76, 2.5, 4);
  noseGeo.rotateX(-Math.PI / 2);
  noseGeo.rotateZ(Math.PI / 4);
  const nose = new THREE.Mesh(noseGeo, matteBodyMat);
  nose.position.set(0, -0.05, -4.6);
  group.add(nose);

  // 3. Signature dorsal livery stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 5.4), accentOrangeMat);
  stripe.position.set(0, 0.62, -0.4);
  group.add(stripe);

  // 4. Glossy dark cockpit canopy bubble
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.62, 2.2), canopyMat);
  canopy.position.set(0, 0.78, -2.05);
  group.add(canopy);

  // 5. Wide straight main wings
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.24, 2.1), matteBodyMat);
  mainWing.position.set(0, -0.1, -0.35);
  group.add(mainWing);

  // 6. Wingtip pods (dark slate)
  const podGeo = new THREE.BoxGeometry(0.45, 0.42, 2.3);
  const leftTip = new THREE.Mesh(podGeo, darkSlateMat);
  leftTip.position.set(-5.85, -0.1, -0.3);
  const rightTip = new THREE.Mesh(podGeo, darkSlateMat);
  rightTip.position.set(5.85, -0.1, -0.3);
  group.add(leftTip, rightTip);

  // 7. Underwing ordnance rocket pods (2 pairs)
  const pylonGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.8, 6);
  pylonGeo.rotateX(Math.PI / 2);
  [-3.2, -1.9, 1.9, 3.2].forEach((px) => {
    const pod = new THREE.Mesh(pylonGeo, darkSlateMat);
    pod.position.set(px, -0.52, -0.45);
    group.add(pod);
  });

  // 8. Twin rear-mounted dorsal turbofan nacelles
  const engineGeo = new THREE.CylinderGeometry(0.62, 0.56, 2.6, 8);
  engineGeo.rotateX(Math.PI / 2);
  const engLeft = new THREE.Mesh(engineGeo, darkSlateMat);
  engLeft.position.set(-1.18, 0.76, 1.55);
  const engRight = new THREE.Mesh(engineGeo, darkSlateMat);
  engRight.position.set(1.18, 0.76, 1.55);
  group.add(engLeft, engRight);

  // Engine intake rings
  const ringGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.25, 8);
  ringGeo.rotateX(Math.PI / 2);
  const ringL = new THREE.Mesh(ringGeo, accentOrangeMat);
  ringL.position.set(-1.18, 0.76, 0.3);
  const ringR = new THREE.Mesh(ringGeo, accentOrangeMat);
  ringR.position.set(1.18, 0.76, 0.3);
  group.add(ringL, ringR);

  // 9. Twin glowing jet exhaust cones
  const exhGeo = new THREE.ConeGeometry(0.45, 1.6, 6);
  exhGeo.rotateX(Math.PI / 2);
  const exhaustLeft = new THREE.Mesh(exhGeo, exhaustGlowMat);
  exhaustLeft.position.set(-1.18, 0.76, 3.45);
  const exhaustRight = new THREE.Mesh(exhGeo, exhaustGlowMat);
  exhaustRight.position.set(1.18, 0.76, 3.45);
  group.add(exhaustLeft, exhaustRight);

  // 10. Horizontal tailplane + twin H-tail vertical stabilizers
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 1.35), matteBodyMat);
  hTail.position.set(0, 0.16, 3.35);
  group.add(hTail);

  const vFinGeo = new THREE.BoxGeometry(0.22, 1.75, 1.45);
  const finL = new THREE.Mesh(vFinGeo, darkSlateMat);
  finL.position.set(-2.15, 0.85, 3.45);
  const finR = new THREE.Mesh(vFinGeo, darkSlateMat);
  finR.position.set(2.15, 0.85, 3.45);
  group.add(finL, finR);

  // 11. 30mm GAU-8 nose cannon barrel + muzzle flash burst
  const barrelGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.4, 6);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, darkSlateMat);
  barrel.position.set(0, -0.45, -5.6);
  group.add(barrel);

  const flashGeo = new THREE.OctahedronGeometry(0.95, 0);
  const muzzleFlash = new THREE.Mesh(
    flashGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff3a0 }),
  );
  muzzleFlash.position.set(0, -0.45, -6.5);
  muzzleFlash.visible = false;
  group.add(muzzleFlash);

  // Contact shadow silhouette projected onto bay water/rooftops below plane
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 32;
  shadowCanvas.height = 32;
  const sctx = shadowCanvas.getContext('2d')!;
  sctx.fillStyle = 'rgba(10, 18, 34, 0.55)';
  sctx.fillRect(14, 4, 4, 24);
  sctx.fillRect(3, 13, 26, 5);
  sctx.fillRect(9, 23, 14, 3);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  shadowTex.magFilter = THREE.NearestFilter;
  shadowTex.minFilter = THREE.NearestFilter;
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;

  return {
    group,
    exhaustLeft,
    exhaustRight,
    exhaustMat: exhaustGlowMat,
    primaryMat: matteBodyMat,
    accentMat: accentOrangeMat,
    muzzleFlash,
    hullMaterials: [matteBodyMat, darkSlateMat, accentOrangeMat],
    shadowMesh,
  };
}

/**
 * Composite multi-part enemy models keyed by archetype, including the Sky Carrier Boss.
 */
export function createEnemyMesh(
  archetype: 'sam' | 'gunboat' | 'bandit' | 'radar' | 'carrier',
): THREE.Group {
  const group = new THREE.Group();

  if (archetype === 'sam') {
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3b444f,
      roughness: 0.78,
      metalness: 0.2,
      flatShading: true,
    });
    const alertMat = new THREE.MeshStandardMaterial({
      color: 0xe84a36,
      roughness: 0.45,
      metalness: 0.15,
      emissive: 0x551208,
      flatShading: true,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.8, 5.6), baseMat);
    base.position.y = 0.9;
    const turret = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.6), alertMat);
    turret.position.y = 2.6;
    const tubeGeo = new THREE.CylinderGeometry(0.45, 0.45, 4.2, 6);
    tubeGeo.rotateX(Math.PI / 3);
    const tubeL = new THREE.Mesh(tubeGeo, baseMat);
    tubeL.position.set(-1.3, 3.8, -0.5);
    const tubeR = new THREE.Mesh(tubeGeo, baseMat);
    tubeR.position.set(1.3, 3.8, -0.5);
    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.0, 1.0),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    beacon.name = 'telegraphBeacon';
    beacon.position.set(0, 4.8, 0);
    group.add(base, turret, tubeL, tubeR, beacon);
    return group;
  }

  if (archetype === 'gunboat') {
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x334052,
      roughness: 0.7,
      metalness: 0.25,
      flatShading: true,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd9483b,
      roughness: 0.5,
      metalness: 0.15,
      flatShading: true,
    });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.8, 12.2), hullMat);
    hull.position.y = 0.9;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.2, 4), trimMat);
    bow.rotation.x = -Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 0.9, -8.1);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 3.8), hullMat);
    bridge.position.set(0, 2.8, 1.4);
    const turret = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 2.2), trimMat);
    turret.position.set(0, 2.3, -3.5);
    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffc857 }),
    );
    beacon.name = 'telegraphBeacon';
    beacon.position.set(0, 4.8, 1.4);
    group.add(hull, bow, bridge, turret, beacon);
    return group;
  }

  if (archetype === 'bandit') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x262938,
      roughness: 0.65,
      metalness: 0.35,
      flatShading: true,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xd93c3c,
      roughness: 0.55,
      metalness: 0.2,
      flatShading: true,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 7.6), bodyMat);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.25, 2.6), wingMat);
    wings.position.set(0, 0, 0.4);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 1.8), wingMat);
    tail.position.set(0, 1.2, 3.0);
    const exhaust = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 2.2, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6b35 }),
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, 0, 4.7);
    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffea70 }),
    );
    beacon.name = 'telegraphBeacon';
    beacon.position.set(0, 1.1, -3.2);
    group.add(body, wings, tail, exhaust, beacon);
    return group;
  }

  if (archetype === 'carrier') {
    // Composite 10-part Sky Carrier Boss "Aegis-09" airborne fortress!
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x2c3448,
      roughness: 0.72,
      metalness: 0.32,
      flatShading: true,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x455068,
      roughness: 0.8,
      metalness: 0.18,
      flatShading: true,
    });
    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xe64539,
      roughness: 0.42,
      metalness: 0.2,
      emissive: 0x55100c,
      flatShading: true,
    });
    const reactorMat = new THREE.MeshBasicMaterial({
      color: 0x45e8ff,
    });

    // Main dreadnought flight deck & lower armored keel
    const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 3.4, 42), deckMat);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(11, 5.2, 32), armorMat);
    keel.position.set(0, -3.8, 0);
    // Pointed armored prow
    const prow = new THREE.Mesh(new THREE.ConeGeometry(7.2, 11, 4), armorMat);
    prow.rotation.x = -Math.PI / 2;
    prow.rotation.z = Math.PI / 4;
    prow.position.set(0, -0.5, -26.5);
    // Command island tower
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(5.5, 7.5, 11), armorMat);
    bridge.position.set(4.5, 5.2, 4);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 36), crimsonMat);
    stripe.position.set(-2.4, 1.85, 0);

    // 4 Outrigger hover lift turbines with glowing cyan rings
    const rotorGeo = new THREE.CylinderGeometry(5.2, 5.2, 2.0, 8);
    const ringGeo = new THREE.TorusGeometry(4.4, 0.55, 6, 12);
    ringGeo.rotateX(Math.PI / 2);
    for (const [rx, rz] of [
      [-13.5, -9],
      [13.5, -9],
      [-13.5, 11],
      [13.5, 11],
    ]) {
      const pod = new THREE.Mesh(rotorGeo, armorMat);
      pod.position.set(rx, -0.4, rz);
      const glow = new THREE.Mesh(ringGeo, reactorMat);
      glow.position.set(rx, -1.6, rz);
      group.add(pod, glow);
    }

    // Glowing dorsal reactor core & telegraph beacon
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(3.6, 0), crimsonMat);
    core.position.set(0, 3.8, -8);

    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    beacon.name = 'telegraphBeacon';
    beacon.position.set(4.5, 10.8, 4);

    group.add(deck, keel, prow, bridge, stripe, core, beacon);
    return group;
  }

  // archetype === 'radar'
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x5c677d,
    roughness: 0.72,
    metalness: 0.32,
    flatShading: true,
  });
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf4a236,
    roughness: 0.4,
    metalness: 0.3,
    emissive: 0x4a2400,
    flatShading: true,
  });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 6.2, 6), towerMat);
  pedestal.position.y = 3.1;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 5.2, 6), towerMat);
  mast.position.y = 8.4;
  const dish = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.8, 0.9), dishMat);
  dish.position.set(0, 10.6, 0);
  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xff5245 }),
  );
  beacon.name = 'telegraphBeacon';
  beacon.position.set(0, 13.0, 0);
  group.add(pedestal, mast, dish, beacon);
  return group;
}

/**
 * Mid-air rotating Supply Crate pickup (emerald Repair or amber Ordnance).
 */
export function createPickupMesh(kind: 'repair' | 'ordnance'): THREE.Group {
  const group = new THREE.Group();
  const isRepair = kind === 'repair';
  const accent = isRepair ? 0x4ee88e : 0xffbe3b;

  const crateMat = new THREE.MeshStandardMaterial({
    color: isRepair ? 0x1b5e3a : 0x6b3e12,
    emissive: isRepair ? 0x124228 : 0x422508,
    roughness: 0.5,
    flatShading: true,
  });
  const haloMat = new THREE.MeshBasicMaterial({ color: accent });

  const box = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 4.2), crateMat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.42, 6, 12), haloMat);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 4.5), haloMat);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.8, 4.5), haloMat);
  group.add(box, ring, crossH, crossV);
  return group;
}
