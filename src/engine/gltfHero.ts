import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {MaterialBank} from './materials';

export interface GltfHeroInstance {
  group: THREE.Group;
  handSocket: THREE.Group;
  isGltfReady: () => boolean;
  equipWeapon: (weaponGroup: THREE.Group | null) => void;
  triggerRecoil: (strength: number) => void;
  animate: (walkDistance: number, speed: number, time: number, dt: number) => void;
  dispose: () => void;
}

interface TaggedPart {
  geo: THREE.BufferGeometry;
  boneIndex: number;
  color: number;
  tx?: number;
  ty?: number;
  tz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

function makePartGeometry(part: TaggedPart): THREE.BufferGeometry {
  const g = part.geo.clone().toNonIndexed();
  if (part.rx) g.rotateX(part.rx);
  if (part.ry) g.rotateY(part.ry);
  if (part.rz) g.rotateZ(part.rz);
  if (part.tx || part.ty || part.tz) {
    g.translate(part.tx ?? 0, part.ty ?? 0, part.tz ?? 0);
  }
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(part.color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    skinIndices[i * 4] = part.boneIndex;
    skinWeights[i * 4] = 1.0;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));
  g.deleteAttribute('uv');
  part.geo.dispose();
  return g;
}

function quatTrack(
  boneName: string,
  times: number[],
  eulers: Array<[number, number, number]>
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [rx, ry, rz] of eulers) {
    e.set(rx, ry, rz, 'XYZ');
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

function buildSkeletalClips(): THREE.AnimationClip[] {
  // 1. Idle (gentle breathing & poised gun stance)
  const idleClip = new THREE.AnimationClip('Idle', 2.4, [
    new THREE.VectorKeyframeTrack('Hip.position', [0, 1.2, 2.4], [0, 0.92, 0, 0, 0.935, 0, 0, 0.92, 0]),
    quatTrack('Spine', [0, 1.2, 2.4], [[0.02, 0, 0], [-0.01, 0, 0], [0.02, 0, 0]]),
    quatTrack('Head', [0, 1.2, 2.4], [[0, -0.04, 0], [0.02, 0.04, 0], [0, -0.04, 0]]),
    quatTrack('ArmL', [0, 1.2, 2.4], [[0.04, 0, -0.06], [-0.02, 0, -0.05], [0.04, 0, -0.06]]),
    quatTrack('ArmR', [0, 1.2, 2.4], [[0.14, 0, 0.06], [0.18, 0, 0.05], [0.14, 0, 0.06]]),
    quatTrack('ForeR', [0, 1.2, 2.4], [[0.22, 0, 0], [0.25, 0, 0], [0.22, 0, 0]]),
    quatTrack('LegL', [0, 2.4], [[0, 0, 0], [0, 0, 0]]),
    quatTrack('LegR', [0, 2.4], [[0, 0, 0], [0, 0, 0]]),
  ]);

  // 2. Walk (natural 1940s detective stride)
  const wt = [0, 0.25, 0.5, 0.75, 1.0];
  const walkClip = new THREE.AnimationClip('Walk', 1.0, [
    new THREE.VectorKeyframeTrack(
      'Hip.position',
      wt,
      [0, 0.92, 0, 0, 0.955, 0, 0, 0.92, 0, 0, 0.955, 0, 0, 0.92, 0]
    ),
    quatTrack('Spine', wt, [
      [0.05, 0.05, 0.02],
      [0.04, 0, 0],
      [0.05, -0.05, -0.02],
      [0.04, 0, 0],
      [0.05, 0.05, 0.02],
    ]),
    quatTrack('LegL', wt, [
      [0.52, 0, 0],
      [0, 0, 0],
      [-0.52, 0, 0],
      [0, 0, 0],
      [0.52, 0, 0],
    ]),
    quatTrack('LegR', wt, [
      [-0.52, 0, 0],
      [0, 0, 0],
      [0.52, 0, 0],
      [0, 0, 0],
      [-0.52, 0, 0],
    ]),
    quatTrack('ArmL', wt, [
      [-0.44, 0, -0.05],
      [0, 0, -0.05],
      [0.44, 0, -0.05],
      [0, 0, -0.05],
      [-0.44, 0, -0.05],
    ]),
    quatTrack('ArmR', wt, [
      [0.34, 0, 0.06],
      [0.18, 0, 0.06],
      [0.02, 0, 0.06],
      [0.18, 0, 0.06],
      [0.34, 0, 0.06],
    ]),
    quatTrack('ForeR', wt, [
      [0.28, 0, 0],
      [0.24, 0, 0],
      [0.2, 0, 0],
      [0.24, 0, 0],
      [0.28, 0, 0],
    ]),
  ]);

  // 3. Run (urgent sprint)
  const rt = [0, 0.16, 0.32, 0.48, 0.64];
  const runClip = new THREE.AnimationClip('Run', 0.64, [
    new THREE.VectorKeyframeTrack(
      'Hip.position',
      rt,
      [0, 0.9, 0, 0, 0.97, 0, 0, 0.9, 0, 0, 0.97, 0, 0, 0.9, 0]
    ),
    quatTrack('Spine', rt, [
      [0.18, 0.08, 0.03],
      [0.16, 0, 0],
      [0.18, -0.08, -0.03],
      [0.16, 0, 0],
      [0.18, 0.08, 0.03],
    ]),
    quatTrack('LegL', rt, [
      [0.86, 0, 0],
      [0, 0, 0],
      [-0.86, 0, 0],
      [0, 0, 0],
      [0.86, 0, 0],
    ]),
    quatTrack('LegR', rt, [
      [-0.86, 0, 0],
      [0, 0, 0],
      [0.86, 0, 0],
      [0, 0, 0],
      [-0.86, 0, 0],
    ]),
    quatTrack('ArmL', rt, [
      [-0.78, 0, -0.06],
      [0, 0, -0.06],
      [0.78, 0, -0.06],
      [0, 0, -0.06],
      [-0.78, 0, -0.06],
    ]),
    quatTrack('ArmR', rt, [
      [0.65, 0, 0.07],
      [0.35, 0, 0.07],
      [0.05, 0, 0.07],
      [0.35, 0, 0.07],
      [0.65, 0, 0.07],
    ]),
    quatTrack('ForeR', rt, [
      [0.52, 0, 0],
      [0.44, 0, 0],
      [0.36, 0, 0],
      [0.44, 0, 0],
      [0.52, 0, 0],
    ]),
  ]);

  // 4. Fire (crisp arm raise + muzzle recoil kick)
  const ft = [0, 0.08, 0.22, 0.34];
  const fireClip = new THREE.AnimationClip('Fire', 0.34, [
    quatTrack('Spine', ft, [
      [0.04, -0.14, 0],
      [-0.04, -0.18, 0],
      [0.02, -0.1, 0],
      [0.02, 0, 0],
    ]),
    quatTrack('ArmR', ft, [
      [1.36, -0.06, 0],
      [1.62, -0.06, 0],
      [1.38, -0.06, 0],
      [0.24, 0, 0.06],
    ]),
    quatTrack('ForeR', ft, [
      [0.12, 0, 0],
      [0.24, 0, 0],
      [0.12, 0, 0],
      [0.22, 0, 0],
    ]),
  ]);

  return [idleClip, walkClip, runClip, fireClip];
}

function buildExportSourceRig(): {
  exportScene: THREE.Group;
  clips: THREE.AnimationClip[];
} {
  const exportScene = new THREE.Group();
  exportScene.name = 'VitoMenottiGLTF';

  // Build hierarchical bone skeleton (indices 0..7)
  const hip = new THREE.Bone();
  hip.name = 'Hip';
  hip.position.set(0, 0.92, 0);

  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.set(0, 0.34, 0);
  hip.add(spine);

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.28, 0);
  spine.add(head);

  const armL = new THREE.Bone();
  armL.name = 'ArmL';
  armL.position.set(-0.27, 0.17, 0);
  spine.add(armL);

  const armR = new THREE.Bone();
  armR.name = 'ArmR';
  armR.position.set(0.27, 0.17, 0);
  spine.add(armR);

  const foreR = new THREE.Bone();
  foreR.name = 'ForeR';
  foreR.position.set(0, -0.26, 0);
  armR.add(foreR);

  const legL = new THREE.Bone();
  legL.name = 'LegL';
  legL.position.set(-0.1, -0.02, 0);
  hip.add(legL);

  const legR = new THREE.Bone();
  legR.name = 'LegR';
  legR.position.set(0.1, -0.02, 0);
  hip.add(legR);

  const bones = [hip, spine, head, armL, armR, foreR, legL, legR];

  // Construct vertex-skinned parts in hero root space (with Hip at y=0.92)
  const parts: THREE.BufferGeometry[] = [
    // 0: Hip / pelvis + belt & brass buckle
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.37, 0.18, 0.23),
      boneIndex: 0,
      color: 0x201d1c,
      ty: 0.92,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.39, 0.05, 0.25),
      boneIndex: 0,
      color: 0x3b2214,
      ty: 0.99,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.06, 0.055, 0.03),
      boneIndex: 0,
      color: 0xd4a857,
      ty: 0.99,
      tz: -0.125,
    }),
    // 1: Spine / Charcoal vest + coat lapels + cream shirt collar + crimson tie + leather X-holster
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.45, 0.49, 0.27),
      boneIndex: 1,
      color: 0x2d2926,
      ty: 1.24,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.075, 0.29, 0.03),
      boneIndex: 1,
      color: 0x393430,
      tx: -0.08,
      ty: 1.33,
      tz: -0.14,
      rz: -0.22,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.075, 0.29, 0.03),
      boneIndex: 1,
      color: 0x393430,
      tx: 0.08,
      ty: 1.33,
      tz: -0.14,
      rz: 0.22,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.2, 0.08, 0.22),
      boneIndex: 1,
      color: 0xd9d2c5,
      ty: 1.49,
      tz: -0.01,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.06, 0.28, 0.025),
      boneIndex: 1,
      color: 0x6e1f24,
      ty: 1.28,
      tz: -0.14,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.055, 0.48, 0.285),
      boneIndex: 1,
      color: 0x6b3b20,
      ty: 1.25,
      tz: 0.005,
      rz: 0.48,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.055, 0.48, 0.285),
      boneIndex: 1,
      color: 0x6b3b20,
      ty: 1.25,
      tz: 0.005,
      rz: -0.48,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.075, 0.17, 0.11),
      boneIndex: 1,
      color: 0x6b3b20,
      tx: -0.235,
      ty: 1.1,
      tz: 0.02,
    }),
    // 2: Head / neck + sculpted skull + nose + eyes + Borsalino fedora & ribbon
    makePartGeometry({
      geo: new THREE.CylinderGeometry(0.065, 0.075, 0.11, 10),
      boneIndex: 2,
      color: 0xd9b394,
      ty: 1.54,
    }),
    makePartGeometry({
      geo: new THREE.SphereGeometry(0.132, 16, 12),
      boneIndex: 2,
      color: 0xd9b394,
      ty: 1.68,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.026, 0.044, 0.034),
      boneIndex: 2,
      color: 0xc99f7f,
      ty: 1.675,
      tz: -0.125,
    }),
    makePartGeometry({
      geo: new THREE.SphereGeometry(0.015, 8, 8),
      boneIndex: 2,
      color: 0x161519,
      tx: -0.044,
      ty: 1.7,
      tz: -0.115,
    }),
    makePartGeometry({
      geo: new THREE.SphereGeometry(0.015, 8, 8),
      boneIndex: 2,
      color: 0x161519,
      tx: 0.044,
      ty: 1.7,
      tz: -0.115,
    }),
    makePartGeometry({
      geo: new THREE.CylinderGeometry(0.225, 0.235, 0.018, 20),
      boneIndex: 2,
      color: 0x26211e,
      ty: 1.76,
      tz: -0.01,
      rx: 0.06,
    }),
    makePartGeometry({
      geo: new THREE.CylinderGeometry(0.105, 0.125, 0.125, 18),
      boneIndex: 2,
      color: 0x26211e,
      ty: 1.82,
      tz: -0.01,
      rx: 0.06,
    }),
    makePartGeometry({
      geo: new THREE.CylinderGeometry(0.127, 0.129, 0.028, 18),
      boneIndex: 2,
      color: 0x6e1f24,
      ty: 1.776,
      tz: -0.01,
      rx: 0.06,
    }),
    // 3: Left Arm + cuff + hand
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.12, 0.28, 0.12),
      boneIndex: 3,
      color: 0x2d2926,
      tx: -0.27,
      ty: 1.3,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.102, 0.25, 0.102),
      boneIndex: 3,
      color: 0x2d2926,
      tx: -0.27,
      ty: 1.06,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.106, 0.04, 0.106),
      boneIndex: 3,
      color: 0xd9d2c5,
      tx: -0.27,
      ty: 0.94,
    }),
    makePartGeometry({
      geo: new THREE.SphereGeometry(0.048, 10, 8),
      boneIndex: 3,
      color: 0xd9b394,
      tx: -0.27,
      ty: 0.89,
    }),
    // 4: Right Upper Arm
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.12, 0.28, 0.12),
      boneIndex: 4,
      color: 0x2d2926,
      tx: 0.27,
      ty: 1.3,
    }),
    // 5: Right Forearm + shirt cuff + right hand
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.102, 0.25, 0.102),
      boneIndex: 5,
      color: 0x2d2926,
      tx: 0.27,
      ty: 1.06,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.106, 0.04, 0.106),
      boneIndex: 5,
      color: 0xd9d2c5,
      tx: 0.27,
      ty: 0.94,
    }),
    makePartGeometry({
      geo: new THREE.SphereGeometry(0.048, 10, 8),
      boneIndex: 5,
      color: 0xd9b394,
      tx: 0.27,
      ty: 0.89,
    }),
    // 6: Left Leg + Shoe
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.148, 0.44, 0.158),
      boneIndex: 6,
      color: 0x201d1c,
      tx: -0.1,
      ty: 0.68,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.128, 0.4, 0.138),
      boneIndex: 6,
      color: 0x201d1c,
      tx: -0.1,
      ty: 0.28,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.138, 0.095, 0.255),
      boneIndex: 6,
      color: 0x151313,
      tx: -0.1,
      ty: 0.048,
      tz: -0.04,
    }),
    // 7: Right Leg + Shoe
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.148, 0.44, 0.158),
      boneIndex: 7,
      color: 0x201d1c,
      tx: 0.1,
      ty: 0.68,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.128, 0.4, 0.138),
      boneIndex: 7,
      color: 0x201d1c,
      tx: 0.1,
      ty: 0.28,
    }),
    makePartGeometry({
      geo: new THREE.BoxGeometry(0.138, 0.095, 0.255),
      boneIndex: 7,
      color: 0x151313,
      tx: 0.1,
      ty: 0.048,
      tz: -0.04,
    }),
  ];

  const mergedGeo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();

  const skinMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.68,
    metalness: 0.06,
  });

  const skinnedMesh = new THREE.SkinnedMesh(mergedGeo, skinMat);
  skinnedMesh.name = 'VitoSkinnedMesh';
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;

  exportScene.add(hip);
  exportScene.add(skinnedMesh);

  // Update matrices prior to binding skeleton so inverseBindMatrices are exact
  exportScene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.bind(skeleton);

  const clips = buildSkeletalClips();
  return {exportScene, clips};
}

