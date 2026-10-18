import { describe, expect, test } from 'vitest';
import { Raycaster, Vector3 } from 'three';
import { createCrestMesh } from './crest-geometry';

const sources = import.meta.glob<string>('../../../public/team-crests/*-{light,mesh}.svg', {
  eager: true, query: '?raw', import: 'default',
});

describe('solid SVG crest geometry', () => {
  test('extrudes the outlines and leaves cutouts open all the way through', () => {
    const crest = createCrestMesh('<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M0 0H100V100H0Z M30 30H70V70H30Z"/></svg>', '#20d6c1');
    expect(crest.shapeCount).toBe(1);
    expect(crest.holeCount).toBe(1);
    crest.mesh.updateMatrixWorld(true);
    const holeRay = new Raycaster(new Vector3(0, 0, 3), new Vector3(0, 0, -1));
    expect(holeRay.intersectObject(crest.mesh)).toHaveLength(0);
    const faceRay = new Raycaster(new Vector3(0.8, 0.8, 3), new Vector3(0, 0, -1));
    expect(faceRay.intersectObject(crest.mesh).length).toBeGreaterThan(0);
    const sideRay = new Raycaster(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
    expect(sideRay.intersectObject(crest.mesh).length).toBeGreaterThan(0);
    crest.dispose();
  });

  const badges = Object.entries(sources).filter(([path]) => !path.endsWith('sporting-lesbians-light.svg'));
  test('covers all eight team badges with vector sources', () => expect(badges).toHaveLength(8));
  test.each(badges)('%s has actual solid path geometry with untextured materials', (_path, svg) => {
    expect(svg).not.toContain('<image');
    const crest = createCrestMesh(svg, '#20d6c1');
    expect(crest.shapeCount).toBeGreaterThan(0);
    expect(crest.vertexCount).toBeGreaterThan(100);
    const bounds = crest.mesh.geometry.boundingBox!;
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.14);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(0.2);
    expect(crest.mesh.geometry.groups.some((group) => group.materialIndex === 1)).toBe(true);
    for (const material of crest.mesh.material) expect(material.map).toBeNull();
    expect(Array.from(crest.mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    crest.dispose();
  });
});
