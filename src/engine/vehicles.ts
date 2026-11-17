import * as THREE from 'three';
import type {MaterialBank} from './materials';

export type VehicleVariant =
  | 'muscle_hero'
  | 'checker_cab'
  | 'police'
  | 'sedan_40s'
  | 'red_finned';

export interface ProceduralVehicle {
  group: THREE.Group;
  bodyTiltGroup: THREE.Group;
  wheels: THREE.Group[];
  frontSteerPivots: THREE.Group[];
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  lightbarRed?: THREE.MeshStandardMaterial;
  lightbarBlue?: THREE.MeshStandardMaterial;
  headlightSpotLeft?: THREE.SpotLight;
  headlightSpotRight?: THREE.SpotLight;
  steeringWheel?: THREE.Group;
  smokeSprite: THREE.Sprite;
  setLights: (headlightIntensity: number, braking: boolean, policePulse?: number) => void;
  setCrashState: (crashed: boolean, health: number, elapsed: number) => void;
}

export function createProceduralVehicle(
  variant: VehicleVariant,
  mats: MaterialBank,
  withSpotlights = false
): ProceduralVehicle {
  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const contactPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.55, 5.25),
    mats.contactShadow
  );
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.y = 0.018;
  root.add(contactPlane);

  const paintColors: Record<VehicleVariant, number> = {
    muscle_hero: 0x050608,
    checker_cab: 0xe3a81e,
    police: 0x11151d,
    sedan_40s: 0x101824,
    red_finned: 0x8e1919,
  };

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paintColors[variant],
    roughness: variant === 'muscle_hero' ? 0.16 : 0.22,
    metalness: variant === 'muscle_hero' ? 0.2 : 0.24,
    clearcoat: 0.94,
    clearcoatRoughness: 0.08,
    envMapIntensity: variant === 'muscle_hero' ? 0.8 : 1.2,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x151618,
    roughness: 0.85,
    metalness: 0.05,
  });

  const whitewallMat = new THREE.MeshStandardMaterial({
    color: 0xe6e2d8,
    roughness: 0.72,
    metalness: 0.02,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    emissive: new THREE.Color(0xffe1a6),
    emissiveIntensity: 1.2,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0x6b080c,
    emissive: new THREE.Color(0xff201a),
    emissiveIntensity: 0.9,
    roughness: 0.18,
  });

  // 1. Primary sculpted chassis
  const hullShape = new THREE.Shape();
  if (variant === 'sedan_40s') {
    hullShape.moveTo(-2.25, 0.22);
    hullShape.lineTo(2.25, 0.22);
    hullShape.quadraticCurveTo(2.38, 0.65, 1.9, 0.88);
    hullShape.lineTo(0.85, 0.96);
    hullShape.quadraticCurveTo(0.45, 1.48, -0.35, 1.48);
    hullShape.quadraticCurveTo(-1.35, 1.42, -1.75, 0.94);
    hullShape.quadraticCurveTo(-2.32, 0.82, -2.25, 0.22);
  } else {
    hullShape.moveTo(-2.35, 0.22);
    hullShape.lineTo(2.35, 0.22);
    hullShape.lineTo(2.38, 0.74);
    hullShape.lineTo(1.25, 0.84);
    hullShape.lineTo(0.55, 1.28);
    hullShape.lineTo(-0.92, 1.28);
    hullShape.lineTo(-1.72, 0.86);
    hullShape.lineTo(-2.36, 0.78);
    hullShape.closePath();
  }

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.82,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  hullGeo.center();
  hullGeo.rotateY(Math.PI / 2);

  const hullMesh = new THREE.Mesh(hullGeo, paintMat);
  hullMesh.position.y = variant === 'sedan_40s' ? 0.85 : 0.75;
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyTiltGroup.add(hullMesh);

  // Side chrome beltline trim + side mirrors + chrome door handles + wheel fender flares
  const trimGeo = new THREE.BoxGeometry(0.05, 0.05, 3.6);
  const handleGeo = new THREE.BoxGeometry(0.05, 0.032, 0.16);
  const flareGeo = new THREE.TorusGeometry(0.43, 0.048, 8, 14, Math.PI);
  [-0.98, 0.98].forEach((sx) => {
    const sideTrim = new THREE.Mesh(trimGeo, mats.chrome);
    sideTrim.position.set(sx, 0.76, 0);
    const doorHandle = new THREE.Mesh(handleGeo, mats.chrome);
    doorHandle.position.set(sx + (sx > 0 ? 0.025 : -0.025), 0.82, 0.14);
    const mirrorStem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), mats.chrome);
    mirrorStem.position.set(sx + (sx > 0 ? 0.05 : -0.05), 0.92, -0.58);
    const mirrorCap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.07), mats.chrome);
    mirrorCap.position.set(sx + (sx > 0 ? 0.11 : -0.11), 0.94, -0.58);
    [-1.46, 1.46].forEach((fz) => {
      const flare = new THREE.Mesh(flareGeo, paintMat);
      flare.position.set(sx * 0.97, 0.36, fz);
      flare.rotation.y = Math.PI / 2;
      bodyTiltGroup.add(flare);
    });
    bodyTiltGroup.add(sideTrim, doorHandle, mirrorStem, mirrorCap);
  });

  // 2. Variant markings
  if (variant === 'police') {
    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6e6e0,
      roughness: 0.25,
      clearcoat: 0.8,
    });
    const whiteDoors = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.48, 1.35), whiteMat);
    whiteDoors.position.set(0, 0.62, 0.05);
    const whiteRoof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 1.25), whiteMat);
    whiteRoof.position.set(0, 1.31, 0.15);
    bodyTiltGroup.add(whiteDoors, whiteRoof);
  } else if (variant === 'checker_cab') {
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 128;
    checkerCanvas.height = 32;
    const cctx = checkerCanvas.getContext('2d')!;
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 4; y++) {
        cctx.fillStyle = (x + y) % 2 === 0 ? '#111111' : '#f2ede0';
        cctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.repeat.set(4, 1);
    checkerTex.colorSpace = THREE.SRGBColorSpace;
    const checkerMat = new THREE.MeshStandardMaterial({map: checkerTex, roughness: 0.4});
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.1, 3.6), checkerMat);
    strip.position.set(0, 0.74, 0.05);
    bodyTiltGroup.add(strip);

    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0xffe49e,
        emissive: new THREE.Color(0xffb833),
        emissiveIntensity: 1.4,
      })
    );
    taxiSign.position.set(0, 1.38, -0.05);
    bodyTiltGroup.add(taxiSign);
  } else if (variant === 'red_finned') {
    // Classic 1950s vertical tailfins
    [-0.84, 0.84].forEach((fx) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.95), paintMat);
      fin.position.set(fx, 0.92, 1.92);
      fin.rotation.x = 0.16;
      bodyTiltGroup.add(fin);
    });
  }

  // 3. Tinted greenhouse windshield & A/B/C roof pillars
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.46, 0.38, 1.58),
    mats.glassDark
  );
  windshield.position.set(0, 1.07, 0.18);
  bodyTiltGroup.add(windshield);

  [-0.75, 0.75].forEach((px) => {
    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.08), paintMat);
    bPillar.position.set(px, 1.08, 0.18);
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), paintMat);
    aPillar.position.set(px, 1.07, -0.56);
    aPillar.rotation.x = 0.42;
    bodyTiltGroup.add(bPillar, aPillar);
  });

  // 4. Muscle car twin hood scoops, chrome hood spear, rear deck spoiler
  if (variant === 'muscle_hero') {
    const scoopGeo = new THREE.BoxGeometry(0.32, 0.07, 0.78);
    const scoopL = new THREE.Mesh(scoopGeo, paintMat);
    scoopL.position.set(-0.34, 0.94, -1.35);
    const scoopR = new THREE.Mesh(scoopGeo, paintMat);
    scoopR.position.set(0.34, 0.94, -1.35);
    const hoodRib = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 1.45), mats.chrome);
    hoodRib.position.set(0, 0.92, -1.55);
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 0.24), mats.darkSteel);
    spoilerWing.position.set(0, 0.96, 2.18);
    spoilerWing.rotation.x = 0.12;
    [-0.68, 0.68].forEach((sx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.1), mats.darkSteel);
      post.position.set(sx, 0.88, 2.18);
      bodyTiltGroup.add(post);
    });
    bodyTiltGroup.add(scoopL, scoopR, hoodRib, spoilerWing);
  } else {
    // Classic chrome hood spear & crest
    const hoodSpear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 1.1), mats.chrome);
    hoodSpear.position.set(0, 0.95, -1.55);
    bodyTiltGroup.add(hoodSpear);
  }

  // Dual chrome exhaust tips
  const exhaustGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.24, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  [-0.58, 0.58].forEach((ex) => {
    const tip = new THREE.Mesh(exhaustGeo, mats.chrome);
    tip.position.set(ex, 0.26, 2.48);
    bodyTiltGroup.add(tip);
  });

  // Chrome bumpers
  const bumperGeo = new THREE.BoxGeometry(1.96, 0.14, 0.16);
  const frontBumper = new THREE.Mesh(bumperGeo, mats.chrome);
  frontBumper.position.set(0, 0.36, -2.5);
  const rearBumper = new THREE.Mesh(bumperGeo, mats.chrome);
  rearBumper.position.set(0, 0.36, 2.5);
  bodyTiltGroup.add(frontBumper, rearBumper);

  // Chrome grille slats
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.24, 0.08), mats.chrome);
  grille.position.set(0, 0.58, -2.47);
  bodyTiltGroup.add(grille);

  // Quad headlights
  const headGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.08, 14);
  headGeo.rotateX(Math.PI / 2);
  [-0.76, -0.56, 0.56, 0.76].forEach((hx) => {
    const hl = new THREE.Mesh(headGeo, headlightMat);
    hl.position.set(hx, 0.62, -2.46);
    bodyTiltGroup.add(hl);
  });

  // Wide segmented red taillight bar (Reference 11)
  const tailHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 0.16, 0.06),
    mats.darkSteel
  );
  tailHousing.position.set(0, 0.64, 2.45);
  bodyTiltGroup.add(tailHousing);

  [-0.66, -0.38, 0.38, 0.66].forEach((tx) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.05), taillightMat);
    seg.position.set(tx, 0.64, 2.47);
    bodyTiltGroup.add(seg);
  });

  const plateMat = new THREE.MeshStandardMaterial({color: 0xe6e1d3, roughness: 0.45});
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.05), plateMat);
  rearPlate.position.set(0, 0.5, 2.49);
  bodyTiltGroup.add(rearPlate);

  // Police roof lightbar
  let lightbarRed: THREE.MeshStandardMaterial | undefined;
  let lightbarBlue: THREE.MeshStandardMaterial | undefined;
  if (variant === 'police') {
    lightbarRed = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: new THREE.Color(0xff2222),
      emissiveIntensity: 2.2,
    });
    lightbarBlue = new THREE.MeshStandardMaterial({
      color: 0x2277ff,
      emissive: new THREE.Color(0x2277ff),
      emissiveIntensity: 0.4,
    });
    const barMount = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.18), mats.chrome);
    barMount.position.set(0, 1.38, 0.15);
    const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.2), lightbarRed);
    redPod.position.set(-0.28, 1.43, 0.15);
    const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.2), lightbarBlue);
    bluePod.position.set(0.28, 1.43, 0.15);
    bodyTiltGroup.add(barMount, redPod, bluePod);
  }

  // Hero car leather interior, seats, backlit gauges & steering wheel (Ref 17)
  let steeringWheel: THREE.Group | undefined;
  if (variant === 'muscle_hero') {
    const leatherSeatMat = new THREE.MeshStandardMaterial({color: 0x3b1f14, roughness: 0.62});
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.22, 0.34),
      new THREE.MeshStandardMaterial({color: 0x4b2816, roughness: 0.65})
    );
    dash.position.set(0, 0.84, -0.58);
    bodyTiltGroup.add(dash);

    // Seats
    [-0.38, 0.38].forEach((sx) => {
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.12), leatherSeatMat);
      seatBack.position.set(sx, 0.72, 0.22);
      seatBack.rotation.x = 0.15;
      bodyTiltGroup.add(seatBack);
    });

    const gaugeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16);
    gaugeGeo.rotateX(Math.PI / 2);
    const dialGlow = new THREE.MeshStandardMaterial({
      color: 0xffe4b3,
      emissive: new THREE.Color(0xffb552),
      emissiveIntensity: 1.4,
    });
    [-0.48, -0.32].forEach((gx) => {
      const bezel = new THREE.Mesh(gaugeGeo, mats.chrome);
      bezel.position.set(gx, 0.89, -0.4);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.052, 14), dialGlow);
      face.position.set(gx, 0.89, -0.378);
      bodyTiltGroup.add(bezel, face);
    });

    steeringWheel = new THREE.Group();
    steeringWheel.position.set(-0.4, 0.86, -0.32);
    steeringWheel.rotation.x = -0.35;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.022, 10, 24),
      new THREE.MeshStandardMaterial({color: 0x5c2e16, roughness: 0.48})
    );
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.02), mats.chrome);
    steeringWheel.add(rim, spoke);
    bodyTiltGroup.add(steeringWheel);
  }

  // 4 Articulated 5-spoke wheels with steering knuckles
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 22);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.255, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const whiteGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.25, 18);
  whiteGeo.rotateZ(Math.PI / 2);
  const spokeBarGeo = new THREE.BoxGeometry(0.27, 0.045, 0.39);

  const wheels: THREE.Group[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  const wheelPositions: Array<{x: number; z: number; front: boolean}> = [
    {x: -0.92, z: -1.46, front: true},
    {x: 0.92, z: -1.46, front: true},
    {x: -0.92, z: 1.46, front: false},
    {x: 0.92, z: 1.46, front: false},
  ];

  const brakeDiscGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16);
  brakeDiscGeo.rotateZ(Math.PI / 2);
  const caliperMat = new THREE.MeshStandardMaterial({
    color: variant === 'muscle_hero' ? 0xb82424 : 0x555b66,
    roughness: 0.42,
    metalness: 0.6,
  });

  const useWhitewalls = variant === 'sedan_40s' || variant === 'red_finned';
  for (const wp of wheelPositions) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wp.x, 0.36, wp.z);
    root.add(steerPivot);
    if (wp.front) frontSteerPivots.push(steerPivot);

    // Non-spinning brake caliper & rotor assembly inside wheel arch
    const disc = new THREE.Mesh(brakeDiscGeo, mats.chrome);
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.11), caliperMat);
    caliper.position.set(wp.x > 0 ? -0.04 : 0.04, 0.06, -0.08);
    steerPivot.add(disc, caliper);

    const wheelSpinGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, mats.chrome);
    wheelSpinGroup.add(tire, rim);
    for (let s = 0; s < 3; s++) {
      const sp = new THREE.Mesh(spokeBarGeo, mats.darkSteel);
      sp.rotation.x = (s * Math.PI) / 3;
      wheelSpinGroup.add(sp);
    }
    if (useWhitewalls) {
      const ww = new THREE.Mesh(whiteGeo, whitewallMat);
      wheelSpinGroup.add(ww);
    }
    steerPivot.add(wheelSpinGroup);
    wheels.push(wheelSpinGroup);
  }

  // Crash hood smoke sprite
  const smokeSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: mats.steamTexture,
      color: 0x3b3835,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  smokeSprite.position.set(0, 1.25, -1.7);
  smokeSprite.scale.setScalar(1.4);
  smokeSprite.visible = false;
  bodyTiltGroup.add(smokeSprite);

  let headlightSpotLeft: THREE.SpotLight | undefined;
  let headlightSpotRight: THREE.SpotLight | undefined;
  if (withSpotlights) {
    const makeSpot = (x: number) => {
      const spot = new THREE.SpotLight(0xffe7b8, 2.5, 42, Math.PI / 5.5, 0.55, 1.4);
      spot.position.set(x, 0.65, -2.35);
      spot.target.position.set(x * 0.7, 0.0, -18);
      bodyTiltGroup.add(spot);
      bodyTiltGroup.add(spot.target);
      return spot;
    };
    headlightSpotLeft = makeSpot(-0.68);
    headlightSpotRight = makeSpot(0.68);
  }

  return {
    group: root,
    bodyTiltGroup,
    wheels,
    frontSteerPivots,
    headlightMat,
    taillightMat,
    lightbarRed,
    lightbarBlue,
    headlightSpotLeft,
    headlightSpotRight,
    steeringWheel,
    smokeSprite,
    setLights(headlightIntensity: number, braking: boolean, policePulse = 0) {
      headlightMat.emissiveIntensity = 0.6 + headlightIntensity * 1.4;
      taillightMat.emissiveIntensity = braking ? 3.8 : 0.95 + headlightIntensity * 0.6;
      if (headlightSpotLeft && headlightSpotRight) {
        const sInt = headlightIntensity * 16;
        headlightSpotLeft.intensity = sInt;
        headlightSpotRight.intensity = sInt;
      }
      if (lightbarRed && lightbarBlue) {
        const alt = Math.sin(policePulse * 10) > 0;
        lightbarRed.emissiveIntensity = alt ? 3.2 : 0.3;
        lightbarBlue.emissiveIntensity = alt ? 0.3 : 3.2;
      }
    },
    setCrashState(crashed: boolean, health: number, elapsed: number) {
      if (!crashed && health >= 95) {
        smokeSprite.visible = false;
        return;
      }
      smokeSprite.visible = crashed || health < 75;
      const damageRatio = Math.max(0, (100 - health) / 100);
      const puff = (elapsed * 1.4) % 1;
      smokeSprite.position.set(
        Math.sin(elapsed * 2.5) * 0.16,
        1.15 + puff * 1.35,
        -1.65
      );
      smokeSprite.scale.setScalar(0.9 + puff * (1.2 + damageRatio * 1.5));
      smokeSprite.material.opacity = Math.sin(puff * Math.PI) * (0.28 + damageRatio * 0.45);
      // Hazard flash on taillights when wrecked
      if (crashed && Math.sin(elapsed * 12) > 0) {
        taillightMat.emissiveIntensity = 4.2;
      }
    },
  };
}

