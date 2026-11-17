import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyShopItem,
  checkAndAdvanceContract,
  computeDayNightAtmosphere,
  createCustomContract,
  createInitialProgression,
  deserializeSave,
  findInteriorAt,
  generateHeroMonologue,
  generateNpcReply,
  getAllContracts,
  getRankForCash,
  getShopItemsForZone,
  parsePlayerUtterance,
  resolveAllVehicleCollisions,
  resolveCircleCollisions,
  serializeSave,
  stepHeroMovement,
  stepTrafficVehicles,
  stepVehiclePhysics,
} from './simulation';
import {CAR_SPAWN, CONTRACTS, DEFAULT_SETTINGS, HERO_NAME, HERO_SPAWN} from './constants';
import type {PlayerState, TrafficVehicleState, VehiclePhysicsState} from './types';

function makeCar(overrides: Partial<VehiclePhysicsState> = {}): VehiclePhysicsState {
  return {
    x: CAR_SPAWN.x,
    z: CAR_SPAWN.z,
    yaw: 0,
    speed: 0,
    vx: 0,
    vz: 0,
    steerAngle: 0,
    wheelSpin: 0,
    braking: false,
    pitch: 0,
    roll: 0,
    gear: 'N',
    rpm01: 0.2,
    health: 100,
    crashed: false,
    crashFlashTimer: 0,
    engineTier: 0,
    armorTier: 0,
    ...overrides,
  };
}

function makeTrafficCar(overrides: Partial<TrafficVehicleState> = {}): TrafficVehicleState {
  return {
    id: 'tc_1',
    variant: 'checker_cab',
    axis: 'z',
    laneCoord: 3.2,
    dir: -1,
    baseSpeed: 7.2,
    minBound: -90,
    maxBound: 90,
    parked: false,
    x: 3.2,
    z: 0,
    yaw: 0,
    speed: 7.2,
    vx: 0,
    vz: -7.2,
    wheelSpin: 0,
    health: 100,
    crashed: false,
    crashTimer: 0,
    ...overrides,
  };
}

test('day-night atmosphere transitions smoothly from golden hour to midnight', () => {
  const golden = computeDayNightAtmosphere(0.0, 'clear');
  const dusk = computeDayNightAtmosphere(0.32, 'drizzle');
  const night = computeDayNightAtmosphere(0.62, 'storm');

  assert.equal(golden.phaseLabel, 'Golden Hour');
  assert.equal(dusk.phaseLabel, 'Dusk');
  assert.equal(night.phaseLabel, 'Midnight');

  assert.ok(golden.sunIntensity > dusk.sunIntensity);
  assert.ok(dusk.sunIntensity > night.sunIntensity);
  assert.ok(night.neonIntensity > golden.neonIntensity);
  assert.ok(night.roadWetness > golden.roadWetness);
});

test('circle collision prevents hero and car from clipping into west building block while leaving Fuel Bar doorway open', () => {
  const res = resolveCircleCollisions(-14.2, 0, 0.5);
  assert.ok(res.collided);
  assert.ok(res.x >= -13.0, `Expected pushed outside x >= -13.0, got ${res.x}`);

  // Fuel Bar doorway at x=-14, z=12 should be enterable
  const doorRes = resolveCircleCollisions(-14.0, 12.0, 0.42);
  assert.equal(doorRes.collided, false);
  const interior = findInteriorAt(-18.0, 12.0);
  assert.equal(interior?.id, 'fuel_bar');
});

test('hero walks forward smoothly along -Z and accumulates distance', () => {
  const start: PlayerState = {
    x: HERO_SPAWN.x,
    z: HERO_SPAWN.z,
    yaw: 0,
    vx: 0,
    vz: 0,
    walkDistance: 0,
    inVehicle: false,
    stamina: 100,
    maxStamina: 100,
    armor: 25,
    maxArmor: 100,
    sprinting: false,
    equippedWeapon: 'revolver',
  };
  let curr: PlayerState = start;
  for (let i = 0; i < 20; i++) {
    curr = stepHeroMovement(curr, 1, 0, 0, false, 0.05);
  }
  assert.ok(curr.z < start.z - 2.0, 'Hero should advance north (-Z)');
  assert.ok(curr.walkDistance > 2.0);
});

test('hero smoothly faces the 3D mouse pointer override even while standing or strafing', () => {
  const start: PlayerState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    walkDistance: 0,
    inVehicle: false,
    stamina: 100,
    maxStamina: 100,
    armor: 25,
    maxArmor: 100,
    sprinting: false,
    equippedWeapon: 'revolver',
  };
  // Pointing straight east (+X) -> target yaw = atan2(-dx, -dz) = -PI/2
  const eastAimYaw = Math.atan2(-10, 0);
  let curr = start;
  for (let i = 0; i < 12; i++) {
    curr = stepHeroMovement(curr, 0, 0, 0, false, 0.05, undefined, [], eastAimYaw);
  }
  assert.ok(Math.abs(curr.yaw - eastAimYaw) < 0.08, `Expected hero yaw near ${eastAimYaw}, got ${curr.yaw}`);
});

