// Everything alive that isn't you: Swomee-Swans, butterflies, Bar-ba-loots, and the one on the ridge.
import * as THREE from 'three';
import { groundHeight, lerp, rand, FOREST_RADIUS } from './world.js';

// ---------------------------------------------------------------- Swomee-Swans

export function createSwans(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: '#ff9d2e', side: THREE.DoubleSide });
  const bodyGeo = new THREE.SphereGeometry(0.4, 8, 6).scale(1, 0.7, 1.8);
  const wingGeo = new THREE.PlaneGeometry(1.5, 0.6).rotateX(-Math.PI / 2).translate(0.75, 0, 0);

  const swans = [];
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat), right = new THREE.Mesh(wingGeo, mat);
    right.scale.x = -1;
    group.add(new THREE.Mesh(bodyGeo, mat), left, right);
    scene.add(group);
    swans.push({
      group, left, right,
      cx: rand(-70, 70), cz: rand(-70, 70), radius: rand(12, 40), height: rand(13, 26),
      angle: rand(0, 6.28), speed: rand(0.25, 0.5) * (i % 2 ? 1 : -1), phase: rand(0, 6.28),
      leaveAt: 0.08 + i * 0.03, // each swan has its own breaking point
    });
  }

  function update(dt, time, ruin) {
    for (const s of swans) {
      if (!s.group.visible) continue;
      if (ruin > s.leaveAt) { // gone for good: spiral up and out of the valley
        s.radius += dt * 14;
        s.height += dt * 4;
        if (s.radius > 320) s.group.visible = false;
      }
      s.angle += s.speed * dt * (30 / Math.max(30, s.radius));
      s.group.position.set(s.cx + Math.cos(s.angle) * s.radius, s.height + Math.sin(time + s.phase), s.cz + Math.sin(s.angle) * s.radius);
      s.group.rotation.y = -s.angle + (s.speed > 0 ? Math.PI : 0);
      const flap = Math.sin(time * 7 + s.phase) * 0.7;
      s.left.rotation.z = flap;
      s.right.rotation.z = -flap;
    }
  }
  return { update, count: () => swans.filter((s) => s.group.visible).length };
}

// ---------------------------------------------------------------- butterflies

export function createButterflies(scene) {
  const colors = ['#fff27a', '#ffffff', '#8fd3ff', '#ffa6d5'];
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.2).translate(0.08, 0, 0);
  const flies = [];
  for (let i = 0; i < 60; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide });
    const group = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat), right = new THREE.Mesh(wingGeo, mat);
    right.scale.x = -1;
    group.add(left, right);
    group.rotation.x = -Math.PI / 2;
    scene.add(group);
    const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 60;
    flies.push({ group, left, right, x: Math.cos(a) * r, z: Math.sin(a) * r, phase: rand(0, 6.28) });
  }

  function update(time, ruin) {
    const alive = Math.floor(flies.length * Math.max(0, 1 - ruin * 2));
    flies.forEach((f, i) => {
      f.group.visible = i < alive;
      if (!f.group.visible) return;
      const x = f.x + Math.sin(time * 0.5 + f.phase) * 3, z = f.z + Math.cos(time * 0.37 + f.phase * 2) * 3;
      f.group.position.set(x, groundHeight(x, z) + 0.9 + Math.sin(time * 2 + f.phase) * 0.4, z);
      const flap = Math.sin(time * 18 + f.phase) * 1.1;
      f.left.rotation.y = flap;
      f.right.rotation.y = -flap;
    });
  }
  return { update };
}

// ---------------------------------------------------------------- Bar-ba-loots

