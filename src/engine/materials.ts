import * as THREE from 'three';
import {
  createBrickBuildingTextures,
  createCheckerTileTexture,
  createContactShadowTexture,
  createCrosswalkTexture,
  createRoadTextures,
  createSidewalkTextures,
  createSoftParticleTexture,
  createWoodPlankTexture,
} from './textures';
import type {AtmosphereParams} from '../game/types';

export interface MaterialBank {
  asphalt: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  crosswalk: THREE.MeshStandardMaterial;
  buildings: THREE.MeshStandardMaterial[];
  neonMaterials: THREE.MeshStandardMaterial[];
  streetLampBulbs: THREE.MeshStandardMaterial[];
  limestone: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  woodFrame: THREE.MeshStandardMaterial;
  woodFloor: THREE.MeshStandardMaterial;
  dinerFloor: THREE.MeshStandardMaterial;
  clinicFloor: THREE.MeshStandardMaterial;
  glassDark: THREE.MeshPhysicalMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  steamTexture: THREE.CanvasTexture;
  maxAnisotropy: number;
  updateAtmosphere: (atmo: AtmosphereParams) => void;
  dispose: () => void;
}

export function createMaterialBank(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): MaterialBank {
  const maxAniso = isSoftwareGl
    ? 1
    : Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const roadTex = createRoadTextures(maxAniso);
  const sidewalkTex = createSidewalkTextures(maxAniso);
  const crosswalkMap = createCrosswalkTexture(maxAniso);
  const shadowTex = createContactShadowTexture();
  const steamTexture = createSoftParticleTexture();
  const woodFloorTex = createWoodPlankTexture(maxAniso, 3, 4);
  const dinerFloorTex = createCheckerTileTexture('#e6dfd0', '#1c1d22', maxAniso, 4, 4);
  const clinicFloorTex = createCheckerTileTexture('#cfd8dc', '#b8c4ca', maxAniso, 5, 5);

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: roadTex.map,
    roughnessMap: roadTex.roughnessMap,
    bumpMap: roadTex.bumpMap,
    bumpScale: 0.035,
    roughness: 0.45,
    metalness: 0.14,
    envMapIntensity: 1.35,
  });

  const sidewalk = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sidewalkTex.map,
    roughnessMap: sidewalkTex.roughnessMap,
    bumpMap: sidewalkTex.bumpMap,
    bumpScale: 0.025,
    roughness: 0.78,
    metalness: 0.03,
    envMapIntensity: 0.45,
  });

  const crosswalk = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: crosswalkMap,
    transparent: true,
    opacity: 0.86,
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const brickConfigs = [
    {brick: '#5f3728', trim: '#8b7a66', cols: 5, rows: 6, seed: 101},
    {brick: '#4b3129', trim: '#766c62', cols: 4, rows: 7, seed: 202},
    {brick: '#6b4734', trim: '#988b76', cols: 6, rows: 5, seed: 303},
    {brick: '#3f3b3a', trim: '#7a7770', cols: 6, rows: 8, seed: 404},
  ];

  const buildings = brickConfigs.map((cfg) => {
    const tex = createBrickBuildingTextures(
      cfg.brick,
      cfg.trim,
      cfg.cols,
      cfg.rows,
      maxAniso,
      cfg.seed
    );
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex.map,
      emissiveMap: tex.emissiveMap,
      emissive: new THREE.Color(0xffbd6b),
      emissiveIntensity: 0.25,
      bumpMap: tex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.82,
      metalness: 0.04,
    });
  });

  const limestone = new THREE.MeshStandardMaterial({
    color: 0xb7a790,
    roughness: 0.76,
    metalness: 0.05,
  });

  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x1d2026,
    roughness: 0.42,
    metalness: 0.78,
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xdfe4ea,
    roughness: 0.14,
    metalness: 0.94,
    envMapIntensity: 1.4,
  });

  const woodFrame = new THREE.MeshStandardMaterial({
    color: 0x5d2f1a,
    roughness: 0.56,
    metalness: 0.08,
  });

  const woodFloor = new THREE.MeshStandardMaterial({
    map: woodFloorTex,
    roughness: 0.52,
    metalness: 0.08,
  });

  const dinerFloor = new THREE.MeshStandardMaterial({
    map: dinerFloorTex,
    roughness: 0.35,
    metalness: 0.05,
  });

  const clinicFloor = new THREE.MeshStandardMaterial({
    map: clinicFloorTex,
    roughness: 0.42,
    metalness: 0.06,
  });

  const glassDark = new THREE.MeshPhysicalMaterial({
    color: 0x1a2633,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.45,
    envMapIntensity: 1.8,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  const neonMaterials: THREE.MeshStandardMaterial[] = [];
  const streetLampBulbs: THREE.MeshStandardMaterial[] = [];

  const disposableTextures: THREE.Texture[] = [
    roadTex.map,
    roadTex.roughnessMap,
    roadTex.bumpMap,
    sidewalkTex.map,
    sidewalkTex.roughnessMap,
    sidewalkTex.bumpMap,
    crosswalkMap,
    shadowTex,
    steamTexture,
    woodFloorTex,
    dinerFloorTex,
    clinicFloorTex,
  ];

  return {
    asphalt,
    sidewalk,
    crosswalk,
    buildings,
    neonMaterials,
    streetLampBulbs,
    limestone,
    darkSteel,
    chrome,
    woodFrame,
    woodFloor,
    dinerFloor,
    clinicFloor,
    glassDark,
    contactShadow,
    steamTexture,
    maxAnisotropy: maxAniso,
    updateAtmosphere(atmo: AtmosphereParams) {
      asphalt.roughness = THREE.MathUtils.lerp(0.74, 0.42, atmo.roadWetness);
      asphalt.envMapIntensity = THREE.MathUtils.lerp(0.75, 1.35, atmo.roadWetness);
      sidewalk.roughness = THREE.MathUtils.lerp(0.88, 0.66, atmo.roadWetness);

      for (const bMat of buildings) {
        bMat.emissiveIntensity = 0.15 + atmo.windowGlow * 1.45;
      }
      for (const nMat of neonMaterials) {
        nMat.emissiveIntensity = atmo.neonIntensity * 1.15;
      }
      for (const lMat of streetLampBulbs) {
        lMat.emissiveIntensity = 0.35 + atmo.streetLightIntensity * 1.25;
      }
    },
    dispose() {
      for (const t of disposableTextures) t.dispose();
      asphalt.dispose();
      sidewalk.dispose();
      crosswalk.dispose();
      limestone.dispose();
      darkSteel.dispose();
      chrome.dispose();
      woodFrame.dispose();
      woodFloor.dispose();
      dinerFloor.dispose();
      clinicFloor.dispose();
      glassDark.dispose();
      contactShadow.dispose();
      for (const m of buildings) {
        m.map?.dispose();
        m.emissiveMap?.dispose();
        m.bumpMap?.dispose();
        m.dispose();
      }
      for (const m of neonMaterials) {
        m.map?.dispose();
        m.emissiveMap?.dispose();
        m.dispose();
      }
      for (const m of streetLampBulbs) m.dispose();
    },
  };
}
