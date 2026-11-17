import {
  AVENUE_X_COORDS,
  BUILDING_COLLIDERS,
  CROSS_Z_COORDS,
  LANDMARKS,
  NPC_DEFINITIONS,
  WEAPONS,
} from '../game/constants';
import {
  getActiveContract,
  getActiveContractStep,
  getAllContracts,
  getDialogueOptionsForNpc,
  getRankForCash,
  getShopItemsForZone,
} from '../game/simulation';
import type {
  AtmosphereParams,
  CameraMode,
  CustomMissionDraft,
  GameModeState,
  InteriorZone,
  PlayerState,
  ProgressionState,
  SettingsState,
  ShopCategory,
  TrafficVehicleState,
  VehiclePhysicsState,
  WeaponId,
} from '../game/types';

export type SubModalKind = 'comms' | 'mission' | 'shop' | null;

export interface GameUICallbacks {
  onStartNew: () => void;
  onContinueSave: () => void;
  onResume: () => void;
  onPause: () => void;
  onReturnToTitle: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
  onToggleCameraMode: () => void;
  onCycleTimeOfDay: () => void;
  onSetTime01: (t: number) => void;
  onUpdateSettings: (patch: Partial<SettingsState>) => void;
  onInteractContext: () => void;
  onDialogueChoice: (choiceId: string, label: string, tag: string) => void;
  onDialogueFreeText: (text: string) => void;
  onCloseDialogue: () => void;
  onCycleWeapon: () => void;
  onSelectWeapon: (weaponId: WeaponId) => void;
  onOpenHeroComms: () => void;
  onSubmitHeroComms: (text: string) => void;
  onOpenMissionModal: () => void;
  onCreateCustomMission: (draft: CustomMissionDraft) => void;
  onOpenShop: () => void;
  onBuyShopItem: (itemId: string) => void;
  onToggleZen: () => void;
  onCloseSubModal: () => void;
  onTouchKey: (key: string, down: boolean) => void;
}

export class GameUI {
  private root: HTMLElement;
  private cb: GameUICallbacks;

  private continueBtn!: HTMLButtonElement;
  private saveMetaEl!: HTMLElement;
  private rankEl!: HTMLElement;
  private cashEl!: HTMLElement;
  private timePhaseEl!: HTMLElement;
  private clockEl!: HTMLElement;
  private heatStarsEl!: HTMLElement;
  private muteBtn!: HTMLButtonElement;
  private contractCodeEl!: HTMLElement;
  private contractTitleEl!: HTMLElement;
  private contractDescEl!: HTMLElement;
  private interiorBadgeEl!: HTMLElement;
  private speedClusterEl!: HTMLElement;
  private speedValEl!: HTMLElement;
  private gearValEl!: HTMLElement;
  private chassisValEl!: HTMLElement;
  private footClusterEl!: HTMLElement;
  private staminaValEl!: HTMLElement;
  private armorValEl!: HTMLElement;
  private weaponBtnEl!: HTMLButtonElement;
  private weaponValEl!: HTMLElement;
  private promptPillEl!: HTMLButtonElement;
  private promptKeyEl!: HTMLElement;
  private promptTextEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private toastTimer = 0;

  private minimapCtx!: CanvasRenderingContext2D;

  // Dialogue
  private dlgNameEl!: HTMLElement;
  private dlgRoleEl!: HTMLElement;
  private dlgMemoryEl!: HTMLElement;
  private dlgSpeechEl!: HTMLElement;
  private dlgChoicesEl!: HTMLElement;
  private dlgInputEl!: HTMLInputElement;
  private dlgVoiceBtn!: HTMLButtonElement;

  // Vito Menotti Comms Modal
  private commsReplyEl!: HTMLElement;
  private commsInputEl!: HTMLInputElement;
  private commsVoiceBtn!: HTMLButtonElement;

  // Custom Mission Modal
  private missionTitleEl!: HTMLInputElement;
  private missionTypeEl!: HTMLSelectElement;
  private missionLandmarkEl!: HTMLSelectElement;
  private missionNpcEl!: HTMLSelectElement;
  private missionRewardEl!: HTMLInputElement;
  private missionBriefingEl!: HTMLInputElement;

  // Shop Modal
  private shopFilter: 'all' | ShopCategory = 'all';
  private shopCashEl!: HTMLElement;
  private shopZoneEl!: HTMLElement;
  private shopListEl!: HTMLElement;
  private lastShopContext: {
    prog: ProgressionState;
    player: PlayerState;
    car: VehiclePhysicsState;
    zone: InteriorZone | null;
  } | null = null;

  // Pause / Settings
  private qualitySelect!: HTMLSelectElement;
  private weatherSelect!: HTMLSelectElement;
  private timeRange!: HTMLInputElement;
  private bloomCheck!: HTMLInputElement;
  private grainCheck!: HTMLInputElement;
  private autoTimeCheck!: HTMLInputElement;
  private ttsCheck!: HTMLInputElement;
  private masterRange!: HTMLInputElement;
  private sfxRange!: HTMLInputElement;

  // Game Over / Summary
  private goTitleEl!: HTMLElement;
  private goCashEl!: HTMLElement;
  private goRankEl!: HTMLElement;
  private goContractsEl!: HTMLElement;

  constructor(root: HTMLElement, callbacks: GameUICallbacks) {
    this.root = root;
    this.cb = callbacks;
    this.renderShell();
    this.bindEvents();
  }

