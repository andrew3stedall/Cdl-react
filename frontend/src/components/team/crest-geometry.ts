import { Box2, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Vector2 } from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

/** Build the SVG's filled contours, including nested holes, as solid meshes. */
export function createCrestMesh(svg: string, accent: string) {
  const paths = new SVGLoader().parse(svg).paths;
  const shapes = paths.flatMap((path) => path.toShapes());
  if (!shapes.length) throw new Error('The crest has no vector outlines.');
  const bounds = new Box2();
  for (const shape of shapes) {
    for (const point of shape.getPoints(4)) bounds.expandByPoint(point);
  }
  const size = bounds.getSize(new Vector2());
  const extent = Math.max(size.x, size.y);
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('The crest has invalid bounds.');
  const center = bounds.getCenter(new Vector2());
  const depth = extent * 0.075;
  const geometry = new ExtrudeGeometry(shapes, {
    depth, steps: 1, curveSegments: 4,
    bevelEnabled: true, bevelSegments: 1,
    bevelSize: extent * 0.00035,
    bevelThickness: extent * 0.0025,
  });
  geometry.translate(-center.x, -center.y, -depth / 2);
  geometry.scale(2 / extent, 2 / extent, 2 / extent);
  // SVG y points down. A rotation preserves triangle winding and normals.
  geometry.rotateX(Math.PI);
  geometry.computeBoundingBox();
  const face = new MeshStandardMaterial({ color: '#eaf1f4', metalness: 0.3, roughness: 0.32 });
  const edge = new MeshStandardMaterial({ color: accent, metalness: 0.5, roughness: 0.28 });
  const mesh = new Mesh(geometry, [face, edge]);
  const model = new Group();
  model.add(mesh);
  return {
    model, mesh,
    shapeCount: shapes.length,
    holeCount: shapes.reduce((sum, shape) => sum + shape.holes.length, 0),
    vertexCount: geometry.getAttribute('position').count,
    dispose() { geometry.dispose(); face.dispose(); edge.dispose(); },
  };
}
