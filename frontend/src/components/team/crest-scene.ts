import { DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { createCrestMesh } from './crest-geometry';

export async function createCrestScene(canvas: HTMLCanvasElement, src: string, accent: string, signal: AbortSignal) {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error('Crest could not be loaded.');
  const svg = await response.text();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const crest = createCrestMesh(svg, accent);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) { crest.dispose(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  scene.add(crest.model);
  scene.add(new HemisphereLight('#eafaff', '#19263b', 2.2));
  const key = new DirectionalLight('#ffffff', 3.0);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new DirectionalLight(accent, 4.0);
  rim.position.set(3, -1, -4);
  scene.add(rim);
  const camera = new PerspectiveCamera(36, 1, 0.1, 20);
  camera.position.z = 4.6;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, elapsed = 0, previous = 0, disposed = false;
  const render = () => {
    crest.model.rotation.set(0.12, -0.35 + elapsed * 0.48, 0);
    renderer.render(scene, camera);
  };
  const resize = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = 4.6 / Math.min(camera.aspect, 1);
    camera.updateProjectionMatrix();
    render();
  };
  const animate = (now: number) => {
    if (disposed) return;
    if (previous) elapsed += Math.min((now - previous) / 1000, 0.05);
    previous = now;
    render();
    frame = requestAnimationFrame(animate);
  };
  const updateMotion = () => {
    cancelAnimationFrame(frame);
    previous = 0;
    if (!motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
    else render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  motion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  resize();
  updateMotion();
  canvas.dataset.vertices = String(crest.vertexCount);
  canvas.dataset.shapes = String(crest.shapeCount);
  canvas.dataset.holes = String(crest.holeCount);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    motion.removeEventListener('change', updateMotion);
    document.removeEventListener('visibilitychange', updateMotion);
    crest.dispose(); renderer.dispose();
  };
}