  private renderShell() {
    const landmarkOptions = LANDMARKS.map(
      (l) => `<option value="${l.id}">${l.label}</option>`
    ).join('');
    const npcOptions = NPC_DEFINITIONS.map(
      (n) => `<option value="${n.id}">${n.name}${n.isKid ? ' (Kid)' : ''}</option>`
    ).join('');

    this.root.innerHTML = `
      <!-- TITLE SCREEN -->
      <section class="title-screen" aria-label="Title screen">
        <div class="title-left-column">
          <svg class="title-svg-lockup" viewBox="0 0 440 156" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Empire Noir IV">
            <rect x="2" y="8" width="436" height="140" rx="4" fill="rgba(10,11,15,0.72)" stroke="#d4a857" stroke-opacity="0.48" stroke-width="1.5"/>
            <path d="M18 24 H422 M18 132 H422" stroke="#d4a857" stroke-opacity="0.35" stroke-width="1"/>
            <polygon points="396,28 408,42 396,56 384,42" fill="#d4a857" fill-opacity="0.88"/>
            <text x="26" y="42" fill="#d4a857" font-family="IBM Plex Mono, monospace" font-size="12" letter-spacing="4">LIBERTY DISTRICT · VITO MENOTTI</text>
            <text x="24" y="92" fill="#f5efe2" font-family="Cinzel, Georgia, serif" font-size="44" font-weight="800" letter-spacing="3">EMPIRE NOIR</text>
            <text x="26" y="120" fill="#e4b55c" font-family="Cinzel, Georgia, serif" font-size="20" font-weight="700" letter-spacing="6">SYNDICATE · IV</text>
          </svg>
          <p class="title-subtitle">
            Step into the 580m Liberty Metropolis as Vito Menotti. Cruise five avenues from the Uptown Financial Plaza to South Harbor Pier, gear up inside six hospitable shops, wield four firearms, and converse via voice or text with 18 residents &amp; kids.
          </p>
          <div id="title-save-meta" class="title-save-meta" hidden></div>
          <div class="title-actions">
            <button type="button" id="btn-start-game" class="btn-primary" data-start="true">Enter City</button>
            <button type="button" id="btn-continue-save" class="btn-secondary" hidden>Resume Save</button>
          </div>
        </div>
        <div class="title-controls-line">
          WASD Move / Drive · Mouse Pointer Aim · Drag Look · 1–4 Guns · F Car · E Talk · B Shops · V Comms · J Missions · Z Clean View
        </div>
      </section>

      <!-- ACTIVE GAMEPLAY HUD -->
      <div class="hud-shell" aria-label="Gameplay HUD">
        <div class="hud-top-left">
          <div class="hud-stat-strip">
            <div class="hud-metric">
              <span class="hud-kicker">Vito Menotti</span>
              <span id="hud-rank" class="hud-sub-val">Outsider</span>
            </div>
            <div class="hud-divider"></div>
            <div class="hud-metric">
              <span class="hud-kicker">Syndicate</span>
              <span id="hud-cash" class="hud-hero-val tabular-nums">$250</span>
            </div>
            <div class="hud-divider"></div>
            <div class="hud-metric">
              <span id="hud-phase" class="hud-kicker">Golden Hour</span>
              <span id="hud-clock" class="hud-sub-val tabular-nums">17:45</span>
            </div>
            <div class="hud-divider"></div>
            <div class="hud-metric">
              <span class="hud-kicker">Heat</span>
              <div id="hud-heat" class="hud-heat-stars" aria-label="Wanted heat"></div>
            </div>
          </div>
          <div id="hud-interior-badge" class="hud-interior-badge" hidden>Inside Fuel Bar</div>
        </div>

        <div class="hud-top-right">
          <div class="hud-utility-row">
            <button type="button" id="btn-shop" class="icon-btn icon-btn-wide" title="Liberty Shops &amp; Garage Upgrades [B]" aria-label="Open Shop">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span>B</span>
            </button>
            <button type="button" id="btn-comms" class="icon-btn icon-btn-wide" title="Vito Menotti Voice / Text Comms [V]" aria-label="Vito Comms">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
              </svg>
              <span>V</span>
            </button>
            <button type="button" id="btn-missions" class="icon-btn icon-btn-wide" title="Custom Mission Board [J]" aria-label="Custom Mission Board">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>J</span>
            </button>
            <button type="button" id="btn-zen" class="icon-btn" title="Zero-Occlusion View [Z]" aria-label="Zero-Occlusion View">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button type="button" id="btn-time" class="icon-btn" title="Advance Time of Day [T]" aria-label="Advance Time of Day">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            </button>
            <button type="button" id="btn-cam" class="icon-btn" title="Toggle Camera View [C]" aria-label="Toggle Camera View">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <button type="button" id="btn-mute" class="icon-btn" title="Mute Audio [M]" aria-label="Mute Audio">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <button type="button" id="btn-pause" class="icon-btn" title="Settings &amp; Pause [Esc]" aria-label="Settings and Pause">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
          <div class="hud-minimap" aria-label="District radar">
            <canvas id="hud-minimap-canvas" width="134" height="134"></canvas>
          </div>
        </div>

        <div class="hud-bottom-left">
          <div class="contract-card">
            <span id="hud-contract-code" class="hud-kicker">CONTRACT 01</span>
            <div id="hud-contract-title" class="contract-title">The Fuel Bar Envelope</div>
            <p id="hud-contract-desc" class="contract-desc">Walk to the Fuel Bar doorway and press E to speak with Sal Moretti.</p>
          </div>
        </div>

        <div class="hud-bottom-right">
          <div id="hud-speed-cluster" class="speed-cluster" hidden>
            <div class="hud-metric">
              <span class="hud-kicker">MPH</span>
              <span id="hud-speed-val" class="speed-value tabular-nums">0</span>
            </div>
            <div class="hud-divider"></div>
            <div class="hud-metric">
              <span class="hud-kicker">Gear</span>
              <span id="hud-gear-val" class="hud-sub-val tabular-nums">N</span>
            </div>
            <div class="hud-divider"></div>
            <div class="hud-metric">
              <span class="hud-kicker">Chassis</span>
              <span id="hud-chassis-val" class="hud-sub-val tabular-nums">100%</span>
            </div>
          </div>
          <div id="hud-foot-cluster" class="speed-cluster">
            <div class="hud-metric">
              <span class="hud-kicker">Stamina</span>
              <span id="hud-stamina-val" class="hud-sub-val tabular-nums">100%</span>
            </div>
            <div class="hud-divider"></div>
            <div class="hud-metric">
              <span class="hud-kicker">Armor</span>
              <span id="hud-armor-val" class="hud-sub-val tabular-nums">25</span>
            </div>
            <div class="hud-divider"></div>
            <button type="button" id="hud-weapon-btn" class="hud-weapon-btn" title="Cycle Firearm [Q or 1-4] · Space/Click Fire">
              <span class="hud-kicker">Weapon [1–4]</span>
              <span id="hud-weapon-val" class="hud-sub-val">.38 Snub</span>
            </button>
          </div>
        </div>

        <button type="button" id="zen-restore-btn" class="icon-btn icon-btn-wide zen-restore-btn" title="Restore HUD [Z]" aria-label="Restore HUD">
          <span>HUD [Z]</span>
        </button>

        <button type="button" id="hud-prompt-pill" class="hud-prompt-pill">
          <span id="hud-prompt-key" class="key-cap">F</span>
          <span id="hud-prompt-text">Drive Black Muscle Coupe</span>
        </button>

        <div id="hud-toast" class="hud-toast" role="status"></div>

        <!-- Mobile Touch Controls -->
        <div class="touch-controls">
          <div class="touch-pad">
            <div></div>
            <button type="button" class="touch-btn" data-tkey="KeyW">▲</button>
            <div></div>
            <button type="button" class="touch-btn" data-tkey="KeyA">◀</button>
            <button type="button" class="touch-btn" data-tkey="KeyS">▼</button>
            <button type="button" class="touch-btn" data-tkey="KeyD">▶</button>
          </div>
          <div class="touch-pad" style="grid-template-columns: repeat(2, 54px);">
            <button type="button" class="touch-btn" style="width:54px" data-tkey="KeyF">CAR</button>
            <button type="button" class="touch-btn" style="width:54px" data-tkey="KeyE">TALK</button>
          </div>
        </div>
      </div>

      <!-- NPC DIALOGUE PANEL -->
      <section class="dialogue-panel" aria-label="Character conversation">
        <div class="dialogue-header">
          <div>
            <div id="dlg-name" class="dialogue-npc-name">Sal Moretti</div>
            <div id="dlg-role" class="dialogue-npc-role">Syndicate Fixer</div>
          </div>
          <span id="dlg-memory" class="dialogue-memory-chip">Calm · First Contact</span>
        </div>
        <p id="dlg-speech" class="dialogue-speech"></p>
        <div id="dlg-choices" class="dialogue-choices"></div>
        <form id="dlg-form" class="dialogue-input-row">
          <input id="dlg-input" class="dialogue-text-input" type="text" placeholder="Speak freely: ask about weapons, cars, cops, Sal, kids, locations..." />
          <button type="button" id="dlg-voice-btn" class="btn-secondary" title="Voice input">Mic</button>
          <button type="submit" class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;">Say</button>
          <button type="button" id="dlg-close-btn" class="btn-secondary" style="padding: 8px 14px;">Leave</button>
        </form>
      </section>

      <!-- VITO MENOTTI VOICE / TEXT COMMS MODAL -->
      <div class="modal-backdrop comms-modal" role="dialog" aria-modal="true" aria-label="Vito Menotti Voice and Text Comms">
        <div class="modal-card">
          <h2 class="modal-title">VITO MENOTTI · INNER VOICE & COMMS</h2>
          <p id="comms-reply" class="dialogue-speech"></p>
          <div class="dialogue-choices" id="comms-quick">
            <button type="button" class="dialogue-choice-btn" data-comms="What is my active mission?">Check Objective</button>
            <button type="button" class="dialogue-choice-btn" data-comms="How is my black coupe holding up?">Check Coupe</button>
            <button type="button" class="dialogue-choice-btn" data-comms="Check my equipped weapon.">Check Weapon</button>
            <button type="button" class="dialogue-choice-btn" data-comms="How much police heat do I have?">Check Heat</button>
          </div>
          <form id="comms-form" class="dialogue-input-row">
            <input id="comms-input" class="dialogue-text-input" type="text" placeholder="Talk aloud as Vito Menotti or dictate a note..." />
            <button type="button" id="comms-voice-btn" class="btn-secondary" title="Speak via microphone">Mic</button>
            <button type="submit" class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;">Speak</button>
            <button type="button" id="comms-close-btn" class="btn-secondary" style="padding: 8px 14px;">Close</button>
          </form>
        </div>
      </div>

      <!-- CUSTOM MISSION CREATOR MODAL -->
      <div class="modal-backdrop mission-modal" role="dialog" aria-modal="true" aria-label="Custom Mission Board">
        <div class="modal-card">
          <h2 class="modal-title">SYNDICATE CUSTOM MISSION BOARD</h2>
          <form id="mission-form" class="mission-form">
            <div class="settings-grid">
              <label class="settings-label" for="ms-title">Contract Title</label>
              <input id="ms-title" class="dialogue-text-input" type="text" value="Midnight Harbor Drop" required />

              <label class="settings-label" for="ms-type">Operation Type</label>
              <select id="ms-type" class="settings-select">
                <option value="deliver">Drive & Deliver Envelope</option>
                <option value="drive">High-Speed District Cruise</option>
                <option value="talk">Face-to-Face Parley</option>
              </select>

              <label class="settings-label" for="ms-landmark">Target Landmark</label>
              <select id="ms-landmark" class="settings-select">${landmarkOptions}</select>

              <label class="settings-label" for="ms-npc">Contact / Kid</label>
              <select id="ms-npc" class="settings-select">${npcOptions}</select>

              <label class="settings-label" for="ms-reward">Payout ($)</label>
              <input id="ms-reward" class="settings-select tabular-nums" type="number" min="250" max="5000" step="50" value="1250" />

              <label class="settings-label" for="ms-briefing">Custom Briefing</label>
              <input id="ms-briefing" class="dialogue-text-input" type="text" placeholder="Optional instruction for radar..." />
            </div>
            <div class="modal-actions">
              <button type="button" id="ms-close-btn" class="btn-secondary">Cancel</button>
              <button type="submit" class="btn-primary">Launch Contract</button>
            </div>
          </form>
        </div>
      </div>

      <!-- LIBERTY SHOPS & GARAGE CATALOG MODAL -->
      <div class="modal-backdrop shop-modal" role="dialog" aria-modal="true" aria-label="Liberty Shops and Garage Upgrades">
        <div class="modal-card">
          <div class="shop-header-row">
            <div>
              <h2 class="modal-title">LIBERTY SHOPS &amp; SYNDICATE SUPPLY</h2>
              <div id="shop-zone-label" class="dialogue-npc-role">All Liberty Shops</div>
            </div>
            <div class="hud-metric" style="align-items: flex-end;">
              <span class="hud-kicker">Available Funds</span>
              <span id="shop-cash-val" class="hud-hero-val tabular-nums">$250</span>
            </div>
          </div>
          <div class="shop-tabs" role="tablist" aria-label="Shop categories">
            <button type="button" class="shop-tab-btn active" data-shop-cat="all">All</button>
            <button type="button" class="shop-tab-btn" data-shop-cat="consumable">Food &amp; Meds</button>
            <button type="button" class="shop-tab-btn" data-shop-cat="gear">Tailor &amp; Papers</button>
            <button type="button" class="shop-tab-btn" data-shop-cat="weapon">Armory</button>
            <button type="button" class="shop-tab-btn" data-shop-cat="vehicle">Coupe Upgrades</button>
          </div>
          <div id="shop-list" class="shop-list"></div>
          <div class="modal-actions">
            <button type="button" id="shop-close-btn" class="btn-secondary">Close [B]</button>
          </div>
        </div>
      </div>

      <!-- PAUSE & SETTINGS MODAL -->
      <div class="modal-backdrop pause-modal" role="dialog" aria-modal="true" aria-label="Game Settings and Pause">
        <div class="modal-card">
          <h2 class="modal-title">SYNDICATE DOSSIER & SETTINGS</h2>
          <div class="settings-grid">
            <label class="settings-label" for="set-quality">Visual Quality Tier</label>
            <select id="set-quality" class="settings-select">
              <option value="cinematic">Cinematic (Ultra Bloom + 35mm Grain)</option>
              <option value="high">High (Crisp PBR + Dynamic Reflections)</option>
              <option value="balanced">Performance</option>
            </select>

            <label class="settings-label" for="set-weather">City Weather</label>
            <select id="set-weather" class="settings-select">
              <option value="clear">Golden Clear</option>
              <option value="drizzle">Wet Drizzle</option>
              <option value="storm">Noir Downpour</option>
            </select>

            <label class="settings-label" for="set-time">Time of Day (Golden → Night)</label>
            <input id="set-time" class="settings-range" type="range" min="0" max="0.98" step="0.01" value="0.04" />

            <label class="settings-label" for="set-autotime">Auto Day-Night Cycle</label>
            <input id="set-autotime" type="checkbox" />

            <label class="settings-label" for="set-bloom">Neon & Sun Bloom</label>
            <input id="set-bloom" type="checkbox" checked />

            <label class="settings-label" for="set-grain">35mm Film Grain</label>
            <input id="set-grain" type="checkbox" checked />

            <label class="settings-label" for="set-master">Master Volume</label>
            <input id="set-master" class="settings-range" type="range" min="0" max="1" step="0.05" value="0.75" />

            <label class="settings-label" for="set-sfx">Engine & Gunfire SFX</label>
            <input id="set-sfx" class="settings-range" type="range" min="0" max="1" step="0.05" value="0.85" />

            <label class="settings-label" for="set-tts">Spoken Voices (TTS)</label>
            <input id="set-tts" type="checkbox" />
          </div>
          <div class="modal-actions">
            <button type="button" id="btn-reset-save" class="btn-secondary">Reset Save</button>
            <button type="button" id="btn-to-title" class="btn-secondary">Title</button>
            <button type="button" id="btn-resume" class="btn-primary">Resume</button>
          </div>
        </div>
      </div>

      <!-- VICTORY / SUMMARY MODAL -->
      <div class="modal-backdrop gameover-modal" role="dialog" aria-modal="true" aria-label="Contract Chapter Complete">
        <div class="modal-card">
          <h2 id="go-title" class="modal-title">DISTRICT SECURED</h2>
          <p class="dialogue-speech">
            Vito Menotti ran the whole Liberty District circuit clean — from the Fuel Bar to South Harbor Pier. Create custom contracts anytime with [J].
          </p>
          <div class="stat-tiles">
            <div class="stat-tile">
              <span class="hud-kicker">Syndicate Cash</span>
              <span id="go-cash" class="hud-hero-val tabular-nums">$0</span>
            </div>
            <div class="stat-tile">
              <span class="hud-kicker">Rank</span>
              <span id="go-rank" class="hud-sub-val">Associate</span>
            </div>
            <div class="stat-tile">
              <span class="hud-kicker">Contracts</span>
              <span id="go-contracts" class="hud-sub-val tabular-nums">6 / 6</span>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" id="btn-go-free" class="btn-secondary">Free Roam</button>
            <button type="button" id="btn-go-replay" class="btn-primary" data-start="true">New Campaign</button>
          </div>
        </div>
      </div>
    `;

    this.continueBtn = this.root.querySelector('#btn-continue-save')!;
    this.saveMetaEl = this.root.querySelector('#title-save-meta')!;
    this.rankEl = this.root.querySelector('#hud-rank')!;
    this.cashEl = this.root.querySelector('#hud-cash')!;
    this.timePhaseEl = this.root.querySelector('#hud-phase')!;
    this.clockEl = this.root.querySelector('#hud-clock')!;
    this.heatStarsEl = this.root.querySelector('#hud-heat')!;
    this.muteBtn = this.root.querySelector('#btn-mute')!;
    this.contractCodeEl = this.root.querySelector('#hud-contract-code')!;
    this.contractTitleEl = this.root.querySelector('#hud-contract-title')!;
    this.contractDescEl = this.root.querySelector('#hud-contract-desc')!;
    this.interiorBadgeEl = this.root.querySelector('#hud-interior-badge')!;
    this.speedClusterEl = this.root.querySelector('#hud-speed-cluster')!;
    this.speedValEl = this.root.querySelector('#hud-speed-val')!;
    this.gearValEl = this.root.querySelector('#hud-gear-val')!;
    this.chassisValEl = this.root.querySelector('#hud-chassis-val')!;
    this.footClusterEl = this.root.querySelector('#hud-foot-cluster')!;
    this.staminaValEl = this.root.querySelector('#hud-stamina-val')!;
    this.armorValEl = this.root.querySelector('#hud-armor-val')!;
    this.weaponBtnEl = this.root.querySelector('#hud-weapon-btn')!;
    this.weaponValEl = this.root.querySelector('#hud-weapon-val')!;
    this.promptPillEl = this.root.querySelector('#hud-prompt-pill')!;
    this.promptKeyEl = this.root.querySelector('#hud-prompt-key')!;
    this.promptTextEl = this.root.querySelector('#hud-prompt-text')!;
    this.toastEl = this.root.querySelector('#hud-toast')!;

    this.shopCashEl = this.root.querySelector('#shop-cash-val')!;
    this.shopZoneEl = this.root.querySelector('#shop-zone-label')!;
    this.shopListEl = this.root.querySelector('#shop-list')!;

    const mmCanvas = this.root.querySelector('#hud-minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = mmCanvas.getContext('2d')!;

    this.dlgNameEl = this.root.querySelector('#dlg-name')!;
    this.dlgRoleEl = this.root.querySelector('#dlg-role')!;
    this.dlgMemoryEl = this.root.querySelector('#dlg-memory')!;
    this.dlgSpeechEl = this.root.querySelector('#dlg-speech')!;
    this.dlgChoicesEl = this.root.querySelector('#dlg-choices')!;
    this.dlgInputEl = this.root.querySelector('#dlg-input')!;
    this.dlgVoiceBtn = this.root.querySelector('#dlg-voice-btn')!;

    this.commsReplyEl = this.root.querySelector('#comms-reply')!;
    this.commsInputEl = this.root.querySelector('#comms-input')!;
    this.commsVoiceBtn = this.root.querySelector('#comms-voice-btn')!;

    this.missionTitleEl = this.root.querySelector('#ms-title')!;
    this.missionTypeEl = this.root.querySelector('#ms-type')!;
    this.missionLandmarkEl = this.root.querySelector('#ms-landmark')!;
    this.missionNpcEl = this.root.querySelector('#ms-npc')!;
    this.missionRewardEl = this.root.querySelector('#ms-reward')!;
    this.missionBriefingEl = this.root.querySelector('#ms-briefing')!;

    this.qualitySelect = this.root.querySelector('#set-quality')!;
    this.weatherSelect = this.root.querySelector('#set-weather')!;
    this.timeRange = this.root.querySelector('#set-time')!;
    this.bloomCheck = this.root.querySelector('#set-bloom')!;
    this.grainCheck = this.root.querySelector('#set-grain')!;
    this.autoTimeCheck = this.root.querySelector('#set-autotime')!;
    this.ttsCheck = this.root.querySelector('#set-tts')!;
    this.masterRange = this.root.querySelector('#set-master')!;
    this.sfxRange = this.root.querySelector('#set-sfx')!;

    this.goTitleEl = this.root.querySelector('#go-title')!;
    this.goCashEl = this.root.querySelector('#go-cash')!;
    this.goRankEl = this.root.querySelector('#go-rank')!;
    this.goContractsEl = this.root.querySelector('#go-contracts')!;
  }

  private bindVoiceButton(
    btn: HTMLButtonElement,
    onTranscript: (transcript: string) => void
  ) {
    const SpeechRec =
      (window as unknown as {SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown})
        .SpeechRecognition ||
      (window as unknown as {webkitSpeechRecognition?: unknown}).webkitSpeechRecognition;

    if (!SpeechRec) {
      btn.style.display = 'none';
      return;
    }

    btn.addEventListener('click', () => {
      try {
        const rec = new (SpeechRec as new () => {
          lang: string;
          onresult: (ev: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void;
          onerror: () => void;
          start: () => void;
        })();
        rec.lang = 'en-US';
        btn.textContent = '...';
        rec.onresult = (ev) => {
          btn.textContent = 'Mic';
          const transcript = ev.results?.[0]?.[0]?.transcript;
          if (transcript) onTranscript(transcript);
        };
        rec.onerror = () => {
          btn.textContent = 'Mic';
        };
        rec.start();
      } catch {
        btn.textContent = 'Mic';
      }
    });
  }

  private bindEvents() {
    this.root.querySelector('#btn-start-game')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onStartNew();
    });
    this.continueBtn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onContinueSave();
    });
    this.root.querySelector('#btn-shop')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onOpenShop();
    });
    this.root.querySelector('#btn-comms')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onOpenHeroComms();
    });
    this.root.querySelector('#btn-missions')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onOpenMissionModal();
    });
    this.root.querySelector('#btn-zen')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onToggleZen();
    });
    this.root.querySelector('#zen-restore-btn')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onToggleZen();
    });
    this.root.querySelector('#btn-time')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onCycleTimeOfDay();
    });
    this.root.querySelector('#btn-cam')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onToggleCameraMode();
    });
    this.muteBtn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onToggleMute();
    });
    this.root.querySelector('#btn-pause')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onPause();
    });
    this.weaponBtnEl.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onCycleWeapon();
    });
    this.promptPillEl.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      this.cb.onInteractContext();
    });

    // NPC Dialogue form & voice
    this.root.querySelector('#dlg-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = this.dlgInputEl.value.trim();
      if (!val) return;
      this.dlgInputEl.value = '';
      this.cb.onDialogueFreeText(val);
    });
    this.root.querySelector('#dlg-close-btn')?.addEventListener('click', () => {
      this.cb.onCloseDialogue();
    });
    this.bindVoiceButton(this.dlgVoiceBtn, (t) => this.cb.onDialogueFreeText(t));

    // Vito Menotti Comms Modal
    this.root.querySelector('#comms-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = this.commsInputEl.value.trim();
      if (!val) return;
      this.commsInputEl.value = '';
      this.cb.onSubmitHeroComms(val);
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-comms]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.dataset.comms;
        if (text) this.cb.onSubmitHeroComms(text);
      });
    });
    this.root.querySelector('#comms-close-btn')?.addEventListener('click', () => {
      this.cb.onCloseSubModal();
    });
    this.bindVoiceButton(this.commsVoiceBtn, (t) => this.cb.onSubmitHeroComms(t));

    // Custom Mission Board Modal
    this.root.querySelector('#mission-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.cb.onCreateCustomMission({
        title: this.missionTitleEl.value,
        type: this.missionTypeEl.value as CustomMissionDraft['type'],
        targetLandmarkId: this.missionLandmarkEl.value,
        targetNpcId: this.missionNpcEl.value,
        rewardCash: Number(this.missionRewardEl.value) || 1000,
        briefing: this.missionBriefingEl.value,
      });
    });
    this.root.querySelector('#ms-close-btn')?.addEventListener('click', () => {
      this.cb.onCloseSubModal();
    });

    // Shop Modal tabs & close
    this.root.querySelectorAll<HTMLButtonElement>('[data-shop-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.shopCat as 'all' | ShopCategory;
        this.shopFilter = cat;
        this.root.querySelectorAll('[data-shop-cat]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        if (this.lastShopContext) {
          this.renderShopModal(
            this.lastShopContext.prog,
            this.lastShopContext.player,
            this.lastShopContext.car,
            this.lastShopContext.zone
          );
        }
      });
    });
    this.root.querySelector('#shop-close-btn')?.addEventListener('click', () => {
      this.cb.onCloseSubModal();
    });

    // Settings controls
    this.qualitySelect.addEventListener('change', () => {
      this.cb.onUpdateSettings({quality: this.qualitySelect.value as SettingsState['quality']});
    });
    this.weatherSelect.addEventListener('change', () => {
      this.cb.onUpdateSettings({weather: this.weatherSelect.value as SettingsState['weather']});
    });
    this.timeRange.addEventListener('input', () => {
      this.cb.onSetTime01(parseFloat(this.timeRange.value));
    });
    this.bloomCheck.addEventListener('change', () => {
      this.cb.onUpdateSettings({bloom: this.bloomCheck.checked});
    });
    this.grainCheck.addEventListener('change', () => {
      this.cb.onUpdateSettings({filmGrain: this.grainCheck.checked});
    });
    this.autoTimeCheck.addEventListener('change', () => {
      this.cb.onUpdateSettings({autoCycleTime: this.autoTimeCheck.checked});
    });
    this.ttsCheck.addEventListener('change', () => {
      this.cb.onUpdateSettings({ttsEnabled: this.ttsCheck.checked});
    });
    this.masterRange.addEventListener('input', () => {
      this.cb.onUpdateSettings({masterVolume: parseFloat(this.masterRange.value)});
    });
    this.sfxRange.addEventListener('input', () => {
      this.cb.onUpdateSettings({sfxVolume: parseFloat(this.sfxRange.value)});
    });

    this.root.querySelector('#btn-resume')?.addEventListener('click', () => this.cb.onResume());
    this.root.querySelector('#btn-to-title')?.addEventListener('click', () => this.cb.onReturnToTitle());
    this.root.querySelector('#btn-reset-save')?.addEventListener('click', () => this.cb.onRestart());
    this.root.querySelector('#btn-go-free')?.addEventListener('click', () => this.cb.onResume());
    this.root.querySelector('#btn-go-replay')?.addEventListener('click', () => this.cb.onRestart());

    this.root.querySelectorAll<HTMLButtonElement>('[data-tkey]').forEach((btn) => {
      const code = btn.dataset.tkey!;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.cb.onTouchKey(code, true);
      });
      const up = () => this.cb.onTouchKey(code, false);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    });
  }

  setModeState(mode: GameModeState) {
    document.body.dataset.state = mode;
  }

  setSubModal(kind: SubModalKind) {
    if (kind) {
      document.body.setAttribute('data-submodal', kind);
    } else {
      document.body.removeAttribute('data-submodal');
    }
  }

  setZenMode(zen: boolean) {
    if (zen) {
      document.body.dataset.zen = 'true';
    } else {
      delete document.body.dataset.zen;
    }
  }

  renderShopModal(
    prog: ProgressionState,
    player: PlayerState,
    car: VehiclePhysicsState,
    zone: InteriorZone | null
  ) {
    this.lastShopContext = {prog, player, car, zone};
    this.shopCashEl.textContent = `$${Math.round(prog.cash)}`;
    this.shopZoneEl.textContent = zone
      ? `Inside ${zone.name} · ${zone.subtitle}`
      : 'All Liberty Supply · Walk inside Tailors, Tea House, Garage, or Clinic for local stock';

    const owned = prog.ownedItemIds ?? [];
    const items = getShopItemsForZone(zone?.id ?? null).filter(
      (item) => this.shopFilter === 'all' || item.category === this.shopFilter
    );

    this.shopListEl.innerHTML = '';
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'shop-item-card';

      const alreadyOwned =
        (item.maxArmorBoost && owned.includes(item.id)) ||
        (item.weaponId && owned.includes(item.id)) ||
        (item.engineTier !== undefined && (car.engineTier ?? 0) >= item.engineTier) ||
        (item.armorTier !== undefined && (car.armorTier ?? 0) >= item.armorTier);

      const featuredLocal =
        zone && item.shopZoneIds && item.shopZoneIds.includes(zone.id);

      const catLabel =
        item.category === 'consumable'
          ? 'Food / Med'
          : item.category === 'gear'
            ? 'Tailor / Legal'
            : item.category === 'weapon'
              ? 'Armory'
              : 'Garage';

      const info = document.createElement('div');
      info.className = 'shop-item-info';
      info.innerHTML = `
        <div class="shop-item-title-row">
          <span class="shop-item-name">${item.name}</span>
          <span class="shop-item-cat">${featuredLocal ? 'IN-SHOP · ' : ''}${catLabel}</span>
        </div>
        <div class="shop-item-desc">${item.description}</div>
      `;

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = alreadyOwned ? 'btn-secondary shop-buy-btn' : 'btn-primary shop-buy-btn';
      if (alreadyOwned) {
        buyBtn.textContent = 'Owned';
        buyBtn.disabled = true;
      } else if (prog.cash < item.price) {
        buyBtn.textContent = `$${item.price}`;
        buyBtn.disabled = true;
      } else {
        buyBtn.textContent = `Buy $${item.price}`;
      }
      buyBtn.dataset.shopBuy = item.id;
      buyBtn.addEventListener('click', () => {
        this.cb.onBuyShopItem(item.id);
      });

      card.append(info, buyBtn);
      this.shopListEl.appendChild(card);
    }
  }

  setHeroCommsReply(text: string) {
    this.commsReplyEl.textContent = text;
  }

  setSavePreview(cash: number | null, contractsDone: number, totalContracts: number) {
    if (cash === null) {
      this.continueBtn.hidden = true;
      this.saveMetaEl.hidden = true;
      return;
    }
    const rank = getRankForCash(cash);
    this.continueBtn.hidden = false;
    this.saveMetaEl.hidden = false;
    this.saveMetaEl.textContent = `SAVED DOSSIER · ${rank.title.toUpperCase()} · $${Math.round(cash)} · ${contractsDone}/${totalContracts} CONTRACTS`;
  }

  syncSettingsUI(settings: SettingsState, time01: number, muted: boolean) {
    this.qualitySelect.value = settings.quality;
    this.weatherSelect.value = settings.weather;
    this.timeRange.value = time01.toFixed(2);
    this.bloomCheck.checked = settings.bloom;
    this.grainCheck.checked = settings.filmGrain;
    this.autoTimeCheck.checked = settings.autoCycleTime;
    this.ttsCheck.checked = settings.ttsEnabled;
    this.masterRange.value = String(settings.masterVolume);
    this.sfxRange.value = String(settings.sfxVolume);
    this.muteBtn.style.opacity = muted ? '0.5' : '1';
  }

  showToast(message: string) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 3200);
  }

  openDialogue(npcId: string, replyText: string, prog: ProgressionState) {
    const npc = NPC_DEFINITIONS.find((n) => n.id === npcId) ?? NPC_DEFINITIONS[0];
    const mem = prog.npcMemory[npcId];
    this.dlgNameEl.textContent = npc.name;
    this.dlgRoleEl.textContent = npc.role;

    const moodLabel = mem ? mem.mood.charAt(0).toUpperCase() + mem.mood.slice(1) : 'Calm';
    if (!mem || mem.metCount === 0) {
      this.dlgMemoryEl.textContent = `${moodLabel} · First Contact`;
    } else if (mem.trust >= 1) {
      this.dlgMemoryEl.textContent = `${moodLabel} · Trusted · Met ${mem.metCount}×`;
    } else if (mem.trust < 0) {
      this.dlgMemoryEl.textContent = `${moodLabel} · Wary · Remembers Friction`;
    } else {
      this.dlgMemoryEl.textContent = `${moodLabel} · Acquainted · Met ${mem.metCount}×`;
    }

    this.dlgSpeechEl.textContent = `“${replyText}”`;

    const opts = getDialogueOptionsForNpc(npcId, prog);
    this.dlgChoicesEl.innerHTML = '';
    for (const opt of opts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dialogue-choice-btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        this.cb.onDialogueChoice(opt.id, opt.label, opt.tag);
      });
      this.dlgChoicesEl.appendChild(btn);
    }
  }

  updateGameOver(prog: ProgressionState) {
    const rank = getRankForCash(prog.cash);
    const total = getAllContracts(prog).length;
    this.goTitleEl.textContent = 'LIBERTY DISTRICT SECURED';
    this.goCashEl.textContent = `$${Math.round(prog.cash)}`;
    this.goRankEl.textContent = rank.title;
    this.goContractsEl.textContent = `${prog.completedContractIds.length} / ${total}`;
  }

  updateHUD(
    player: PlayerState,
    car: VehiclePhysicsState,
    prog: ProgressionState,
    atmo: AtmosphereParams,
    cameraMode: CameraMode,
    prompt: {key: string; text: string} | null,
    trafficCars: TrafficVehicleState[] = [],
    currentInteriorName: string | null = null
  ) {
    const rank = getRankForCash(prog.cash);
    this.rankEl.textContent = rank.title;
    this.cashEl.textContent = `$${Math.round(prog.cash)}`;
    this.timePhaseEl.textContent = atmo.phaseLabel;
    this.clockEl.textContent = atmo.clockLabel;

    if (currentInteriorName) {
      this.interiorBadgeEl.hidden = false;
      this.interiorBadgeEl.textContent = `Inside: ${currentInteriorName}`;
    } else {
      this.interiorBadgeEl.hidden = true;
    }

    let starsHtml = '';
    for (let i = 0; i < 5; i++) {
      const active = i < prog.heat;
      starsHtml += `<svg width="13" height="13" viewBox="0 0 24 24" fill="${
        active ? '#e4b55c' : 'rgba(255,255,255,0.16)'
      }"><polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"/></svg>`;
    }
    this.heatStarsEl.innerHTML = starsHtml;

    const activeContract = getActiveContract(prog);
    const activeStep = getActiveContractStep(prog);
    if (activeContract && activeStep) {
      this.contractCodeEl.textContent = `${activeContract.code} · $${activeContract.rewardCash}`;
      this.contractTitleEl.textContent = activeContract.title;
      this.contractDescEl.textContent = activeStep.instruction;
    } else {
      this.contractCodeEl.textContent = 'FREE ROAM';
      this.contractTitleEl.textContent = 'All Active Contracts Complete';
      this.contractDescEl.textContent =
        'Press [J] to create a custom contract, [V] for Vito Comms, or cruise the Harbor Pier.';
    }

    if (player.inVehicle) {
      this.speedClusterEl.hidden = false;
      this.footClusterEl.hidden = true;
      const mph = Math.round(Math.abs(car.speed) * 2.237);
      this.speedValEl.textContent = String(mph);
      this.gearValEl.textContent =
        cameraMode === 'interior' ? `${car.gear} · DASH` : car.gear;
      const pct = Math.round(car.health);
      this.chassisValEl.textContent = car.crashed ? `${pct}%!` : `${pct}%`;
      this.chassisValEl.style.color = car.crashed || pct < 70 ? '#ff6b6b' : '#f3eee4';
    } else {
      this.speedClusterEl.hidden = true;
      this.footClusterEl.hidden = false;
      this.staminaValEl.textContent = `${Math.round(player.stamina)}%`;
      this.armorValEl.textContent = `${Math.round(player.armor ?? 0)}`;
      const weaponDef = WEAPONS.find((w) => w.id === player.equippedWeapon) ?? WEAPONS[0];
      this.weaponValEl.textContent = weaponDef.shortName;
    }

    if (prompt) {
      this.promptKeyEl.textContent = prompt.key;
      this.promptTextEl.textContent = prompt.text;
      this.promptPillEl.classList.add('visible');
    } else {
      this.promptPillEl.classList.remove('visible');
    }

    this.drawMinimap(player, car, prog, trafficCars);
  }

  private drawMinimap(
    player: PlayerState,
    car: VehiclePhysicsState,
    prog: ProgressionState,
    trafficCars: TrafficVehicleState[]
  ) {
    const ctx = this.minimapCtx;
    const size = 134;
    const half = size / 2;
    const scale = 0.48; // Shows ~279m diameter across the 580x560m Liberty Metropolis

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, size, size);

    const px = player.inVehicle ? car.x : player.x;
    const pz = player.inVehicle ? car.z : player.z;
    const toMap = (wx: number, wz: number) => ({
      x: half + (wx - px) * scale,
      y: half + (wz - pz) * scale,
    });

    // South Harbor water
    const waterTop = toMap(-360, 114);
    ctx.fillStyle = '#0d2236';
    ctx.fillRect(waterTop.x, waterTop.y, 720 * scale, 180 * scale);

    // Liberty Park green square (x: 22..56, z: -84..-44)
    const parkTop = toMap(22, -84);
    ctx.fillStyle = '#183324';
    ctx.fillRect(parkTop.x, parkTop.y, 34 * scale, 40 * scale);

    // Roads: 5 Avenues ([-150, -68, 0, 68, 150]) & 5 land Cross Streets
    ctx.fillStyle = '#202530';
    for (const ax of AVENUE_X_COORDS) {
      const p = toMap(ax - 9, -260);
      ctx.fillRect(p.x, p.y, 18 * scale, 376 * scale);
    }
    for (const cz of CROSS_Z_COORDS) {
      if (cz > 110) continue;
      const cr = toMap(-260, cz - 8);
      ctx.fillRect(cr.x, cr.y, 520 * scale, 16 * scale);
    }

    // Extended Harbor Pier 4 center strip (z: 102..248)
    const pier = toMap(-12, 102);
    ctx.fillStyle = '#473626';
    ctx.fillRect(pier.x, pier.y, 24 * scale, 146 * scale);

    // Buildings
    ctx.fillStyle = '#332b27';
    for (const b of BUILDING_COLLIDERS) {
      if (b.kind === 'boundary') continue;
      const p0 = toMap(b.minX, b.minZ);
      const w = (b.maxX - b.minX) * scale;
      const h = (b.maxZ - b.minZ) * scale;
      ctx.fillRect(p0.x, p0.y, w, h);
    }

    // Traffic & parked vehicles
    for (const tc of trafficCars) {
      const tp = toMap(tc.x, tc.z);
      ctx.fillStyle = tc.crashed
        ? '#ff5252'
        : tc.variant === 'police'
          ? '#69a6ff'
          : tc.variant === 'checker_cab'
            ? '#e8b838'
            : '#8c94a3';
      ctx.fillRect(tp.x - 2, tp.y - 2, 4, 4);
    }

    // Hero car
    if (!player.inVehicle) {
      const cp = toMap(car.x, car.z);
      ctx.fillStyle = car.crashed ? '#ff6b6b' : '#6ec1ff';
      ctx.fillRect(cp.x - 2.5, cp.y - 3.5, 5, 7);
    }

    // NPCs & Kids
    for (const npc of NPC_DEFINITIONS) {
      const np = toMap(npc.x, npc.z);
      ctx.fillStyle = npc.isKid ? '#67d4ff' : '#e8dfc8';
      ctx.beginPath();
      ctx.arc(np.x, np.y, npc.isKid ? 2.1 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Objective beacon ring
    const step = getActiveContractStep(prog);
    if (step?.targetPos) {
      const tp = toMap(step.targetPos.x, step.targetPos.z);
      ctx.strokeStyle = '#e4b55c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center player arrow
    const yaw = player.inVehicle ? car.yaw : player.yaw;
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#e4b55c';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
