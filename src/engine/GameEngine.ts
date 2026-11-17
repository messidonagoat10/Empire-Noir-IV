import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {
  CAR_SPAWN,
  DEFAULT_SETTINGS,
  HERO_SPAWN,
  NPC_DEFINITIONS,
  WEAPONS,
} from '../game/constants';
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
  getActiveContractStep,
  getAllContracts,
  getRankForCash,
  mergeSettings,
  SAVE_STORAGE_KEY,
  serializeSave,
  stepHeroMovement,
  stepTrafficVehicles,
  stepVehiclePhysics,
  type WorldMindContext,
} from '../game/simulation';
import type {
  CameraMode,
  CustomMissionDraft,
  GameModeState,
  PlayerState,
  ProgressionState,
  SettingsState,
  TrafficVehicleState,
  VehiclePhysicsState,
  WeaponId,
} from '../game/types';
import {createMaterialBank, type MaterialBank} from './materials';
import {createProceduralVehicle, type ProceduralVehicle} from './vehicles';
import {createProceduralCharacter, type ProceduralCharacter} from './characters';
import {createGltfHero, type GltfHeroInstance} from './gltfHero';
import {createWeaponModel, type WeaponRig} from './weapons';
import {buildNoirCityWorld, type WorldHandles} from './worldBuilder';
import {
  createPostProcessingPipeline,
  detectSoftwareWebGL,
  type PostProcessingPipeline,
} from './postprocessing';
import {NoirAudioEngine} from './audio';
import {GameUI, type SubModalKind} from '../ui/GameUI';

const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _playerVec = new THREE.Vector3();

export class NoirGameEngine {
  private mountEl: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pipeline: PostProcessingPipeline;
  private mats: MaterialBank;
  private world: WorldHandles;
  private heroMesh: ProceduralCharacter;
  private gltfHero: GltfHeroInstance;
  private gltfActivated = false;
  private heroCarMesh: ProceduralVehicle;
  private weaponRigs = new Map<WeaponId, WeaponRig>();
  private audio = new NoirAudioEngine();
  private ui: GameUI;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private sunDisc: THREE.Mesh;
  private sunOffset = new THREE.Vector3(-28, 22, -82);

  // Mouse pointer ground-plane aiming
  private pointerNdc = new THREE.Vector2();
  private hasPointerPos = false;
  private aimRaycaster = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
  private aimHit = new THREE.Vector3();
  private aimReticleMesh: THREE.Mesh;

  // Game State
  private mode: GameModeState = 'title';
  private activeSubModal: SubModalKind = null;
  private zenMode = false;
  private time01 = 0.04; // Golden Hour start
  private elapsed = 0;
  private lastTs = 0;
  private frameId = 0;
  private hitstopTimer = 0;
  private trauma = 0;
  private cameraMode: CameraMode = 'chase';
  private cameraYaw = 0;
  private cameraPitch = 0.24;
  private draggingLook = false;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDownAt = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private muted = false;
  private activeDialogueNpcId: string | null = null;
  private saveAccum = 0;

  // Weapons & Interiors
  private lastFireTime = 0;
  private muzzleFlashTimer = 0;
  private lastInteriorId: string | null = null;
  private heatClearAccum = 0;
  private trafficCars: TrafficVehicleState[] = [];

  private player: PlayerState;
  private car: VehiclePhysicsState;
  private progression: ProgressionState;
  private settings: SettingsState;

  // Input Tracking
  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();

  // Smooth Camera state
  private camPosCurrent = new THREE.Vector3(-4, 4.2, 24);
  private camLookCurrent = new THREE.Vector3(0, 2.2, -16);