/**
 * Generates an in-memory binary GLTF (.glb) skeletal hero character with Idle, Walk, Run, and Fire clips,
 * loads it via GLTFLoader, and drives real bone skinning with THREE.AnimationMixer.
 */
export function createGltfHero(mats: MaterialBank): GltfHeroInstance {
  const root = new THREE.Group();
  root.name = 'VitoMenottiRoot';

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 18),
    mats.contactShadow
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.016;
  root.add(shadow);

  const handSocket = new THREE.Group();
  handSocket.name = 'VitoWeaponSocket';
  let currentWeapon: THREE.Group | null = null;

  let loadedRoot: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  const actions: Record<'idle' | 'walk' | 'run' | 'fire', THREE.AnimationAction | null> = {
    idle: null,
    walk: null,
    run: null,
    fire: null,
  };
  let currentLocomotion: 'idle' | 'walk' | 'run' = 'idle';
  let recoilTimer = 0;
  let gltfReady = false;
  let disposed = false;

  // Build & load real binary GLTF asynchronously (resolves in ~10ms with zero network requests)
  const {exportScene, clips} = buildExportSourceRig();
  const exporter = new GLTFExporter();
  const loader = new GLTFLoader();

  void exporter
    .parseAsync(exportScene, {binary: true, animations: clips})
    .then((result) => {
      if (disposed) return;
      const buffer = result instanceof ArrayBuffer ? result : new ArrayBuffer(0);
      return loader.parseAsync(buffer, '');
    })
    .then((gltf) => {
      if (disposed || !gltf) return;
      loadedRoot = gltf.scene;
      loadedRoot.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      const foreR = loadedRoot.getObjectByName('ForeR');
      if (foreR) {
        handSocket.position.set(0, -0.26, -0.04);
        handSocket.rotation.set(-Math.PI / 2 + 0.25, 0, 0);
        foreR.add(handSocket);
      } else {
        loadedRoot.add(handSocket);
      }

      if (currentWeapon) {
        handSocket.add(currentWeapon);
      }

      mixer = new THREE.AnimationMixer(loadedRoot);
      const findClip = (name: string) =>
        THREE.AnimationClip.findByName(gltf.animations, name) ?? gltf.animations[0];

      actions.idle = mixer.clipAction(findClip('Idle'));
      actions.walk = mixer.clipAction(findClip('Walk'));
      actions.run = mixer.clipAction(findClip('Run'));
      const fireClip = findClip('Fire');
      actions.fire = mixer.clipAction(fireClip);
      actions.fire.setLoop(THREE.LoopOnce, 1);
      actions.fire.clampWhenFinished = false;

      actions.idle.play();
      currentLocomotion = 'idle';
      root.add(loadedRoot);
      gltfReady = true;

      // Clean up temporary export source geometry
      exportScene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
    })
    .catch((err) => {
      console.warn('GLTF hero pipeline fallback:', err);
    });

  return {
    group: root,
    handSocket,
    isGltfReady: () => gltfReady,
    equipWeapon(weaponGroup: THREE.Group | null) {
      if (currentWeapon) currentWeapon.removeFromParent();
      currentWeapon = weaponGroup;
      if (weaponGroup) {
        handSocket.add(weaponGroup);
      }
    },
    triggerRecoil(_strength: number) {
      recoilTimer = 0.34;
      if (actions.fire) {
        actions.fire.reset();
        actions.fire.setEffectiveWeight(1.0);
        actions.fire.play();
      }
    },
    animate(_walkDistance: number, speed: number, _time: number, dt: number) {
      if (!mixer) return;
      if (recoilTimer > 0) recoilTimer = Math.max(0, recoilTimer - dt);

      const desired: 'idle' | 'walk' | 'run' =
        speed > 4.2 ? 'run' : speed > 0.35 ? 'walk' : 'idle';

      if (desired !== currentLocomotion) {
        const prev = actions[currentLocomotion];
        const next = actions[desired];
        if (next) {
          next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
          if (prev) prev.crossFadeTo(next, 0.16, true);
        }
        currentLocomotion = desired;
      }

      if (currentLocomotion === 'walk' && actions.walk) {
        actions.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 3.0, 0.65, 1.5));
      } else if (currentLocomotion === 'run' && actions.run) {
        actions.run.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 5.5, 0.85, 1.45));
      }

      if (recoilTimer > 0) {
        handSocket.rotation.x = -0.18;
      } else {
        handSocket.rotation.x = -Math.PI / 2 + 0.28;
      }

      mixer.update(Math.min(dt, 0.05));
    },
    dispose() {
      disposed = true;
      mixer?.stopAllAction();
      loadedRoot?.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
    },
  };
}
