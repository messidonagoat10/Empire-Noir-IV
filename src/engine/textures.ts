import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface RoadTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export function createRoadTextures(maxAniso: number): RoadTextureSet {
  const w = 512;
  const h = 512;
  const [albedoC, aCtx] = makeCanvas(w, h);
  const [roughC, rCtx] = makeCanvas(w, h);
  const [bumpC, bCtx] = makeCanvas(w, h);

  // Base dark asphalt
  aCtx.fillStyle = '#1b1d22';
  aCtx.fillRect(0, 0, w, h);

  // Base damp asphalt roughness (~0.62)
  rCtx.fillStyle = 'rgb(158, 158, 158)';
  rCtx.fillRect(0, 0, w, h);

  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, w, h);

  // Deterministic pseudo-random grain + wet puddles
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4500; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = 1 + rand() * 2.5;
    const v = 22 + Math.floor(rand() * 26);
    aCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    aCtx.fillRect(x, y, s, s);

    const bv = 100 + Math.floor(rand() * 56);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(x, y, s, s);
  }

  // Glossy puddles (low roughness = near mirror-like speculars for neon/sun)
  for (let i = 0; i < 18; i++) {
    const px = 40 + rand() * (w - 80);
    const py = 20 + rand() * (h - 40);
    const rx = 24 + rand() * 68;
    const ry = 32 + rand() * 90;

    const gradR = rCtx.createRadialGradient(px, py, 4, px, py, Math.max(rx, ry));
    gradR.addColorStop(0, 'rgb(18, 18, 18)');
    gradR.addColorStop(0.65, 'rgb(36, 36, 36)');
    gradR.addColorStop(1, 'rgba(158, 158, 158, 0)');
    rCtx.save();
    rCtx.translate(px, py);
    rCtx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    rCtx.translate(-px, -py);
    rCtx.fillStyle = gradR;
    rCtx.beginPath();
    rCtx.arc(px, py, Math.max(rx, ry), 0, Math.PI * 2);
    rCtx.fill();
    rCtx.restore();

    const gradA = aCtx.createRadialGradient(px, py, 4, px, py, Math.max(rx, ry));
    gradA.addColorStop(0, 'rgba(10, 12, 16, 0.55)');
    gradA.addColorStop(1, 'rgba(10, 12, 16, 0)');
    aCtx.fillStyle = gradA;
    aCtx.beginPath();
    aCtx.arc(px, py, Math.max(rx, ry), 0, Math.PI * 2);
    aCtx.fill();
  }

  // Double yellow center line (Refs 01, 02, 03, 11)
  aCtx.fillStyle = '#c88c24';
  aCtx.fillRect(w * 0.5 - 10, 0, 5, h);
  aCtx.fillRect(w * 0.5 + 5, 0, 5, h);

  // Subtle dashed lane lines
  aCtx.fillStyle = 'rgba(215, 210, 195, 0.52)';
  for (let y = 16; y < h; y += 64) {
    aCtx.fillRect(w * 0.25 - 2, y, 4, 30);
    aCtx.fillRect(w * 0.75 - 2, y, 4, 30);
  }

  return {
    map: finalizeTexture(albedoC, true, maxAniso, 1, 6),
    roughnessMap: finalizeTexture(roughC, false, maxAniso, 1, 6),
    bumpMap: finalizeTexture(bumpC, false, maxAniso, 1, 6),
  };
}

export function createSidewalkTextures(maxAniso: number): RoadTextureSet {
  const w = 256;
  const h = 256;
  const [albedoC, aCtx] = makeCanvas(w, h);
  const [roughC, rCtx] = makeCanvas(w, h);
  const [bumpC, bCtx] = makeCanvas(w, h);

  aCtx.fillStyle = '#474542';
  aCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(115, 115, 115)';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(138, 138, 138)';
  bCtx.fillRect(0, 0, w, h);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 1600; i++) {
    const v = 60 + Math.floor(rand() * 24);
    aCtx.fillStyle = `rgb(${v},${v - 1},${v - 3})`;
    aCtx.fillRect(rand() * w, rand() * h, 2, 2);
  }

  // Concrete paving grid
  aCtx.strokeStyle = 'rgba(20, 19, 18, 0.65)';
  aCtx.lineWidth = 3;
  bCtx.strokeStyle = 'rgb(60, 60, 60)';
  bCtx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    const pos = (i * w) / 4;
    aCtx.beginPath();
    aCtx.moveTo(pos, 0);
    aCtx.lineTo(pos, h);
    aCtx.moveTo(0, pos);
    aCtx.lineTo(w, pos);
    aCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(pos, 0);
    bCtx.lineTo(pos, h);
    bCtx.moveTo(0, pos);
    bCtx.lineTo(w, pos);
    bCtx.stroke();
  }

  // Glossy damp sheen patches (Ref 10, 15)
  const g = rCtx.createRadialGradient(128, 128, 10, 128, 128, 110);
  g.addColorStop(0, 'rgb(42,42,42)');
  g.addColorStop(1, 'rgba(115,115,115,0)');
  rCtx.fillStyle = g;
  rCtx.fillRect(0, 0, w, h);

  return {
    map: finalizeTexture(albedoC, true, maxAniso, 2, 12),
    roughnessMap: finalizeTexture(roughC, false, maxAniso, 2, 12),
    bumpMap: finalizeTexture(bumpC, false, maxAniso, 2, 12),
  };
}

