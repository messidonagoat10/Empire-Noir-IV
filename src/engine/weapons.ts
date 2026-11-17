import * as THREE from 'three';
import type {MaterialBank} from './materials';
import type {WeaponId} from '../game/types';

export interface WeaponRig {
  group: THREE.Group;
  muzzleFlash: THREE.Mesh;
}

/**
 * Builds distinct procedural 3D weapon models for all 4 syndicate firearms:
 * - revolver (.38 Snub Revolver)
 * - pistol (1911 Chrome Automatic)
 * - tommy (M1928 Thompson Submachine Gun with drum magazine)
 * - shotgun (Sawed-Off Double Barrel 12-Gauge)
 */
export function createWeaponModel(weaponId: WeaponId, mats: MaterialBank): WeaponRig {
  const g = new THREE.Group();

  const gunSteel = new THREE.MeshStandardMaterial({
    color: 0x20242b,
    roughness: 0.32,
    metalness: 0.85,
  });
  const walnut = new THREE.MeshStandardMaterial({
    color: 0x5c3018,
    roughness: 0.52,
    metalness: 0.08,
  });

  let muzzleZ = -0.22;
  let muzzleY = 0.04;

  if (weaponId === 'revolver') {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.048), walnut);
    grip.position.set(0, -0.04, 0.04);
    grip.rotation.x = 0.28;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.055, 0.13), gunSteel);
    frame.position.set(0, 0.02, -0.02);

    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.06, 12),
      mats.chrome
    );
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.set(0, 0.025, -0.015);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.015, 0.14, 10),
      gunSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.035, -0.14);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.014), mats.chrome);
    sight.position.set(0, 0.052, -0.195);

    g.add(grip, frame, cylinder, barrel, sight);
    muzzleZ = -0.22;
    muzzleY = 0.035;
  } else if (weaponId === 'pistol') {
    // 1911 Chrome Automatic
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.115, 0.048), walnut);
    grip.position.set(0, -0.045, 0.035);
    grip.rotation.x = 0.22;

    const lowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.032, 0.18), gunSteel);
    lowerFrame.position.set(0, 0.01, -0.04);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.036, 0.21), mats.chrome);
    slide.position.set(0, 0.042, -0.055);

    const barrelTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.03, 10),
      gunSteel
    );
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.04, -0.17);

    g.add(grip, lowerFrame, slide, barrelTip);
    muzzleZ = -0.19;
    muzzleY = 0.04;
  } else if (weaponId === 'tommy') {
    // M1928 Tommy Gun with Walnut Stock, Vertical Foregrip & Iconic Drum Magazine
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.11, 0.24), walnut);
    stock.position.set(0, -0.02, 0.17);
    stock.rotation.x = 0.16;

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.075, 0.34), gunSteel);
    receiver.position.set(0, 0.03, -0.05);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.046), walnut);
    grip.position.set(0, -0.05, 0.04);
    grip.rotation.x = 0.25;

    const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.12, 10), walnut);
    foregrip.position.set(0, -0.055, -0.24);
    foregrip.rotation.x = -0.12;

    // Iconic round 50-rd drum magazine
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.058, 20), gunSteel);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.07, -0.09);

    const drumFace = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.064, 16), mats.chrome);
    drumFace.rotation.x = Math.PI / 2;
    drumFace.position.set(0, -0.07, -0.09);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.36, 12), gunSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.042, -0.38);

    const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.055, 10), mats.chrome);
    comp.rotation.x = Math.PI / 2;
    comp.position.set(0, 0.042, -0.55);

    g.add(stock, receiver, grip, foregrip, drum, drumFace, barrel, comp);
    muzzleZ = -0.59;
    muzzleY = 0.042;
  } else {
    // Sawed-off Double Barrel Shotgun
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.095, 0.22), walnut);
    stock.position.set(0, -0.02, 0.14);
    stock.rotation.x = 0.24;

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.068, 0.14), mats.chrome);
    receiver.position.set(0, 0.025, 0.0);

    const forend = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.042, 0.18), walnut);
    forend.position.set(0, 0.004, -0.16);

    const barrelGeo = new THREE.CylinderGeometry(0.017, 0.018, 0.42, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelL = new THREE.Mesh(barrelGeo, gunSteel);
    barrelL.position.set(-0.019, 0.042, -0.27);
    const barrelR = new THREE.Mesh(barrelGeo, gunSteel);
    barrelR.position.set(0.019, 0.042, -0.27);

    g.add(stock, receiver, forend, barrelL, barrelR);
    muzzleZ = -0.50;
    muzzleY = 0.042;
  }

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 1), flashMat);
  muzzleFlash.position.set(0, muzzleY, muzzleZ);
  muzzleFlash.visible = false;
  g.add(muzzleFlash);

  return {group: g, muzzleFlash};
}