test('vehicle physics accelerates, steers, and rebounds safely on collision', () => {
  let car = makeCar();

  for (let i = 0; i < 30; i++) {
    const out = stepVehiclePhysics(
      car,
      {throttle: 1, steer: 0.2, brake: false, boost: false},
      0.04
    );
    car = out.car;
  }
  assert.ok(car.speed > 8, 'Car should accelerate forward');
  assert.ok(car.z < CAR_SPAWN.z - 4, 'Car should move north');
  assert.notEqual(car.gear, 'N');
});

test('vehicles never overlap each other and high-speed contact triggers crash physics', () => {
  const hero = makeCar({x: 3.2, z: 0.6, yaw: 0, speed: 14, vz: -14});
  const traffic = [makeTrafficCar({id: 'tc_police', variant: 'police', x: 3.2, z: -0.5, vz: 6})];

  const out = resolveAllVehicleCollisions(hero, traffic);
  assert.equal(out.collisions.length, 1);
  assert.equal(out.collisions[0].involvedHero, true);
  assert.equal(out.collisions[0].involvedPolice, true);
  assert.equal(out.heroCar.crashed, true);
  assert.ok(out.heroCar.health < 100);
  assert.equal(out.trafficCars[0].crashed, true);

  const distAfter = Math.hypot(
    out.heroCar.x - out.trafficCars[0].x,
    out.heroCar.z - out.trafficCars[0].z
  );
  assert.ok(distAfter >= 1.9, `Cars must separate cleanly, got ${distAfter}`);

  // Ambient car yields behind a stopped car ahead in its lane
  const stoppedHero = makeCar({x: 3.2, z: -6.0, speed: 0});
  const cruiser = makeTrafficCar({id: 'tc_behind', x: 3.2, z: 0.0, dir: -1, baseSpeed: 8});
  const stepRes = stepTrafficVehicles([cruiser], stoppedHero, 0.05);
  assert.ok(stepRes.trafficCars[0].speed < 8, 'Traffic car should brake when blocked ahead');
});

test('contracts advance through talk and location steps and increment rank & cash', () => {
  let prog = createInitialProgression();
  assert.equal(getRankForCash(prog.cash).title, 'Outsider');

  let res = checkAndAdvanceContract(prog, {type: 'talk', npcId: 'sal'});
  assert.equal(res.stepCompleted, true);
  prog = res.progression;

  res = checkAndAdvanceContract(prog, {type: 'location', x: 4.5, z: -34.0});
  assert.equal(res.stepCompleted, true);
  prog = res.progression;

  res = checkAndAdvanceContract(prog, {type: 'talk', npcId: 'elena'});
  assert.equal(res.stepCompleted, true);
  assert.equal(res.contractCompleted?.id, 'contract_01');
  assert.ok(res.progression.cash >= 900);
  assert.equal(getRankForCash(res.progression.cash).title, 'Associate');
  assert.equal(res.progression.activeContractId, 'contract_02');
});

test('custom mission creation integrates with contract progression', () => {
  let prog = createInitialProgression();
  const custom = createCustomContract(
    {
      title: 'Harbor Pier Drop',
      type: 'deliver',
      targetNpcId: 'frankie',
      targetLandmarkId: 'harbor_pier',
      rewardCash: 1500,
      briefing: 'Deliver bullion to the freighter pier.',
    },
    0
  );
  prog = {
    ...prog,
    customContracts: [custom],
    activeContractId: custom.id,
    activeStepIndex: 0,
  };
  assert.ok(getAllContracts(prog).some((c) => c.id === custom.id));

  const s1 = checkAndAdvanceContract(prog, {type: 'location', x: 0, z: 128});
  assert.equal(s1.stepCompleted, true);
  assert.equal(s1.contractCompleted, null);

  const s2 = checkAndAdvanceContract(s1.progression, {type: 'talk', npcId: 'frankie'});
  assert.equal(s2.stepCompleted, true);
  assert.equal(s2.contractCompleted?.id, custom.id);
  assert.equal(s2.progression.cash, prog.cash + 1500);
});

