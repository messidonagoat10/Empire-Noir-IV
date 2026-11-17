import {
  BUILDING_COLLIDERS,
  CONTRACTS,
  DEFAULT_SETTINGS,
  HERO_NAME,
  HERO_SPAWN,
  CAR_SPAWN,
  INTERIOR_ZONES,
  LANDMARKS,
  NPC_DEFINITIONS,
  SHOP_ITEMS,
  SYNDICATE_RANKS,
  WEAPONS,
  WORLD_BOUNDS,
} from './constants';
import type {
  AtmosphereParams,
  ContractMission,
  ContractStep,
  CustomMissionDraft,
  DialogueOption,
  InteriorZone,
  NpcMemoryState,
  NpcMood,
  ParsedUtterance,
  PlayerState,
  ProgressionState,
  RectCollider,
  SavePayload,
  SettingsState,
  ShopItem,
  SyndicateRank,
  TrafficVehicleState,
  UtteranceIntent,
  VehicleCollisionEvent,
  VehiclePhysicsState,
  WeaponId,
  WeatherMode,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerpHexColor(hexA: number, hexB: number, t: number): number {
  const k = clamp(t, 0, 1);
  const rA = (hexA >> 16) & 0xff;
  const gA = (hexA >> 8) & 0xff;
  const bA = hexA & 0xff;
  const rB = (hexB >> 16) & 0xff;
  const gB = (hexB >> 8) & 0xff;
  const bB = hexB & 0xff;
  const r = Math.round(lerp(rA, rB, k));
  const g = Math.round(lerp(gA, gB, k));
  const b = Math.round(lerp(bA, bB, k));
  return (r << 16) | (g << 8) | b;
}

/**
 * Computes lighting, fog, neon, and wet-road atmosphere parameters for rawTime01 in [0, 1):
 * - 0.00 -> 17:45 (Golden Hour)
 * - 0.32 -> 19:45 (Dusk)
 * - 0.62 -> 23:30 (Midnight)
 * - 0.90 -> 05:30 (Dawn)
 */
export function computeDayNightAtmosphere(
  rawTime01: number,
  weather: WeatherMode = 'drizzle'
): AtmosphereParams {
  const t = ((rawTime01 % 1) + 1) % 1;

  const nightArcHours = t <= 0.62 ? (t / 0.62) * 5.75 : 5.75 + ((t - 0.62) / 0.38) * 6.25;
  const totalMinutes = Math.floor((17 * 60 + 45 + nightArcHours * 60) % (24 * 60));
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const clockLabel = `${hh}:${mm}`;

  let phaseLabel: AtmosphereParams['phaseLabel'] = 'Golden Hour';
  if (t >= 0.22 && t < 0.45) phaseLabel = 'Dusk';
  else if (t >= 0.45 && t < 0.85) phaseLabel = 'Midnight';
  else if (t >= 0.85) phaseLabel = 'Dawn';

  let sunColorHex: number;
  let sunIntensity: number;
  let sunElevationRad: number;
  let sunAzimuthRad: number;
  let hemiSkyHex: number;
  let hemiGroundHex: number;
  let hemiIntensity: number;
  let fogColorHex: number;
  let fogDensity: number;
  let exposure: number;
  let neonIntensity: number;
  let windowGlow: number;
  let streetLightIntensity: number;
  let headlightIntensity: number;
  let godRayStrength: number;

  if (t < 0.32) {
    const k = smoothstep(0.0, 0.32, t);
    sunColorHex = lerpHexColor(0xffb45a, 0xe86b4a, k);
    sunIntensity = lerp(3.4, 1.25, k);
    sunElevationRad = lerp(0.24, 0.06, k);
    sunAzimuthRad = lerp(-0.32, -0.52, k);
    hemiSkyHex = lerpHexColor(0x88b4e8, 0x4b4270, k);
    hemiGroundHex = lerpHexColor(0x473321, 0x1c1926, k);
    hemiIntensity = lerp(0.92, 0.46, k);
    fogColorHex = lerpHexColor(0xd99b5e, 0x2d2038, k);
    fogDensity = lerp(0.0048, 0.0074, k);
    exposure = lerp(1.15, 1.02, k);
    neonIntensity = lerp(0.45, 2.0, k);
    windowGlow = lerp(0.18, 0.78, k);
    streetLightIntensity = lerp(0.2, 2.0, k);
    headlightIntensity = lerp(0.15, 1.7, k);
    godRayStrength = lerp(0.85, 0.42, k);
  } else if (t < 0.62) {
    const k = smoothstep(0.32, 0.62, t);
    sunColorHex = lerpHexColor(0xe86b4a, 0x526ea8, k);
    sunIntensity = lerp(1.25, 0.35, k);
    sunElevationRad = lerp(0.06, 0.45, k);
    sunAzimuthRad = lerp(-0.52, -0.15, k);
    hemiSkyHex = lerpHexColor(0x4b4270, 0x131d36, k);
    hemiGroundHex = lerpHexColor(0x1c1926, 0x07090f, k);
    hemiIntensity = lerp(0.46, 0.24, k);
    fogColorHex = lerpHexColor(0x2d2038, 0x060811, k);
    fogDensity = lerp(0.0074, 0.009, k);
    exposure = lerp(1.02, 0.96, k);
    neonIntensity = lerp(2.0, 3.4, k);
    windowGlow = lerp(0.78, 1.0, k);
    streetLightIntensity = lerp(2.0, 3.6, k);
    headlightIntensity = lerp(1.7, 3.0, k);
    godRayStrength = lerp(0.42, 0.1, k);
  } else if (t < 0.88) {
    const k = smoothstep(0.62, 0.88, t);
    sunColorHex = lerpHexColor(0x526ea8, 0xd88e68, k);
    sunIntensity = lerp(0.35, 1.65, k);
    sunElevationRad = lerp(0.45, 0.14, k);
    sunAzimuthRad = lerp(-0.15, 0.25, k);
    hemiSkyHex = lerpHexColor(0x131d36, 0x6a80a8, k);
    hemiGroundHex = lerpHexColor(0x07090f, 0x2c2824, k);
    hemiIntensity = lerp(0.24, 0.68, k);
    fogColorHex = lerpHexColor(0x060811, 0x6b606e, k);
    fogDensity = lerp(0.009, 0.0072, k);
    exposure = lerp(0.96, 1.08, k);
    neonIntensity = lerp(3.4, 1.4, k);
    windowGlow = lerp(1.0, 0.45, k);
    streetLightIntensity = lerp(3.6, 1.3, k);
    headlightIntensity = lerp(3.0, 0.9, k);
    godRayStrength = lerp(0.1, 0.45, k);
  } else {
    const k = smoothstep(0.88, 1.0, t);
    sunColorHex = lerpHexColor(0xd88e68, 0xffb45a, k);
    sunIntensity = lerp(1.65, 3.4, k);
    sunElevationRad = lerp(0.14, 0.24, k);
    sunAzimuthRad = lerp(0.25, -0.32, k);
    hemiSkyHex = lerpHexColor(0x6a80a8, 0x88b4e8, k);
    hemiGroundHex = lerpHexColor(0x2c2824, 0x473321, k);
    hemiIntensity = lerp(0.68, 0.92, k);
    fogColorHex = lerpHexColor(0x6b606e, 0xd99b5e, k);
    fogDensity = lerp(0.0072, 0.0048, k);
    exposure = lerp(1.08, 1.15, k);
    neonIntensity = lerp(1.4, 0.45, k);
    windowGlow = lerp(0.45, 0.18, k);
    streetLightIntensity = lerp(1.3, 0.2, k);
    headlightIntensity = lerp(0.9, 0.15, k);
    godRayStrength = lerp(0.45, 0.85, k);
  }

  let roadWetness = 0.65;
  if (weather === 'clear') {
    roadWetness = 0.45;
  } else if (weather === 'drizzle') {
    roadWetness = 0.82;
    fogDensity *= 1.1;
  } else if (weather === 'storm') {
    roadWetness = 0.96;
    fogDensity *= 1.28;
    sunIntensity *= 0.74;
  }

  return {
    time01: t,
    phaseLabel,
    clockLabel,
    sunElevationRad,
    sunAzimuthRad,
    sunColorHex,
    sunIntensity,
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity,
    fogColorHex,
    fogDensity,
    exposure,
    neonIntensity,
    windowGlow,
    streetLightIntensity,
    headlightIntensity,
    roadWetness,
    godRayStrength,
  };
}

export function findInteriorAt(x: number, z: number): InteriorZone | null {
  for (const zone of INTERIOR_ZONES) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
      return zone;
    }
  }
  return null;
}

