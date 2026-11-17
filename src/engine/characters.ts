import * as THREE from 'three';
import type {MaterialBank} from './materials';

export interface ProceduralCharacter {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  handSocket: THREE.Group;
  markerRing?: THREE.Mesh;
  equipWeapon: (weaponGroup: THREE.Group | null) => void;
  triggerRecoil: (strength: number) => void;
  animate: (walkDistance: number, speed: number, time: number, dt?: number) => void;
}

export interface CharacterStyle {
  vestColor: number;
  shirtColor: number;
  trouserColor: number;
  hatColor: number;
  tieColor: number;
  skinColor: number;
  hasHolster: boolean;
  isWoman?: boolean;
  isKid?: boolean;
  hasQuestRing?: boolean;
}

export function createProceduralCharacter(
  style: CharacterStyle,
  mats: MaterialBank
): ProceduralCharacter {
  const root = new THREE.Group();
  const isKid = Boolean(style.isKid);
  const charScale = isKid ? 0.68 : 1.0;

  // Contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(isKid ? 0.3 : 0.42, 18),
    mats.contactShadow
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.016;
  root.add(shadow);

  let markerRing: THREE.Mesh | undefined;
  if (style.hasQuestRing) {
    markerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.56, 28),
      new THREE.MeshBasicMaterial({
        color: isKid ? 0x67d4ff : 0xe4b55c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.position.y = 0.025;
    root.add(markerRing);
  }

  const rigRoot = new THREE.Group();
  rigRoot.scale.setScalar(charScale);
  root.add(rigRoot);

  const vestMat = new THREE.MeshStandardMaterial({
    color: style.vestColor,
    roughness: 0.76,
    metalness: 0.05,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: style.shirtColor,
    roughness: 0.72,
    metalness: 0.02,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: style.trouserColor,
    roughness: 0.82,
    metalness: 0.03,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: style.skinColor,
    roughness: 0.58,
    metalness: 0.02,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x6b3b20,
    roughness: 0.42,
    metalness: 0.14,
  });
  const hatMat = new THREE.MeshStandardMaterial({
    color: style.hatColor,
    roughness: 0.74,
    metalness: 0.03,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x161414,
    roughness: 0.34,
    metalness: 0.16,
  });
  const eyeMat = new THREE.MeshStandardMaterial({color: 0x18171c, roughness: 0.25});

  // Hip / Torso anchor
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  rigRoot.add(torso);

  // Pelvis & tailored Vest/Coat
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(style.isWoman ? 0.32 : 0.37, 0.18, 0.23),
    trouserMat
  );
  pelvis.castShadow = true;
  torso.add(pelvis);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(style.isWoman ? 0.37 : 0.44, 0.49, 0.26),
    vestMat
  );
  chest.position.y = 0.31;
  chest.castShadow = true;
  torso.add(chest);

  // Waist belt & brass buckle
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(style.isWoman ? 0.34 : 0.39, 0.045, 0.25),
    leatherMat
  );
  belt.position.set(0, 0.08, 0);
  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.05, 0.028),
    mats.chrome
  );
  buckle.position.set(0, 0.08, -0.125);
  torso.add(belt, buckle);

  // Suit coat tail / skirt trim + lapels + pocket flaps
  if (!isKid && !style.isWoman) {
    const lapelGeo = new THREE.BoxGeometry(0.075, 0.29, 0.03);
    const lapelL = new THREE.Mesh(lapelGeo, vestMat);
    lapelL.position.set(-0.08, 0.41, -0.135);
    lapelL.rotation.z = -0.22;
    const lapelR = new THREE.Mesh(lapelGeo, vestMat);
    lapelR.position.set(0.08, 0.41, -0.135);
    lapelR.rotation.z = 0.22;
    const flapGeo = new THREE.BoxGeometry(0.095, 0.03, 0.025);
    const flapL = new THREE.Mesh(flapGeo, vestMat);
    flapL.position.set(-0.135, 0.16, -0.138);
    const flapR = new THREE.Mesh(flapGeo, vestMat);
    flapR.position.set(0.135, 0.16, -0.138);
    torso.add(lapelL, lapelR, flapL, flapR);
  } else if (style.isWoman) {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.27, 0.42, 16),
      vestMat
    );
    skirt.position.y = -0.14;
    skirt.castShadow = true;
    torso.add(skirt);
  }

  // Kid backpack / satchel
  if (isKid) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.14), leatherMat);
    pack.position.set(0, 0.32, 0.17);
    pack.castShadow = true;
    torso.add(pack);
  }

  // Shirt collar & tie
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.22), shirtMat);
  collar.position.set(0, 0.56, -0.01);
  torso.add(collar);

  const tie = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.28, 0.025),
    new THREE.MeshStandardMaterial({color: style.tieColor, roughness: 0.45})
  );
  tie.position.set(0, 0.36, -0.135);
  torso.add(tie);

  // Iconic leather X-strap shoulder holster (Refs 02, 06, 10)
  if (style.hasHolster && !isKid) {
    const strapGeo = new THREE.BoxGeometry(0.055, 0.48, 0.275);
    const strapA = new THREE.Mesh(strapGeo, leatherMat);
    strapA.position.set(0, 0.33, 0.005);
    strapA.rotation.z = 0.48;
    const strapB = new THREE.Mesh(strapGeo, leatherMat);
    strapB.position.set(0, 0.33, 0.005);
    strapB.rotation.z = -0.48;

    const backPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12),
      leatherMat
    );
    backPad.rotation.x = Math.PI / 2;
    backPad.position.set(0, 0.34, 0.14);

    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.17, 0.11), leatherMat);
    pouch.position.set(-0.23, 0.18, 0.02);

    torso.add(strapA, strapB, backPad, pouch);
  }

  // Head with sculpted facial hints & Hat/Hair
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0);
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.1, 10), skinMat);
  head.add(neck);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 14), skinMat);
  skull.position.y = 0.14;
  skull.scale.set(0.92, isKid ? 1.02 : 1.08, 0.96);
  skull.castShadow = true;
  head.add(skull);

  // Nose & eyes (facing -Z)
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.044, 0.034), skinMat);
  nose.position.set(0, 0.135, -0.125);
  const eyeGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.044, 0.16, -0.114);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.044, 0.16, -0.114);
  head.add(nose, eyeL, eyeR);

  if (isKid && !style.isWoman) {
    // 1940s Newsboy flat cap for boys
    const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, 1.45), hatMat);
    capCrown.position.set(0, 0.17, 0);
    capCrown.scale.set(1.02, 0.72, 1.15);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.016, 14, 1, false, -0.9, 1.8), hatMat);
    visor.position.set(0, 0.18, -0.07);
    visor.rotation.y = Math.PI;
    head.add(capCrown, visor);
  } else if (!style.isWoman) {
    // Fedora brim + pinched crown + dark ribbon band
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.235, 0.018, 20), hatMat);
    brim.position.set(0, 0.22, -0.01);
    brim.rotation.x = 0.06;
    brim.castShadow = true;

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.125, 18), hatMat);
    crown.position.set(0, 0.28, -0.01);
    crown.rotation.x = 0.06;

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.126, 0.128, 0.028, 18),
      new THREE.MeshStandardMaterial({color: 0x241d19, roughness: 0.55})
    );
    band.position.set(0, 0.236, -0.01);
    band.rotation.x = 0.06;

    head.add(brim, crown, band);
  } else {
    // 1940s hair + ribbon bow for kid girls
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 12),
      new THREE.MeshStandardMaterial({color: 0x1b120e, roughness: 0.65})
    );
    hair.position.set(0, 0.15, 0.02);
    head.add(hair);
    if (isKid) {
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.05), hatMat);
      bow.position.set(0.06, 0.28, 0.02);
      bow.rotation.z = -0.2;
      head.add(bow);
    }
  }

  // Arms (pivoted at shoulders) + jacket sleeves
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * (style.isWoman ? 0.23 : 0.27), 0.51, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.28, 0.115), isKid ? vestMat : shirtMat);
    upper.position.y = -0.13;
    upper.castShadow = true;
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.26, 0.098), isKid ? vestMat : shirtMat);
    fore.position.y = -0.37;
    fore.castShadow = true;
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.036, 0.104), shirtMat);
    cuff.position.y = -0.475;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), skinMat);
    hand.position.y = -0.52;
    armPivot.add(upper, fore, cuff, hand);
    torso.add(armPivot);
    return armPivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Hand socket attached to right hand for equipping 3D guns!
  const handSocket = new THREE.Group();
  handSocket.position.set(0, -0.51, -0.04);
  handSocket.rotation.x = -Math.PI / 2 + 0.15;
  rightArm.add(handSocket);

  // Legs
  const makeLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.1, 0.9, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.44, 0.155), trouserMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.4, 0.135), trouserMat);
    shin.position.y = -0.62;
    shin.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.08, 0.25), shoeMat);
    shoe.position.set(0, -0.845, -0.04);
    shoe.castShadow = true;
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.025, 0.26), leatherMat);
    sole.position.set(0, -0.892, -0.04);
    legPivot.add(thigh, shin, shoe, sole);
    rigRoot.add(legPivot);
    return legPivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  let currentWeapon: THREE.Group | null = null;
  let recoilTimer = 0;
  let recoilAmount = 0;

  return {
    group: root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    handSocket,
    markerRing,
    equipWeapon(weaponGroup: THREE.Group | null) {
      if (currentWeapon) {
        currentWeapon.removeFromParent();
      }
      currentWeapon = weaponGroup;
      if (weaponGroup) {
        handSocket.add(weaponGroup);
      }
    },
    triggerRecoil(strength: number) {
      recoilAmount = Math.min(1.0, strength);
      recoilTimer = 0.28;
    },
    animate(walkDistance: number, speed: number, time: number, dt = 0.016) {
      if (recoilTimer > 0) {
        recoilTimer = Math.max(0, recoilTimer - dt);
      }
      const aimFactor = recoilTimer > 0 ? Math.min(1, recoilTimer / 0.12) : 0;

      const moveWeight = Math.min(1, speed / 2.2);
      const stride = Math.sin(walkDistance * (isKid ? 3.5 : 2.8)) * 0.62 * moveWeight;
      const armSwing = Math.sin(walkDistance * (isKid ? 3.5 : 2.8)) * 0.48 * moveWeight;

      leftLeg.rotation.x = stride;
      rightLeg.rotation.x = -stride;
      leftArm.rotation.x = -armSwing;

      // Raise right arm smoothly to aim & kick upward when firing
      if (aimFactor > 0 && currentWeapon) {
        const kick = Math.sin((1 - recoilTimer / 0.28) * Math.PI) * 0.34 * recoilAmount;
        rightArm.rotation.x = THREE.MathUtils.lerp(armSwing, 1.38 + kick, aimFactor);
        handSocket.rotation.x = -0.15;
      } else {
        rightArm.rotation.x = currentWeapon ? armSwing * 0.4 + 0.18 : armSwing;
        handSocket.rotation.x = -Math.PI / 2 + 0.32;
      }

      const bob = Math.abs(Math.cos(walkDistance * 2.8)) * 0.035 * moveWeight;
      const idleBreath = Math.sin(time * (isKid ? 3.2 : 2.1)) * (isKid ? 0.015 : 0.008) * (1 - moveWeight);
      torso.position.y = 0.92 + bob + idleBreath;
      torso.rotation.z = Math.sin(walkDistance * 2.8) * 0.025 * moveWeight;

      if (markerRing) {
        const pulse = 1 + Math.sin(time * 3.0) * 0.08;
        markerRing.scale.setScalar(pulse);
      }
    },
  };
}