test('cognitive NLU mind understands player speech, crashes, weapons, kids, and Vito Menotti self-talk', () => {
  let prog = createInitialProgression();
  const atmo = computeDayNightAtmosphere(0.65, 'drizzle');

  const parsed = parsePlayerUtterance('Where can I get a Tommy Gun near Liberty Park?');
  assert.equal(parsed.mentionedWeapon, 'tommy');
  assert.equal(parsed.intent, 'location');

  const kidReply = generateNpcReply('tommy_kid', 'Hey kid, like my Tommy gun?', null, prog, atmo, {
    equippedWeapon: 'tommy',
    carCrashed: true,
  });
  assert.equal(kidReply.memory.mood, 'playful');
  assert.ok(kidReply.reply.toLowerCase().includes('tommy') || kidReply.reply.toLowerCase().includes('vinnie'));

  const first = generateNpcReply('sal', 'Watch your tone', 'intimidate', prog, atmo);
  prog = {...prog, npcMemory: {...prog.npcMemory, sal: first.memory}};
  assert.equal(first.memory.trust, -1);

  const second = generateNpcReply('sal', 'What about my crashed car?', null, prog, atmo, {
    carCrashed: true,
    carHealth: 45,
  });
  assert.equal(second.memory.metCount, 2);
  assert.ok(second.reply.includes('remember'));

  const selfTalk = generateHeroMonologue('How is my car looking?', prog, atmo, {
    equippedWeapon: 'shotgun',
    carCrashed: true,
    carHealth: 40,
  });
  assert.ok(selfTalk.includes(HERO_NAME));
});

test('save serialization round-trips safely and rejects malformed input', () => {
  const prog = createInitialProgression();
  const raw = serializeSave({
    version: 1,
    savedAt: 123456,
    time01: 0.35,
    player: {
      x: -3,
      z: 4,
      yaw: 1.1,
      inVehicle: false,
      equippedWeapon: 'tommy',
      armor: 60,
      maxArmor: 150,
    },
    car: {
      x: -5,
      z: 9,
      yaw: 0.2,
      health: 84,
      crashed: false,
      engineTier: 1,
      armorTier: 1,
    },
    progression: prog,
    settings: DEFAULT_SETTINGS,
  });
  const loaded = deserializeSave(raw);
  assert.ok(loaded);
  assert.equal(loaded.time01, 0.35);
  assert.equal(loaded.player.x, -3);
  assert.equal(loaded.player.equippedWeapon, 'tommy');
  assert.equal(loaded.player.maxArmor, 150);
  assert.equal(loaded.car.health, 84);
  assert.equal(loaded.car.engineTier, 1);
  assert.equal(loaded.car.armorTier, 1);
  assert.equal(deserializeSave('{bad json'), null);
});

test('expanded city map has 12 contracts, open east/west shop doorways, and working shop upgrades', () => {
  assert.equal(CONTRACTS.length, 12);

  // Bespoke Tailors (x=-160) & Golden Dragon Tea House (x=+160) doorways must be open
  assert.equal(resolveCircleCollisions(-160, 0, 0.42).collided, false);
  assert.equal(findInteriorAt(-168, 0)?.id, 'tailor_shop');
  assert.equal(resolveCircleCollisions(160, 0, 0.42).collided, false);
  assert.equal(findInteriorAt(168, 0)?.id, 'dragon_shop');

  let prog = {...createInitialProgression(), cash: 1200, heat: 2};
  let player: PlayerState = {
    x: -168,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    walkDistance: 0,
    inVehicle: false,
    stamina: 40,
    maxStamina: 100,
    armor: 20,
    maxArmor: 100,
    sprinting: false,
    equippedWeapon: 'revolver',
  };
  let car = makeCar();

  assert.ok(getShopItemsForZone('tailor_shop').length >= 12);

  // Buy lined trenchcoat (+50 maxArmor, +50 armor, -$420)
  const coatRes = buyShopItem(prog, player, car, 'kevlar_trench');
  assert.equal(coatRes.ok, true);
  prog = coatRes.progression;
  player = coatRes.player;
  car = coatRes.car;
  assert.equal(player.maxArmor, 150);
  assert.equal(player.armor, 70);
  assert.equal(prog.cash, 780);

  // Buy Twin-Carb V8 Tier 1 (-$490) -> faster acceleration & top speed
  const engRes = buyShopItem(prog, player, car, 'v8_twin_carb');
  assert.equal(engRes.ok, true);
  car = engRes.car;
  prog = engRes.progression;
  assert.equal(car.engineTier, 1);

  let fastCar = car;
  let stockCar = makeCar();
  for (let i = 0; i < 45; i++) {
    fastCar = stepVehiclePhysics(fastCar, {throttle: 1, steer: 0, brake: false, boost: false}, 0.05).car;
    stockCar = stepVehiclePhysics(stockCar, {throttle: 1, steer: 0, brake: false, boost: false}, 0.05).car;
  }
  assert.ok(fastCar.speed > stockCar.speed + 2.5, 'Upgraded V8 should reach higher speed');

  // Insufficient funds rejects cleanly
  const tooExpensive = buyShopItem(prog, player, car, 'supercharger_stage2');
  assert.equal(tooExpensive.ok, false);
});

