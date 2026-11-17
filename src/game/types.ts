export type GameModeState = 'title' | 'playing' | 'dialogue' | 'paused' | 'gameover';

export type WeatherMode = 'clear' | 'drizzle' | 'storm';

export type GraphicsQuality = 'cinematic' | 'high' | 'balanced';

export type CameraMode = 'chase' | 'interior';

export type WeaponId = 'revolver' | 'pistol' | 'tommy' | 'shotgun';

export type NpcMood = 'friendly' | 'calm' | 'suspicious' | 'angry' | 'fearful' | 'playful';

export type NpcPersonality = 'calculating' | 'charming' | 'nervous' | 'gruff' | 'innocent';

export interface Vec2 {
  x: number;
  z: number;
}

export interface RectCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'building' | 'prop' | 'boundary';
}

export interface InteriorZone {
  id: string;
  name: string;
  subtitle: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  hospitalityBonus?: 'heal_stamina' | 'clear_heat' | 'repair_car' | 'intel';
}

export interface WeaponDefinition {
  id: WeaponId;
  key: string;
  name: string;
  shortName: string;
  caliber: string;
  fireRateMs: number;
  damage: number;
  spread: number;
}

export interface AtmosphereParams {
  time01: number; // 0 = Golden Hour, 0.32 = Dusk, 0.62 = Midnight, 0.90 = Dawn
  phaseLabel: 'Golden Hour' | 'Dusk' | 'Midnight' | 'Dawn';
  clockLabel: string;
  sunElevationRad: number;
  sunAzimuthRad: number;
  sunColorHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  fogColorHex: number;
  fogDensity: number;
  exposure: number;
  neonIntensity: number;
  windowGlow: number;
  streetLightIntensity: number;
  headlightIntensity: number;
  roadWetness: number;
  godRayStrength: number;
}

export interface PlayerState {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  walkDistance: number;
  inVehicle: boolean;
  stamina: number;
  maxStamina: number;
  armor: number;
  maxArmor: number;
  sprinting: boolean;
  equippedWeapon: WeaponId;
}

export interface VehiclePhysicsState {
  x: number;
  z: number;
  yaw: number;
  speed: number; // signed forward speed (m/s)
  vx: number;
  vz: number;
  steerAngle: number;
  wheelSpin: number;
  braking: boolean;
  pitch: number;
  roll: number;
  gear: string;
  rpm01: number;
  health: number; // 0..100
  crashed: boolean;
  crashFlashTimer: number;
  engineTier: number; // 0 = stock, 1 = twin-carb, 2 = supercharged
  armorTier: number; // 0 = stock, 1 = reinforced bumper
}

export type ShopCategory = 'consumable' | 'gear' | 'weapon' | 'vehicle';

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  description: string;
  shopZoneIds?: string[]; // if omitted, available at Syndicate Supply or matching shop
  weaponId?: WeaponId;
  staminaGain?: number;
  armorGain?: number;
  maxArmorBoost?: number;
  heatReduction?: number;
  carHeal?: boolean;
  engineTier?: number;
  armorTier?: number;
}

export interface TrafficVehicleState {
  id: string;
  variant: 'checker_cab' | 'police' | 'sedan_40s' | 'red_finned';
  axis: 'x' | 'z';
  laneCoord: number;
  dir: 1 | -1;
  baseSpeed: number;
  minBound: number;
  maxBound: number;
  parked: boolean;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  vx: number;
  vz: number;
  wheelSpin: number;
  health: number;
  crashed: boolean;
  crashTimer: number;
}

export interface VehicleCollisionEvent {
  idA: string;
  idB: string;
  impactSpeed: number;
  x: number;
  z: number;
  involvedHero: boolean;
  involvedPolice: boolean;
}

export interface SyndicateRank {
  index: number;
  title: string;
  minCash: number;
}

export type ContractStepType = 'talk' | 'drive' | 'deliver' | 'evade';

export interface ContractStep {
  id: string;
  type: ContractStepType;
  targetNpcId?: string;
  targetPos?: Vec2;
  targetRadius?: number;
  label: string;
  instruction: string;
}

export interface ContractMission {
  id: string;
  code: string;
  title: string;
  giverNpcId: string;
  rewardCash: number;
  heatGain: number;
  isCustom?: boolean;
  steps: ContractStep[];
}

export interface CustomMissionDraft {
  title: string;
  type: 'drive' | 'talk' | 'deliver';
  targetNpcId: string;
  targetLandmarkId: string;
  rewardCash: number;
  briefing: string;
}

export interface NpcMemoryState {
  metCount: number;
  lastChoiceTag: string | null;
  lastTopic: string | null;
  mood: NpcMood;
  trust: number; // -3 to +4
  completedContracts: string[];
  notes: string[];
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  yaw: number;
  coatColor: number;
  hatColor: number;
  tieColor: number;
  skinColor?: number;
  isWoman?: boolean;
  isKid?: boolean;
  hasHolster?: boolean;
  personality: NpcPersonality;
  voicePitch: number;
  voiceRate: number;
  greeting: string;
  secretIntel: string;
  interiorId?: string;
}

export interface DialogueOption {
  id: string;
  label: string;
  tag: string;
  trustDelta: number;
}

export type UtteranceIntent =
  | 'greeting'
  | 'mission'
  | 'car'
  | 'weapon'
  | 'police'
  | 'location'
  | 'weather_time'
  | 'npc_query'
  | 'compliment'
  | 'threaten'
  | 'apologize'
  | 'bribe'
  | 'farewell'
  | 'general';

export interface ParsedUtterance {
  raw: string;
  intent: UtteranceIntent;
  sentiment: 'warm' | 'neutral' | 'hostile';
  mentionedNpcId: string | null;
  mentionedLandmark: string | null;
  mentionedWeapon: WeaponId | null;
  keywords: string[];
}

export interface SettingsState {
  quality: GraphicsQuality;
  bloom: boolean;
  filmGrain: boolean;
  weather: WeatherMode;
  autoCycleTime: boolean;
  cycleSpeed: number;
  masterVolume: number;
  sfxVolume: number;
  ttsEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface ProgressionState {
  cash: number;
  heat: number; // 0..5
  activeContractId: string | null;
  activeStepIndex: number;
  completedContractIds: string[];
  customContracts: ContractMission[];
  npcMemory: Record<string, NpcMemoryState>;
  ownedItemIds: string[];
  purchasesCount: number;
  totalDistanceDriven: number;
  timePlayedSeconds: number;
  crashesCount: number;
}

export interface SavePayload {
  version: number;
  savedAt: number;
  time01: number;
  player: Pick<
    PlayerState,
    'x' | 'z' | 'yaw' | 'inVehicle' | 'equippedWeapon' | 'armor' | 'maxArmor'
  >;
  car: Pick<
    VehiclePhysicsState,
    'x' | 'z' | 'yaw' | 'health' | 'crashed' | 'engineTier' | 'armorTier'
  >;
  progression: ProgressionState;
  settings: SettingsState;
}

