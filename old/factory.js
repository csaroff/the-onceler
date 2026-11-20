// The business. Tufts become Thneeds, Thneeds become money, money becomes machines that make it all go faster.
import * as THREE from 'three';
import { toon, inked, pipe, ball } from './toon.js';
import { groundHeight, fellTree, rand, HOME } from './world.js';

export const THNEED_PRICE = 3.98;
export const BLUEPRINTS = {
  factory: { key: '1', name: 'Thneed Factory', base: 40, blurb: 'knits tufts into Thneeds, fast' },
  wagon: { key: '2', name: 'Thneed Wagon', base: 60, blurb: 'ships Thneeds forth, ten at a time' },
  hacker: { key: '3', name: 'Super-Axe-Hacker', base: 120, blurb: 'whacks four trees at one smacker' },
};
const WAGON_LOAD = 10, SHIP_DISTANCE = 118, HACKER_REACH = 11;

const purple = toon('#8e5bd6'), pink = toon('#ff5fa2'), red = toon('#f0483e'), cream = toon('#fff3c9');
const yellow = toon('#ffd23c'), teal = toon('#2fb7a6'), steel = toon('#c9d6da'), soot = toon('#4a4347');
const wheelGeo = new THREE.TorusGeometry(0.5, 0.14, 7, 14).rotateY(Math.PI / 2);
const smokeGeo = new THREE.SphereGeometry(0.5, 8, 6);

function signTexture(lines) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff3c9';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#17110d';
  g.textAlign = 'center';
  g.font = 'bold 50px Georgia';
  g.fillText(lines[0], 128, 56);
  g.font = 'bold 42px Georgia';
  g.fillText(lines[1], 128, 108);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Nothing here is square or stands up straight. Lathe profiles run bottom to top.
function buildModel(type) {
  const group = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0, ink = 0.05) => {
    const mesh = inked(geo, mat, ink);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const blob = (mat, sx, sy, sz, x, y, z) => add(ball, mat, x, y, z, 0.04).scale.set(sx, sy, sz);
  const wheels = (halfWidth, front, back, size = 1) => {
    for (const x of [-halfWidth, halfWidth]) for (const z of [front, back]) add(wheelGeo, yellow, x, 0.55 * size, z).scale.setScalar(size);
  };
  const lathe = (profile) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 18);

  if (type === 'cart') {
    // Your wagon: where the first Thneed gets knitted and sold.
    blob(purple, 1.5, 0.9, 2.1, 0, 1.5, 0);
    wheels(1.45, 1.2, -1.2);
    add(lathe([[0, 2.2], [1.9, 2.2], [1.7, 2.5], [0.5, 3.5], [0, 3.9]]), red, 0, 0, 0).rotation.z = 0.12; // lopsided roof
    add(pipe([[0.8, 2.4, -1], [1.1, 3.4, -1.2], [0.8, 4.2, -1.1], [1.1, 4.9, -1.3]], 0.16), soot);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: signTexture(['THNEEDS', '$3.98']) }));
    sign.position.set(0, 1.6, 2.13);
    sign.rotation.z = -0.06;
    group.add(sign);
  } else if (type === 'factory') {
    const lean = new THREE.Group();
    lean.rotation.z = 0.07;
    group.add(lean);
    const tower = inked(lathe([[0, 0], [3, 0], [3.3, 1], [2.4, 3.6], [2.9, 5.2], [1.7, 7.4], [0, 7.4]]), purple, 0.06);
    const roof = inked(lathe([[0, 7.2], [2.0, 7.2], [2.3, 7.6], [1.3, 8.6], [0.5, 9.6], [0, 10.4]]), red, 0.06);
    roof.rotation.z = -0.16;
    const brim = inked(new THREE.TorusGeometry(2.1, 0.22, 7, 18).rotateX(Math.PI / 2), cream, 0.05);
    brim.position.y = 7.4;
    lean.add(tower, roof, brim);
    // Chimneys that can't decide which way is up.
    add(pipe([[2.2, 4.4, 0], [3.6, 5.2, 0.3], [3.4, 7, -0.2], [4.1, 8.6, 0.2], [3.8, 10, 0]], 0.34), soot);
    add(pipe([[-2, 5, 0.5], [-3.2, 6, 0.8], [-2.8, 7.6, 0.4], [-3.3, 8.8, 0.7]], 0.26), soot);
    blob(yellow, 0.5, 0.7, 0.2, 0.9, 4.6, 2.35);
    blob(yellow, 0.4, 0.55, 0.2, -1.1, 2.6, 2.75);
    blob(soot, 0.8, 1.2, 0.2, 0.2, 0.9, 3.1); // door
    // A Thneed, mid-knit, hung out the front.
    add(new THREE.TorusKnotGeometry(0.6, 0.2, 60, 8), pink, -0.2, 6.2, 2.4, 0.04);
    group.userData.chimney = new THREE.Vector3(3.8, 10.2, 0);
  } else if (type === 'wagon') {
    add(lathe([[0, 0.7], [1.0, 0.8], [1.5, 1.5], [1.6, 2.0], [1.45, 2.05], [0, 1.2]]), teal).scale.set(1, 1, 1.5);
    wheels(1.35, 1.3, -1.3);
    const load = inked(ball, pink, 0.04); // the Thneeds
    load.scale.set(1.2, 0.8, 1.9);
    load.position.y = 2.1;
    group.add(load);
    group.userData.load = load;
    add(pipe([[0, 1.9, 2.1], [0, 2.9, 2.5], [0.3, 3.5, 2.3]], 0.1), soot);
  } else if (type === 'hacker') {
    blob(red, 1.3, 1.0, 2.0, 0, 1.6, 0);
    wheels(1.35, 1.3, -1.3, 1.3);
    add(pipe([[0, 2.3, -0.4], [0.2, 3.6, -0.5], [-0.1, 4.8, -0.3], [0, 5.6, -0.4]], 0.22), soot);
    add(pipe([[-0.6, 2.2, -1.5], [-0.9, 3.2, -1.9], [-0.6, 3.9, -2.2]], 0.13), soot);
    const arms = new THREE.Group();
    arms.position.set(0, 5.6, -0.4);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      arm.add(inked(pipe([[0, 0, 0], [1.3, 0.7, 0], [2.4, 0.5, 0], [3.2, -0.3, 0]], 0.1), yellow, 0.04));
      const blade = inked(ball, steel, 0.05);
      blade.scale.set(0.2, 0.75, 0.55);
      blade.position.set(3.3, -0.8, 0);
      arm.add(blade);
      arms.add(arm);
    }
    group.add(arms);
    group.userData.arms = arms;
    group.userData.chimney = new THREE.Vector3(-0.6, 4, -2.2);
  }
  return group;
}