export interface BuildingTextureSet {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export function createBrickBuildingTextures(
  brickHex: string,
  trimHex: string,
  cols: number,
  rows: number,
  maxAniso: number,
  seedInit = 91
): BuildingTextureSet {
  const w = 512;
  const h = 512;
  const [albedoC, aCtx] = makeCanvas(w, h);
  const [emissC, eCtx] = makeCanvas(w, h);
  const [bumpC, bCtx] = makeCanvas(w, h);

  aCtx.fillStyle = brickHex;
  aCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = 'rgb(145, 145, 145)';
  bCtx.fillRect(0, 0, w, h);

  let seed = seedInit;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Brick courses
  const brickH = 8;
  const brickW = 20;
  for (let y = 0; y < h; y += brickH) {
    const offset = ((y / brickH) % 2) * (brickW * 0.5);
    aCtx.fillStyle = 'rgba(0,0,0,0.22)';
    aCtx.fillRect(0, y, w, 1.5);
    bCtx.fillStyle = 'rgb(95,95,95)';
    bCtx.fillRect(0, y, w, 1.5);
    for (let x = -brickW; x < w + brickW; x += brickW) {
      if (rand() > 0.55) {
        aCtx.fillStyle = rand() > 0.5 ? 'rgba(255,220,180,0.06)' : 'rgba(10,8,6,0.12)';
        aCtx.fillRect(x + offset, y + 1.5, brickW - 2, brickH - 2);
      }
      aCtx.fillStyle = 'rgba(0,0,0,0.18)';
      aCtx.fillRect(x + offset, y, 1.5, brickH);
    }
  }

  // Windows with sills, mullions, and warm apartment glow
  const cellW = w / cols;
  const cellH = h / rows;
  const winW = cellW * 0.52;
  const winH = cellH * 0.6;

  for (let r = 0; r < rows; r++) {
    // Stone cornice band per floor
    aCtx.fillStyle = trimHex;
    aCtx.fillRect(0, r * cellH, w, 5);
    bCtx.fillStyle = 'rgb(190,190,190)';
    bCtx.fillRect(0, r * cellH, w, 5);

    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + (cellW - winW) * 0.5;
      const wy = r * cellH + (cellH - winH) * 0.5 + 3;

      // Recessed stone sill & lintel
      aCtx.fillStyle = trimHex;
      aCtx.fillRect(wx - 4, wy - 6, winW + 8, 6);
      aCtx.fillRect(wx - 4, wy + winH, winW + 8, 6);

      // Dark glass pane
      aCtx.fillStyle = '#141821';
      aCtx.fillRect(wx, wy, winW, winH);
      bCtx.fillStyle = 'rgb(75,75,75)';
      bCtx.fillRect(wx, wy, winW, winH);

      // Some apartments lit warmly
      const lit = rand() > 0.36;
      if (lit) {
        const warm = rand() > 0.25 ? '#ffca7a' : '#ff9f4d';
        eCtx.fillStyle = warm;
        eCtx.fillRect(wx + 3, wy + 3, winW - 6, winH - 6);
        // Subtle blind shadow across top third
        eCtx.fillStyle = 'rgba(0,0,0,0.42)';
        eCtx.fillRect(wx + 3, wy + 3, winW - 6, (winH - 6) * (0.2 + rand() * 0.3));
      }

      // Window frame & crossbars
      aCtx.strokeStyle = '#2a2724';
      aCtx.lineWidth = 3;
      aCtx.strokeRect(wx, wy, winW, winH);
      aCtx.beginPath();
      aCtx.moveTo(wx + winW * 0.5, wy);
      aCtx.lineTo(wx + winW * 0.5, wy + winH);
      aCtx.moveTo(wx, wy + winH * 0.45);
      aCtx.lineTo(wx + winW, wy + winH * 0.45);
      aCtx.stroke();

      eCtx.strokeStyle = '#000000';
      eCtx.lineWidth = 3;
      eCtx.strokeRect(wx, wy, winW, winH);
      eCtx.beginPath();
      eCtx.moveTo(wx + winW * 0.5, wy);
      eCtx.lineTo(wx + winW * 0.5, wy + winH);
      eCtx.moveTo(wx, wy + winH * 0.45);
      eCtx.lineTo(wx + winW, wy + winH * 0.45);
      eCtx.stroke();
    }
  }

