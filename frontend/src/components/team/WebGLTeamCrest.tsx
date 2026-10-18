import { useEffect, useRef, useState } from 'react';
import { teamCrestAsset, type TeamCrestTeam } from './TeamCrest';

const bgVertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
const bgFragment = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uAccent;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float t = uTime * 0.36;
  vec2 c = vUv - 0.5;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float radius = length(vec2(c.x * aspect, c.y));
  float halo = exp(-radius * 3.2) * (0.18 + 0.1 * sin(t * 2.0));
  float ring = exp(-abs(radius - (0.30 + 0.018 * sin(t))) * 85.0) * 0.22;
  float outerRing = exp(-abs(radius - (0.41 - 0.018 * cos(t * 0.8))) * 45.0) * 0.11;
  vec3 color = vec3(0.025, 0.043, 0.067) + uAccent * (halo + ring + outerRing);
  vec2 cell = floor(vUv * vec2(37.0, 23.0));
  color += uAccent * step(0.997, hash(cell)) * (0.35 + 0.65 * sin(t * 2.8 + hash(cell) * 6.28)) * 0.55;
  color *= 0.74 + (1.0 - smoothstep(0.12, 0.85, radius)) * 0.26;
  gl_FragColor = vec4(color, 1.0);
}`;
const logoVertex = `
attribute vec3 aPosition;
attribute vec2 aUv;
uniform vec2 uRotation;
varying vec2 vUv;
varying float vLight;
void main() {
  float cy = cos(uRotation.y), sy = sin(uRotation.y);
  float cx = cos(uRotation.x), sx = sin(uRotation.x);
  vec3 p = vec3(aPosition.x * cy + aPosition.z * sy, aPosition.y, -aPosition.x * sy + aPosition.z * cy);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  float depth = p.z - 2.3;
  float scale = 2.1 / max(1.0, -depth);
  gl_Position = vec4(p.xy * scale, depth * 0.1, 1.0);
  vUv = aUv;
  vLight = 0.55 + 0.45 * abs(cy);
}`;
const logoFragment = `
precision mediump float;
uniform sampler2D uLogo;
uniform vec3 uAccent;
uniform float uSide;
varying vec2 vUv;
varying float vLight;
void main() {
  if (uSide > 0.5) { gl_FragColor = vec4(uAccent * 0.72, 1.0); return; }
  vec4 crest = texture2D(uLogo, vUv);
  if (crest.a < 0.04) discard;
  gl_FragColor = vec4(crest.rgb * vLight + uAccent * 0.08, crest.a);
}`;
const face = new Float32Array([
  -0.68,-0.68,0.055,0,1, 0.68,-0.68,0.055,1,1, 0.68,0.68,0.055,1,0,
  -0.68,-0.68,0.055,0,1, 0.68,0.68,0.055,1,0, -0.68,0.68,0.055,0,0,
  -0.68,-0.68,-0.055,0,1, 0.68,0.68,-0.055,1,0, 0.68,-0.68,-0.055,1,1,
  -0.68,-0.68,-0.055,0,1, -0.68,0.68,-0.055,0,0, 0.68,0.68,-0.055,1,0,
]);
const sides = new Float32Array([
  -0.68,-0.68,-0.055,0,0,-0.68,-0.68,0.055,1,0,0.68,-0.68,0.055,1,1,
  -0.68,-0.68,-0.055,0,0,0.68,-0.68,0.055,1,1,0.68,-0.68,-0.055,0,1,
  0.68,-0.68,-0.055,0,0,0.68,-0.68,0.055,1,0,0.68,0.68,0.055,1,1,
  0.68,-0.68,-0.055,0,0,0.68,0.68,0.055,1,1,0.68,0.68,-0.055,0,1,
  0.68,0.68,-0.055,0,0,0.68,0.68,0.055,1,0,-0.68,0.68,0.055,1,1,
  0.68,0.68,-0.055,0,0,-0.68,0.68,0.055,1,1,-0.68,0.68,-0.055,0,1,
  -0.68,0.68,-0.055,0,0,-0.68,0.68,0.055,1,0,-0.68,-0.68,0.055,1,1,
  -0.68,0.68,-0.055,0,0,-0.68,-0.68,0.055,1,1,-0.68,-0.68,-0.055,0,1,
]);

export function WebGLTeamCrest({ team, accent, className = '' }: { team: TeamCrestTeam; accent: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const asset = teamCrestAsset(team);
  const src = asset ? `/team-crests/${asset}-${document.documentElement.dataset.themeMode === 'dark' ? 'light' : 'dark'}.svg` : undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src || !('WebGLRenderingContext' in window)) return undefined;
    readyRef.current = false;
    setReady(false);
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power' });
    if (!gl) return undefined;
    const bg = createProgram(gl, bgVertex, bgFragment);
    const logo = createProgram(gl, logoVertex, logoFragment);
    const bgBuffer = gl.createBuffer(), faceBuffer = gl.createBuffer(), sideBuffer = gl.createBuffer(), texture = gl.createTexture();
    if (!bg || !logo || !bgBuffer || !faceBuffer || !sideBuffer || !texture) return undefined;

    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, faceBuffer); gl.bufferData(gl.ARRAY_BUFFER, face, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, sideBuffer); gl.bufferData(gl.ARRAY_BUFFER, sides, gl.STATIC_DRAW);
    const rgb = hexToRgb(accent);
    const bgPos = gl.getAttribLocation(bg, 'aPosition');
    const bgRes = gl.getUniformLocation(bg, 'uResolution'), bgTime = gl.getUniformLocation(bg, 'uTime'), bgAccent = gl.getUniformLocation(bg, 'uAccent');
    const logoPos = gl.getAttribLocation(logo, 'aPosition'), logoUv = gl.getAttribLocation(logo, 'aUv');
    const rotation = gl.getUniformLocation(logo, 'uRotation'), sampler = gl.getUniformLocation(logo, 'uLogo');
    const logoAccent = gl.getUniformLocation(logo, 'uAccent'), sideMode = gl.getUniformLocation(logo, 'uSide');
    gl.useProgram(bg); gl.uniform3f(bgAccent, rgb[0], rgb[1], rgb[2]);
    gl.useProgram(logo); gl.uniform1i(sampler, 0); gl.uniform3f(logoAccent, rgb[0], rgb[1], rgb[2]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const bitmap = document.createElement('canvas'); bitmap.width = 512; bitmap.height = 512;
      const ctx = bitmap.getContext('2d');
      if (!ctx) return;
      const s = Math.min(450 / image.naturalWidth, 450 / image.naturalHeight);
      const w = image.naturalWidth * s, h = image.naturalHeight * s;
      ctx.drawImage(image, (512 - w) / 2, (512 - h) / 2, w, h);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      readyRef.current = true; setReady(true);
    };
    image.src = src;

    let frame = 0, start = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bindMesh = (buffer: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(logoPos); gl.enableVertexAttribArray(logoUv);
      gl.vertexAttribPointer(logoPos, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(logoUv, 2, gl.FLOAT, false, 20, 12);
    };
    const draw = (now: number) => {
      if (!start) start = now;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h) {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5), pw = Math.round(w * ratio), ph = Math.round(h * ratio);
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
        gl.viewport(0, 0, pw, ph);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(bg); gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
        gl.enableVertexAttribArray(bgPos); gl.vertexAttribPointer(bgPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(bgRes, pw, ph); gl.uniform1f(bgTime, reduced ? 0 : (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (readyRef.current) {
          const t = reduced ? 0 : (now - start) / 1000;
          gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
          gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.useProgram(logo); gl.uniform2f(rotation, 0.12 + Math.sin(t * 0.7) * 0.1, t * 0.72);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.uniform1f(sideMode, 1); bindMesh(sideBuffer); gl.drawArrays(gl.TRIANGLES, 0, 24);
          gl.uniform1f(sideMode, 0); bindMesh(faceBuffer); gl.drawArrays(gl.TRIANGLES, 0, 12);
          gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
        }
      }
      if (!reduced) frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame); image.onload = null;
      gl.deleteTexture(texture); gl.deleteBuffer(bgBuffer); gl.deleteBuffer(faceBuffer); gl.deleteBuffer(sideBuffer);
      gl.deleteProgram(bg); gl.deleteProgram(logo);
    };
  }, [accent, src]);

  return <div aria-hidden="true" className={`webgl-team-crest ${className}`} data-ready={ready}>
    {src ? <img alt="" className="webgl-team-crest__fallback" src={src} /> : null}
    <canvas className="webgl-team-crest__canvas" ref={canvasRef} />
  </div>;
}
function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertex), fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  return program;
}
function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type); if (!shader) return null;
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
  return shader;
}
function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}