export function createFactory(scene, trees, stock, hooks) {
  const machines = [];
  const owned = { factory: 0, wagon: 0, hacker: 0 };
  let knitTimer = 0, sellTimer = 0, shipments = 0;

  const cart = buildModel('cart');
  cart.position.set(HOME.x, groundHeight(HOME.x, HOME.z), HOME.z);
  cart.rotation.y = -0.6;
  scene.add(cart);

  const ghosts = {};
  for (const type of Object.keys(BLUEPRINTS)) { ghosts[type] = buildModel(type); ghosts[type].visible = false; scene.add(ghosts[type]); }

  // "I biggered my factory. I biggered my roads." Each one costs more than the last.
  const price = (type) => Math.round(BLUEPRINTS[type].base * 1.5 ** owned[type]);
  const canAfford = (type) => stock.money >= price(type);

  function sell(count) {
    const amount = count * THNEED_PRICE;
    stock.money = Math.round((stock.money + amount) * 100) / 100;
    stock.sold += count;
    hooks.onSale(amount);
  }

  function showGhost(type, x, z) {
    for (const [name, ghost] of Object.entries(ghosts)) ghost.visible = name === type;
    if (type) ghosts[type].position.set(x, groundHeight(x, z), z);
  }

  function makeSmoke(count, size) {
    const smoke = [];
    for (let i = 0; i < count; i++) {
      const puff = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: '#3a3336', transparent: true }));
      scene.add(puff);
      smoke.push({ puff, age: i * (4.2 / count), drift: 0, size });
    }
    return smoke;
  }

  function place(type, x, z) {
    if (!canAfford(type)) return false;
    stock.money = Math.round((stock.money - price(type)) * 100) / 100;
    owned[type]++;
    const model = buildModel(type);
    model.position.set(x, groundHeight(x, z), z);
    scene.add(model);
    const machine = { type, model, x, z, timer: 0, state: 'home', load: 0, tx: 0, tz: 0 };
    if (type === 'factory') machine.smoke = makeSmoke(8, 1.6);
    if (type === 'hacker') { machine.smoke = makeSmoke(5, 0.6); machine.state = 'seek'; }
    if (type === 'wagon') { machine.depot = { x: HOME.x - 6 - owned.wagon * 4, z: HOME.z + 3 }; model.userData.load.visible = false; }
    machines.push(machine);
    return true;
  }

  // Rattle a vehicle toward a point. True once it is within `near` of it.
  function drive(m, tx, tz, speed, dt, near = 0.6) {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    if (d < near) return true;
    const stride = Math.min(d, speed * dt);
    m.x += (dx / d) * stride;
    m.z += (dz / d) * stride;
    m.model.position.set(m.x, groundHeight(m.x, m.z) + Math.abs(Math.sin(m.x + m.z)) * 0.12, m.z);
    m.model.rotation.set(0, Math.atan2(dx, dz), Math.sin((m.x + m.z) * 1.7) * 0.05);
    return false;
  }

  function updateWagon(m, dt) {
    if (m.state === 'home') {
      if (!drive(m, m.depot.x, m.depot.z, 13, dt) || stock.thneeds < 4) return;
      m.load = Math.min(WAGON_LOAD, stock.thneeds);
      stock.thneeds -= m.load;
      // South, East, West, North, in turn.
      const heading = (shipments++ % 4) * (Math.PI / 2) + 0.4;
      m.tx = Math.cos(heading) * SHIP_DISTANCE; m.tz = Math.sin(heading) * SHIP_DISTANCE;
      m.model.userData.load.visible = true;
      m.state = 'out';
    } else if (m.state === 'out' && drive(m, m.tx, m.tz, 13, dt)) {
      sell(m.load);
      m.load = 0;
      m.model.userData.load.visible = false;
      m.state = 'home';
    }
  }

  function updateHacker(m, dt) {
    const arms = m.model.userData.arms;
    const standing = trees.filter((t) => t.state === 'standing');
    const near = (t) => Math.hypot(t.x - m.x, t.z - m.z);
    if (m.state === 'seek') {
      arms.rotation.y += dt * 2;
      if (!standing.length) return;
      const target = standing.reduce((a, b) => (near(a) < near(b) ? a : b));
      if (drive(m, target.x, target.z, 7, dt, 4)) { m.state = 'whack'; m.timer = 0; }
    } else {
      m.timer += dt;
      arms.rotation.y += dt * 22;
      if (m.timer < 0.9) return;
      // Four Truffula Trees at one smacker.
      const victims = standing.filter((t) => near(t) < HACKER_REACH).sort((a, b) => near(a) - near(b)).slice(0, 4);
      for (const tree of victims) { fellTree(tree, m.x, m.z); hooks.onTreeFelled(tree); }
      m.state = 'seek';
    }
  }

  function updateSmoke(m, dt) {
    const chimney = m.model.userData.chimney;
    for (const s of m.smoke) {
      s.age += dt;
      if (s.age > 4.2) { s.age = 0; s.drift = rand(-0.5, 0.5); }
      s.puff.position.set(
        m.model.position.x + chimney.x + s.drift * s.age + s.age * 0.6,
        m.model.position.y + chimney.y + s.age * 2.2 * s.size,
        m.model.position.z + chimney.z);
      s.puff.scale.setScalar((0.6 + s.age * 0.9) * s.size);
      s.puff.material.opacity = 0.8 * (1 - s.age / 4.2);
    }
  }

  function update(dt) {
    // The cart knits and sells by hand: slow, but it is how you start.
    knitTimer += dt;
    if (knitTimer >= 2) { knitTimer = 0; if (stock.tufts >= 1) { stock.tufts--; stock.thneeds++; } }
    sellTimer += dt;
    if (sellTimer >= 3 && stock.thneeds >= 1) { sellTimer = 0; stock.thneeds--; sell(1); }

    for (const m of machines) {
      if (m.type === 'factory') {
        m.timer += dt;
        if (m.timer >= 1) { m.timer = 0; const made = Math.min(2, stock.tufts); stock.tufts -= made; stock.thneeds += made; }
      }
      if (m.type === 'wagon') updateWagon(m, dt);
      if (m.type === 'hacker') updateHacker(m, dt);
      if (m.smoke) updateSmoke(m, dt);
    }
  }

  return { place, update, showGhost, canAfford, price, owned, count: () => machines.length, last: () => machines[machines.length - 1] };
}
