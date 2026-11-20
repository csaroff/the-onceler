// Art lab: draws one model from src/art on a contact sheet, exactly as the game would draw it.
//   /lab.html?model=barbaloot&views=idle@0/25/8,walk@0.3/90/5&opts={"variant":"crummy"}
// A view is  pose@time/yaw/pitch/zoom  (all but pose optional). tools/shot.mjs saves the sheet as a PNG.
import * as THREE from 'three';
import { createInk } from './ink.js';
import { toon, PALETTE } from './toon.js';

const params = new URLSearchParams(location.search);
const name = params.get('model');
const options = JSON.parse(params.get('opts') || '{}');
const views = (params.get('views') || 'idle@0/25/8,idle@0/90/5,idle@0/205/8,idle@0/0/0/2.2').split(',').map((v) => {
  const [pose, rest = ''] = v.split('@');
  const [t = 0, yaw = 25, pitch = 8, zoom = 1] = rest.split('/').map(Number);
  return { pose, t, yaw, pitch, zoom };
});
const CELL_W = Number(params.get('w') || 480), CELL_H = Number(params.get('h') || 400);
const columns = Math.min(views.length, Number(params.get('cols') || 3)), rows = Math.ceil(views.length / columns);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(CELL_W, CELL_H);
const ink = createInk(renderer);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.add(new THREE.HemisphereLight('#ffffff', '#8fb86a', 1.5));
const sun = new THREE.DirectionalLight('#fff3d6', 1.9);
sun.position.set(80, 120, 40);
scene.add(sun);

const sheet = document.createElement('canvas');
sheet.width = CELL_W * columns; sheet.height = CELL_H * rows;
document.body.append(sheet);
const pen = sheet.getContext('2d');

try {
  const art = await import(`./art/${name}.js`);
  const firstPerson = !!art.FIRST_PERSON;
  const camera = new THREE.PerspectiveCamera(firstPerson ? 70 : 35, CELL_W / CELL_H, 0.05, 2000);
  camera.layers.enable(1);
  scene.add(camera);

  // A patch of lawn with a line every metre, so sizes can be judged.
  const lawn = document.createElement('canvas');
  lawn.width = lawn.height = 64;
  const g = lawn.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0, 60, 0, 0.35)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64);
  const lawnTexture = new THREE.CanvasTexture(lawn);
  lawnTexture.wrapS = lawnTexture.wrapT = THREE.RepeatWrapping;
  lawnTexture.repeat.set(400, 400);
  lawnTexture.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), toon(PALETTE.grass, { map: lawnTexture }));
  scene.add(ground);

  const model = art.build(options);
  if (firstPerson) {
    camera.add(model);
    // Something to look at past the hands.
    for (let i = 0; i < 7; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 8).translate(0, 4, 0), toon(i % 2 ? PALETTE.trunkLight : PALETTE.tufts[i % 5]));
      post.position.set((i - 3) * 5, 0, -9 - (i % 3) * 6);
      scene.add(post);
    }
  } else {
    scene.add(model);
  }

  const box = new THREE.Box3(), center = new THREE.Vector3(), extent = new THREE.Vector3();
  views.forEach((view, i) => {
    if (art.pose) art.pose(model, view.pose, view.t, 1);
    if (firstPerson) {
      camera.position.set(0, 1.7, 0);
      camera.rotation.set(THREE.MathUtils.degToRad(view.pitch - 8), THREE.MathUtils.degToRad(view.yaw - 25), 0);
    } else {
      model.updateMatrixWorld(true);
      box.setFromObject(model).getCenter(center);
      box.getSize(extent);
      const radius = Math.max(extent.x, extent.y, extent.z) * 0.5 + 0.2;
      const distance = (radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15 / view.zoom;
      const yaw = THREE.MathUtils.degToRad(view.yaw), pitch = THREE.MathUtils.degToRad(view.pitch);
      // With zoom, look at the top of the model (usually the face) rather than the middle.
      const aim = center.clone();
      if (view.zoom > 1) aim.y = box.max.y - radius / view.zoom;
      camera.position.set(aim.x + Math.sin(yaw) * Math.cos(pitch) * distance, aim.y + Math.sin(pitch) * distance, aim.z + Math.cos(yaw) * Math.cos(pitch) * distance);
      camera.lookAt(aim);
    }
    camera.updateMatrixWorld(true);
    ink.render(scene, camera, 0, Number(params.get('ruin') || 0));
    const x = (i % columns) * CELL_W, y = Math.floor(i / columns) * CELL_H;
    pen.drawImage(renderer.domElement, x, y, CELL_W, CELL_H);
    pen.font = '15px monospace';
    pen.fillStyle = '#000';
    pen.fillText(`${view.pose} t=${view.t} yaw=${view.yaw}${firstPerson ? '' : `  h=${extent.y.toFixed(2)}m w=${extent.x.toFixed(2)}m`}`, x + 8, y + 18);
  });
  document.title = 'ready';
} catch (error) {
  pen.fillStyle = '#fff';
  pen.font = '16px monospace';
  String(error.stack || error).split('\n').slice(0, 12).forEach((line, i) => pen.fillText(line, 10, 24 + i * 20));
  document.title = `error: ${error.message}`;
}