  constructor(mountEl: HTMLElement, uiRoot: HTMLElement) {
    this.mountEl = mountEl;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mountEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd99b5e);
    this.scene.fog = new THREE.FogExp2(0xd99b5e, 0.0048);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      54,
      window.innerWidth / window.innerHeight,
      0.15,
      420
    );
    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);

    this.hemiLight = new THREE.HemisphereLight(0x88b4e8, 0x473321, 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffb45a, 3.2);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 175;
    const d = 44;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(10, 16, 16),
      new THREE.MeshBasicMaterial({color: 0xffe4a8, fog: false})
    );
    this.scene.add(this.sunDisc);

    // Materials & 320m x 320m Liberty District
    this.mats = createMaterialBank(this.renderer, this.isSoftwareGl);
    this.world = buildNoirCityWorld(this.mats);
    this.scene.add(this.world.root);
    this.trafficCars = this.world.initialTrafficStates.map((c) => ({...c}));

    // Hero: Vito Menotti procedural frame-0 rig + GLTF skeletal hot-swap + 4 3D weapons
    this.heroMesh = createProceduralCharacter(
      {
        vestColor: 0x69675d,
        shirtColor: 0xd4ccb8,
        trouserColor: 0x45433d,
        hatColor: 0xc2ab87,
        tieColor: 0x262422,
        skinColor: 0xd4a482,
        hasHolster: true,
      },
      this.mats
    );
    this.scene.add(this.heroMesh.group);

    this.gltfHero = createGltfHero(this.mats);
    this.gltfHero.group.visible = false;
    this.scene.add(this.gltfHero.group);

    this.aimReticleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 24),
      new THREE.MeshBasicMaterial({
        color: 0xe4b55c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    this.aimReticleMesh.rotation.x = -Math.PI / 2;
    this.aimReticleMesh.position.y = 0.04;
    this.aimReticleMesh.visible = false;
    this.scene.add(this.aimReticleMesh);

    for (const w of WEAPONS) {
      this.weaponRigs.set(w.id, createWeaponModel(w.id, this.mats));
    }

    this.heroCarMesh = createProceduralVehicle('muscle_hero', this.mats, !this.isSoftwareGl);
    this.scene.add(this.heroCarMesh.group);

    this.pipeline = createPostProcessingPipeline(
      this.renderer,
      this.scene,
      this.camera,
      this.isSoftwareGl
    );

    this.settings = {...DEFAULT_SETTINGS};
    this.progression = createInitialProgression();
    this.player = this.makeInitialPlayer();
    this.car = this.makeInitialCar();

    this.ui = new GameUI(uiRoot, {
      onStartNew: () => this.startNewGame(),
      onContinueSave: () => this.continueFromSave(),
      onResume: () => {
        this.closeSubModal();
        this.setMode('playing');
      },
      onPause: () => {
        this.closeSubModal();
        this.setMode(this.mode === 'paused' ? 'playing' : 'paused');
      },
      onReturnToTitle: () => {
        this.closeSubModal();
        this.setMode('title');
      },
      onRestart: () => {
        this.closeSubModal();
        localStorage.removeItem(SAVE_STORAGE_KEY);
        this.startNewGame();
      },
      onToggleMute: () => this.toggleMute(),
      onToggleCameraMode: () => this.toggleCameraMode(),
      onCycleTimeOfDay: () => this.stepTimeOfDay(),
      onSetTime01: (t) => {
        this.time01 = t;
        this.applyAtmosphere();
      },
      onUpdateSettings: (patch) => this.updateSettings(patch),
      onInteractContext: () => this.triggerPrimaryContextAction(),
      onDialogueChoice: (id, label, tag) => this.handleDialogueChoice(id, label, tag),
      onDialogueFreeText: (text) => this.handleDialogueFreeText(text),
      onCloseDialogue: () => this.closeDialogue(),
      onCycleWeapon: () => this.cycleWeapon(),
      onSelectWeapon: (weaponId) => this.equipWeapon(weaponId),
      onOpenHeroComms: () => this.openHeroCommsModal(),
      onSubmitHeroComms: (text) => this.submitHeroComms(text),
      onOpenMissionModal: () => this.openCustomMissionModal(),
      onCreateCustomMission: (draft) => this.createAndActivateCustomMission(draft),
      onOpenShop: () => this.openShopModal(),
      onBuyShopItem: (itemId) => this.handleBuyShopItem(itemId),
      onToggleZen: () => this.toggleZenMode(),
      onCloseSubModal: () => this.closeSubModal(),
      onTouchKey: (code, down) => {
        if (down) {
          this.keysHeld.add(code);
          this.keysJustPressed.add(code);
        } else {
          this.keysHeld.delete(code);
        }
      },
    });

    const saved = deserializeSave(localStorage.getItem(SAVE_STORAGE_KEY));
    if (saved) {
      this.ui.setSavePreview(
        saved.progression.cash,
        saved.progression.completedContractIds.length,
        getAllContracts(saved.progression).length
      );
      this.settings = mergeSettings(DEFAULT_SETTINGS, saved.settings);
    } else {
      this.ui.setSavePreview(null, 0, getAllContracts(this.progression).length);
    }

    this.equipWeapon(this.player.equippedWeapon, true);
    this.syncMeshesToState();
    this.applyAtmosphere();
    this.ui.syncSettingsUI(this.settings, this.time01, this.muted);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindInputListeners();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      this.startNewGame();
    } else {
      this.setMode('title');
    }

    this.lastTs = performance.now();
    this.stepFrame(0.016);
    this.renderFrame();
    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  }

  private makeInitialPlayer(): PlayerState {
    return {
      x: HERO_SPAWN.x,
      z: HERO_SPAWN.z,
      yaw: HERO_SPAWN.yaw,
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
  }

  private makeInitialCar(): VehiclePhysicsState {
    return {
      x: CAR_SPAWN.x,
      z: CAR_SPAWN.z,
      yaw: CAR_SPAWN.yaw,
      speed: 0,
      vx: 0,
      vz: 0,
      steerAngle: 0,
      wheelSpin: 0,
      braking: false,
      pitch: 0,
      roll: 0,
      gear: 'N',
      rpm01: 0.15,
      health: 100,
      crashed: false,
      crashFlashTimer: 0,
      engineTier: 0,
      armorTier: 0,
    };
  }

  private getActiveHero() {
    return this.gltfActivated ? this.gltfHero : this.heroMesh;
  }

  private buildWorldMindContext(): WorldMindContext {
    const px = this.player.inVehicle ? this.car.x : this.player.x;
    const pz = this.player.inVehicle ? this.car.z : this.player.z;
    const zone = findInteriorAt(px, pz);
    return {
      equippedWeapon: this.player.equippedWeapon,
      carHealth: this.car.health,
      carCrashed: this.car.crashed,
      currentInteriorName: zone?.name ?? null,
    };
  }

  private setMode(next: GameModeState) {
    this.mode = next;
    this.ui.setModeState(next);
    if (next !== 'playing' && this.zenMode) {
      this.zenMode = false;
      this.ui.setZenMode(false);
    }
    if (next === 'playing') {
      this.keysHeld.clear();
      this.keysJustPressed.clear();
      this.audio.ensureStarted();
    }
  }

  private openSubModal(kind: SubModalKind) {
    this.activeSubModal = kind;
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.ui.setSubModal(kind);
  }

  private closeSubModal() {
    this.activeSubModal = null;
    this.keysJustPressed.clear();
    this.keysHeld.clear();
    this.ui.setSubModal(null);
  }

  private startNewGame() {
    this.closeSubModal();
    this.player = this.makeInitialPlayer();
    this.car = this.makeInitialCar();
    this.trafficCars = this.world.initialTrafficStates.map((c) => ({...c}));
    this.progression = createInitialProgression();
    this.time01 = 0.04;
    this.cameraYaw = 0;
    this.cameraPitch = 0.22;
    this.cameraMode = 'chase';
    this.lastInteriorId = null;
    this.equipWeapon('revolver', true);
    this.syncMeshesToState();
    this.applyAtmosphere();
    this.setMode('playing');
    this.ui.showToast('VITO MENOTTI · SPEAK WITH SAL MORETTI');
    this.persistSave();
  }

  private continueFromSave() {
    this.closeSubModal();
    const saved = deserializeSave(localStorage.getItem(SAVE_STORAGE_KEY));
    if (!saved) {
      this.startNewGame();
      return;
    }
    this.time01 = saved.time01;
    this.progression = saved.progression;
    this.settings = saved.settings;
    this.player = {
      ...this.makeInitialPlayer(),
      ...saved.player,
    };
    this.car = {
      ...this.makeInitialCar(),
      ...saved.car,
    };
    this.trafficCars = this.world.initialTrafficStates.map((c) => ({...c}));
    this.cameraYaw = this.player.inVehicle ? this.car.yaw : this.player.yaw;
    this.equipWeapon(this.player.equippedWeapon, true);
    this.syncMeshesToState();
    this.applyAtmosphere();
    this.ui.syncSettingsUI(this.settings, this.time01, this.muted);
    this.setMode('playing');
    this.ui.showToast('DOSSIER LOADED');
  }

  private persistSave() {
    try {
      const payload = serializeSave({
        version: 1,
        savedAt: Date.now(),
        time01: this.time01,
        player: {
          x: this.player.x,
          z: this.player.z,
          yaw: this.player.yaw,
          inVehicle: this.player.inVehicle,
          equippedWeapon: this.player.equippedWeapon,
          armor: this.player.armor,
          maxArmor: this.player.maxArmor,
        },
        car: {
          x: this.car.x,
          z: this.car.z,
          yaw: this.car.yaw,
          health: this.car.health,
          crashed: this.car.crashed,
          engineTier: this.car.engineTier,
          armorTier: this.car.armorTier,
        },
        progression: this.progression,
        settings: this.settings,
      });
      localStorage.setItem(SAVE_STORAGE_KEY, payload);
      this.ui.setSavePreview(
        this.progression.cash,
        this.progression.completedContractIds.length,
        getAllContracts(this.progression).length
      );
    } catch {
      // Storage quota ignore
    }
  }

  private bindInputListeners() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'playing' || this.activeSubModal !== null) return;
      this.audio.ensureStarted();
      this.draggingLook = true;
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
      this.pointerDownAt = performance.now();
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (this.mode !== 'playing' || this.activeSubModal !== null) return;
      this.pointerNdc.set(
        (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1,
        -(e.clientY / Math.max(window.innerHeight, 1)) * 2 + 1
      );
      this.hasPointerPos = true;

      if (!this.draggingLook) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.cameraYaw -= dx * 0.0055;
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch + dy * 0.004,
        -0.05,
        0.65
      );
    });
    window.addEventListener('pointerup', (e) => {
      if (
        this.draggingLook &&
        this.mode === 'playing' &&
        this.activeSubModal === null &&
        !this.player.inVehicle &&
        e.button === 0
      ) {
        const moved = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
        const heldMs = performance.now() - this.pointerDownAt;
        if (moved < 6 && heldMs < 240) {
          this.fireEquippedWeapon();
        }
      }
      this.draggingLook = false;
    });
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.pipeline.resize(w, h);
  };

  private onWindowBlur = () => {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.draggingLook = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.code === 'Escape') {
        if (this.mode === 'dialogue') this.closeDialogue();
        else if (this.activeSubModal !== null) this.closeSubModal();
      }
      return;
    }

    if (this.mode === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startNewGame();
      }
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (this.activeSubModal !== null) {
        this.closeSubModal();
      } else if (this.mode === 'dialogue') {
        this.closeDialogue();
      } else if (this.mode === 'playing' || this.mode === 'paused') {
        this.setMode(this.mode === 'paused' ? 'playing' : 'paused');
      }
      return;
    }

    if (e.code === 'KeyB' && this.activeSubModal === 'shop') {
      e.preventDefault();
      this.closeSubModal();
      return;
    }

    if (this.mode === 'dialogue' || this.activeSubModal !== null) return;

    if (this.mode === 'playing') {
      if (e.code === 'KeyV') {
        e.preventDefault();
        this.openHeroCommsModal();
        return;
      }
      if (e.code === 'KeyJ') {
        e.preventDefault();
        this.openCustomMissionModal();
        return;
      }
      if (e.code === 'KeyB') {
        e.preventDefault();
        this.openShopModal();
        return;
      }
      if (e.code === 'KeyZ') {
        e.preventDefault();
        this.toggleZenMode();
        return;
      }
      if (e.code === 'KeyQ') {
        this.cycleWeapon();
        return;
      }
      if (e.code === 'Digit1') {
        this.equipWeapon('revolver');
        return;
      }
      if (e.code === 'Digit2') {
        this.equipWeapon('pistol');
        return;
      }
      if (e.code === 'Digit3') {
        this.equipWeapon('tommy');
        return;
      }
      if (e.code === 'Digit4') {
        this.equipWeapon('shotgun');
        return;
      }
    }

    if (!this.keysHeld.has(e.code)) {
      this.keysJustPressed.add(e.code);
    }
    this.keysHeld.add(e.code);

    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private equipWeapon(weaponId: WeaponId, silent = false) {
    this.player.equippedWeapon = weaponId;
    const rig = this.weaponRigs.get(weaponId);
    if (rig) {
      rig.muzzleFlash.visible = false;
      this.getActiveHero().equipWeapon(rig.group);
    }
    if (!silent) {
      const def = WEAPONS.find((w) => w.id === weaponId);
      if (def) {
        this.ui.showToast(`EQUIPPED · ${def.name.toUpperCase()} (${def.caliber})`);
      }
      this.persistSave();
    }
  }

  private cycleWeapon() {
    const idx = WEAPONS.findIndex((w) => w.id === this.player.equippedWeapon);
    const next = WEAPONS[(idx + 1) % WEAPONS.length];
    this.equipWeapon(next.id);
  }

  private fireEquippedWeapon() {
    if (this.player.inVehicle) return;
    const def = WEAPONS.find((w) => w.id === this.player.equippedWeapon) ?? WEAPONS[0];
    const now = performance.now();
    if (now - this.lastFireTime < def.fireRateMs) return;
    this.lastFireTime = now;

    const rig = this.weaponRigs.get(def.id);
    if (rig) {
      rig.muzzleFlash.visible = true;
      rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      this.muzzleFlashTimer = 0.075;
    }
    this.getActiveHero().triggerRecoil(def.id === 'shotgun' ? 1.4 : def.id === 'tommy' ? 0.65 : 1.0);
    this.audio.playGunshot(def.id);
    this.trauma = Math.min(0.45, this.trauma + (def.id === 'shotgun' ? 0.22 : 0.09));
    this.triggerHaptic(35, def.id === 'shotgun' ? 0.65 : 0.3);
  }

  private toggleMute() {
    this.muted = !this.muted;
    this.audio.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.muted);
    this.ui.syncSettingsUI(this.settings, this.time01, this.muted);
  }

  private toggleCameraMode() {
    if (!this.player.inVehicle) {
      this.ui.showToast('ENTER VEHICLE [F] FOR DASHBOARD CAM');
      return;
    }
    this.cameraMode = this.cameraMode === 'chase' ? 'interior' : 'chase';
    this.ui.showToast(
      this.cameraMode === 'interior' ? 'INTERIOR DASHBOARD CAM' : 'THIRD-PERSON CHASE CAM'
    );
  }

  private stepTimeOfDay() {
    if (this.time01 < 0.22) this.time01 = 0.32;
    else if (this.time01 < 0.50) this.time01 = 0.62;
    else this.time01 = 0.04;
    this.applyAtmosphere();
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    this.ui.showToast(`${atmo.phaseLabel.toUpperCase()} · ${atmo.clockLabel}`);
    this.ui.syncSettingsUI(this.settings, this.time01, this.muted);
  }

  private updateSettings(patch: Partial<SettingsState>) {
    this.settings = mergeSettings(this.settings, patch);
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : this.settings.quality === 'balanced'
          ? 1
          : Math.min(window.devicePixelRatio, 2)
    );
    this.audio.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.muted);
    this.applyAtmosphere();
    this.ui.syncSettingsUI(this.settings, this.time01, this.muted);
    this.persistSave();
  }

  private applyAtmosphere() {
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);

    this.scene.background = new THREE.Color(atmo.fogColorHex);
    (this.scene.fog as THREE.FogExp2).color.setHex(atmo.fogColorHex);
    (this.scene.fog as THREE.FogExp2).density = atmo.fogDensity;
    this.scene.environmentIntensity = THREE.MathUtils.lerp(
      0.85,
      0.24,
      Math.min(1, (atmo.neonIntensity - 0.45) / 2.9)
    );

    this.renderer.toneMappingExposure = atmo.exposure;

    this.hemiLight.color.setHex(atmo.hemiSkyHex);
    this.hemiLight.groundColor.setHex(atmo.hemiGroundHex);
    this.hemiLight.intensity = atmo.hemiIntensity;

    const r = 90;
    const sunX = Math.sin(atmo.sunAzimuthRad) * Math.cos(atmo.sunElevationRad) * r;
    const sunY = Math.sin(atmo.sunElevationRad) * r;
    const sunZ = -Math.cos(atmo.sunAzimuthRad) * Math.cos(atmo.sunElevationRad) * r;
    this.sunOffset.set(sunX, Math.max(sunY, 6), sunZ);
    const px = this.player.inVehicle ? this.car.x : this.player.x;
    const pz = this.player.inVehicle ? this.car.z : this.player.z;
    this.sunLight.position.set(px + this.sunOffset.x, this.sunOffset.y, pz + this.sunOffset.z);
    this.sunLight.target.position.set(px, 0, pz);
    this.sunLight.color.setHex(atmo.sunColorHex);
    this.sunLight.intensity = atmo.sunIntensity;

    this.sunDisc.position.set(sunX * 2.2, Math.max(sunY * 2.1, -18), sunZ * 2.2);
    this.sunDisc.visible =
      atmo.phaseLabel === 'Golden Hour' ||
      atmo.phaseLabel === 'Dusk' ||
      atmo.phaseLabel === 'Dawn';
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.setHex(atmo.sunColorHex);

    this.mats.updateAtmosphere(atmo);
    this.heroCarMesh.setLights(atmo.headlightIntensity, this.car.braking);
  }

  private findNearbyNpc(): string | null {
    const px = this.player.inVehicle ? this.car.x : this.player.x;
    const pz = this.player.inVehicle ? this.car.z : this.player.z;
    let bestId: string | null = null;
    let bestDist = 4.1;
    for (const npc of NPC_DEFINITIONS) {
      const d = Math.hypot(px - npc.x, pz - npc.z);
      if (d < bestDist) {
        bestDist = d;
        bestId = npc.id;
      }
    }
    return bestId;
  }

  private isNearCar(): boolean {
    if (this.player.inVehicle) return true;
    return Math.hypot(this.player.x - this.car.x, this.player.z - this.car.z) < 3.6;
  }

  private triggerPrimaryContextAction() {
    if (this.mode !== 'playing') return;
    if (!this.player.inVehicle) {
      const npcId = this.findNearbyNpc();
      if (npcId) {
        this.openDialogue(npcId);
        return;
      }
    }
    this.toggleEnterExitCar();
  }

  private toggleEnterExitCar() {
    if (this.player.inVehicle) {
      const exitX = this.car.x - Math.cos(this.car.yaw) * 2.1;
      const exitZ = this.car.z + Math.sin(this.car.yaw) * 2.1;
      this.player.inVehicle = false;
      this.player.x = exitX;
      this.player.z = exitZ;
      this.player.yaw = this.car.yaw;
      this.cameraMode = 'chase';
      this.getActiveHero().group.visible = true;
      this.persistSave();
    } else if (this.isNearCar()) {
      this.player.inVehicle = true;
      this.player.vx = 0;
      this.player.vz = 0;
      this.heroMesh.group.visible = false;
      this.gltfHero.group.visible = false;
      this.cameraYaw = this.car.yaw;
      this.persistSave();
    }
  }

  private openDialogue(npcId: string) {
    this.closeSubModal();
    this.activeDialogueNpcId = npcId;
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    const npc = NPC_DEFINITIONS.find((n) => n.id === npcId) ?? NPC_DEFINITIONS[0];

    const adv = checkAndAdvanceContract(this.progression, {type: 'talk', npcId});
    this.progression = adv.progression;
    if (adv.contractCompleted) {
      this.audio.playContractSting();
      const newRank = getRankForCash(this.progression.cash);
      this.ui.showToast(
        `${adv.contractCompleted.code} COMPLETE · +$${adv.contractCompleted.rewardCash} (${newRank.title})`
      );
      if (!this.progression.activeContractId) {
        window.setTimeout(() => {
          this.ui.updateGameOver(this.progression);
          this.setMode('gameover');
        }, 1200);
      }
    } else if (adv.stepCompleted) {
      this.audio.playContractSting();
      this.ui.showToast('OBJECTIVE UPDATED');
    }

    const res = generateNpcReply(
      npcId,
      npc.greeting,
      adv.stepCompleted ? 'business' : null,
      this.progression,
      atmo,
      this.buildWorldMindContext()
    );
    this.progression = {
      ...this.progression,
      npcMemory: {...this.progression.npcMemory, [npcId]: res.memory},
    };
    this.ui.openDialogue(npcId, res.reply, this.progression);
    this.audio.speakText(res.reply, this.settings.ttsEnabled, npc.voicePitch, npc.voiceRate);
    this.setMode('dialogue');
    this.persistSave();
  }

  private handleDialogueChoice(_id: string, label: string, tag: string) {
    if (!this.activeDialogueNpcId) return;
    const npc =
      NPC_DEFINITIONS.find((n) => n.id === this.activeDialogueNpcId) ?? NPC_DEFINITIONS[0];
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    const res = generateNpcReply(
      this.activeDialogueNpcId,
      label,
      tag,
      this.progression,
      atmo,
      this.buildWorldMindContext()
    );
    this.progression = {
      ...this.progression,
      npcMemory: {...this.progression.npcMemory, [this.activeDialogueNpcId]: res.memory},
    };
    this.ui.openDialogue(this.activeDialogueNpcId, res.reply, this.progression);
    this.audio.speakText(res.reply, this.settings.ttsEnabled, npc.voicePitch, npc.voiceRate);
    this.persistSave();
  }

  private handleDialogueFreeText(text: string) {
    if (!this.activeDialogueNpcId) return;
    const npc =
      NPC_DEFINITIONS.find((n) => n.id === this.activeDialogueNpcId) ?? NPC_DEFINITIONS[0];
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    const res = generateNpcReply(
      this.activeDialogueNpcId,
      text,
      null,
      this.progression,
      atmo,
      this.buildWorldMindContext()
    );
    this.progression = {
      ...this.progression,
      npcMemory: {...this.progression.npcMemory, [this.activeDialogueNpcId]: res.memory},
    };
    this.ui.openDialogue(this.activeDialogueNpcId, res.reply, this.progression);
    this.audio.speakText(res.reply, this.settings.ttsEnabled, npc.voicePitch, npc.voiceRate);
    this.persistSave();
  }

  private closeDialogue() {
    this.activeDialogueNpcId = null;
    this.setMode('playing');
  }

  private openHeroCommsModal() {
    if (this.mode !== 'playing') return;
    const npcId = !this.player.inVehicle ? this.findNearbyNpc() : null;
    if (npcId) {
      this.openDialogue(npcId);
      return;
    }
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    const thought = generateHeroMonologue(
      '',
      this.progression,
      atmo,
      this.buildWorldMindContext()
    );
    this.ui.setHeroCommsReply(thought);
    this.openSubModal('comms');
  }

  private submitHeroComms(text: string) {
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    const line = generateHeroMonologue(
      text,
      this.progression,
      atmo,
      this.buildWorldMindContext()
    );
    this.ui.setHeroCommsReply(line);
    this.audio.speakText(line, this.settings.ttsEnabled, 0.85, 0.96);
  }

  private openCustomMissionModal() {
    if (this.mode !== 'playing') return;
    this.openSubModal('mission');
  }

  private openShopModal() {
    if (this.mode !== 'playing') return;
    const px = this.player.inVehicle ? this.car.x : this.player.x;
    const pz = this.player.inVehicle ? this.car.z : this.player.z;
    const zone = findInteriorAt(px, pz);
    this.ui.renderShopModal(this.progression, this.player, this.car, zone);
    this.openSubModal('shop');
  }

  private handleBuyShopItem(itemId: string) {
    const res = buyShopItem(this.progression, this.player, this.car, itemId);
    if (res.ok) {
      this.progression = res.progression;
      this.player = res.player;
      this.car = res.car;
      if (res.item?.weaponId) {
        this.equipWeapon(this.player.equippedWeapon, true);
      }
      this.audio.playContractSting();
      this.ui.showToast(res.reason.toUpperCase());
      this.persistSave();
    } else {
      this.ui.showToast(res.reason.toUpperCase());
    }
    const px = this.player.inVehicle ? this.car.x : this.player.x;
    const pz = this.player.inVehicle ? this.car.z : this.player.z;
    const zone = findInteriorAt(px, pz);
    this.ui.renderShopModal(this.progression, this.player, this.car, zone);
  }

  private toggleZenMode() {
    this.zenMode = !this.zenMode;
    this.ui.setZenMode(this.zenMode);
    if (this.zenMode) {
      this.ui.showToast('ZERO-OCCLUSION VIEW · PRESS [Z] TO RESTORE HUD');
    }
  }

  private createAndActivateCustomMission(draft: CustomMissionDraft) {
    const mission = createCustomContract(draft, this.progression.customContracts.length);
    this.progression = {
      ...this.progression,
      customContracts: [...this.progression.customContracts, mission],
      activeContractId: mission.id,
      activeStepIndex: 0,
    };
    this.closeSubModal();
    this.audio.playContractSting();
    this.ui.showToast(`${mission.code} ACTIVE · ${mission.title.toUpperCase()} ($${mission.rewardCash})`);
    this.syncMeshesToState();
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    this.ui.updateHUD(
      this.player,
      this.car,
      this.progression,
      atmo,
      this.cameraMode,
      null,
      this.trafficCars,
      null
    );
    this.persistSave();
  }

  private syncMeshesToState() {
    this.heroMesh.group.visible = !this.player.inVehicle && !this.gltfActivated;
    this.heroMesh.group.position.set(this.player.x, 0, this.player.z);
    this.heroMesh.group.rotation.y = this.player.yaw;

    this.gltfHero.group.visible = !this.player.inVehicle && this.gltfActivated;
    this.gltfHero.group.position.set(this.player.x, 0, this.player.z);
    this.gltfHero.group.rotation.y = this.player.yaw;

    this.heroCarMesh.group.position.set(this.car.x, 0, this.car.z);
    this.heroCarMesh.group.rotation.y = this.car.yaw;
    this.heroCarMesh.bodyTiltGroup.rotation.x = this.car.pitch;
    this.heroCarMesh.bodyTiltGroup.rotation.z = this.car.roll;

    for (const pivot of this.heroCarMesh.frontSteerPivots) {
      pivot.rotation.y = this.car.steerAngle;
    }
    for (const w of this.heroCarMesh.wheels) {
      w.rotation.x = -this.car.wheelSpin;
    }
    if (this.heroCarMesh.steeringWheel) {
      this.heroCarMesh.steeringWheel.rotation.z = this.car.steerAngle * 2.4;
    }

    const step = getActiveContractStep(this.progression);
    if (step?.targetPos) {
      this.world.waypointBeacon.visible = true;
      this.world.waypointBeacon.position.set(step.targetPos.x, 0, step.targetPos.z);
    } else {
      this.world.waypointBeacon.visible = false;
    }
  }

  private triggerHaptic(durationMs = 45, strength = 0.45) {
    if (!this.settings.hapticsEnabled) return;
    try {
      const pads = navigator.getGamepads?.();
      if (pads) {
        for (const pad of pads) {
          pad?.vibrationActuator?.playEffect?.('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude: strength * 0.6,
            strongMagnitude: strength,
          });
        }
      }
    } catch {
      // ignore if unsupported
    }
  }

  private loop = () => {
    const now = performance.now();
    const rawDt = (now - this.lastTs) / 1000;
    this.lastTs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.stepFrame(dt);
    this.renderFrame();

    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepFrame(dt: number) {
    this.elapsed += dt;

    if (!this.gltfActivated && this.gltfHero.isGltfReady()) {
      this.gltfActivated = true;
      this.heroMesh.group.visible = false;
      this.gltfHero.group.visible = !this.player.inVehicle;
      this.gltfHero.group.position.set(this.player.x, 0, this.player.z);
      this.gltfHero.group.rotation.y = this.player.yaw;
      this.equipWeapon(this.player.equippedWeapon, true);
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        const rig = this.weaponRigs.get(this.player.equippedWeapon);
        if (rig) rig.muzzleFlash.visible = false;
      }
    }

    if (this.mode === 'playing' && this.settings.autoCycleTime && this.activeSubModal === null) {
      this.time01 = (this.time01 + dt * 0.012 * this.settings.cycleSpeed) % 1;
      this.applyAtmosphere();
    }

    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);

    if (this.mode === 'title') {
      this.aimReticleMesh.visible = false;
      const tourT = this.elapsed * 0.22;
      _camGoal.set(
        -2.2 + Math.sin(tourT) * 4.5,
        2.6 + Math.cos(tourT * 0.7) * 0.65,
        22.0 + Math.cos(tourT * 0.5) * 3.5
      );
      _lookGoal.set(1.5 + Math.sin(tourT * 0.6) * 2.5, 3.2, -22.0);
      this.camera.position.lerp(_camGoal, 1 - Math.exp(-3.0 * dt));
      this.camLookCurrent.lerp(_lookGoal, 1 - Math.exp(-3.0 * dt));
      this.camera.lookAt(this.camLookCurrent);

      this.getActiveHero().animate(0, 0, this.elapsed, dt);
      this.heroCarMesh.setLights(atmo.headlightIntensity, false);
      this.heroCarMesh.setCrashState(this.car.crashed, this.car.health, this.elapsed);
      _playerVec.set(this.player.x, 0, this.player.z);
      this.world.updateDynamic(
        dt,
        this.elapsed,
        atmo,
        this.settings.weather,
        _playerVec,
        this.trafficCars,
        this.settings.quality
      );
      return;
    }

    if (this.mode !== 'playing' || this.activeSubModal !== null) {
      this.aimReticleMesh.visible = false;
      this.audio.updateContinuous(false, 0, 0, dt, this.settings.weather, true);
      this.keysJustPressed.clear();
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
      this.keysJustPressed.clear();
      return;
    }

    // One-shot actions
    if (this.keysJustPressed.has('KeyF')) this.toggleEnterExitCar();
    if (this.keysJustPressed.has('KeyT')) this.stepTimeOfDay();
    if (this.keysJustPressed.has('KeyC')) this.toggleCameraMode();
    if (this.keysJustPressed.has('KeyM')) this.toggleMute();
    if (this.keysJustPressed.has('KeyH') && this.player.inVehicle) this.audio.playHorn();
    if (this.keysJustPressed.has('KeyE') && !this.player.inVehicle) {
      const npcId = this.findNearbyNpc();
      if (npcId) this.openDialogue(npcId);
    }
    if (this.keysJustPressed.has('Space') && !this.player.inVehicle) {
      this.fireEquippedWeapon();
    }
    this.keysJustPressed.clear();

    const fwd =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const right =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);
    const sprintOrBoost = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const brake = this.keysHeld.has('Space');

    if (this.player.inVehicle) {
      this.aimReticleMesh.visible = false;
      const stepOut = stepVehiclePhysics(
        this.car,
        {
          throttle: fwd,
          steer: -right,
          brake,
          boost: sprintOrBoost,
        },
        dt
      );
      this.car = stepOut.car;
      this.player.x = this.car.x;
      this.player.z = this.car.z;
      this.progression.totalDistanceDriven += Math.abs(this.car.speed) * dt;

      if (stepOut.impactStrength > 5.5) {
        this.audio.playImpact(stepOut.impactStrength);
        this.hitstopTimer = 0.045;
        this.trauma = Math.min(1, stepOut.impactStrength * 0.055);
        this.triggerHaptic(70, 0.7);
      }

      if (!this.draggingLook && Math.abs(this.car.speed) > 1.2) {
        let diff = this.car.yaw - this.cameraYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.cameraYaw += diff * (1 - Math.exp(-3.8 * dt));
      }
    } else {
      let aimYaw: number | null = null;
      if (this.hasPointerPos && !this.draggingLook) {
        this.aimRaycaster.setFromCamera(this.pointerNdc, this.camera);
        if (this.aimRaycaster.ray.intersectPlane(this.aimPlane, this.aimHit)) {
          const dx = this.aimHit.x - this.player.x;
          const dz = this.aimHit.z - this.player.z;
          if (dx * dx + dz * dz > 0.16 && dx * dx + dz * dz < 6400) {
            aimYaw = Math.atan2(-dx, -dz);
            this.aimReticleMesh.position.set(this.aimHit.x, 0.04, this.aimHit.z);
            this.aimReticleMesh.visible = true;
          } else {
            this.aimReticleMesh.visible = false;
          }
        } else {
          this.aimReticleMesh.visible = false;
        }
      } else {
        this.aimReticleMesh.visible = false;
      }

      const npcObstacles = NPC_DEFINITIONS.map((n) => ({x: n.x, z: n.z, radius: 0.48}));
      this.player = stepHeroMovement(
        this.player,
        fwd,
        right,
        this.cameraYaw,
        sprintOrBoost,
        dt,
        undefined,
        [{x: this.car.x, z: this.car.z, radius: 1.55}, ...npcObstacles],
        aimYaw
      );
      const speed = Math.hypot(this.player.vx, this.player.vz);
      this.getActiveHero().animate(this.player.walkDistance, speed, this.elapsed, dt);
    }

    // Step traffic & prevent ALL vehicle overlaps (triggers crashes on impact >= 1.5 m/s)
    const trafficStep = stepTrafficVehicles(this.trafficCars, this.car, dt);
    this.trafficCars = trafficStep.trafficCars;
    this.car = trafficStep.heroCar;
    if (this.player.inVehicle) {
      this.player.x = this.car.x;
      this.player.z = this.car.z;
    }

    for (const col of trafficStep.collisions) {
      this.audio.playImpact(col.impactSpeed);
      if (col.involvedHero) {
        this.progression.crashesCount += 1;
        this.hitstopTimer = 0.055;
        this.trauma = Math.min(1, 0.35 + col.impactSpeed * 0.045);
        this.triggerHaptic(85, 0.8);
        if (col.involvedPolice && this.progression.heat < 5) {
          this.progression.heat += 1;
          this.ui.showToast('COLLISION WITH CRUISER · PRECINCT HEAT +1');
        } else {
          this.ui.showToast("CRASH! FENDER DAMAGE — VISIT VINNIE'S GARAGE");
        }
      }
    }

    // Location & hospitality checks
    const px = this.player.inVehicle ? this.car.x : this.player.x;
    const pz = this.player.inVehicle ? this.car.z : this.player.z;

    const currentZone = findInteriorAt(px, pz);
    const currentZoneId = currentZone?.id ?? null;
    if (currentZoneId !== this.lastInteriorId) {
      this.lastInteriorId = currentZoneId;
      if (currentZone) {
        this.ui.showToast(`ENTERED ${currentZone.name.toUpperCase()}`);
      }
    }

    if (currentZone?.hospitalityBonus === 'heal_stamina') {
      this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 28 * dt);
    } else if (currentZone?.hospitalityBonus === 'clear_heat' && this.progression.heat > 0) {
      this.heatClearAccum += dt;
      if (this.heatClearAccum >= 4.0) {
        this.heatClearAccum = 0;
        this.progression.heat = Math.max(0, this.progression.heat - 1);
        this.ui.showToast(`SANCTUARY AT ${currentZone.name.toUpperCase()} · HEAT COOLED`);
      }
    } else {
      this.heatClearAccum = 0;
    }

    const carZone = findInteriorAt(this.car.x, this.car.z);
    if (
      (carZone?.hospitalityBonus === 'repair_car' ||
        currentZone?.hospitalityBonus === 'repair_car') &&
      (this.car.health < 99 || this.car.crashed)
    ) {
      this.car.health = 100;
      this.car.crashed = false;
      this.car.crashFlashTimer = 0;
      this.ui.showToast("VINNIE'S GARAGE · COUPE REPAIRED TO 100%");
    }

    const locAdv = checkAndAdvanceContract(this.progression, {
      type: 'location',
      x: px,
      z: pz,
    });
    if (locAdv.stepCompleted) {
      this.progression = locAdv.progression;
      this.audio.playContractSting();
      if (locAdv.contractCompleted) {
        const rank = getRankForCash(this.progression.cash);
        this.ui.showToast(
          `${locAdv.contractCompleted.code} COMPLETE · +$${locAdv.contractCompleted.rewardCash} (${rank.title})`
        );
      } else {
        this.ui.showToast('OBJECTIVE REACHED');
      }
      this.persistSave();
    }

    this.progression.timePlayedSeconds += dt;
    this.saveAccum += dt;
    if (this.saveAccum >= 6) {
      this.saveAccum = 0;
      this.persistSave();
    }

    // Keep shadow frustum centered around Vito Menotti across the 320m x 320m map
    this.sunLight.position.set(px + this.sunOffset.x, this.sunOffset.y, pz + this.sunOffset.z);
    this.sunLight.target.position.set(px, 0, pz);

    this.syncMeshesToState();
    this.heroCarMesh.setLights(atmo.headlightIntensity, this.car.braking);
    this.heroCarMesh.setCrashState(this.car.crashed, this.car.health, this.elapsed);
    _playerVec.set(px, 0, pz);
    this.world.updateDynamic(
      dt,
      this.elapsed,
      atmo,
      this.settings.weather,
      _playerVec,
      this.trafficCars,
      this.settings.quality
    );

    const walkSpd = this.player.inVehicle ? 0 : Math.hypot(this.player.vx, this.player.vz);
    this.audio.updateContinuous(
      this.player.inVehicle,
      this.car.rpm01,
      walkSpd,
      dt,
      this.settings.weather,
      false
    );

    // Damped Camera Update
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const shake = this.trauma * this.trauma * 0.25;

    if (this.player.inVehicle && this.cameraMode === 'interior') {
      const fx = -Math.sin(this.car.yaw);
      const fz = -Math.cos(this.car.yaw);
      const rx = Math.cos(this.car.yaw);
      const rz = -Math.sin(this.car.yaw);
      _camGoal.set(
        this.car.x - rx * 0.38 - fx * 0.05,
        1.14,
        this.car.z - rz * 0.38 - fz * 0.05
      );
      _lookGoal.set(
        this.car.x - rx * 0.25 + fx * 18,
        1.05,
        this.car.z - rz * 0.25 + fz * 18
      );
      this.camPosCurrent.copy(_camGoal);
      this.camLookCurrent.copy(_lookGoal);
    } else {
      const dist = this.player.inVehicle ? 7.2 : 4.2;
      const height = this.player.inVehicle ? 2.55 : 2.15;
      const targetY = this.player.inVehicle ? 1.15 : 1.45;
      const sinY = Math.sin(this.cameraYaw);
      const cosY = Math.cos(this.cameraYaw);
      _camGoal.set(
        px + sinY * dist * Math.cos(this.cameraPitch),
        height + Math.sin(this.cameraPitch) * dist * 0.65,
        pz + cosY * dist * Math.cos(this.cameraPitch)
      );
      _lookGoal.set(px - sinY * 2.5, targetY, pz - cosY * 2.5);

      const camSmooth = 1 - Math.exp(-9.5 * dt);
      this.camPosCurrent.lerp(_camGoal, camSmooth);
      this.camLookCurrent.lerp(_lookGoal, camSmooth);
    }

    this.camera.position.set(
      this.camPosCurrent.x + (Math.random() - 0.5) * shake,
      this.camPosCurrent.y + (Math.random() - 0.5) * shake,
      this.camPosCurrent.z
    );
    this.camera.lookAt(this.camLookCurrent);

    let prompt: {key: string; text: string} | null = null;
    if (!this.player.inVehicle) {
      const npcId = this.findNearbyNpc();
      if (npcId) {
        const npc = NPC_DEFINITIONS.find((n) => n.id === npcId)!;
        prompt = {key: 'E', text: `Talk to ${npc.name}`};
      } else if (this.isNearCar()) {
        prompt = {key: 'F', text: 'Drive Black Muscle Coupe'};
      }
    }

    this.ui.updateHUD(
      this.player,
      this.car,
      this.progression,
      atmo,
      this.cameraMode,
      prompt,
      this.trafficCars,
      currentZone?.name ?? null
    );
  }

  private renderFrame() {
    const atmo = computeDayNightAtmosphere(this.time01, this.settings.weather);
    this.pipeline.render(this.elapsed, atmo, this.settings);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    this.audio.dispose();
    this.gltfHero.dispose();
    this.aimReticleMesh.geometry.dispose();
    (this.aimReticleMesh.material as THREE.Material).dispose();
    this.world.dispose();
    this.mats.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }
}
