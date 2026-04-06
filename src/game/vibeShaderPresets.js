import * as THREE from 'three';

const PRESETS = [
  {
    id: 'default',
    label: 'Default',
    description: 'The original look with the game’s native lighting, fog, and color balance.'
  },
  {
    id: 'borderlands',
    label: 'Borderlands-ish',
    description: 'Comic-book ink edges, crunchy posterized shading, and warmer hero colors.'
  },
  {
    id: 'neon-noir',
    label: 'Neon Noir',
    description: 'Cyan and magenta club energy with moody contrast and a little chromatic split.'
  },
  {
    id: 'retro-arcade',
    label: 'Retro Arcade',
    description: 'Chunky pixelation, a tighter palette, and CRT-style scanlines.'
  },
  {
    id: 'dreamwave',
    label: 'Dreamwave',
    description: 'Synthy sunset tones with gentle screen warping and a glossy haze.'
  },
  {
    id: 'surveillance',
    label: 'Surveillance',
    description: 'Cold blue security-cam vibes with scanlines, noise, and a harsher vignette.'
  }
].map((preset, index) => ({ ...preset, index }));

export const VIBE_SHADER_PRESETS = PRESETS;
export const DEFAULT_VIBE_SHADER_PRESET_ID = PRESETS[0].id;

export function getVibeShaderPreset(presetId) {
  return PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[0];
}