/**
 * Resolves a circle in XZ plane against an array of AABB colliders and world bounds.
 */
export function resolveCircleCollisions(
  x: number,
  z: number,
  radius: number,
  colliders: RectCollider[] = BUILDING_COLLIDERS
): {x: number; z: number; collided: boolean} {
  let nx = clamp(x, WORLD_BOUNDS.minX + radius, WORLD_BOUNDS.maxX - radius);
  let nz = clamp(z, WORLD_BOUNDS.minZ + radius, WORLD_BOUNDS.maxZ - radius);
  let collided = nx !== x || nz !== z;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const closestX = clamp(nx, c.minX, c.maxX);
    const closestZ = clamp(nz, c.minZ, c.maxZ);
    const dx = nx - closestX;
    const dz = nz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      } else {
        const penLeft = Math.abs(nx - c.minX);
        const penRight = Math.abs(c.maxX - nx);
        const penTop = Math.abs(nz - c.minZ);
        const penBot = Math.abs(c.maxZ - nz);
        const minPen = Math.min(penLeft, penRight, penTop, penBot);
        if (minPen === penLeft) nx = c.minX - radius;
        else if (minPen === penRight) nx = c.maxX + radius;
        else if (minPen === penTop) nz = c.minZ - radius;
        else nz = c.maxZ + radius;
      }
    }
  }

  return {x: nx, z: nz, collided};
}

export interface VehicleInput {
  throttle: number; // -1..1
  steer: number; // -1..1 (+1 = left, -1 = right)
  brake: boolean;
  boost: boolean;
}

export function stepVehiclePhysics(
  car: VehiclePhysicsState,
  input: VehicleInput,
  dt: number,
  colliders: RectCollider[] = BUILDING_COLLIDERS,
  collisionRadius = 1.45
): {car: VehiclePhysicsState; impactStrength: number} {
  const safeDt = Math.min(dt, 0.05);
  const engineTier = car.engineTier ?? 0;
  const armorTier = car.armorTier ?? 0;
  const maxFwd = (input.boost ? 30 : 23) + engineTier * 4.5;
  const maxRev = -9;

  let speed = car.speed;
  const accelRate = (input.boost ? 18 : 13.5) + engineTier * 2.5;

  if (input.throttle > 0.05) {
    speed += input.throttle * accelRate * safeDt;
  } else if (input.throttle < -0.05) {
    if (speed > 0.6) {
      speed -= 26 * safeDt;
    } else {
      speed += input.throttle * 10 * safeDt;
    }
  } else {
    speed *= Math.exp(-2.2 * safeDt);
  }

  if (input.brake) {
    speed *= Math.exp(-7.5 * safeDt);
    if (Math.abs(speed) < 0.25) speed = 0;
  }

  speed = clamp(speed, maxRev, maxFwd);

  const targetSteer = input.steer * 0.52;
  const steerAngle = lerp(car.steerAngle, targetSteer, 1 - Math.exp(-12 * safeDt));

  let yaw = car.yaw;
  if (Math.abs(speed) > 0.15) {
    const steerFactor = clamp(Math.abs(speed) / 6, 0.25, 1);
    const turnDir = speed >= 0 ? 1 : -1;
    yaw += steerAngle * 2.45 * steerFactor * turnDir * safeDt;
  }

  const fwdX = -Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);
  const vx = fwdX * speed;
  const vz = fwdZ * speed;

  const rawX = car.x + vx * safeDt;
  const rawZ = car.z + vz * safeDt;

  const resolved = resolveCircleCollisions(rawX, rawZ, collisionRadius, colliders);
  let impactStrength = 0;
  let health = car.health;
  let crashed = car.crashed;
  let crashFlashTimer = Math.max(0, car.crashFlashTimer - safeDt);

  if (resolved.collided) {
    impactStrength = Math.abs(speed);
    if (impactStrength > 5.5) {
      const dmgScale = armorTier > 0 ? 0.55 : 1.0;
      health = Math.max(10, health - impactStrength * 1.4 * dmgScale);
      crashed = true;
      crashFlashTimer = 2.4;
    }
    speed = -speed * 0.28;
  }

  const targetPitch = clamp((speed - car.speed) * -0.035, -0.06, 0.06);
  const targetRoll = clamp(steerAngle * (speed / 22) * 0.09, -0.08, 0.08);
  const pitch = lerp(car.pitch, targetPitch, 1 - Math.exp(-10 * safeDt));
  const roll = lerp(car.roll, targetRoll, 1 - Math.exp(-10 * safeDt));
  const wheelSpin = car.wheelSpin + (speed * safeDt) / 0.36;

  const absSpeed = Math.abs(speed);
  let gear = 'N';
  if (speed < -0.2) gear = 'R';
  else if (absSpeed > 0.2) {
    if (absSpeed < 6) gear = '1';
    else if (absSpeed < 12) gear = '2';
    else if (absSpeed < 18) gear = '3';
    else gear = '4';
  }

  const rpm01 = clamp(0.18 + (absSpeed % 6.5) / 7.5 + (input.throttle > 0 ? 0.12 : 0), 0.12, 1.0);

  return {
    car: {
      x: resolved.x,
      z: resolved.z,
      yaw,
      speed,
      vx: fwdX * speed,
      vz: fwdZ * speed,
      steerAngle,
      wheelSpin,
      braking: input.brake || (input.throttle < 0 && speed > 0.4),
      pitch,
      roll,
      gear,
      rpm01,
      health,
      crashed,
      crashFlashTimer,
      engineTier,
      armorTier,
    },
    impactStrength,
  };
}

/**
 * Dual-sphere vehicle footprint separation + crash physics so cars NEVER overlap each other.
 * If two vehicles touch or overlap, separates them and records crash events when impact >= 1.5 m/s.
 */
