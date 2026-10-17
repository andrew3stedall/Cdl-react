import { useEffect, useRef, useState } from 'react';
import { teamCrestAsset, type TeamCrestTeam } from './TeamCrest';

const vertexShader = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragmentShader = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uLogoSize;
uniform float uTime;
uniform vec3 uAccent;
uniform sampler2D uLogo;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float t = uTime * 0.36;
  vec2 centered = vUv - 0.5;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 scene = vec2(centered.x * aspect, centered.y);
  float radius = length(scene);
  float halo = exp(-radius * 3.2) * (0.18 + 0.1 * sin(t * 2.0));
  float ring = exp(-abs(radius - (0.30 + 0.018 * sin(t))) * 85.0) * 0.22;
  float outerRing = exp(-abs(radius - (0.41 - 0.018 * cos(t * 0.8))) * 45.0) * 0.11;
  vec3 bg = vec3(0.025, 0.043, 0.067) + uAccent * (halo + ring + outerRing);
  vec2 logoScale = vec2(0.34, 0.34);
  float logoAspect = uLogoSize.x / max(uLogoSize.y, 1.0);
  if (logoAspect > aspect) logoScale.y = logoScale.x * aspect / logoAspect;
  else logoScale.x = logoScale.y * logoAspect / aspect;
  vec2 logoUv = (centered / logoScale) + 0.5;
  vec2 wobble = vec2(sin(vUv.y * 16.0 + t * 1.3), cos(vUv.x * 14.0 - t)) * 0.0025;
  vec4 logo = vec4(0.0);
  if (logoUv.x >= 0.0 && logoUv.x <= 1.0 && logoUv.y >= 0.0 && logoUv.y <= 1.0) {
    logo = texture2D(uLogo, clamp(logoUv + wobble, 0.002, 0.998));
  }
  float edge = texture2D(uLogo, clamp(logoUv + vec2(0.012, 0.0), 0.0, 1.0)).a;
  float glow = max(0.0, edge - logo.a) * 0.7;
  vec3 color = mix(bg, uAccent * 0.9, glow);
  color = mix(color, logo.rgb, logo.a);
  vec2 cell = floor(vUv * vec2(37.0, 23.0));
  float star = step(0.997, hash(cell));
  float pulse = 0.35 + 0.65 * sin(t * 2.8 + hash(cell) * 6.28);
  color += uAccent * star * pulse * 0.55;
  float vignette = 1.0 - smoothstep(0.12, 0.85, radius);
  color *= 0.74 + vignette * 0.26;
  gl_FragColor = vec4(color, 1.0);
}`;

export function WebGLTeamCrest({ team, accent, className = '' }: { team: TeamCrestTeam; accent: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const asset = teamCrestAsset(team);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !asset) return undefined;
    setReady(false);
    if (!('WebGLRenderingContext' in window)) return undefined;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return undefined;
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return undefined;

    const vertices = gl.createBuffer();
    if (!vertices) return undefined;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    if (!texture) return undefined;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const accentRgb = hexToRgb(accent);
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'uResolution'),
      logoSize: gl.getUniformLocation(program, 'uLogoSize'),
      time: gl.getUniformLocation(program, 'uTime'),
      accent: gl.getUniformLocation(program, 'uAccent'),
      logo: gl.getUniformLocation(program, 'uLogo'),
    };
    gl.uniform1i(uniforms.logo, 0);
    gl.uniform3f(uniforms.accent, accentRgb[0], accentRgb[1], accentRgb[2]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform2f(uniforms.logoSize, image.naturalWidth, image.naturalHeight);
      setReady(true);
    };
    image.onerror = () => setReady(false);
    image.src = `/team-crests/${asset}-${document.documentElement.dataset.themeMode === 'dark' ? 'light' : 'dark'}.svg`;

    let frame = 0;
    let startTime = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width && height) {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        const pixelWidth = Math.round(width * ratio);
        const pixelHeight = Math.round(height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }
        gl.viewport(0, 0, pixelWidth, pixelHeight);
        gl.uniform2f(uniforms.resolution, pixelWidth, pixelHeight);
        gl.uniform1f(uniforms.time, reducedMotion ? 0 : (timestamp - startTime) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      image.onload = null;
      image.onerror = null;
      gl.deleteTexture(texture);
      gl.deleteBuffer(vertices);
      gl.deleteProgram(program);
    };
  }, [accent, asset]);

  const fallbackSrc = asset ? `/team-crests/${asset}-${document.documentElement.dataset.themeMode === 'dark' ? 'light' : 'dark'}.svg` : undefined;
  return <div aria-hidden="true" className={`webgl-team-crest ${className}`} data-ready={ready}>
    {fallbackSrc ? <img alt="" className="webgl-team-crest__fallback" src={fallbackSrc} /> : null}
    <canvas className="webgl-team-crest__canvas" ref={canvasRef} />
  </div>;
}

function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram | null {
  const vertexObject = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fragmentObject = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vertexObject || !fragmentObject) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexObject);
  gl.attachShader(program, fragmentObject);
  gl.linkProgram(program);
  gl.deleteShader(vertexObject);
  gl.deleteShader(fragmentObject);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}
