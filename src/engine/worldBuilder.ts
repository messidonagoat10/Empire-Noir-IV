import * as THREE from 'three';
import type {MaterialBank} from './materials';
import {createSignTexture} from './textures';
import {createProceduralVehicle, createVintageStreetcar, type ProceduralVehicle} from './vehicles';
import {createProceduralCharacter, type ProceduralCharacter} from './characters';
import {createWeaponModel} from './weapons';
import {NPC_DEFINITIONS} from '../game/constants';
import type {AtmosphereParams, TrafficVehicleState, WeatherMode} from '../game/types';

export interface AmbientPedestrian {
  char: ProceduralCharacter;
  axis: 'x' | 'z';
  pos: number;
  lane: number;
  dir: 1 | -1;
  speed: number;
  min: number;
  max: number;
  walkDist: number;
}

export interface WorldHandles {
  root: THREE.Group;
  streetLights: THREE.PointLight[];
  trafficGreenMats: THREE.MeshStandardMaterial[];
  trafficRedMats: THREE.MeshStandardMaterial[];
  streetcarNorth: THREE.Group;
  streetcarSouth: THREE.Group;
  initialTrafficStates: TrafficVehicleState[];
  trafficMeshes: Map<string, ProceduralVehicle>;
  npcs: Map<string, ProceduralCharacter>;
  pedestrians: AmbientPedestrian[];
  waypointBeacon: THREE.Group;
  steamSprites: Array<{mesh: THREE.Sprite; baseX: number; baseZ: number; phase: number}>;
  rainPoints: THREE.Points;
  updateDynamic: (
    dt: number,
    elapsed: number,
    atmo: AtmosphereParams,
    weather: WeatherMode,
    playerPos: THREE.Vector3,
    trafficStates: TrafficVehicleState[],
    quality: 'cinematic' | 'high' | 'balanced'
  ) => void;
  dispose: () => void;
}

function makeNeonSignMesh(
  width: number,
  height: number,
  texOpts: Parameters<typeof createSignTexture>[0],
  mats: MaterialBank,
  baseEmissive = 1.25
): THREE.Group {
  const g = new THREE.Group();
  const tex = createSignTexture(texOpts, mats.maxAnisotropy);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: baseEmissive,
    roughness: 0.35,
  });
  mats.neonMaterials.push(faceMat);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.16, height + 0.16, 0.22),
    mats.darkSteel
  );
  const faceFront = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  faceFront.position.z = 0.115;
  const faceBack = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  faceBack.position.z = -0.115;
  faceBack.rotation.y = Math.PI;
  g.add(housing, faceFront, faceBack);
  return g;
}

function addFireEscape(
  parent: THREE.Group,
  x: number,
  z: number,
  rotY: number,
  floors: number,
  mats: MaterialBank
) {
  const fe = new THREE.Group();
  fe.position.set(x, 0, z);
  fe.rotation.y = rotY;
  const balconyGeo = new THREE.BoxGeometry(3.2, 0.08, 0.95);
  const railGeo = new THREE.BoxGeometry(3.2, 0.72, 0.05);
  const ladderGeo = new THREE.BoxGeometry(0.06, 3.6, 0.06);

  for (let f = 1; f <= floors; f++) {
    const y = f * 3.6;
    const plat = new THREE.Mesh(balconyGeo, mats.darkSteel);
    plat.position.set(0, y, 0.48);
    const rail = new THREE.Mesh(railGeo, mats.darkSteel);
    rail.position.set(0, y + 0.4, 0.94);
    const ladL = new THREE.Mesh(ladderGeo, mats.darkSteel);
    ladL.position.set(-0.7, y - 1.6, 0.56);
    ladL.rotation.x = 0.32;
    const ladR = new THREE.Mesh(ladderGeo, mats.darkSteel);
    ladR.position.set(-0.2, y - 1.6, 0.56);
    ladR.rotation.x = 0.32;
    fe.add(plat, rail, ladL, ladR);
  }
  parent.add(fe);
}

function addWaterTower(parent: THREE.Group, x: number, yBase: number, z: number, mats: MaterialBank) {
  const g = new THREE.Group();
  g.position.set(x, yBase, z);
  const legGeo = new THREE.BoxGeometry(0.18, 2.8, 0.18);
  [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, mats.darkSteel);
    leg.position.set(lx, 1.4, lz);
    g.add(leg);
  });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.8, 16), mats.woodFrame);
  tank.position.y = 4.1;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.1, 16), mats.darkSteel);
  cone.position.y = 6.0;
  g.add(tank, cone);
  parent.add(g);
}

function addStreetLamp(
  parent: THREE.Group,
  x: number,
  z: number,
  armDirX: number,
  mats: MaterialBank,
  lightList: THREE.PointLight[]
) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.12, 5.2, 10),
    mats.darkSteel
  );
  post.position.y = 2.6;
  post.castShadow = true;
  g.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), mats.darkSteel);
  arm.position.set(armDirX * 0.55, 5.1, 0);
  g.add(arm);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4ad,
    emissive: new THREE.Color(0xffb552),
    emissiveIntensity: 1.5,
  });
  mats.streetLampBulbs.push(bulbMat);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), bulbMat);
  lantern.position.set(armDirX * 1.05, 4.92, 0);
  g.add(lantern);

  if (lightList.length < 4) {
    const pt = new THREE.PointLight(0xffb14d, 1.5, 24, 1.6);
    pt.position.set(x + armDirX * 1.05, 4.75, z);
    parent.add(pt);
    lightList.push(pt);
  }

  parent.add(g);
}

function addTree(parent: THREE.Group, x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);

  const trunkMat = new THREE.MeshStandardMaterial({color: 0x3b2c22, roughness: 0.9});
  const leafMat = new THREE.MeshStandardMaterial({color: 0x3d4f28, roughness: 0.86});

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 3.0, 8), trunkMat);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  g.add(trunk);

  const crowns = [
    {x: 0, y: 4.1, z: 0, r: 1.45},
    {x: 0.75, y: 3.6, z: 0.45, r: 1.05},
    {x: -0.7, y: 3.7, z: -0.4, r: 1.1},
    {x: 0.15, y: 4.9, z: -0.2, r: 0.95},
  ];
  for (const c of crowns) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r, 1), leafMat);
    m.position.set(c.x, c.y, c.z);
    m.castShadow = true;
    g.add(m);
  }
  parent.add(g);
}

function addBench(parent: THREE.Group, x: number, z: number, rotY: number, mats: MaterialBank) {
  const b = new THREE.Group();
  b.position.set(x, 0.14, z);
  b.rotation.y = rotY;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.55), mats.woodFrame);
  seat.position.y = 0.44;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.07), mats.woodFrame);
  back.position.set(0, 0.7, -0.24);
  back.rotation.x = -0.14;
  [-0.82, 0.82].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.5), mats.darkSteel);
    leg.position.set(lx, 0.22, 0);
    b.add(leg);
  });
  b.add(seat, back);
  parent.add(b);
}