export function resolveAllVehicleCollisions(
  heroCar: VehiclePhysicsState,
  trafficCars: TrafficVehicleState[]
): {
  heroCar: VehiclePhysicsState;
  trafficCars: TrafficVehicleState[];
  collisions: VehicleCollisionEvent[];
} {
  const SPHERE_OFFSET = 1.25;
  const SPHERE_RADIUS = 1.02; // 2.04m width, ~4.54m overall length -> zero overlap
  const MIN_DIST = SPHERE_RADIUS * 2;

  let hCar = {...heroCar};
  const tCars = trafficCars.map((c) => ({...c}));
  const collisions: VehicleCollisionEvent[] = [];

  const getSpheres = (x: number, z: number, yaw: number) => {
    const fx = -Math.sin(yaw) * SPHERE_OFFSET;
    const fz = -Math.cos(yaw) * SPHERE_OFFSET;
    return [
      {x: x + fx, z: z + fz},
      {x: x - fx, z: z - fz},
    ];
  };

  // Helper to separate two oriented vehicles A and B
  const collidePair = (
    ax: number,
    az: number,
    ayaw: number,
    avx: number,
    avz: number,
    aStatic: boolean,
    bx: number,
    bz: number,
    byaw: number,
    bvx: number,
    bvz: number,
    bStatic: boolean
  ): {
    ax: number;
    az: number;
    bx: number;
    bz: number;
    hit: boolean;
    impactSpeed: number;
    nx: number;
    nz: number;
  } => {
    // Broadphase skip
    if (Math.hypot(ax - bx, az - bz) > 5.4) {
      return {ax, az, bx, bz, hit: false, impactSpeed: 0, nx: 0, nz: 0};
    }

    const sa = getSpheres(ax, az, ayaw);
    const sb = getSpheres(bx, bz, byaw);
    let maxPen = 0;
    let bestNx = 0;
    let bestNz = 0;

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const dx = sa[i].x - sb[j].x;
        const dz = sa[i].z - sb[j].z;
        const dist = Math.hypot(dx, dz);
        if (dist < MIN_DIST) {
          const pen = MIN_DIST - dist;
          if (pen > maxPen) {
            maxPen = pen;
            if (dist > 1e-4) {
              bestNx = dx / dist;
              bestNz = dz / dist;
            } else {
              bestNx = Math.cos(ayaw);
              bestNz = -Math.sin(ayaw);
            }
          }
        }
      }
    }

    if (maxPen <= 0) {
      return {ax, az, bx, bz, hit: false, impactSpeed: 0, nx: 0, nz: 0};
    }

    const weightA = aStatic ? 0 : bStatic ? 1 : 0.5;
    const weightB = bStatic ? 0 : aStatic ? 1 : 0.5;
    const push = maxPen + 0.02;
    const nax = ax + bestNx * push * weightA;
    const naz = az + bestNz * push * weightA;
    const nbx = bx - bestNx * push * weightB;
    const nbz = bz - bestNz * push * weightB;

    const relVx = avx - bvx;
    const relVz = avz - bvz;
    const closing = Math.abs(relVx * bestNx + relVz * bestNz) + Math.hypot(relVx, relVz) * 0.35;

    return {
      ax: nax,
      az: naz,
      bx: nbx,
      bz: nbz,
      hit: true,
      impactSpeed: closing,
      nx: bestNx,
      nz: bestNz,
    };
  };

  // 1. Hero Car vs every Traffic/Parked Car
  for (let i = 0; i < tCars.length; i++) {
    const tc = tCars[i];
    const res = collidePair(
      hCar.x,
      hCar.z,
      hCar.yaw,
      hCar.vx,
      hCar.vz,
      false,
      tc.x,
      tc.z,
      tc.yaw,
      tc.vx,
      tc.vz,
      tc.parked
    );
    if (res.hit) {
      hCar.x = res.ax;
      hCar.z = res.az;
      tc.x = res.bx;
      tc.z = res.bz;

      if (res.impactSpeed >= 1.5) {
        const heroArmorScale = (hCar.armorTier ?? 0) > 0 ? 0.55 : 1.0;
        hCar.speed *= -0.35;
        hCar.vx = -Math.sin(hCar.yaw) * hCar.speed;
        hCar.vz = -Math.cos(hCar.yaw) * hCar.speed;
        hCar.health = Math.max(5, hCar.health - res.impactSpeed * 1.8 * heroArmorScale);
        hCar.crashed = true;
        hCar.crashFlashTimer = 3.0;

        if (!tc.parked) {
          tc.speed = 0;
          tc.vx = -res.nx * Math.min(8, res.impactSpeed * 0.45);
          tc.vz = -res.nz * Math.min(8, res.impactSpeed * 0.45);
          tc.yaw += (Math.random() > 0.5 ? 1 : -1) * Math.min(0.45, res.impactSpeed * 0.04);
        }
        tc.health = Math.max(5, tc.health - res.impactSpeed * 2.2);
        tc.crashed = true;
        tc.crashTimer = 5.0;

        collisions.push({
          idA: 'hero',
          idB: tc.id,
          impactSpeed: res.impactSpeed,
          x: (hCar.x + tc.x) * 0.5,
          z: (hCar.z + tc.z) * 0.5,
          involvedHero: true,
          involvedPolice: tc.variant === 'police',
        });
      } else {
        // Gentle bump stops car cleanly without overlapping
        hCar.speed *= 0.25;
      }
    }
  }

  // 2. Traffic Car vs Traffic Car (ensures ambient cars NEVER overlap each other)
  for (let i = 0; i < tCars.length; i++) {
    for (let j = i + 1; j < tCars.length; j++) {
      const a = tCars[i];
      const b = tCars[j];
      const res = collidePair(
        a.x,
        a.z,
        a.yaw,
        a.vx,
        a.vz,
        a.parked,
        b.x,
        b.z,
        b.yaw,
        b.vx,
        b.vz,
        b.parked
      );
      if (res.hit) {
        a.x = res.ax;
        a.z = res.az;
        b.x = res.bx;
        b.z = res.bz;
        if (res.impactSpeed >= 1.8 && (!a.crashed || !b.crashed)) {
          a.speed = 0;
          b.speed = 0;
          a.crashed = true;
          b.crashed = true;
          a.crashTimer = 4.5;
          b.crashTimer = 4.5;
          a.health = Math.max(10, a.health - res.impactSpeed * 1.6);
          b.health = Math.max(10, b.health - res.impactSpeed * 1.6);
          collisions.push({
            idA: a.id,
            idB: b.id,
            impactSpeed: res.impactSpeed,
            x: (a.x + b.x) * 0.5,
            z: (a.z + b.z) * 0.5,
            involvedHero: false,
            involvedPolice: a.variant === 'police' || b.variant === 'police',
          });
        }
      }
    }
  }

  return {heroCar: hCar, trafficCars: tCars, collisions};
}

/**
 * Advances traffic cars with lane awareness (yield ahead of stopped/hero cars) and crash recovery.
 */