/**
 * Red-and-cream vintage streetcar (References 17 & 19)
 */
export function createVintageStreetcar(mats: MaterialBank): THREE.Group {
  const g = new THREE.Group();

  const redMat = new THREE.MeshStandardMaterial({
    color: 0x7b1d1d,
    roughness: 0.38,
    metalness: 0.18,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xe6dac1,
    roughness: 0.45,
    metalness: 0.06,
  });
  const interiorGlow = new THREE.MeshStandardMaterial({
    color: 0x3b2618,
    emissive: new THREE.Color(0xffb45a),
    emissiveIntensity: 1.35,
    roughness: 0.5,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.38, 2.38), mats.darkSteel);
  chassis.position.y = 0.42;
  g.add(chassis);

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.95, 2.48), redMat);
  lowerBody.position.y = 1.08;
  lowerBody.castShadow = true;
  g.add(lowerBody);

  const upperCore = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.92, 2.28), interiorGlow);
  upperCore.position.y = 2.02;
  g.add(upperCore);

  const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(10.52, 0.9, 2.46), mats.glassDark);
  windowGlass.position.y = 2.02;
  g.add(windowGlass);

  for (let x = -4.8; x <= 4.81; x += 1.2) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 2.52), creamMat);
    pillar.position.set(x, 2.02, 0);
    g.add(pillar);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.7, 0.28, 2.54), creamMat);
  roof.position.y = 2.62;
  roof.castShadow = true;
  g.add(roof);

  const cupola = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.2, 1.35), redMat);
  cupola.position.y = 2.84;
  g.add(cupola);

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: new THREE.Color(0xffcf77),
    emissiveIntensity: 2.4,
  });
  [-5.32, 5.32].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), lampMat);
    lamp.position.set(lx, 1.05, 0);
    g.add(lamp);
  });

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 14);
  wheelGeo.rotateX(Math.PI / 2);
  [-3.6, -2.5, 2.5, 3.6].forEach((wx) => {
    [-1.08, 1.08].forEach((wz) => {
      const w = new THREE.Mesh(wheelGeo, mats.darkSteel);
      w.position.set(wx, 0.32, wz);
      g.add(w);
    });
  });

  return g;
}
