// The drawing style: flat banded colour with a black ink line round everything, and no straight edges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

// Three flat bands of light instead of a smooth gradient.
const ramp = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });

// The ink line is the same shape drawn again in black, inside out and slightly fattened.
const inkMaterials = new Map();
function inkMaterial(thickness, fog) {
  const key = `${thickness}|${fog}`;
  if (!inkMaterials.has(key)) {
    const mat = new THREE.MeshBasicMaterial({ color: '#17110d', side: THREE.BackSide, fog });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.inkThickness = { value: thickness };
      shader.vertexShader = 'uniform float inkThickness;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * inkThickness;');
    };
    inkMaterials.set(key, mat);
  }
  return inkMaterials.get(key);
}

export function inked(geometry, material, thickness = 0.04) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(new THREE.Mesh(geometry, inkMaterial(thickness, material.fog)));
  return mesh;
}

// A curling, tapering lock: tufts, moustaches, eyebrows, beaks. Base at the origin, tip up +y, curling toward +x.
export function horn(length, radius, bend = 0) {
  const geo = new THREE.ConeGeometry(radius, length, 7, 6).translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / length;
    p.setX(i, p.getX(i) + bend * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

// A bendy pipe through a list of [x, y, z] points.
export function pipe(points, radius, segments = 18) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segments, radius, 7);
}

export const ball = new THREE.SphereGeometry(1, 14, 10);