  return {
    map: finalizeTexture(albedoC, true, maxAniso, 1, 1),
    emissiveMap: finalizeTexture(emissC, true, maxAniso, 1, 1),
    bumpMap: finalizeTexture(bumpC, false, maxAniso, 1, 1),
  };
}

export function createSignTexture(
  opts: {
    width?: number;
    height?: number;
    bg: string;
    border?: string;
    title: string;
    subtitle?: string;
    textColor: string;
    glowColor?: string;
    fontSize?: number;
    vertical?: boolean;
    retroCar?: boolean;
  },
  maxAniso: number
): THREE.CanvasTexture {
  const w = opts.width ?? 512;
  const h = opts.height ?? 256;
  const [c, ctx] = makeCanvas(w, h);

  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, w, h);

  if (opts.retroCar) {
    // Retro painted Americar billboard style (Refs 01, 03, 06, 19)
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2a2723');
    grad.addColorStop(1, '#141311');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Painted vintage red convertible silhouette
    ctx.fillStyle = '#a82b24';
    ctx.beginPath();
    ctx.roundRect(w * 0.42, h * 0.45, w * 0.48, h * 0.24, 18);
    ctx.fill();
    ctx.fillStyle = '#d9c5a0';
    ctx.beginPath();
    ctx.roundRect(w * 0.52, h * 0.34, w * 0.24, h * 0.14, 10);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(w * 0.52, h * 0.71, 22, 0, Math.PI * 2);
    ctx.arc(w * 0.80, h * 0.71, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eee5d3';
    ctx.beginPath();
    ctx.arc(w * 0.52, h * 0.71, 13, 0, Math.PI * 2);
    ctx.arc(w * 0.80, h * 0.71, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.glowColor) {
    ctx.shadowColor = opts.glowColor;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = opts.textColor;

  if (opts.vertical) {
    const letters = opts.title.split('');
    const fSize = opts.fontSize ?? Math.floor((h - 40) / Math.max(letters.length, 1));
    ctx.font = `800 ${fSize}px "Cinzel", Georgia, serif`;
    const step = (h - 36) / letters.length;
    letters.forEach((ch, idx) => {
      ctx.fillText(ch, w / 2, 18 + step * (idx + 0.5));
    });
  } else if (opts.retroCar) {
    ctx.textAlign = 'left';
    ctx.font = `900 ${opts.fontSize ?? 58}px "Cinzel", Georgia, serif`;
    ctx.fillText(opts.title, 28, h * 0.24);
    if (opts.subtitle) {
      ctx.font = 'italic 600 24px Georgia, serif';
      ctx.fillStyle = '#e6c891';
      ctx.fillText(opts.subtitle, 30, h * 0.56);
    }
  } else {
    const fSize = opts.fontSize ?? 68;
    ctx.font = `800 ${fSize}px "Cinzel", Georgia, serif`;
    const yPos = opts.subtitle ? h * 0.40 : h * 0.5;
    ctx.fillText(opts.title, w / 2, yPos);
    if (opts.subtitle) {
      ctx.shadowBlur = 4;
      ctx.font = '700 24px "Inter", sans-serif';
      ctx.fillStyle = '#f7e6c4';
      ctx.fillText(opts.subtitle, w / 2, h * 0.74);
    }
  }

  return finalizeTexture(c, true, maxAniso, 1, 1);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSoftParticleTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.45, 'rgba(220, 228, 240, 0.35)');
  grad.addColorStop(1, 'rgba(220, 228, 240, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCrosswalkTexture(maxAniso: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(232, 226, 210, 0.82)';
  for (let x = 22; x < 490; x += 56) {
    ctx.fillRect(x, 12, 32, 104);
  }
  return finalizeTexture(c, true, maxAniso, 1, 1);
}

export function createCheckerTileTexture(
  colorA: string,
  colorB: string,
  maxAniso: number,
  repeatX = 4,
  repeatY = 4
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const step = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * step, y * step, step, step);
    }
  }
  return finalizeTexture(c, true, maxAniso, repeatX, repeatY);
}

export function createWoodPlankTexture(maxAniso: number, repeatX = 3, repeatY = 3): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#4b2b18';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = (y / 32) % 2 === 0 ? '#57331d' : '#462614';
    ctx.fillRect(0, y, 256, 30);
    ctx.fillStyle = 'rgba(15, 8, 4, 0.45)';
    ctx.fillRect(0, y + 30, 256, 2);
  }
  return finalizeTexture(c, true, maxAniso, repeatX, repeatY);
}