export function buildNoirCityWorld(mats: MaterialBank): WorldHandles {
  const root = new THREE.Group();
  const streetLights: THREE.PointLight[] = [];
  const trafficGreenMats: THREE.MeshStandardMaterial[] = [];
  const trafficRedMats: THREE.MeshStandardMaterial[] = [];

  // 1. Ginormous 580x560m Metropolis Base + 5 North-South Avenues + 5 East-West Cross Streets
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(780, 780),
    new THREE.MeshStandardMaterial({color: 0x15171c, roughness: 0.86, metalness: 0.05})
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.04;
  outerGround.receiveShadow = true;
  root.add(outerGround);

  // 5 North-South Avenues: Fifth West (-150), West Broadway (-68), Tenth Ave (0), Harbor Blvd (+68), East 150th (+150)
  const aveGeo = new THREE.PlaneGeometry(18, 376);
  [-150, -68, 0, 68, 150].forEach((ax) => {
    const ave = new THREE.Mesh(aveGeo, mats.asphalt);
    ave.rotation.x = -Math.PI / 2;
    ave.position.set(ax, 0, -78);
    ave.receiveShadow = true;
    root.add(ave);
  });

  // 5 East-West Cross Streets: z = -170, -94, -34, +34, +94
  const crossRoadGeo = new THREE.PlaneGeometry(516, 16);
  [-170, -94, -34, 34, 94].forEach((cz) => {
    const cr = new THREE.Mesh(crossRoadGeo, mats.asphalt);
    cr.rotation.x = -Math.PI / 2;
    cr.position.set(0, 0.004, cz);
    cr.receiveShadow = true;
    root.add(cr);
  });

  // East Garage Alley (Tenth Ave -> Vinnie's Garage Bay)
  const alley = new THREE.Mesh(new THREE.PlaneGeometry(28, 10), mats.asphalt);
  alley.rotation.x = -Math.PI / 2;
  alley.position.set(24, 0.005, 0);
  alley.receiveShadow = true;
  root.add(alley);

  // Sidewalks raised 0.14m above asphalt across the 580x560m metropolis
  const makeSidewalkBlock = (x: number, z: number, w: number, d: number) => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), mats.sidewalk);
    sw.position.set(x, 0.07, z);
    sw.receiveShadow = true;
    root.add(sw);
  };
  // Central bay (x: -59..-11 & +11..+59)
  makeSidewalkBlock(-35, 0, 48, 50);
  makeSidewalkBlock(35, -14.5, 48, 21);
  makeSidewalkBlock(35, 14.5, 48, 21);
  makeSidewalkBlock(0, -64, 118, 44);
  makeSidewalkBlock(0, 64, 118, 44);
  // North Midtown & Uptown rows
  [-110, 0, 110].forEach((bx, idx) => {
    const w = idx === 1 ? 118 : 68;
    makeSidewalkBlock(bx, -131, w, 52);
    makeSidewalkBlock(bx, -217, w, 72);
  });
  // West Broadway blocks (-139..-77) & Harbor Blvd blocks (+77..+139)
  [-109, 109].forEach((bx) => {
    makeSidewalkBlock(bx, -64, 66, 44);
    makeSidewalkBlock(bx, 0, 66, 50);
    makeSidewalkBlock(bx, 64, 66, 44);
  });
  // Outer West (-249..-159) & Outer East (+159..+249) districts
  [-204, 204].forEach((bx) => {
    makeSidewalkBlock(bx, -217, 90, 72);
    makeSidewalkBlock(bx, -131, 90, 52);
    makeSidewalkBlock(bx, -64, 90, 44);
    makeSidewalkBlock(bx, 0, 90, 50);
    makeSidewalkBlock(bx, 64, 90, 44);
  });

  // Crosswalks at major avenue intersections
  const cwGeo = new THREE.PlaneGeometry(16.4, 3.6);
  [-150, -68, 0, 68, 150].forEach((ax) => {
    [-103.5, -43.5, -24.5, 24.5, 43.5].forEach((cz) => {
      const cw = new THREE.Mesh(cwGeo, mats.crosswalk);
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(ax, 0.022, cz);
      root.add(cw);
    });
  });

  // Streetcar Rails along North Cross (z = -31) and South Cross (z = +31)
  [-31.7, -30.3, 30.3, 31.7].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(490, 0.03, 0.09), mats.chrome);
    rail.position.set(0, 0.025, rz);
    root.add(rail);
  });

  // 2. Central West Block + OPEN ENTERABLE FUEL BAR & LOUNGE (x: -23.5..-13.5, z: 5.5..18.5)
  const addCappedBuilding = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    matIdx: number,
    waterTower = false
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.buildings[matIdx % mats.buildings.length]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.55, d + 0.55), mats.limestone);
    cornice.position.set(x, h + 0.2, z);
    root.add(cornice);

    if (waterTower) {
      addWaterTower(root, x - w * 0.22, h + 0.45, z + d * 0.18, mats);
    }
    return mesh;
  };

  addCappedBuilding(-34.8, -10, 42, 23, 28, 0, true);
  addCappedBuilding(-39.8, 14, 32, 18, 19.6, 2, false);
  // Fuel Bar upper floors (starts above 4.6m ceiling so interior is open!)
  const fuelUpper = new THREE.Mesh(new THREE.BoxGeometry(10.4, 13.5, 19.6), mats.buildings[2]);
  fuelUpper.position.set(-18.6, 11.4, 14);
  fuelUpper.castShadow = true;
  root.add(fuelUpper);

  // --- Hospitable Interior 1: FUEL BAR & LOUNGE (Doorway open x=-13.5, z=10..14) ---
  const fuelInterior = new THREE.Group();
  const fuelFloor = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 13.0), mats.woodFloor);
  fuelFloor.rotation.x = -Math.PI / 2;
  fuelFloor.position.set(-18.6, 0.16, 12.0);
  fuelFloor.receiveShadow = true;
  const fuelCeiling = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.3, 13.2), mats.woodFrame);
  fuelCeiling.position.set(-18.6, 4.5, 12.0);
  fuelInterior.add(fuelFloor, fuelCeiling);

  // Back & side walls inside Fuel Bar
  const wallMatWarm = new THREE.MeshStandardMaterial({color: 0x3b2214, roughness: 0.78});
  const fuelBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.4, 13.2), wallMatWarm);
  fuelBackWall.position.set(-23.5, 2.3, 12.0);
  const fuelSideN = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.4, 0.4), wallMatWarm);
  fuelSideN.position.set(-18.6, 2.3, 5.6);
  const fuelSideS = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.4, 0.4), wallMatWarm);
  fuelSideS.position.set(-18.6, 2.3, 18.4);
  fuelInterior.add(fuelBackWall, fuelSideN, fuelSideS);

  // Storefront glass & wooden mullions leaving open center doorway (z=10..14)
  [-4.8, 4.8].forEach((zOff) => {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 4.2), mats.glassDark);
    pane.position.set(-13.6, 2.2, 12.0 + zOff);
    fuelInterior.add(pane);
  });
  const barHeader = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 13.4), mats.woodFrame);
  barHeader.position.set(-13.4, 4.05, 12.0);
  fuelInterior.add(barHeader);

  // Mahogany Bar Counter + Barstools + Tables + Glowing Jukebox
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 7.2), mats.woodFrame);
  barCounter.position.set(-20.4, 0.72, 11.8);
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 7.4), mats.chrome);
  barTop.position.set(-20.4, 1.32, 11.8);
  const liquorShelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 6.2), mats.woodFrame);
  liquorShelf.position.set(-23.0, 1.8, 11.8);
  fuelInterior.add(barCounter, barTop, liquorShelf);

  const bottleColors = [0xd4a857, 0x34a853, 0xa83232, 0xff9f40];
  for (let bz = 9.4; bz <= 14.2; bz += 0.6) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.34, 8),
      new THREE.MeshStandardMaterial({
        color: bottleColors[Math.floor(bz) % bottleColors.length],
        emissive: new THREE.Color(0xffb45a),
        emissiveIntensity: 0.45,
        roughness: 0.2,
      })
    );
    bottle.position.set(-22.9, 2.25, bz);
    fuelInterior.add(bottle);
  }

  for (let sz = 9.0; sz <= 14.6; sz += 1.4) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.75, 12), mats.darkSteel);
    stool.position.set(-19.2, 0.52, sz);
    const cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12),
      new THREE.MeshStandardMaterial({color: 0x7a1f24, roughness: 0.5})
    );
    cushion.position.set(-19.2, 0.92, sz);
    fuelInterior.add(stool, cushion);
  }

  // Round lounge tables & glowing Jukebox
  [
    {x: -16.4, z: 8.2},
    {x: -16.4, z: 15.8},
  ].forEach((tp) => {
    const tPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.85, 10), mats.darkSteel);
    tPost.position.set(tp.x, 0.56, tp.z);
    const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 16), mats.woodFrame);
    tTop.position.set(tp.x, 1.0, tp.z);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.24, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffe49e,
        emissive: new THREE.Color(0xff9933),
        emissiveIntensity: 1.5,
      })
    );
    lampShade.position.set(tp.x, 1.24, tp.z);
    fuelInterior.add(tPost, tTop, lampShade);
  });

  const jukebox = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.65, 1.05),
    new THREE.MeshStandardMaterial({
      color: 0x5c1a1b,
      emissive: new THREE.Color(0xff8438),
      emissiveIntensity: 0.9,
      roughness: 0.3,
    })
  );
  jukebox.position.set(-22.4, 0.98, 17.2);
  fuelInterior.add(jukebox);

  const fuelWarmLamp = new THREE.PointLight(0xffa448, 2.2, 15, 1.5);
  fuelWarmLamp.position.set(-18.2, 3.8, 12.0);
  fuelInterior.add(fuelWarmLamp);
  streetLights.push(fuelWarmLamp);

  const fuelSign = makeNeonSignMesh(
    11.0,
    1.15,
    {
      bg: '#7d2618',
      border: '#d4a857',
      title: 'FUEL  BAR',
      textColor: '#ffefd1',
      glowColor: '#ff8a3d',
      fontSize: 64,
    },
    mats,
    0.85
  );
  fuelSign.rotation.y = Math.PI / 2;
  fuelSign.position.set(-13.0, 4.24, 12.0);
  fuelInterior.add(fuelSign);
  root.add(fuelInterior);

  // AMERICAR Billboard & HOTEL vertical neon on central west block
  const americarBoard = makeNeonSignMesh(
    11.5,
    4.6,
    {
      width: 640,
      height: 256,
      bg: '#1c1b18',
      border: '#a6864f',
      title: 'AMERICAR',
      subtitle: 'Best way to see the U.S.A.!',
      textColor: '#f5ead2',
      fontSize: 56,
      retroCar: true,
    },
    mats,
    0.35
  );
  americarBoard.rotation.y = Math.PI / 2;
  americarBoard.position.set(-13.35, 7.6, -9);
  root.add(americarBoard);

  const hotelSign = makeNeonSignMesh(
    1.5,
    6.4,
    {
      width: 160,
      height: 512,
      bg: '#141724',
      border: '#57d6ff',
      title: 'HOTEL',
      textColor: '#ff708c',
      glowColor: '#ff4268',
      vertical: true,
      fontSize: 70,
    },
    mats,
    1.8
  );
  hotelSign.position.set(-12.7, 10.2, -20.5);
  root.add(hotelSign);

  addFireEscape(root, -13.5, -14.5, Math.PI / 2, 4, mats);

  // 3. Central North-East Block: MIRAGE + OPEN ENTERABLE JOE'S CORNER DINER
  addCappedBuilding(39.7, -14.5, 32.6, 24, 19, 1, true);
  const mirageMain = addCappedBuilding(18.5, -11.3, 9.8, 22, 12.6, 1, false);
  mirageMain.castShadow = true;

  // Joe's Diner Upper Floor above ground bay
  const dinerUpper = new THREE.Mesh(new THREE.BoxGeometry(9.8, 17.5, 6.4), mats.buildings[0]);
  dinerUpper.position.set(18.5, 13.0, -20.8);
  root.add(dinerUpper);

  // --- Hospitable Interior 2: JOE'S CORNER DINER (x: 13.6..23.2, z: -23..-16.5) ---
  const dinerGroup = new THREE.Group();
  const dinerFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6.4), mats.dinerFloor);
  dinerFloorMesh.rotation.x = -Math.PI / 2;
  dinerFloorMesh.position.set(18.4, 0.16, -20.2);
  dinerFloorMesh.receiveShadow = true;
  const dinerCeiling = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.28, 6.4), mats.darkSteel);
  dinerCeiling.position.set(18.4, 4.15, -20.2);
  const dinerCounter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 4.4), mats.chrome);
  dinerCounter.position.set(20.6, 0.68, -20.2);
  const dinerBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.0, 6.4), wallMatWarm);
  dinerBack.position.set(23.1, 2.1, -20.2);
  dinerGroup.add(dinerFloorMesh, dinerCeiling, dinerCounter, dinerBack);

  const boothMat = new THREE.MeshStandardMaterial({color: 0x992424, roughness: 0.48});
  for (let dz = -22.0; dz <= -18.4; dz += 1.2) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.72, 10), boothMat);
    stool.position.set(19.6, 0.52, dz);
    dinerGroup.add(stool);
  }
  const boothTable = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.9), mats.chrome);
  boothTable.position.set(16.0, 0.52, -22.0);
  const boothSeat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 0.55), boothMat);
  boothSeat.position.set(16.0, 0.62, -22.65);
  const dinerSign = makeNeonSignMesh(
    5.4,
    1.1,
    {
      bg: '#0c1626',
      border: '#60a5fa',
      title: "JOE'S DINER",
      textColor: '#e0f2fe',
      glowColor: '#38bdf8',
      fontSize: 54,
    },
    mats,
    1.5
  );
  dinerSign.rotation.y = -Math.PI / 2;
  dinerSign.position.set(13.45, 3.85, -20.2);
  dinerGroup.add(boothTable, boothSeat, dinerSign);
  root.add(dinerGroup);

  // Mirage Marquee & Neon Rings
  const marqueeGroup = new THREE.Group();
  marqueeGroup.position.set(13.5, 4.4, -12.5);
  const marqueeDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 3.8, 1.35, 24, 1, false, Math.PI * 0.5, Math.PI),
    mats.darkSteel
  );
  marqueeGroup.add(marqueeDrum);

  const neonRingMat = new THREE.MeshStandardMaterial({
    color: 0xff5e42,
    emissive: new THREE.Color(0xff3c28),
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  mats.neonMaterials.push(neonRingMat);

  [-0.56, 0.56].forEach((ry) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.86, 0.06, 8, 28, Math.PI),
      neonRingMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = Math.PI / 2;
    ring.position.y = ry;
    marqueeGroup.add(ring);
  });

  [3.6, 4.8, 6.0].forEach((sy) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 14.5), neonRingMat);
    strip.position.set(0.05, sy, -0.5);
    marqueeGroup.add(strip);
  });

  const mirageSign = makeNeonSignMesh(
    6.6,
    1.7,
    {
      width: 640,
      height: 192,
      bg: '#1c0c0d',
      border: '#ff5238',
      title: 'MIRAGE',
      subtitle: 'TEEN LAWYER  ·  POINT  ·  8:30 PM',
      textColor: '#fff0d6',
      glowColor: '#ff4824',
      fontSize: 82,
    },
    mats,
    1.95
  );
  mirageSign.rotation.y = -Math.PI / 2;
  mirageSign.position.set(-3.82, 0.72, 0);
  marqueeGroup.add(mirageSign);
  root.add(marqueeGroup);

  const coffeeBlade = makeNeonSignMesh(
    1.5,
    6.8,
    {
      width: 180,
      height: 512,
      bg: '#0d1a2d',
      border: '#60a5fa',
      title: 'COFFEE',
      textColor: '#dbeafe',
      glowColor: '#3b82f6',
      vertical: true,
      fontSize: 66,
    },
    mats,
    1.65
  );
  coffeeBlade.position.set(12.6, 10.6, -21.8);
  root.add(coffeeBlade);

  // --- Hospitable Interior 3: VINNIE'S GARAGE & ARMORY BAY (x: 25.5..35.5, z: -4.4..4.4) ---
  addCappedBuilding(46, 0, 20, 15, 10, 3, false);
  const garageBayRoof = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.35, 9.6), mats.darkSteel);
  garageBayRoof.position.set(30.5, 4.6, 0);
  const garageBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 9.6), mats.buildings[3]);
  garageBackWall.position.set(35.4, 2.25, 0);
  const workBench = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 5.2), mats.woodFrame);
  workBench.position.set(34.5, 0.5, 0);
  const liftPostL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.28), mats.chrome);
  liftPostL.position.set(29.8, 1.8, -2.6);
  const liftPostR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.28), mats.chrome);
  liftPostR.position.set(29.8, 1.8, 2.6);
  // Display weapon models mounted on Garage Armory bench!
  const tommyDisplay = createWeaponModel('tommy', mats).group;
  tommyDisplay.position.set(34.3, 1.15, -1.2);
  tommyDisplay.scale.setScalar(1.35);
  const shotgunDisplay = createWeaponModel('shotgun', mats).group;
  shotgunDisplay.position.set(34.3, 1.15, 1.1);
  shotgunDisplay.scale.setScalar(1.35);
  root.add(garageBayRoof, garageBackWall, workBench, liftPostL, liftPostR, tommyDisplay, shotgunDisplay);

  const garageSign = makeNeonSignMesh(
    3.8,
    1.1,
    {
      bg: '#081b10',
      border: '#34e877',
      title: 'GARAGE · ARMORY',
      textColor: '#4aff8e',
      glowColor: '#22e066',
      fontSize: 44,
    },
    mats,
    2.1
  );
  garageSign.position.set(18.5, 4.6, -4.75);
  root.add(garageSign);

  // SE Block (Pizza + Casino)
  addCappedBuilding(34.7, 14.5, 42.5, 21, 19, 0, true);
  const pizzaSign = makeNeonSignMesh(
    3.6,
    1.25,
    {
      bg: '#0a160c',
      border: '#42f56c',
      title: 'PIZZA',
      textColor: '#f5e9c9',
      glowColor: '#3be363',
      fontSize: 70,
    },
    mats,
    1.8
  );
  pizzaSign.position.set(11.8, 6.2, 8.8);
  root.add(pizzaSign);
  addFireEscape(root, 13.5, 14.5, -Math.PI / 2, 4, mats);

  // 4. Classical Domed Courthouse at North End (z = -66)
  const courthouse = new THREE.Group();
  courthouse.position.set(0, 0, -68);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(34, 2.2, 22), mats.limestone);
  plinth.position.y = 1.1;
  plinth.receiveShadow = true;
  const steps = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 5), mats.limestone);
  steps.position.set(0, 0.6, 13);
  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 18), mats.limestone);
  mainHall.position.y = 9.2;
  mainHall.castShadow = true;
  courthouse.add(plinth, steps, mainHall);

  const colGeo = new THREE.CylinderGeometry(0.46, 0.54, 11.4, 14);
  for (let cx = -11; cx <= 11.1; cx += 3.66) {
    const col = new THREE.Mesh(colGeo, mats.limestone);
    col.position.set(cx, 7.9, 10.6);
    col.castShadow = true;
    courthouse.add(col);
  }
  const entablature = new THREE.Mesh(new THREE.BoxGeometry(26.8, 1.5, 3.4), mats.limestone);
  entablature.position.set(0, 14.3, 9.9);
  courthouse.add(entablature);

  const pedShape = new THREE.Shape();
  pedShape.moveTo(-13.6, 0);
  pedShape.lineTo(13.6, 0);
  pedShape.lineTo(0, 4.2);
  pedShape.closePath();
  const pedGeo = new THREE.ExtrudeGeometry(pedShape, {
    depth: 3.2,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 1,
  });
  const pediment = new THREE.Mesh(pedGeo, mats.limestone);
  pediment.position.set(0, 15.05, 8.3);
  courthouse.add(pediment);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 7.2, 24), mats.limestone);
  drum.position.set(0, 19.6, -1);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(7.1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mats.limestone
  );
  dome.position.set(0, 23.1, -1);
  const lanternTop = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 3.6, 12), mats.limestone);
  lanternTop.position.set(0, 31.1, -1);
  courthouse.add(drum, dome, lanternTop);
  root.add(courthouse);

  // 5. OPEN LIBERTY PARK (x: 22..56, z: -84..-44) with Fountain, Lawns, Benches & Trees!
  const parkLawn = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 40),
    new THREE.MeshStandardMaterial({color: 0x263822, roughness: 0.92})
  );
  parkLawn.rotation.x = -Math.PI / 2;
  parkLawn.position.set(39, 0.16, -64);
  parkLawn.receiveShadow = true;
  root.add(parkLawn);

  const fountainPool = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 0.75, 24), mats.limestone);
  fountainPool.position.set(39, 0.52, -64);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.0, 0.12, 24),
    new THREE.MeshPhysicalMaterial({color: 0x225a70, roughness: 0.1, clearcoat: 1})
  );
  fountainWater.position.set(39, 0.85, -64);
  const fountainSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 2.6, 14), mats.limestone);
  fountainSpire.position.set(39, 1.7, -64);
  root.add(fountainPool, fountainWater, fountainSpire);

  addBench(root, 34, -60, Math.PI * 0.5, mats);
  addBench(root, 44, -60, -Math.PI * 0.5, mats);
  addBench(root, 39, -56, 0, mats);
  addTree(root, 26, -78, 1.25);
  addTree(root, 52, -78, 1.2);
  addTree(root, 26, -48, 1.15);
  addTree(root, 52, -48, 1.3);

  // 6. West Broadway — Hospitable Interior 4: MERCY CLINIC (x: -95..-78, z: -8.5..8.5)
  addCappedBuilding(-39, -64, 34, 32, 40, 3, true); // NW block
  addCappedBuilding(-111, -64, 66, 26, 40, 0, false);
  addCappedBuilding(-111, 64, 66, 24, 40, 2, true);
  // Clinic side & back buildings leaving center bay open at x=-78, z=-2.2..+2.2
  addCappedBuilding(-120, 0, 48, 20, 48, 1, false);
  addCappedBuilding(-86.5, -16.5, 17, 18, 15.5, 1, false);
  addCappedBuilding(-86.5, 16.5, 17, 18, 15.5, 1, false);
  const clinicUpper = new THREE.Mesh(new THREE.BoxGeometry(17.2, 13.5, 17.2), mats.buildings[1]);
  clinicUpper.position.set(-86.6, 11.4, 0);
  root.add(clinicUpper);

  const clinicFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(17.0, 17.0), mats.clinicFloor);
  clinicFloorMesh.rotation.x = -Math.PI / 2;
  clinicFloorMesh.position.set(-86.6, 0.16, 0);
  const clinicDesk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.05, 4.6), mats.woodFrame);
  clinicDesk.position.set(-91.2, 0.68, 0);
  const cotMat = new THREE.MeshStandardMaterial({color: 0xe8ecee, roughness: 0.65});
  [-5.2, 5.2].forEach((cz) => {
    const cot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 1.1), cotMat);
    cot.position.set(-88.5, 0.48, cz);
    root.add(cot);
  });
  const clinicSign = makeNeonSignMesh(
    6.4,
    1.2,
    {
      bg: '#f2f4f7',
      border: '#b91c1c',
      title: '+ MERCY CLINIC',
      textColor: '#b91c1c',
      glowColor: '#ef4444',
      fontSize: 52,
    },
    mats,
    1.2
  );
  clinicSign.rotation.y = Math.PI / 2;
  clinicSign.position.set(-77.8, 4.2, 0);
  root.add(clinicFloorMesh, clinicDesk, clinicSign);

  // 7B. OUTER WEST: FIFTH & WEST BESPOKE TAILORS (open doorway x=-160, z=-2.6..+2.6) + WEST RAILYARD
  addCappedBuilding(-204, -64, 86, 26, 40, 2, true);
  addCappedBuilding(-204, 64, 86, 24, 40, 0, false);
  addCappedBuilding(-214, 0, 68, 22, 48, 3, false); // Back mass x: -248..-180
  addCappedBuilding(-169, -16.5, 18, 19, 15.5, 2, false);
  addCappedBuilding(-169, 16.5, 18, 19, 15.5, 2, false);
  const tailorUpper = new THREE.Mesh(new THREE.BoxGeometry(18, 13.5, 17.2), mats.buildings[2]);
  tailorUpper.position.set(-169, 11.4, 0);
  root.add(tailorUpper);

  const tailorFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(18.0, 17.0), mats.woodFloor);
  tailorFloorMesh.rotation.x = -Math.PI / 2;
  tailorFloorMesh.position.set(-169, 0.16, 0);
  const tailorTable = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 4.4), mats.woodFrame);
  tailorTable.position.set(-173, 0.62, 0);
  const clothRollMat = new THREE.MeshStandardMaterial({color: 0x6b1d24, roughness: 0.72});
  [-2.8, 2.8].forEach((mz) => {
    const bust = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.95, 10), clothRollMat);
    bust.position.set(-166.5, 1.15, mz);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 0.65, 8), mats.darkSteel);
    stand.position.set(-166.5, 0.45, mz);
    root.add(bust, stand);
  });
  const tailorAwning = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.25, 6.2),
    new THREE.MeshStandardMaterial({color: 0x6b2024, roughness: 0.7})
  );
  tailorAwning.position.set(-159.2, 3.45, 0);
  tailorAwning.rotation.z = 0.2;
  const tailorSign = makeNeonSignMesh(
    6.4,
    1.25,
    {
      bg: '#1c1512',
      border: '#d4a857',
      title: 'BESPOKE TAILORS',
      textColor: '#fde68a',
      glowColor: '#f59e0b',
      fontSize: 48,
    },
    mats,
    1.55
  );
  tailorSign.rotation.y = Math.PI / 2;
  tailorSign.position.set(-159.8, 4.4, 0);
  root.add(tailorFloorMesh, tailorTable, tailorAwning, tailorSign);

  // West Railyard Freight Spur & Boxcars (-248..-162, z=-156..-106 & spur along z=-195)
  addCappedBuilding(-205, -131, 86, 18, 48, 3, true);
  [-195.8, -194.2].forEach((rz) => {
    const spurRail = new THREE.Mesh(new THREE.BoxGeometry(175, 0.06, 0.12), mats.chrome);
    spurRail.position.set(-165, 0.04, rz);
    root.add(spurRail);
  });
  const boxcarMat = new THREE.MeshStandardMaterial({color: 0x6b2c24, roughness: 0.76});
  [-210, -186].forEach((bx) => {
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(16, 3.6, 3.1), boxcarMat);
    carBody.position.set(bx, 2.25, -195);
    carBody.castShadow = true;
    root.add(carBody);
  });

  // 7C. OUTER EAST: GOLDEN DRAGON TEA HOUSE (open doorway x=+160, z=-2.6..+2.6) + EAST FOUNDRY
  addCappedBuilding(204, -64, 86, 22, 40, 3, false);
  addCappedBuilding(204, 64, 86, 25, 40, 1, false);
  addCappedBuilding(214, 0, 68, 24, 48, 0, false); // Back mass x: +180..+248
  addCappedBuilding(169, -16.5, 18, 20, 15.5, 0, false);
  addCappedBuilding(169, 16.5, 18, 20, 15.5, 0, false);
  const dragonUpper = new THREE.Mesh(new THREE.BoxGeometry(18, 13.5, 17.2), mats.buildings[0]);
  dragonUpper.position.set(169, 11.4, 0);
  root.add(dragonUpper);

  const dragonFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(18.0, 17.0), mats.dinerFloor);
  dragonFloorMesh.rotation.x = -Math.PI / 2;
  dragonFloorMesh.position.set(169, 0.16, 0);
  const dragonCounter = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.05, 5.2),
    new THREE.MeshStandardMaterial({color: 0x5c1414, roughness: 0.4})
  );
  dragonCounter.position.set(173, 0.68, 0);
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xff4238,
    emissive: new THREE.Color(0xff2e1c),
    emissiveIntensity: 2.2,
    roughness: 0.35,
  });
  mats.neonMaterials.push(lanternMat);
  [-3.8, 3.8].forEach((lz) => {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), lanternMat);
    lantern.scale.y = 1.3;
    lantern.position.set(159.0, 3.1, lz);
    root.add(lantern);
  });
  const dragonSign = makeNeonSignMesh(
    6.4,
    1.25,
    {
      bg: '#2b080a',
      border: '#facc15',
      title: 'GOLDEN DRAGON',
      textColor: '#fef08a',
      glowColor: '#ef4444',
      fontSize: 50,
    },
    mats,
    1.8
  );
  dragonSign.rotation.y = -Math.PI / 2;
  dragonSign.position.set(159.8, 4.4, 0);
  root.add(dragonFloorMesh, dragonCounter, dragonSign);

  // East Docks Maritime Foundry smokestacks & crane yard (oe-far-north)
  addCappedBuilding(205, -131, 86, 20, 48, 3, true);
  [184, 212].forEach((sx) => {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.0, 34, 14), mats.darkSteel);
    stack.position.set(sx, 36, -131);
    root.add(stack);
  });

  // South Midtown & Far North Blocks
  addCappedBuilding(-34.5, 64, 42, 24, 40, 1, false);
  addCappedBuilding(34.5, 64, 42, 25, 40, 0, true);
  addCappedBuilding(-107, -131, 58, 32, 48, 3, false);
  addCappedBuilding(-34.5, -131, 42, 34, 48, 0, true);
  addCappedBuilding(34.5, -131, 42, 30, 48, 2, false);
  addCappedBuilding(107, -131, 58, 36, 48, 1, true);

  // Uptown Exchange Financial Skyline Plaza (z: -252..-182)
  addCappedBuilding(-205, -217, 78, 48, 66, 3, false);
  addCappedBuilding(-107, -217, 56, 62, 66, 0, false);
  addCappedBuilding(-35, -217, 40, 84, 66, 3, false);
  addCappedBuilding(35, -217, 40, 92, 66, 1, false);
  addCappedBuilding(107, -217, 56, 58, 66, 2, false);
  addCappedBuilding(205, -217, 78, 46, 66, 0, false);

  const exchangeSign = makeNeonSignMesh(
    9.2,
    1.4,
    {
      bg: '#101420',
      border: '#d4a857',
      title: 'LIBERTY EXCHANGE',
      textColor: '#fef3c7',
      glowColor: '#f59e0b',
      fontSize: 52,
    },
    mats,
    1.45
  );
  exchangeSign.position.set(-35, 8.2, -181.6);
  root.add(exchangeSign);

  // 8. HUGE WATERFRONT HARBOR, EXTENDED PIER 4 (z: 102..248) & TWIN FREIGHTERS
  const harborWater = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 260),
    new THREE.MeshPhysicalMaterial({
      color: 0x0b2330,
      roughness: 0.14,
      metalness: 0.25,
      clearcoat: 0.9,
      envMapIntensity: 1.5,
    })
  );
  harborWater.rotation.x = -Math.PI / 2;
  harborWater.position.set(0, -0.35, 232);
  root.add(harborWater);

  // Harbor Warehouses flanking pier across the waterfront
  addCappedBuilding(-38, 108, 36, 11, 10, 3, false);
  addCappedBuilding(38, 108, 36, 11, 10, 3, false);
  addCappedBuilding(-160, 108, 164, 12, 10, 3, false);
  addCappedBuilding(160, 108, 164, 12, 10, 3, false);

  // Extended Driveable Wooden Pier jutting deep into Liberty Harbor (x: -12..+12, z: 102..248)
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 148), mats.woodFloor);
  pierDeck.position.set(0, 0.02, 175);
  pierDeck.receiveShadow = true;
  root.add(pierDeck);

  // Pier Gantry Cranes
  [-14, 14].forEach((gx, idx) => {
    const gz = idx === 0 ? 185 : 225;
    const gantry = new THREE.Group();
    gantry.position.set(gx, 0, gz);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 18, 2.6), mats.darkSteel);
    tower.position.y = 9;
    const boom = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 1.8), mats.darkSteel);
    boom.position.set(gx > 0 ? -5 : 5, 17.5, 0);
    gantry.add(tower, boom);
    root.add(gantry);
  });

  const pierSign = makeNeonSignMesh(
    6.4,
    1.15,
    {
      bg: '#13212c',
      border: '#d4a857',
      title: 'LIBERTY PIER 4',
      textColor: '#fef3c7',
      glowColor: '#f59e0b',
      fontSize: 54,
    },
    mats,
    1.3
  );
  pierSign.position.set(0, 4.4, 106);
  root.add(pierSign);

  // Twin Moored Cargo Freighters docked parallel along extended pier
  const makeFreighter = (sx: number, sz: number, rotY = 0) => {
    const shipGroup = new THREE.Group();
    shipGroup.position.set(sx, 0, sz);
    shipGroup.rotation.y = rotY;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 5.2, 46), mats.darkSteel);
    hull.position.y = 2.0;
    const redKeel = new THREE.Mesh(
      new THREE.BoxGeometry(11.2, 1.4, 46.2),
      new THREE.MeshStandardMaterial({color: 0x6b1d1d, roughness: 0.7})
    );
    redKeel.position.y = 0.2;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 5.5, 8.5),
      new THREE.MeshStandardMaterial({color: 0xe6dfd0, roughness: 0.65})
    );
    bridge.position.set(0, 7.2, 12);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 4.2, 12), mats.darkSteel);
    funnel.position.set(0, 11.4, 13);
    shipGroup.add(hull, redKeel, bridge, funnel);
    root.add(shipGroup);
  };
  makeFreighter(22, 142, 0);
  makeFreighter(-23, 206, Math.PI);

  // 9. Distant Iconic Skyline + Instanced Outer Metropolis Towers (fast on SwiftShader!)
  const skylineGroup = new THREE.Group();
  const skyMat = new THREE.MeshStandardMaterial({
    color: 0x3b3536,
    emissive: new THREE.Color(0xffbe73),
    emissiveMap: mats.buildings[3].emissiveMap,
    emissiveIntensity: 0.4,
    roughness: 0.85,
  });
  const empBase = new THREE.Mesh(new THREE.BoxGeometry(28, 105, 24), skyMat);
  empBase.position.set(30, 52.5, -275);
  const empMid = new THREE.Mesh(new THREE.BoxGeometry(18, 56, 16), skyMat);
  empMid.position.set(30, 132, -275);
  const empTop = new THREE.Mesh(new THREE.BoxGeometry(11, 28, 11), skyMat);
  empTop.position.set(30, 172, -275);
  const empSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 3.0, 34, 10), mats.chrome);
  empSpire.position.set(30, 202, -275);
  skylineGroup.add(empBase, empMid, empTop, empSpire);

  const backdropCoords: Array<[number, number, number]> = [
    [-250, 95, -278],
    [-190, 118, -280],
    [-125, 134, -280],
    [-55, 128, -278],
    [85, 124, -278],
    [155, 114, -280],
    [225, 98, -276],
    [-278, 86, -150],
    [-278, 92, -65],
    [-278, 78, 25],
    [278, 88, -140],
    [278, 96, -55],
    [278, 82, 35],
  ];
  const backdropInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(26, 1, 24),
    skyMat,
    backdropCoords.length
  );
  const dummy = new THREE.Object3D();
  backdropCoords.forEach(([bx, bh, bz], idx) => {
    dummy.position.set(bx, bh * 0.5, bz);
    dummy.scale.set(1, bh, 1);
    dummy.updateMatrix();
    backdropInst.setMatrixAt(idx, dummy.matrix);
  });
  backdropInst.instanceMatrix.needsUpdate = true;
  skylineGroup.add(backdropInst);
  root.add(skylineGroup);

  // Instanced Pier & Harbor Cargo Crates (high density, single draw call)
  const crateCoords: Array<[number, number, number]> = [];
  for (let pz = 118; pz <= 238; pz += 20) {
    crateCoords.push([-9.6, 0.9, pz], [9.6, 0.9, pz + 7]);
  }
  const crateInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.7, 1.5, 2.2),
    mats.woodFrame,
    crateCoords.length
  );
  crateCoords.forEach(([cx, cy, cz], idx) => {
    dummy.position.set(cx, cy, cz);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    crateInst.setMatrixAt(idx, dummy.matrix);
  });
  crateInst.instanceMatrix.needsUpdate = true;
  root.add(crateInst);

  // 10. Streetlamps across all 5 avenues, Traffic Signals, Instanced Trees
  [-140, -60, -20, -4, 14, 58, 125, 195, 235].forEach((sz) => {
    addStreetLamp(root, -9.4, sz, 1, mats, streetLights);
    addStreetLamp(root, 9.4, sz, -1, mats, streetLights);
  });
  [-150, -68, 68, 150].forEach((ax) => {
    [-125, -55, 0, 55].forEach((sz) => {
      addStreetLamp(root, ax - 9.4, sz, 1, mats, streetLights);
      addStreetLamp(root, ax + 9.4, sz, -1, mats, streetLights);
    });
  });

  const makeTrafficLight = (x: number, z: number, rotY: number) => {
    const tl = new THREE.Group();
    tl.position.set(x, 0, z);
    tl.rotation.y = rotY;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 8), mats.darkSteel);
    pole.position.y = 2.7;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.09, 0.09), mats.darkSteel);
    arm.position.set(1.5, 5.2, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.96, 0.34), mats.darkSteel);
    box.position.set(2.4, 4.75, 0);
    const rMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: new THREE.Color(0xff2222),
      emissiveIntensity: 0.4,
    });
    const gMat = new THREE.MeshStandardMaterial({
      color: 0x22ff66,
      emissive: new THREE.Color(0x22ff66),
      emissiveIntensity: 2.2,
    });
    trafficRedMats.push(rMat);
    trafficGreenMats.push(gMat);

    const redBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), rMat);
    redBulb.position.set(2.4, 5.02, 0.16);
    const greenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), gMat);
    greenBulb.position.set(2.4, 4.5, 0.16);
    tl.add(pole, arm, box, redBulb, greenBulb);
    root.add(tl);
  };
  makeTrafficLight(-9.8, -25.2, 0);
  makeTrafficLight(9.8, -42.5, Math.PI);
  makeTrafficLight(-9.8, 25.2, 0);
  makeTrafficLight(9.8, 42.5, Math.PI);
  makeTrafficLight(-77.8, -25.2, 0);
  makeTrafficLight(77.8, -25.2, Math.PI);
  makeTrafficLight(-159.5, -25.2, 0);
  makeTrafficLight(159.5, -25.2, Math.PI);

  addTree(root, -11.2, -11, 1.05);
  addTree(root, -11.2, 2.5, 0.95);
  addTree(root, 11.2, 14.5, 1.0);
  addTree(root, -14.5, -46, 1.15);
  addTree(root, 14.5, -46, 1.15);
  addTree(root, -158.5, 13.5, 1.05);
  addTree(root, 158.5, -13.5, 1.05);
  addTree(root, -13.0, -180.0, 1.25);
  addTree(root, 13.0, -180.0, 1.25);

  // Steam vents
  const manholeGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.03, 16);
  const steamSprites: Array<{mesh: THREE.Sprite; baseX: number; baseZ: number; phase: number}> = [];
  for (const spot of [
    {x: -3.2, z: -10},
    {x: 4.0, z: 4},
    {x: -68.0, z: -10},
    {x: 68.0, z: 12},
  ]) {
    const mh = new THREE.Mesh(manholeGeo, mats.darkSteel);
    mh.position.set(spot.x, 0.016, spot.z);
    root.add(mh);

    for (let i = 0; i < 4; i++) {
      const sm = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: mats.steamTexture,
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
          color: 0xf4e4cf,
        })
      );
      sm.position.set(spot.x, 0.3 + i * 0.4, spot.z);
      root.add(sm);
      steamSprites.push({mesh: sm, baseX: spot.x, baseZ: spot.z, phase: i / 4});
    }
  }

  // 11. Two Vintage Streetcars (North & South Cross Streets)
  const streetcarNorth = createVintageStreetcar(mats);
  streetcarNorth.position.set(-18, 0, -31);
  const streetcarSouth = createVintageStreetcar(mats);
  streetcarSouth.position.set(34, 0, 31);
  root.add(streetcarNorth, streetcarSouth);

  // 12. Physics-Driven Non-Overlapping Traffic Fleet & Parked Period Cars
  const initialTrafficStates: TrafficVehicleState[] = [];
  const trafficMeshes = new Map<string, ProceduralVehicle>();

  const registerTraffic = (cfg: {
    id: string;
    variant: TrafficVehicleState['variant'];
    axis: 'x' | 'z';
    pos: number;
    lane: number;
    dir: 1 | -1;
    speed: number;
    min: number;
    max: number;
    parked?: boolean;
  }) => {
    const parked = Boolean(cfg.parked);
    const x = cfg.axis === 'z' ? cfg.lane : cfg.pos;
    const z = cfg.axis === 'z' ? cfg.pos : cfg.lane;
    const yaw =
      cfg.axis === 'z'
        ? cfg.dir === -1
          ? 0
          : Math.PI
        : cfg.dir === 1
          ? -Math.PI / 2
          : Math.PI / 2;

    const state: TrafficVehicleState = {
      id: cfg.id,
      variant: cfg.variant,
      axis: cfg.axis,
      laneCoord: cfg.lane,
      dir: cfg.dir,
      baseSpeed: parked ? 0 : cfg.speed,
      minBound: cfg.min,
      maxBound: cfg.max,
      parked,
      x,
      z,
      yaw,
      speed: parked ? 0 : cfg.speed,
      vx: parked ? 0 : cfg.axis === 'x' ? cfg.dir * cfg.speed : 0,
      vz: parked ? 0 : cfg.axis === 'z' ? cfg.dir * cfg.speed : 0,
      wheelSpin: 0,
      health: 100,
      crashed: false,
      crashTimer: 0,
    };
    const mesh = createProceduralVehicle(cfg.variant, mats, false);
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = yaw;
    root.add(mesh.group);

    initialTrafficStates.push(state);
    trafficMeshes.set(cfg.id, mesh);
  };

  // All 5 Avenues & 5 Cross Streets (well spaced, zero initial overlap!)
  registerTraffic({id: 'cab_tenth_1', variant: 'checker_cab', axis: 'z', pos: -12, lane: 3.4, dir: -1, speed: 7.4, min: -245, max: 105});
  registerTraffic({id: 'police_tenth_1', variant: 'police', axis: 'z', pos: -64, lane: 6.0, dir: -1, speed: 8.6, min: -245, max: 105});
  registerTraffic({id: 'sedan_tenth_s', variant: 'sedan_40s', axis: 'z', pos: 26, lane: -2.8, dir: 1, speed: 6.8, min: -245, max: 105});
  registerTraffic({id: 'red_north_cross', variant: 'red_finned', axis: 'x', pos: 26, lane: -37.5, dir: -1, speed: 8.0, min: -240, max: 240});
  registerTraffic({id: 'cab_south_cross', variant: 'checker_cab', axis: 'x', pos: -35, lane: 37.5, dir: 1, speed: 7.2, min: -240, max: 240});
  registerTraffic({id: 'police_west_bway', variant: 'police', axis: 'z', pos: 15, lane: -65.0, dir: -1, speed: 8.4, min: -240, max: 100});
  registerTraffic({id: 'red_harbor_blvd', variant: 'red_finned', axis: 'z', pos: -22, lane: 71.0, dir: 1, speed: 7.8, min: -240, max: 100});
  registerTraffic({id: 'sedan_far_north', variant: 'sedan_40s', axis: 'x', pos: -18, lane: -97.5, dir: 1, speed: 7.0, min: -240, max: 240});
  registerTraffic({id: 'cab_far_south', variant: 'checker_cab', axis: 'x', pos: 18, lane: 97.5, dir: -1, speed: 7.6, min: -240, max: 240});
  registerTraffic({id: 'sedan_west_fifth', variant: 'sedan_40s', axis: 'z', pos: -45, lane: -147.0, dir: -1, speed: 7.5, min: -235, max: 98});
  registerTraffic({id: 'cab_east_150', variant: 'checker_cab', axis: 'z', pos: 42, lane: 153.0, dir: 1, speed: 7.4, min: -235, max: 98});
  registerTraffic({id: 'police_uptown', variant: 'police', axis: 'x', pos: 52, lane: -173.5, dir: -1, speed: 9.0, min: -240, max: 240});
  registerTraffic({id: 'red_uptown', variant: 'red_finned', axis: 'x', pos: -105, lane: -166.5, dir: 1, speed: 8.2, min: -240, max: 240});
  registerTraffic({id: 'cab_west_cross', variant: 'checker_cab', axis: 'x', pos: -135, lane: -30.5, dir: 1, speed: 7.1, min: -240, max: 240});
  registerTraffic({id: 'sedan_east_cross', variant: 'sedan_40s', axis: 'x', pos: 135, lane: 30.5, dir: -1, speed: 7.3, min: -240, max: 240});
  // Curb-parked period cars (solid collidable!)
  registerTraffic({id: 'parked_east_curb', variant: 'sedan_40s', axis: 'z', pos: 14, lane: 7.0, dir: -1, speed: 0, min: 14, max: 14, parked: true});
  registerTraffic({id: 'parked_west_curb', variant: 'checker_cab', axis: 'z', pos: -16, lane: -7.0, dir: 1, speed: 0, min: -16, max: -16, parked: true});
  registerTraffic({id: 'parked_harbor_pier', variant: 'red_finned', axis: 'z', pos: 115, lane: -7.2, dir: 1, speed: 0, min: 115, max: 115, parked: true});
  registerTraffic({id: 'parked_tailor_curb', variant: 'sedan_40s', axis: 'z', pos: -14, lane: -156.5, dir: 1, speed: 0, min: -14, max: -14, parked: true});
  registerTraffic({id: 'parked_dragon_curb', variant: 'red_finned', axis: 'z', pos: 14, lane: 156.5, dir: -1, speed: 0, min: 14, max: 14, parked: true});

  // 13. All 18 Named NPCs (including 4 Kids!)
  const npcs = new Map<string, ProceduralCharacter>();
  for (const def of NPC_DEFINITIONS) {
    const char = createProceduralCharacter(
      {
        vestColor: def.coatColor,
        shirtColor: def.isWoman ? 0x8c2d3b : 0xd8d0c1,
        trouserColor: def.id === 'dolan' ? 0x151e30 : 0x292624,
        hatColor: def.hatColor,
        tieColor: def.tieColor,
        skinColor: def.skinColor ?? 0xc99c7c,
        hasHolster: Boolean(def.hasHolster),
        isWoman: def.isWoman,
        isKid: def.isKid,
        hasQuestRing: true,
      },
      mats
    );
    char.group.position.set(def.x, 0.14, def.z);
    char.group.rotation.y = def.yaw;
    root.add(char.group);
    npcs.set(def.id, char);
  }

  // 14. Ambient Strolling Neighborhood Kids & Citizens
  const pedestrians: AmbientPedestrian[] = [];
  const spawnPed = (
    isKid: boolean,
    isWoman: boolean,
    vestColor: number,
    axis: 'x' | 'z',
    pos: number,
    lane: number,
    dir: 1 | -1,
    min: number,
    max: number
  ) => {
    const char = createProceduralCharacter(
      {
        vestColor,
        shirtColor: 0xd9d2c4,
        trouserColor: 0x2f2b28,
        hatColor: isKid ? 0xb58947 : 0x3b3733,
        tieColor: 0x702626,
        skinColor: 0xc99c7c,
        hasHolster: false,
        isWoman,
        isKid,
      },
      mats
    );
    const x = axis === 'x' ? pos : lane;
    const z = axis === 'z' ? pos : lane;
    char.group.position.set(x, 0.14, z);
    char.group.rotation.y =
      axis === 'z' ? (dir === -1 ? 0 : Math.PI) : dir === 1 ? -Math.PI / 2 : Math.PI / 2;
    root.add(char.group);
    pedestrians.push({
      char,
      axis,
      pos,
      lane,
      dir,
      speed: isKid ? 2.1 : 1.45,
      min,
      max,
      walkDist: 0,
    });
  };
  spawnPed(true, false, 0x385770, 'x', 28, -54, 1, 25, 52); // Kid running near Liberty Park
  spawnPed(true, true, 0x7c3645, 'z', -6, -11.4, -1, -22, 4); // Kid skipping on Tenth Ave West sidewalk
  spawnPed(false, false, 0x453e38, 'z', 8, 11.4, -1, -22, 22);
  spawnPed(false, true, 0x2c4248, 'z', -52, -60.5, 1, -78, -46);

  // 15. Contract Objective Beacon
  const waypointBeacon = new THREE.Group();
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.35, 32),
    new THREE.MeshBasicMaterial({
      color: 0xe4b55c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.05;
  const beaconBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.55, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xe4b55c,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beaconBeam.position.y = 7.0;
  waypointBeacon.add(beaconRing, beaconBeam);
  root.add(waypointBeacon);

  // 16. Pooled Rain Particles
  const rainCount = 900;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 44;
    rainPositions[i * 3 + 1] = Math.random() * 18;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xcbd9ed,
    size: 0.11,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  root.add(rainPoints);

  return {
    root,
    streetLights,
    trafficGreenMats,
    trafficRedMats,
    streetcarNorth,
    streetcarSouth,
    initialTrafficStates,
    trafficMeshes,
    npcs,
    pedestrians,
    waypointBeacon,
    steamSprites,
    rainPoints,
    updateDynamic(dt, elapsed, atmo, weather, playerPos, trafficStates, quality) {
      for (const sl of streetLights) {
        sl.intensity = atmo.streetLightIntensity * 6.5;
      }

      const greenPhase = Math.floor(elapsed / 8) % 2 === 0;
      for (const gm of trafficGreenMats) gm.emissiveIntensity = greenPhase ? 2.4 : 0.15;
      for (const rm of trafficRedMats) rm.emissiveIntensity = greenPhase ? 0.15 : 2.4;

      streetcarNorth.position.x = ((elapsed * 4.5 + 220) % 440) - 220;
      streetcarSouth.position.x = 220 - ((elapsed * 4.2 + 95) % 440);

      // Sync physics-controlled non-overlapping traffic cars
      for (const st of trafficStates) {
        const mesh = trafficMeshes.get(st.id);
        if (!mesh) continue;
        mesh.group.position.set(st.x, 0, st.z);
        mesh.group.rotation.y = st.yaw;
        for (const w of mesh.wheels) {
          w.rotation.x = -st.wheelSpin;
        }
        mesh.setLights(st.parked ? atmo.headlightIntensity * 0.35 : atmo.headlightIntensity, st.crashed, elapsed);
        mesh.setCrashState(st.crashed, st.health, elapsed);
      }

      // Named NPCs idle breathing & quest ring
      for (const npc of npcs.values()) {
        npc.animate(0, 0, elapsed, dt);
      }

      // Strolling neighborhood pedestrians & kids
      for (const ped of pedestrians) {
        ped.pos += ped.dir * ped.speed * dt;
        if (ped.pos >= ped.max) {
          ped.pos = ped.max;
          ped.dir = -1;
        } else if (ped.pos <= ped.min) {
          ped.pos = ped.min;
          ped.dir = 1;
        }
        ped.walkDist += ped.speed * dt;
        const x = ped.axis === 'x' ? ped.pos : ped.lane;
        const z = ped.axis === 'z' ? ped.pos : ped.lane;
        ped.char.group.position.set(x, 0.14, z);
        ped.char.group.rotation.y =
          ped.axis === 'z' ? (ped.dir === -1 ? 0 : Math.PI) : ped.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
        ped.char.animate(ped.walkDist, ped.speed, elapsed, dt);
      }

      beaconRing.scale.setScalar(1 + Math.sin(elapsed * 3.5) * 0.09);

      for (const sp of steamSprites) {
        const life = (elapsed * 0.35 + sp.phase) % 1;
        sp.mesh.position.set(
          sp.baseX + Math.sin(elapsed * 1.4 + sp.phase * 6) * 0.28,
          0.25 + life * 2.4,
          sp.baseZ + Math.cos(elapsed * 1.1 + sp.phase * 5) * 0.22
        );
        sp.mesh.scale.setScalar(0.55 + life * 1.4);
        sp.mesh.material.opacity = Math.sin(life * Math.PI) * 0.28;
      }

      const showRain = weather !== 'clear';
      rainPoints.visible = showRain;
      if (showRain) {
        rainMat.opacity = weather === 'storm' ? 0.62 : 0.34;
        const activeCount = quality === 'balanced' ? 400 : rainCount;
        rainGeo.setDrawRange(0, activeCount);
        const fallSpeed = weather === 'storm' ? 22 : 14;
        const posAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < activeCount; i++) {
          const idx = i * 3;
          arr[idx + 1] -= fallSpeed * dt;
          if (arr[idx + 1] < 0) {
            arr[idx] = playerPos.x + (Math.random() - 0.5) * 40;
            arr[idx + 1] = 14 + Math.random() * 6;
            arr[idx + 2] = playerPos.z + (Math.random() - 0.5) * 40;
          }
        }
        posAttr.needsUpdate = true;
      }
    },
    dispose() {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
        }
      });
    },
  };
}