export function createLoots(scene) {
  const fur = new THREE.MeshLambertMaterial({ color: '#8a5a2b' });
  const pale = new THREE.MeshLambertMaterial({ color: '#d9b98a' });
  const dark = new THREE.MeshBasicMaterial({ color: '#1a1410' });
  const ball = new THREE.SphereGeometry(1, 12, 10);

  const part = (mat, sx, sy, sz, x, y, z) => {
    const mesh = new THREE.Mesh(ball, mat);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    return mesh;
  };

  const loots = [];
  for (let i = 0; i < 9; i++) {
    const group = new THREE.Group();
    const head = new THREE.Group();
    head.position.y = 1.05;
    head.add(
      part(fur, 0.32, 0.3, 0.3, 0, 0, 0),
      part(fur, 0.1, 0.1, 0.06, -0.24, 0.24, 0), part(fur, 0.1, 0.1, 0.06, 0.24, 0.24, 0), // ears
      part(pale, 0.15, 0.12, 0.12, 0, -0.06, 0.25),                                         // muzzle
      part(dark, 0.04, 0.05, 0.03, -0.12, 0.07, 0.27), part(dark, 0.04, 0.05, 0.03, 0.12, 0.07, 0.27),
    );
    group.add(part(fur, 0.4, 0.5, 0.36, 0, 0.5, 0), part(pale, 0.27, 0.34, 0.2, 0, 0.47, 0.2), head);
    scene.add(group);

    const a = rand(0, 6.28), r = rand(12, 45);
    const loot = { group, head, x: Math.cos(a) * r, z: Math.sin(a) * r, tx: 0, tz: 0, wait: 0, phase: rand(0, 6.28) };
    loot.tx = loot.x; loot.tz = loot.z;
    loots.push(loot);
  }

  const place = (loot, hop) => loot.group.position.set(loot.x, groundHeight(loot.x, loot.z) + hop, loot.z);

  // Normal life: potter about and hop. Once things go bad: stand still and watch you.
  function update(dt, time, ruin, player) {
    for (const loot of loots) {
      if (!loot.group.visible) continue;
      if (ruin > 0.3) {
        loot.group.rotation.y = Math.atan2(player.x - loot.x, player.z - loot.z);
        place(loot, 0);
        continue;
      }
      const dx = loot.tx - loot.x, dz = loot.tz - loot.z, d = Math.hypot(dx, dz);
      if (d < 0.3) {
        loot.wait -= dt;
        if (loot.wait <= 0) {
          loot.tx = loot.x + rand(-10, 10); loot.tz = loot.z + rand(-10, 10);
          if (Math.hypot(loot.tx, loot.tz) > FOREST_RADIUS - 20) { loot.tx = 0; loot.tz = 0; }
          loot.wait = rand(1, 5);
        }
        place(loot, 0);
      } else {
        loot.x += (dx / d) * 1.6 * dt; loot.z += (dz / d) * 1.6 * dt;
        loot.group.rotation.y = Math.atan2(dx, dz);
        place(loot, Math.abs(Math.sin(time * 9 + loot.phase)) * 0.22);
      }
    }
  }

  // The relocation march: single file, heads down, heading for the ridge. t = seconds into the cutscene.
  function march(t, startX) {
    loots.forEach((loot, i) => {
      loot.x = startX + t * 1.5 - i * 2.4;
      loot.z = Math.sin(loot.x * 0.06) * 3;
      place(loot, Math.abs(Math.sin(t * 3 + i)) * 0.04);
      loot.group.rotation.y = Math.PI / 2;
      loot.head.rotation.x = 0.55;
    });
  }

  const remove = () => loots.forEach((loot) => { loot.group.visible = false; });
  return { update, march, remove, visibleCount: () => loots.filter((loot) => loot.group.visible).length };
}

// ---------------------------------------------------------------- the watcher

// He never does anything. He stands where you can see him, and he is a little closer every time you look away.
export function createWatcher(scene) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: '#d9731a' });
  const hairMat = new THREE.MeshLambertMaterial({ color: '#f2d13a' });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  const BODY = [new THREE.Color('#d9731a'), new THREE.Color('#1c120c')];

  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.7, 6, 12), bodyMat);
  body.position.y = 0.8;
  group.add(body);
  for (const side of [-1, 1]) {
    const tash = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 8), hairMat);
    tash.position.set(side * 0.42, 0.85, 0.36);
    tash.rotation.z = side * -2.0; // droops out and down
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), hairMat);
    brow.position.set(side * 0.19, 1.3, 0.4);
    brow.rotation.z = side * -0.45; // permanently furious
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat);
    eye.position.set(side * 0.17, 1.17, 0.42);
    group.add(tash, brow, eye);
  }
  group.visible = false;
  scene.add(group);

  let active = false, moveTimer = 0, frozen = false;
  const toWatcher = new THREE.Vector3();

  function placeAt(x, z, lookX, lookZ, scale) {
    group.position.set(x, groundHeight(x, z), z);
    group.rotation.y = Math.atan2(lookX - x, lookZ - z);
    group.scale.setScalar(scale);
  }

  function reposition(player, viewDir, ruin) {
    const distance = lerp(135, 20, ruin);
    // Just outside the edge of your vision, so a small turn of the head finds him.
    const yaw = Math.atan2(viewDir.x, viewDir.z) + (Math.random() < 0.5 ? -1 : 1) * rand(0.9, 1.4);
    const x = player.x + Math.sin(yaw) * distance, z = player.z + Math.cos(yaw) * distance;
    placeAt(x, z, player.x, player.z, 1 + distance / 35); // bigger when far, so the silhouette always reads
  }

  function update(dt, player, viewDir, ruin) {
    if (!active || frozen) return;
    bodyMat.color.lerpColors(BODY[0], BODY[1], ruin);
    group.rotation.y = Math.atan2(player.x - group.position.x, player.z - group.position.z);

    toWatcher.set(group.position.x - player.x, 0, group.position.z - player.z).normalize();
    const watched = toWatcher.dot(viewDir) > 0.55;
    moveTimer -= dt;
    if (!watched && moveTimer <= 0) { // only ever moves while you aren't looking
      reposition(player, viewDir, ruin);
      moveTimer = rand(5, 11);
    }
  }

  return {
    update, group,
    appear(player, viewDir) { active = true; group.visible = true; reposition(player, viewDir, 0); moveTimer = 8; },
    isActive: () => active,
    // Cutscenes pin him somewhere specific.
    pin(x, z, lookX, lookZ, scale) { frozen = true; group.visible = true; placeAt(x, z, lookX, lookZ, scale); },
    release() { frozen = false; moveTimer = 0; },
  };
}