export function stepTrafficVehicles(
  trafficCars: TrafficVehicleState[],
  heroCar: VehiclePhysicsState,
  dt: number
): {
  heroCar: VehiclePhysicsState;
  trafficCars: TrafficVehicleState[];
  collisions: VehicleCollisionEvent[];
} {
  const safeDt = Math.min(dt, 0.05);
  const updated = trafficCars.map((car) => {
    if (car.parked) return {...car};

    const next = {...car};
    if (next.crashed) {
      next.crashTimer = Math.max(0, next.crashTimer - safeDt);
      next.x += next.vx * safeDt;
      next.z += next.vz * safeDt;
      next.vx *= Math.exp(-4.5 * safeDt);
      next.vz *= Math.exp(-4.5 * safeDt);
      if (next.crashTimer <= 0) {
        // Tow/recover back into clean lane when clear
        next.crashed = false;
        next.health = 100;
        if (next.axis === 'z') {
          next.x = next.laneCoord;
          next.yaw = next.dir === -1 ? 0 : Math.PI;
        } else {
          next.z = next.laneCoord;
          next.yaw = next.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
      return next;
    }

    // Check forward clearance along lane so ambient drivers brake instead of rear-ending!
    let obstacleAhead = false;
    const lookDist = 9.5;
    const fx = next.axis === 'x' ? next.dir : 0;
    const fz = next.axis === 'z' ? next.dir : 0;

    const checkBlock = (ox: number, oz: number) => {
      const dx = ox - next.x;
      const dz = oz - next.z;
      const fwd = dx * fx + dz * fz;
      const lat = Math.abs(dx * -fz + dz * fx);
      return fwd > 2.2 && fwd < lookDist && lat < 2.2;
    };

    if (checkBlock(heroCar.x, heroCar.z)) obstacleAhead = true;
    if (!obstacleAhead) {
      for (const other of trafficCars) {
        if (other.id !== next.id && checkBlock(other.x, other.z)) {
          obstacleAhead = true;
          break;
        }
      }
    }

    const targetSpd = obstacleAhead ? 0 : next.baseSpeed;
    next.speed = lerp(next.speed, targetSpd, 1 - Math.exp(-(obstacleAhead ? 8 : 3.5) * safeDt));
    next.vx = fx * next.speed;
    next.vz = fz * next.speed;

    if (next.axis === 'z') {
      next.z += next.dir * next.speed * safeDt;
      if (next.z > next.maxBound) next.z = next.minBound;
      if (next.z < next.minBound) next.z = next.maxBound;
    } else {
      next.x += next.dir * next.speed * safeDt;
      if (next.x > next.maxBound) next.x = next.minBound;
      if (next.x < next.minBound) next.x = next.maxBound;
    }

    next.wheelSpin += (next.speed * safeDt) / 0.36;
    return next;
  });

  return resolveAllVehicleCollisions(heroCar, updated);
}

export function stepHeroMovement(
  player: PlayerState,
  moveForward: number,
  moveRight: number,
  cameraYaw: number,
  wantsSprint: boolean,
  dt: number,
  colliders: RectCollider[] = BUILDING_COLLIDERS,
  extraObstacles: Array<{x: number; z: number; radius: number}> = [],
  aimYawOverride: number | null = null
): PlayerState {
  const safeDt = Math.min(dt, 0.05);
  const mag = Math.hypot(moveForward, moveRight);
  const isMoving = mag > 0.05;

  const canSprint = wantsSprint && player.stamina > 4;
  const sprinting = isMoving && canSprint;
  const stamina = sprinting
    ? Math.max(0, player.stamina - 22 * safeDt)
    : Math.min(player.maxStamina, player.stamina + 16 * safeDt);

  const maxSpeed = sprinting ? 6.4 : 3.35;

  let targetVx = 0;
  let targetVz = 0;
  let yaw = player.yaw;

  if (isMoving) {
    const nf = moveForward / mag;
    const nr = moveRight / mag;
    const dirX = -Math.sin(cameraYaw) * nf + Math.cos(cameraYaw) * nr;
    const dirZ = -Math.cos(cameraYaw) * nf - Math.sin(cameraYaw) * nr;
    const norm = Math.hypot(dirX, dirZ) || 1;
    const wx = dirX / norm;
    const wz = dirZ / norm;
    targetVx = wx * maxSpeed;
    targetVz = wz * maxSpeed;

    if (aimYawOverride === null || !Number.isFinite(aimYawOverride)) {
      const targetYaw = Math.atan2(-wx, -wz);
      let diff = targetYaw - yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yaw += diff * (1 - Math.exp(-12 * safeDt));
    }
  }

  if (aimYawOverride !== null && Number.isFinite(aimYawOverride)) {
    let diff = aimYawOverride - yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw += diff * (1 - Math.exp(-16 * safeDt));
  }

  const accel = 1 - Math.exp(-14 * safeDt);
  const vx = lerp(player.vx, targetVx, accel);
  const vz = lerp(player.vz, targetVz, accel);

  let nextX = player.x + vx * safeDt;
  let nextZ = player.z + vz * safeDt;

  for (const obs of extraObstacles) {
    const dx = nextX - obs.x;
    const dz = nextZ - obs.z;
    const minDist = 0.42 + obs.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = minDist - dist;
      nextX += (dx / dist) * push;
      nextZ += (dz / dist) * push;
    }
  }

  const resolved = resolveCircleCollisions(nextX, nextZ, 0.42, colliders);
  const stepDist = Math.hypot(resolved.x - player.x, resolved.z - player.z);

  return {
    ...player,
    x: resolved.x,
    z: resolved.z,
    yaw,
    vx,
    vz,
    walkDistance: player.walkDistance + stepDist,
    stamina,
    sprinting,
  };
}

export function getRankForCash(cash: number): SyndicateRank {
  let current = SYNDICATE_RANKS[0];
  for (const rank of SYNDICATE_RANKS) {
    if (cash >= rank.minCash) current = rank;
  }
  return current;
}

export function createInitialProgression(): ProgressionState {
  const npcMemory: Record<string, NpcMemoryState> = {};
  for (const npc of NPC_DEFINITIONS) {
    npcMemory[npc.id] = {
      metCount: 0,
      lastChoiceTag: null,
      lastTopic: null,
      mood: npc.isKid ? 'playful' : 'calm',
      trust: 0,
      completedContracts: [],
      notes: [],
    };
  }
  return {
    cash: 250,
    heat: 0,
    activeContractId: CONTRACTS[0].id,
    activeStepIndex: 0,
    completedContractIds: [],
    customContracts: [],
    npcMemory,
    ownedItemIds: [],
    purchasesCount: 0,
    totalDistanceDriven: 0,
    timePlayedSeconds: 0,
    crashesCount: 0,
  };
}

export function getShopItemsForZone(zoneId: string | null): ShopItem[] {
  if (!zoneId) return SHOP_ITEMS;
  const featured = SHOP_ITEMS.filter(
    (item) => !item.shopZoneIds || item.shopZoneIds.includes(zoneId)
  );
  const others = SHOP_ITEMS.filter(
    (item) => item.shopZoneIds && !item.shopZoneIds.includes(zoneId)
  );
  return [...featured, ...others];
}

export function buyShopItem(
  prog: ProgressionState,
  player: PlayerState,
  car: VehiclePhysicsState,
  itemId: string
): {
  ok: boolean;
  reason: string;
  item: ShopItem | null;
  progression: ProgressionState;
  player: PlayerState;
  car: VehiclePhysicsState;
} {
  const item = SHOP_ITEMS.find((i) => i.id === itemId) ?? null;
  if (!item) {
    return {
      ok: false,
      reason: 'Item not found in Liberty catalog.',
      item: null,
      progression: prog,
      player,
      car,
    };
  }
  const owned = prog.ownedItemIds ?? [];
  if (item.maxArmorBoost && owned.includes(item.id)) {
    return {
      ok: false,
      reason: `${item.name} is already tailored into Vito’s wardrobe.`,
      item,
      progression: prog,
      player,
      car,
    };
  }
  if (item.weaponId && owned.includes(item.id)) {
    return {
      ok: false,
      reason: `${item.name} is already owned. Press keys 1–4 to switch hardware.`,
      item,
      progression: prog,
      player,
      car,
    };
  }
  if (item.engineTier !== undefined && (car.engineTier ?? 0) >= item.engineTier) {
    return {
      ok: false,
      reason: `Coupe engine already meets or exceeds Tier ${item.engineTier}.`,
      item,
      progression: prog,
      player,
      car,
    };
  }
  if (item.armorTier !== undefined && (car.armorTier ?? 0) >= item.armorTier) {
    return {
      ok: false,
      reason: 'Reinforced Iron Grill is already welded onto the coupe.',
      item,
      progression: prog,
      player,
      car,
    };
  }
  if (
    item.heatReduction &&
    !item.staminaGain &&
    !item.armorGain &&
    prog.heat <= 0
  ) {
    return {
      ok: false,
      reason: 'No active Precinct Heat on Vito’s docket.',
      item,
      progression: prog,
      player,
      car,
    };
  }
  if (
    item.carHeal &&
    item.engineTier === undefined &&
    item.armorTier === undefined &&
    car.health >= 99.5 &&
    !car.crashed
  ) {
    return {
      ok: false,
      reason: 'Black 1969 coupe chassis is already at 100%.',
      item,
      progression: prog,
      player,
      car,
    };
  }
  if (prog.cash < item.price) {
    return {
      ok: false,
      reason: `Need $${item.price} for ${item.name} (you have $${Math.round(prog.cash)}).`,
      item,
      progression: prog,
      player,
      car,
    };
  }

  const nextMaxArmor = player.maxArmor + (item.maxArmorBoost ?? 0);
  const nextPlayer: PlayerState = {
    ...player,
    maxArmor: nextMaxArmor,
    armor: clamp(player.armor + (item.armorGain ?? 0), 0, nextMaxArmor),
    stamina: clamp(player.stamina + (item.staminaGain ?? 0), 0, player.maxStamina),
    equippedWeapon: item.weaponId ?? player.equippedWeapon,
  };

  const nextCar: VehiclePhysicsState = {
    ...car,
    health: item.carHeal ? 100 : car.health,
    crashed: item.carHeal ? false : car.crashed,
    crashFlashTimer: item.carHeal ? 0 : car.crashFlashTimer,
    engineTier:
      item.engineTier !== undefined
        ? Math.max(car.engineTier ?? 0, item.engineTier)
        : (car.engineTier ?? 0),
    armorTier:
      item.armorTier !== undefined
        ? Math.max(car.armorTier ?? 0, item.armorTier)
        : (car.armorTier ?? 0),
  };

  const nextOwned = owned.includes(item.id) ? owned : [...owned, item.id];
  const nextProg: ProgressionState = {
    ...prog,
    cash: prog.cash - item.price,
    heat: clamp(prog.heat - (item.heatReduction ?? 0), 0, 5),
    ownedItemIds: nextOwned,
    purchasesCount: (prog.purchasesCount ?? 0) + 1,
  };

  return {
    ok: true,
    reason: `Purchased ${item.name} (-$${item.price}).`,
    item,
    progression: nextProg,
    player: nextPlayer,
    car: nextCar,
  };
}

export function getAllContracts(prog: ProgressionState): ContractMission[] {
  return [...CONTRACTS, ...(prog.customContracts ?? [])];
}

export function createCustomContract(
  draft: CustomMissionDraft,
  existingCount: number
): ContractMission {
  const id = `custom_${Date.now()}_${existingCount + 1}`;
  const cleanTitle = draft.title.trim() || `Syndicate Run #${existingCount + 1}`;
  const reward = clamp(Math.round(draft.rewardCash || 900), 250, 5000);
  const landmark = LANDMARKS.find((l) => l.id === draft.targetLandmarkId) ?? LANDMARKS[0];
  const npc = NPC_DEFINITIONS.find((n) => n.id === draft.targetNpcId) ?? NPC_DEFINITIONS[0];

  const steps: ContractStep[] = [];
  if (draft.type === 'talk') {
    steps.push({
      id: `${id}_s1`,
      type: 'talk',
      targetNpcId: npc.id,
      targetPos: {x: npc.x, z: npc.z},
      targetRadius: 4.0,
      label: `Meet ${npc.name}`,
      instruction: draft.briefing.trim() || `Find ${npc.name} and press E to talk.`,
    });
  } else if (draft.type === 'deliver') {
    steps.push(
      {
        id: `${id}_s1`,
        type: 'drive',
        targetPos: {x: landmark.x, z: landmark.z},
        targetRadius: 7.0,
        label: `Drive to ${landmark.label}`,
        instruction:
          draft.briefing.trim() || `Drive to ${landmark.label} to make the drop.`,
      },
      {
        id: `${id}_s2`,
        type: 'talk',
        targetNpcId: npc.id,
        targetPos: {x: npc.x, z: npc.z},
        targetRadius: 4.0,
        label: `Report to ${npc.name}`,
        instruction: `Confirm the drop with ${npc.name} (E).`,
      }
    );
  } else {
    steps.push({
      id: `${id}_s1`,
      type: 'drive',
      targetPos: {x: landmark.x, z: landmark.z},
      targetRadius: 7.0,
      label: `Reach ${landmark.label}`,
      instruction:
        draft.briefing.trim() || `Cruise or sprint to ${landmark.label}.`,
    });
  }

  return {
    id,
    code: `CUSTOM ${String(existingCount + 1).padStart(2, '0')}`,
    title: cleanTitle,
    giverNpcId: npc.id,
    rewardCash: reward,
    heatGain: draft.type === 'deliver' ? 1 : 0,
    isCustom: true,
    steps,
  };
}

export function getActiveContract(prog: ProgressionState): ContractMission | null {
  if (!prog.activeContractId) return null;
  return getAllContracts(prog).find((c) => c.id === prog.activeContractId) ?? null;
}

export function getActiveContractStep(prog: ProgressionState): ContractStep | null {
  const contract = getActiveContract(prog);
  if (!contract) return null;
  return contract.steps[prog.activeStepIndex] ?? null;
}

export function checkAndAdvanceContract(
  prog: ProgressionState,
  event: {type: 'talk' | 'location'; npcId?: string; x?: number; z?: number}
): {
  progression: ProgressionState;
  stepCompleted: boolean;
  contractCompleted: ContractMission | null;
} {
  const contract = getActiveContract(prog);
  const step = getActiveContractStep(prog);
  if (!contract || !step) {
    return {progression: prog, stepCompleted: false, contractCompleted: null};
  }

  let matched = false;
  if (event.type === 'talk' && step.type === 'talk' && event.npcId === step.targetNpcId) {
    matched = true;
  } else if (
    event.type === 'location' &&
    (step.type === 'drive' || step.type === 'deliver' || step.type === 'evade') &&
    step.targetPos &&
    event.x !== undefined &&
    event.z !== undefined
  ) {
    const dist = Math.hypot(event.x - step.targetPos.x, event.z - step.targetPos.z);
    if (dist <= (step.targetRadius ?? 5.5)) matched = true;
  }

  if (!matched) {
    return {progression: prog, stepCompleted: false, contractCompleted: null};
  }

  const nextIndex = prog.activeStepIndex + 1;
  if (nextIndex < contract.steps.length) {
    return {
      progression: {
        ...prog,
        activeStepIndex: nextIndex,
      },
      stepCompleted: true,
      contractCompleted: null,
    };
  }

  const completedIds = prog.completedContractIds.includes(contract.id)
    ? prog.completedContractIds
    : [...prog.completedContractIds, contract.id];

  const allContracts = getAllContracts(prog);
  const nextContract = allContracts.find((c) => !completedIds.includes(c.id)) ?? null;
  const giverMem = prog.npcMemory[contract.giverNpcId];
  const updatedMemory = giverMem
    ? {
        ...prog.npcMemory,
        [contract.giverNpcId]: {
          ...giverMem,
          trust: clamp(giverMem.trust + 1, -3, 4),
          mood: 'friendly' as NpcMood,
          completedContracts: giverMem.completedContracts.includes(contract.id)
            ? giverMem.completedContracts
            : [...giverMem.completedContracts, contract.id],
        },
      }
    : prog.npcMemory;

  return {
    progression: {
      ...prog,
      cash: prog.cash + contract.rewardCash,
      heat: clamp(prog.heat + contract.heatGain, 0, 5),
      activeContractId: nextContract ? nextContract.id : null,
      activeStepIndex: 0,
      completedContractIds: completedIds,
      npcMemory: updatedMemory,
    },
    stepCompleted: true,
    contractCompleted: contract,
  };
}

export function getDialogueOptionsForNpc(
  npcId: string,
  prog: ProgressionState
): DialogueOption[] {
  const npc = NPC_DEFINITIONS.find((n) => n.id === npcId);
  const activeStep = getActiveContractStep(prog);
  const isTarget = activeStep?.type === 'talk' && activeStep.targetNpcId === npcId;

  const options: DialogueOption[] = [];
  if (isTarget) {
    options.push({
      id: 'business',
      label: '"Let’s handle the family business."',
      tag: 'business',
      trustDelta: 1,
    });
  }
  if (npc?.isKid) {
    options.push(
      {
        id: 'kid_rumor',
        label: '"Seen anything unusual on the block today, kid?"',
        tag: 'street-intel',
        trustDelta: 1,
      },
      {
        id: 'kid_tip',
        label: '"Here’s a buck for a soda. Keep your eyes peeled."',
        tag: 'compliment',
        trustDelta: 1,
      }
    );
    return options;
  }

  options.push(
    {
      id: 'word',
      label: '"What’s the word on the avenue tonight?"',
      tag: 'street-intel',
      trustDelta: 0,
    },
    {
      id: 'pressure',
      label: '"Watch your tone. You know Vito Menotti runs this block."',
      tag: 'intimidate',
      trustDelta: -1,
    }
  );
  return options;
}

/**
 * Cognitive NLU parser: extracts intent, sentiment, NPC names, landmarks, and weapon mentions
 * from voice transcripts or typed text.
 */
export function parsePlayerUtterance(rawText: string): ParsedUtterance {
  const lower = rawText.toLowerCase().trim();
  const keywords = lower.split(/[^a-z0-9]+/).filter(Boolean);

  let mentionedNpcId: string | null = null;
  for (const npc of NPC_DEFINITIONS) {
    const first = npc.name.toLowerCase().replace(/[^a-z ]/g, '').split(' ')[0];
    if (
      (first && first.length >= 3 && lower.includes(first)) ||
      lower.includes(npc.id.replace('_kid', ''))
    ) {
      mentionedNpcId = npc.id;
      break;
    }
  }

  let mentionedLandmark: string | null = null;
  for (const lm of LANDMARKS) {
    const firstWord = lm.label.toLowerCase().split(' ')[0];
    if (lower.includes(firstWord) || lower.includes(lm.id.replace('_', ' '))) {
      mentionedLandmark = lm.label;
      break;
    }
  }

  let mentionedWeapon: WeaponId | null = null;
  if (lower.includes('tommy') || lower.includes('thompson') || lower.includes('drum')) {
    mentionedWeapon = 'tommy';
  } else if (lower.includes('shotgun') || lower.includes('double') || lower.includes('gauge')) {
    mentionedWeapon = 'shotgun';
  } else if (lower.includes('1911') || lower.includes('chrome') || lower.includes('pistol')) {
    mentionedWeapon = 'pistol';
  } else if (lower.includes('revolver') || lower.includes('snub') || lower.includes('38')) {
    mentionedWeapon = 'revolver';
  }

  let intent: UtteranceIntent = 'general';
  if (/(hello|hey|hi |evening|morning|how are|good seeing|vito)/.test(lower)) intent = 'greeting';
  if (/(bye|later|see ya|leave|gotta go)/.test(lower)) intent = 'farewell';
  if (/(sorry|apologize|my bad|easy|peace)/.test(lower)) intent = 'apologize';
  if (/(bribe|cash|dollar|pay|cut|money|envelope|buck)/.test(lower)) intent = 'bribe';
  if (/(threat|kill|shoot|rat|watch it|tone|shut up|else)/.test(lower)) intent = 'threaten';
  if (/(thanks|thank|respect|good job|great|nice|friend|helpful)/.test(lower)) intent = 'compliment';
  if (/(gun|weapon|holster|iron|piece|tommy|shotgun|pistol|revolver)/.test(lower)) intent = 'weapon';
  if (/(car|coupe|engine|crash|dent|drive|garage|wheel|speed)/.test(lower)) intent = 'car';
  if (/(cop|police|heat|precinct|siren|cruiser|badge|dolan)/.test(lower)) intent = 'police';
  if (/(mission|contract|job|work|next|objective|task)/.test(lower)) intent = 'mission';
  if (/(where|how do i get|directions|map|pier|clinic|diner|park|bar|mirage|courthouse)/.test(lower)) {
    intent = 'location';
  }
  if (/(rain|weather|storm|night|time|clock|dusk|golden)/.test(lower)) intent = 'weather_time';
  if (mentionedNpcId && intent === 'general') intent = 'npc_query';

  let sentiment: ParsedUtterance['sentiment'] = 'neutral';
  if (intent === 'threaten') sentiment = 'hostile';
  else if (intent === 'compliment' || intent === 'apologize' || intent === 'greeting' || intent === 'bribe') {
    sentiment = 'warm';
  }

  return {
    raw: rawText,
    intent,
    sentiment,
    mentionedNpcId,
    mentionedLandmark,
    mentionedWeapon,
    keywords,
  };
}

export interface WorldMindContext {
  equippedWeapon?: WeaponId;
  carHealth?: number;
  carCrashed?: boolean;
  currentInteriorName?: string | null;
}

/**
 * Cognitive NPC Mind Engine: understands player voice/text via NLU, updates NPC mood & memory,
 * and crafts intelligent context-aware responses referencing contracts, weapons, crashes, and past visits.
 */
export function generateNpcReply(
  npcId: string,
  userText: string,
  choiceTag: string | null,
  prog: ProgressionState,
  atmosphere: AtmosphereParams,
  context: WorldMindContext = {}
): {reply: string; memory: NpcMemoryState} {
  const npc = NPC_DEFINITIONS.find((n) => n.id === npcId) ?? NPC_DEFINITIONS[0];
  const prevMem: NpcMemoryState = prog.npcMemory[npcId] ?? {
    metCount: 0,
    lastChoiceTag: null,
    lastTopic: null,
    mood: npc.isKid ? 'playful' : 'calm',
    trust: 0,
    completedContracts: [],
    notes: [],
  };

  const parsed = parsePlayerUtterance(userText);
  const rank = getRankForCash(prog.cash);
  const activeContract = getActiveContract(prog);
  const activeStep = getActiveContractStep(prog);
  const weaponDef = WEAPONS.find((w) => w.id === (context.equippedWeapon ?? 'revolver')) ?? WEAPONS[0];

  let trustDelta = 0;
  if (choiceTag === 'business' || choiceTag === 'compliment') trustDelta = 1;
  else if (choiceTag === 'intimidate') trustDelta = -1;
  else if (parsed.sentiment === 'warm') trustDelta = 1;
  else if (parsed.sentiment === 'hostile') trustDelta = -1;

  const nextTrust = clamp(prevMem.trust + trustDelta, -3, 4);
  const metCount = prevMem.metCount + 1;

  let nextMood: NpcMood = prevMem.mood;
  if (npc.isKid) {
    nextMood = parsed.sentiment === 'hostile' ? 'fearful' : 'playful';
  } else if (nextTrust >= 2) {
    nextMood = 'friendly';
  } else if (nextTrust <= -2 || parsed.intent === 'threaten') {
    nextMood = npc.personality === 'nervous' ? 'fearful' : 'angry';
  } else if (nextTrust < 0) {
    nextMood = 'suspicious';
  } else {
    nextMood = 'calm';
  }

  const topicTag = choiceTag ?? parsed.intent;
  const noteText = choiceTag
    ? `${atmosphere.clockLabel}: ${choiceTag}`
    : `${parsed.intent}: "${userText.trim().slice(0, 34)}"`;
  const notes = noteText ? [...prevMem.notes.slice(-4), noteText] : prevMem.notes;

  // Memory recall prefix
  let memoryPrefix = '';
  if (prevMem.metCount > 0) {
    if (parsed.intent === 'apologize' && prevMem.trust < 0) {
      memoryPrefix = 'Alright, Vito — I appreciate you smoothing things over after last time. ';
    } else if (prevMem.lastChoiceTag === 'intimidate' || prevMem.mood === 'angry') {
      memoryPrefix = 'I still remember how hard you pressed me earlier. ';
    } else if (prevMem.lastTopic && prevMem.lastTopic === parsed.intent && !choiceTag) {
      memoryPrefix = `You asked about that earlier, ${rank.title} — `;
    } else if (prevMem.trust >= 2) {
      memoryPrefix = `Always good having you on the block, ${rank.title}. `;
    }
  }

  // Contextual reaction to crashed car or heavy gun
  let reactionNote = '';
  if (context.carCrashed && (parsed.intent === 'car' || prevMem.metCount === 0)) {
    reactionNote = ' (Looks like your coupe took a nasty fender hit—swing by Vinnie’s Garage!)';
  } else if (
    (context.equippedWeapon === 'tommy' || context.equippedWeapon === 'shotgun') &&
    parsed.intent === 'general' &&
    metCount === 1
  ) {
    reactionNote = npc.isKid
      ? ' Whoa, that’s a real ' + weaponDef.shortName + '!'
      : ` Easy swinging that ${weaponDef.shortName} out in the open.`;
  }

  let body = '';
  if (choiceTag === 'business') {
    if (npcId === 'sal') {
      body =
        'Take the black 1969 coupe up to the Mirage Theater intersection and pass word to Elena Vance. Keep your headlights steady.';
    } else if (npcId === 'elena') {
      body =
        'Got the ledger tip, Vito. Roll into Vinnie’s Garage Alley east of Tenth Ave — tell him the plates are hot.';
    } else if (npcId === 'vinnie') {
      body =
        'Fresh plates are bolted on and your suspension is dialed. Run north to Officer Dolan on the Courthouse steps.';
    } else if (npcId === 'dolan') {
      body =
        'Envelope received. Keep your nose clean until Capo Carmine Gallo clears your name on Harbor Boulevard.';
    } else if (npcId === 'carmine') {
      body =
        'Welcome to the east side, Menotti. The freighter on South Pier is waiting on Foreman Frankie Doyle.';
    } else if (npcId === 'frankie') {
      body =
        'Manifest signed and crated. Slip across to Mercy Clinic on West Broadway so Dr. Crane cools your heat.';
    } else if (npcId === 'dr_crane') {
      body =
        'Take a breath, Vito. I patched up your record — head to Liberty Park Fountain and close the accord with Sal.';
    } else {
      body = activeStep
        ? `Your current lead points to: ${activeStep.instruction}`
        : `You have the Syndicate's respect, ${HERO_NAME}.`;
    }
  } else if (parsed.intent === 'threaten' || choiceTag === 'intimidate') {
    body = npc.isKid
      ? 'Hey! Take it easy, Mister Menotti — I’m just selling papers here!'
      : npc.personality === 'nervous'
        ? 'Whoa—hold on, Vito! Put the iron down, I’ll tell you what I know: ' + npc.secretIntel
        : 'Easy with that attitude, Menotti. Word travels from the Fuel Bar to the Courthouse faster than a V8.';
  } else if (parsed.intent === 'weapon') {
    body = npc.isKid
      ? `Is that a ${weaponDef.name}? Tommy says Vinnie keeps extra magazines & upgrades in the Shop [B]!`
      : `That ${weaponDef.name} (${weaponDef.caliber}) carries real weight. Press keys 1–4 to swap, or open Shop [B] for custom tunes & armor.`;
  } else if (parsed.intent === 'car') {
    body =
      npcId === 'vinnie'
        ? `Your black coupe sits at ${Math.round(context.carHealth ?? 100)}% chassis integrity. Open Shop [B] for Twin-Carb, Supercharger, or Iron Bumpers.`
        : 'That black 1969 muscle coupe handles the wet streets nicely — swing by Vinnie’s Garage or open Shop [B] for V8 blowers.';
  } else if (parsed.intent === 'police') {
    body =
      prog.heat > 0
        ? `You’ve got ${prog.heat} star${prog.heat > 1 ? 's' : ''} of precinct heat. Step inside Mercy Clinic, Golden Dragon Tea House, or grab Clean Papers in [B].`
        : 'Cruisers are running cross-street loops tonight. Keep off their fenders and nobody stops you.';
  } else if (parsed.intent === 'mission') {
    body = activeContract && activeStep
      ? `Active work: "${activeContract.title}" ($${activeContract.rewardCash}). Next step: ${activeStep.instruction}`
      : 'All 12 story contracts are clear — open the Custom Mission Board [J] to write your own run.';
  } else if (parsed.intent === 'location') {
    if (parsed.mentionedLandmark) {
      body = `${parsed.mentionedLandmark} is marked on your District Radar in the top-right across all five avenues.`;
    } else {
      body =
        'Tenth Ave runs from Uptown Exchange Plaza down to Outer Pier; West Broadway leads to Fifth Bespoke Tailors; East Cross reaches Golden Dragon Tea House.';
    }
  } else if (parsed.intent === 'npc_query' && parsed.mentionedNpcId) {
    const target = NPC_DEFINITIONS.find((n) => n.id === parsed.mentionedNpcId);
    body = target
      ? `${target.name} (${target.role}) usually holds down that post. Here’s a tip: ${npc.secretIntel}`
      : npc.secretIntel;
  } else if (parsed.intent === 'bribe') {
    body =
      prog.cash >= 200
        ? `You’ve got $${Math.round(prog.cash)} in your pocket, Vito. Hold onto it—unless Dolan corners you at the Courthouse.`
        : 'Save your cash until you close a contract, kid.';
  } else if (parsed.intent === 'weather_time') {
    body = `${atmosphere.clockLabel} (${atmosphere.phaseLabel}) — the wet asphalt throws every neon sign back at you. Stay warm inside ${context.currentInteriorName ?? 'the Fuel Bar or Diner'}.`;
  } else if (parsed.intent === 'compliment' || choiceTag === 'compliment') {
    body = npc.isKid
      ? `Thanks, Vito! Here’s a secret I overheard: ${npc.secretIntel}`
      : `Much obliged, Vito. Between us: ${npc.secretIntel}`;
  } else if (choiceTag === 'street-intel') {
    body = npc.secretIntel;
  } else if (parsed.intent === 'farewell') {
    body = 'Keep your head on a swivel out there, Vito Menotti.';
  } else if (parsed.intent === 'greeting') {
    body = `${npc.greeting}`;
  } else {
    // Intelligent fallback echoing the user's topic naturally!
    const snippet = userText.trim().slice(0, 48);
    body = snippet
      ? `I hear what you’re saying about "${snippet}", Vito. ${npc.secretIntel}`
      : npc.greeting;
  }

  return {
    reply: `${memoryPrefix}${body}${reactionNote}`.trim(),
    memory: {
      metCount,
      lastChoiceTag: choiceTag ?? prevMem.lastChoiceTag,
      lastTopic: topicTag,
      mood: nextMood,
      trust: nextTrust,
      completedContracts: prevMem.completedContracts,
      notes,
    },
  };
}

/**
 * Allows the user (Vito Menotti) to talk to himself / reflect aloud via voice or text
 * when no NPC is right beside him.
 */
export function generateHeroMonologue(
  userText: string,
  prog: ProgressionState,
  atmosphere: AtmosphereParams,
  context: WorldMindContext
): string {
  const parsed = parsePlayerUtterance(userText);
  const rank = getRankForCash(prog.cash);
  const activeStep = getActiveContractStep(prog);
  const weapon = WEAPONS.find((w) => w.id === (context.equippedWeapon ?? 'revolver')) ?? WEAPONS[0];

  if (parsed.intent === 'mission') {
    return activeStep
      ? `Vito Menotti: "${activeStep.instruction}"`
      : `Vito Menotti: "Ledger is clean. Time to write a custom run on the Syndicate Board [J]."`;
  }
  if (parsed.intent === 'car') {
    return context.carCrashed
      ? `Vito Menotti: "Coupe took a beating (${Math.round(context.carHealth ?? 60)}%). Need Vinnie's Garage Alley."`
      : `Vito Menotti: "Black '69 coupe is Purring at ${Math.round(context.carHealth ?? 100)}%. Ready to roll."`;
  }
  if (parsed.intent === 'weapon') {
    return `Vito Menotti: "Carrying the ${weapon.name}. Cold steel keeps Liberty District polite."`;
  }
  if (parsed.intent === 'police') {
    return prog.heat > 0
      ? `Vito Menotti: "${prog.heat} star heat on my back. Mercy Clinic off West Broadway will cool things down."`
      : `Vito Menotti: "Streets are quiet for a ${rank.title}. No sirens on Tenth Ave yet."`;
  }
  if (context.currentInteriorName) {
    return `Vito Menotti: "Warm inside ${context.currentInteriorName} while ${atmosphere.phaseLabel.toLowerCase()} settles outside."`;
  }
  const clean = userText.trim();
  return clean
    ? `Vito Menotti: "${clean}" — ${atmosphere.clockLabel}, ${rank.title}, $${Math.round(prog.cash)} in the pocket.`
    : `Vito Menotti: "${atmosphere.clockLabel} in Liberty District. Keep moving."`;
}

export const SAVE_STORAGE_KEY = 'empire_noir_iv_save_v1';

export function serializeSave(payload: SavePayload): string {
  return JSON.stringify(payload);
}

export function deserializeSave(raw: string | null): SavePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavePayload>;
    if (parsed.version !== 1 || !parsed.player || !parsed.car || !parsed.progression) {
      return null;
    }
    const baseProg = createInitialProgression();
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      time01:
        typeof parsed.time01 === 'number' && Number.isFinite(parsed.time01)
          ? parsed.time01 >= 0 && parsed.time01 < 1
            ? parsed.time01
            : ((parsed.time01 % 1) + 1) % 1
          : 0.04,
      player: {
        x: Number.isFinite(parsed.player.x) ? parsed.player.x : HERO_SPAWN.x,
        z: Number.isFinite(parsed.player.z) ? parsed.player.z : HERO_SPAWN.z,
        yaw: Number.isFinite(parsed.player.yaw) ? parsed.player.yaw : 0,
        inVehicle: Boolean(parsed.player.inVehicle),
        equippedWeapon: parsed.player.equippedWeapon ?? 'revolver',
        armor: Number.isFinite(parsed.player.armor) ? parsed.player.armor : 25,
        maxArmor: Number.isFinite(parsed.player.maxArmor) ? parsed.player.maxArmor : 100,
      },
      car: {
        x: Number.isFinite(parsed.car.x) ? parsed.car.x : CAR_SPAWN.x,
        z: Number.isFinite(parsed.car.z) ? parsed.car.z : CAR_SPAWN.z,
        yaw: Number.isFinite(parsed.car.yaw) ? parsed.car.yaw : 0,
        health: Number.isFinite(parsed.car.health) ? parsed.car.health : 100,
        crashed: Boolean(parsed.car.crashed),
        engineTier: Number.isFinite(parsed.car.engineTier) ? parsed.car.engineTier : 0,
        armorTier: Number.isFinite(parsed.car.armorTier) ? parsed.car.armorTier : 0,
      },
      progression: {
        ...baseProg,
        ...parsed.progression,
        ownedItemIds: Array.isArray(parsed.progression.ownedItemIds)
          ? parsed.progression.ownedItemIds
          : [],
        purchasesCount: Number.isFinite(parsed.progression.purchasesCount)
          ? parsed.progression.purchasesCount
          : 0,
        customContracts: Array.isArray(parsed.progression.customContracts)
          ? parsed.progression.customContracts
          : [],
        npcMemory: {
          ...baseProg.npcMemory,
          ...(parsed.progression.npcMemory ?? {}),
        },
      },
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return null;
  }
}

export function mergeSettings(
  current: SettingsState,
  patch: Partial<SettingsState>
): SettingsState {
  return {
    ...current,
    ...patch,
    masterVolume: clamp(patch.masterVolume ?? current.masterVolume, 0, 1),
    sfxVolume: clamp(patch.sfxVolume ?? current.sfxVolume, 0, 1),
    cycleSpeed: clamp(patch.cycleSpeed ?? current.cycleSpeed, 0.25, 4),
  };
}
