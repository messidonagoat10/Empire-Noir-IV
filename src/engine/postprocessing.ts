import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {AtmosphereParams, SettingsState} from '../game/types';

export function detectSoftwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

const NoirFilmShader = {
  uniforms: {
    tDiffuse: {value: null},
    uTime: {value: 0},
    uGrainIntensity: {value: 0.045},
    uVignetteDarkness: {value: 0.55},
    uSunScreenPos: {value: new THREE.Vector2(0.5, 0.65)},
    uGodRayStrength: {value: 0.35},
    uWarmTint: {value: new THREE.Color(0xffcfa0)},
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    uniform float uVignetteDarkness;
    uniform vec2 uSunScreenPos;
    uniform float uGodRayStrength;
    uniform vec3 uWarmTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 col = base.rgb;

      // Subtle golden-hour / neon atmospheric radial bloom (god-ray glow)
      float dSun = distance(vUv, uSunScreenPos);
      float rayGlow = exp(-dSun * 3.4) * uGodRayStrength * 0.24;
      col += uWarmTint * rayGlow;

      // Subtle cinema film grain
      float n = (hash(vUv * 512.0 + fract(uTime) * 37.0) - 0.5) * uGrainIntensity;
      col += n;

      // Noir edge vignette
      vec2 centered = vUv - 0.5;
      float vig = smoothstep(0.95, 0.28, length(centered) * (0.95 + uVignetteDarkness * 0.45));
      col *= mix(1.0 - uVignetteDarkness * 0.55, 1.0, vig);

      gl_FragColor = vec4(max(col, 0.0), base.a);
    }
  `,
};

export interface PostProcessingPipeline {
  render: (elapsed: number, atmo: AtmosphereParams, settings: SettingsState) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createPostProcessingPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  isSoftwareGl: boolean
): PostProcessingPipeline {
  if (isSoftwareGl) {
    // Software WebGL bypasses multi-pass post-processing per threejs SKILL.md
    return {
      render() {
        renderer.render(scene, camera);
      },
      resize() {},
      dispose() {},
    };
  }

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.58,
    0.45,
    0.78
  );
  composer.addPass(bloomPass);

  const noirPass = new ShaderPass(NoirFilmShader);
  composer.addPass(noirPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    render(elapsed, atmo, settings) {
      bloomPass.enabled = settings.bloom && settings.quality !== 'balanced';
      bloomPass.strength = THREE.MathUtils.lerp(0.45, 0.85, atmo.neonIntensity / 3.1);

      noirPass.uniforms.uTime.value = elapsed;
      noirPass.uniforms.uGrainIntensity.value = settings.filmGrain ? 0.042 : 0.0;
      noirPass.uniforms.uGodRayStrength.value = atmo.godRayStrength;
      noirPass.uniforms.uWarmTint.value.setHex(atmo.sunColorHex);

      composer.render();
    },
    resize(width, height) {
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
    },
    dispose() {
      composer.dispose();
    },
  };
}