export function createVibeShaderDefinition() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uPreset: { value: 0 }
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
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uPreset;

      varying vec2 vUv;

      float luma(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      vec3 posterizeColor(vec3 color, float steps) {
        return floor(color * steps + 0.5) / max(steps, 1.0);
      }

      vec3 saturateColor(vec3 color, float amount) {
        float grey = luma(color);
        return mix(vec3(grey), color, amount);
      }

      float grain(vec2 uv) {
        return fract(sin(dot(uv + uTime * 0.013, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float screenVignette(vec2 uv, float strength) {
        vec2 centered = uv * 2.0 - 1.0;
        float radius = dot(centered, centered);
        return clamp(1.0 - radius * strength, 0.0, 1.0);
      }

      float scanline(vec2 uv, float density, float amount) {
        return 1.0 - amount * (0.5 + 0.5 * sin(uv.y * uResolution.y * density));
      }

      float sobelEdge(vec2 uv, vec2 texel) {
        float tl = luma(texture2D(tDiffuse, uv + texel * vec2(-1.0, -1.0)).rgb);
        float tc = luma(texture2D(tDiffuse, uv + texel * vec2(0.0, -1.0)).rgb);
        float tr = luma(texture2D(tDiffuse, uv + texel * vec2(1.0, -1.0)).rgb);
        float ml = luma(texture2D(tDiffuse, uv + texel * vec2(-1.0, 0.0)).rgb);
        float mr = luma(texture2D(tDiffuse, uv + texel * vec2(1.0, 0.0)).rgb);
        float bl = luma(texture2D(tDiffuse, uv + texel * vec2(-1.0, 1.0)).rgb);
        float bc = luma(texture2D(tDiffuse, uv + texel * vec2(0.0, 1.0)).rgb);
        float br = luma(texture2D(tDiffuse, uv + texel * vec2(1.0, 1.0)).rgb);

        float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
        float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
        return clamp(sqrt((gx * gx) + (gy * gy)), 0.0, 1.0);
      }

      vec3 applyBorderlands(vec2 uv, vec2 texel, vec3 baseColor) {
        float edge = sobelEdge(uv, texel * 1.15);
        float lightBands = smoothstep(0.0, 1.0, luma(baseColor));
        vec3 stylized = saturateColor(baseColor * vec3(1.08, 1.03, 0.94), 1.28);
        stylized = posterizeColor(stylized, 4.0);
        stylized *= mix(vec3(0.72, 0.62, 0.46), vec3(1.0), lightBands);

        float hatch = 0.5 + 0.5 * sin((uv.x + uv.y) * uResolution.y * 0.04);
        stylized *= 1.0 - ((1.0 - lightBands) * hatch * 0.07);
        return mix(stylized, vec3(0.035, 0.026, 0.02), smoothstep(0.12, 0.3, edge));
      }

      vec3 applyNeonNoir(vec2 uv, vec2 texel) {
        vec2 offset = texel * 1.5;
        vec3 aberration = vec3(
          texture2D(tDiffuse, clamp(uv + offset * vec2(1.0, 0.0), 0.0, 1.0)).r,
          texture2D(tDiffuse, uv).g,
          texture2D(tDiffuse, clamp(uv - offset * vec2(1.0, 0.0), 0.0, 1.0)).b
        );
        float value = luma(aberration);
        vec3 shadows = vec3(0.03, 0.02, 0.08);
        vec3 highlights = mix(vec3(0.05, 0.92, 0.84), vec3(1.0, 0.17, 0.62), smoothstep(0.48, 1.0, value));
        vec3 neon = mix(shadows, highlights, smoothstep(0.08, 0.92, value));
        neon = mix(neon, aberration * vec3(1.18, 0.66, 1.36), 0.22);
        neon *= scanline(uv, 1.12, 0.08);
        neon *= screenVignette(uv, 0.24);
        return neon;
      }

      vec3 applyRetroArcade(vec2 uv, vec2 resolution) {
        vec2 pixelSize = vec2(4.0);
        vec2 grid = max(resolution / pixelSize, vec2(1.0));
        vec2 pixelUv = (floor(uv * grid) + 0.5) / grid;
        vec3 pixelated = texture2D(tDiffuse, clamp(pixelUv, 0.0, 1.0)).rgb;
        pixelated = posterizeColor(pixelated, 3.5);
        pixelated = saturateColor(pixelated * vec3(1.06, 1.1, 0.9), 1.16);
        pixelated *= scanline(uv, 0.72, 0.14);
        pixelated *= screenVignette(uv, 0.2);
        return pixelated;
      }

      vec3 applyDreamwave(vec2 uv) {
        vec2 warpedUv = uv + vec2(
          sin((uv.y * 18.0) + (uTime * 0.85)),
          cos((uv.x * 15.0) - (uTime * 0.7))
        ) * 0.0045;
        vec3 warped = texture2D(tDiffuse, clamp(warpedUv, 0.0, 1.0)).rgb;
        vec3 gradient = mix(
          vec3(0.12, 0.68, 0.98),
          vec3(1.0, 0.35, 0.62),
          smoothstep(0.0, 1.0, uv.y)
        );
        vec3 glow = mix(warped, warped * gradient * 1.35, 0.64);
        glow = saturateColor(glow, 1.26);
        glow += 0.03 * sin(vec3(0.0, 1.7, 3.1) + (uTime * 0.6) + (uv.xyx * 9.0));
        glow *= screenVignette(uv, 0.18);
        return glow;
      }

      vec3 applySurveillance(vec2 uv, vec2 texel, vec3 baseColor) {
        float grey = luma(baseColor);
        float edge = sobelEdge(uv, texel * 0.9);
        vec3 cold = vec3(grey * 0.25, grey * 0.64, grey * 0.82);
        cold = mix(cold, vec3(0.92), edge * 0.22);
        cold *= scanline(uv, 0.94, 0.16);
        cold *= screenVignette(uv, 0.32);
        cold += (grain(uv * vec2(1.0, 1.7)) - 0.5) * 0.06;
        return cold;
      }

      void main() {
        vec2 resolution = max(uResolution, vec2(1.0));
        vec2 texel = 1.0 / resolution;
        vec2 uv = clamp(vUv, 0.0, 1.0);
        vec3 baseColor = texture2D(tDiffuse, uv).rgb;
        vec3 color = baseColor;

        if (uPreset < 0.5) {
          color = baseColor;
        } else if (uPreset < 1.5) {
          color = applyBorderlands(uv, texel, baseColor);
        } else if (uPreset < 2.5) {
          color = applyNeonNoir(uv, texel);
        } else if (uPreset < 3.5) {
          color = applyRetroArcade(uv, resolution);
        } else if (uPreset < 4.5) {
          color = applyDreamwave(uv);
        } else {
          color = applySurveillance(uv, texel, baseColor);
        }

        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `
  };
}
