// Everything alive that isn't you: Swomee-Swans, butterflies, Humming-Fish, Bar-ba-loots, and the Lorax.
import * as THREE from 'three';
import { toon, inked, horn, pipe, ball } from './toon.js';
import { groundHeight, trunkPoint, lerp, rand, FOREST_RADIUS, RIDGE_RADIUS, POND, WATER_Y } from './world.js';

const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const black = new THREE.MeshBasicMaterial({ color: '#17110d' });

// ---------------------------------------------------------------- Swomee-Swans

export function createSwans(scene) {
  const mat = toon('#ff9d2e', { side: THREE.DoubleSide });
  const bodyGeo = new THREE.SphereGeometry(0.4, 10, 8).scale(1, 0.75, 1.8);
  const neckGeo = pipe([[0, 0, 0.5], [0, 0.45, 0.85], [0, 0.95, 0.8], [0, 1.1, 1.05]], 0.09, 10);
  const headGeo = new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.12, 1.1);
  const beakGeo = horn(0.3, 0.08).rotateX(Math.PI / 2).translate(0, 1.1, 1.22);
  const wingGeo = new THREE.PlaneGeometry(1.6, 0.7).rotateX(-Math.PI / 2).translate(0.8, 0, 0);

  const swans = [];
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat), right = new THREE.Mesh(wingGeo, mat);
    right.scale.x = -1;
    group.add(inked(bodyGeo, mat), inked(neckGeo, mat, 0.03), inked(headGeo, mat, 0.03), new THREE.Mesh(beakGeo, black), left, right);
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
      s.group.rotation.y = -s.angle + (s.speed < 0 ? Math.PI : 0);
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

// ---------------------------------------------------------------- Humming-Fish

// They leap out of the pond for the fun of it, until the pond is no fun.
export function createFish(scene) {
  const mat = toon('#ffb52e');
  const bodyGeo = new THREE.SphereGeometry(1, 10, 8).scale(0.14, 0.24, 0.5);
  const tailGeo = horn(0.4, 0.2).scale(0.3, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.75);
  const fishes = [];
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group();
    group.add(inked(bodyGeo, mat, 0.03), inked(tailGeo, mat, 0.03));
    group.rotation.order = 'YXZ';
    group.visible = false;
    scene.add(group);
    fishes.push({ group, t: -rand(0, 6), jumping: false, from: new THREE.Vector2(), to: new THREE.Vector2() });
  }
  const spot = (v) => { const a = rand(0, 6.28), r = rand(0, POND.r * 0.6); v.set(POND.x + Math.cos(a) * r, POND.z + Math.sin(a) * r); };

  function update(dt, ruin) {
    for (const f of fishes) {
      f.t += dt;
      if (f.t < 0) continue;
      if (!f.jumping) {
        if (ruin > 0.35) { f.t = -1e9; continue; }
        spot(f.from); spot(f.to);
        f.jumping = true;
        f.group.visible = true;
        f.group.rotation.y = Math.atan2(f.to.x - f.from.x, f.to.y - f.from.y);
      }
      const p = f.t / 1.1;
      if (p >= 1) { f.jumping = false; f.group.visible = false; f.t = -rand(2, 7); continue; }
      f.group.position.set(lerp(f.from.x, f.to.x, p), WATER_Y + Math.sin(p * Math.PI) * 2.4, lerp(f.from.y, f.to.y, p));
      f.group.rotation.x = -Math.cos(p * Math.PI) * 1.1; // nose up on the way out, down on the way in
    }
  }
  return { update };
}

// ---------------------------------------------------------------- Bar-ba-loots

// They climb the Truffula Trees, sit in the tufts, eat the fruit and play tag. Then they stop.
export function createLoots(scene, trees) {
  const fur = toon('#9a6a35'), pale = toon('#ecd3a2'), fruitMat = toon('#ff4f9a');
  const limbGeo = new THREE.CapsuleGeometry(0.085, 0.26, 3, 8).translate(0, -0.2, 0); // hangs from its joint
  const v = new THREE.Vector3();

  function build() {
    const group = new THREE.Group(), rig = new THREE.Group();
    group.add(rig);
    const blob = (parent, mat, sx, sy, sz, x, y, z, ink = true) => {
      const mesh = ink ? inked(ball, mat, 0.07) : new THREE.Mesh(ball, mat);
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(x, y, z);
      parent.add(mesh);
    };
    const limb = (x, y) => {
      const joint = new THREE.Group();
      joint.position.set(x, y, 0);
      joint.add(inked(limbGeo, fur, 0.03));
      rig.add(joint);
      return joint;
    };
    blob(rig, fur, 0.4, 0.5, 0.36, 0, 0.66, 0);
    blob(rig, pale, 0.27, 0.33, 0.2, 0, 0.62, 0.2, false);

    const head = new THREE.Group();
    head.position.y = 1.24;
    rig.add(head);
    blob(head, fur, 0.33, 0.3, 0.3, 0, 0, 0);
    blob(head, pale, 0.16, 0.12, 0.13, 0, -0.07, 0.25, false);
    blob(head, black, 0.05, 0.04, 0.04, 0, -0.02, 0.37, false);
    for (const side of [-1, 1]) {
      blob(head, fur, 0.11, 0.11, 0.07, side * 0.25, 0.25, 0);
      blob(head, white, 0.075, 0.095, 0.04, side * 0.12, 0.08, 0.26, false);
      blob(head, black, 0.03, 0.04, 0.02, side * 0.12, 0.07, 0.3, false);
    }
    const loot = {
      group, rig, head,
      armL: limb(-0.4, 0.98), armR: limb(0.4, 0.98), legL: limb(-0.17, 0.42), legR: limb(0.17, 0.42),
      x: 0, z: 0, y: 0, vy: 0, state: 'idle', timer: rand(0, 2), phase: rand(0, 6.28), tree: null, other: null, up: 0, face: 0, tx: 0, tz: 0,
    };
    loot.fruit = new THREE.Mesh(ball, fruitMat);
    loot.fruit.scale.setScalar(0.1);
    loot.fruit.position.set(0, -0.44, 0.06);
    loot.armR.add(loot.fruit);
    scene.add(group);
    return loot;
  }

  // Limb angles: negative swings a limb forward, about -2.8 is straight up.
  function pose(l, armL, armR, legL, legR, sitting) {
    l.armL.rotation.x = armL; l.armR.rotation.x = armR;
    l.legL.rotation.x = legL; l.legR.rotation.x = legR;
    l.rig.position.y = sitting ? -0.24 : 0;
  }
  const onGround = (l, hop = 0) => l.group.position.set(l.x, groundHeight(l.x, l.z) + hop, l.z);
  const go = (l, state, timer = 0) => { l.state = state; l.timer = timer; };
  const letGo = (l) => { if (l.tree) l.tree.climber = null; l.tree = null; };

  function walkTo(l, tx, tz, speed, dt, time, near = 0.4) {
    const dx = tx - l.x, dz = tz - l.z, d = Math.hypot(dx, dz);
    if (d < near) return true;
    l.x += (dx / d) * speed * dt;
    l.z += (dz / d) * speed * dt;
    l.group.rotation.set(0, Math.atan2(dx, dz), 0);
    const stride = time * (6 + speed * 1.5) + l.phase, swing = Math.sin(stride) * 0.8;
    pose(l, swing, -swing, -swing, swing, false);
    onGround(l, Math.abs(Math.sin(stride)) * 0.15);
    return false;
  }

  function wanderOff(l, range) {
    l.tx = l.x + rand(-range, range); l.tz = l.z + rand(-range, range);
    if (Math.hypot(l.tx, l.tz) > FOREST_RADIUS - 15) { l.tx = rand(-20, 20); l.tz = rand(-20, 20); }
    go(l, 'wander');
  }

  function chooseNext(l) {
    const roll = Math.random();
    if (roll < 0.45) {
      let best = null, bestD = 35;
      for (const tree of trees) {
        const d = Math.hypot(tree.x - l.x, tree.z - l.z);
        if (tree.state === 'standing' && !tree.climber && d < bestD) { best = tree; bestD = d; }
      }
      if (best) { l.tree = best; best.climber = l; return go(l, 'toTree'); }
    }
    if (roll < 0.65) {
      const other = loots[Math.floor(rand(0, loots.length))];
      if (other !== l && ['idle', 'eat', 'wander'].includes(other.state) && Math.hypot(other.x - l.x, other.z - l.z) < 40) {
        l.other = other;
        wanderOff(other, 20); // it runs, not very fast
        return go(l, 'chase', 8);
      }
    }
    if (roll < 0.8) return go(l, 'eat', rand(3, 6));
    wanderOff(l, 14);
  }

  function hugTrunk(l) {
    trunkPoint(l.tree, l.up, v);
    l.group.position.set(v.x - Math.sin(l.face) * 0.28, Math.max(l.tree.baseY, v.y - 0.66), v.z - Math.cos(l.face) * 0.28);
    l.group.rotation.set(0, l.face, 0);
  }

  const loots = [];
  for (let i = 0; i < 12; i++) {
    const l = build();
    const a = rand(0, 6.28), r = rand(10, 50);
    l.x = Math.cos(a) * r; l.z = Math.sin(a) * r;
    loots.push(l);
  }
  // Half of them start the morning already up a tree.
  loots.slice(0, 6).forEach((l) => {
    const tree = trees.filter((t) => !t.climber && Math.hypot(t.x, t.z) < 55)[0];
    if (!tree) return;
    l.tree = tree; tree.climber = l; l.x = tree.x; l.z = tree.z;
    go(l, 'perch', rand(4, 14));
  });

  function update(dt, time, ruin, player) {
    const sad = ruin > 0.3;
    for (const l of loots) {
      if (!l.group.visible) continue;
      l.fruit.visible = l.state === 'eat';
      l.head.rotation.x = 0;
      if (sad && ['idle', 'wander', 'eat', 'chase', 'toTree'].includes(l.state)) { letGo(l); go(l, 'mope'); }
      // The tree it was in has just been cut down.
      if (['climb', 'perch', 'slide'].includes(l.state) && l.tree.state !== 'standing') {
        l.y = l.group.position.y; l.vy = 2;
        letGo(l);
        go(l, 'fall');
      }

      if (l.state === 'idle') {
        pose(l, 0, 0, 0, 0, false);
        onGround(l);
        l.timer -= dt;
        if (l.timer <= 0) chooseNext(l);
      } else if (l.state === 'wander') {
        if (walkTo(l, l.tx, l.tz, 1.9, dt, time)) go(l, 'idle', rand(0.5, 2));
      } else if (l.state === 'toTree') {
        if (l.tree.state !== 'standing') { letGo(l); go(l, 'idle', 1); }
        else if (walkTo(l, l.tree.x, l.tree.z, 2.8, dt, time, 0.6)) { l.up = 0.08; l.face = rand(0, 6.28); go(l, 'climb'); }
      } else if (l.state === 'climb') {
        l.up += dt * 0.2;
        hugTrunk(l);
        const reach = Math.sin(time * 8 + l.phase) * 0.5;
        pose(l, -2.6 + reach, -2.6 - reach, -0.7 - reach, -0.7 + reach, false);
        if (l.up >= 0.9) go(l, 'perch', rand(5, 10));
      } else if (l.state === 'perch') {
        // Sitting on top of the tuft, waving and looking about.
        l.group.position.set(l.tree.x, l.tree.baseY + l.tree.height + 0.6 + 1.55 * l.tree.tuftScale, l.tree.z);
        l.group.rotation.set(0, l.group.rotation.y + dt * 0.5, 0);
        const wave = Math.sin(time * 5 + l.phase) * 0.4;
        pose(l, -2.7 + wave, -2.7 - wave, -1.4, -1.4, true);
        l.timer -= dt;
        if (l.timer <= 0) { l.up = 0.9; go(l, 'slide'); }
      } else if (l.state === 'slide') {
        l.up -= dt * 0.8;
        hugTrunk(l);
        pose(l, -1.5, -1.5, -0.9, -0.9, false);
        if (l.up <= 0.08) { l.x = l.group.position.x; l.z = l.group.position.z; letGo(l); go(l, 'idle', rand(0.3, 1.5)); }
      } else if (l.state === 'fall') {
        l.vy -= 20 * dt;
        l.y += l.vy * dt;
        l.x = l.group.position.x; l.z = l.group.position.z;
        l.group.position.y = l.y;
        l.group.rotation.x += dt * 7;
        pose(l, -2.8, -2.8, 0.5, -0.5, false);
        if (l.y <= groundHeight(l.x, l.z)) { l.group.rotation.x = 0; wanderOff(l, 25); }
      } else if (l.state === 'eat') {
        onGround(l);
        pose(l, -0.3, -1.9 + Math.sin(time * 6 + l.phase) * 0.25, -1.45, -1.45, true);
        l.timer -= dt;
        if (l.timer <= 0) go(l, 'idle', rand(0.5, 2));
      } else if (l.state === 'chase') {
        l.timer -= dt;
        if (l.timer <= 0) go(l, 'idle', 1);
        else if (walkTo(l, l.other.x, l.other.z, 4.4, dt, time, 1)) {
          go(l, 'tumble', 0.7); // caught: both go head over heels
          if (['idle', 'wander', 'eat'].includes(l.other.state)) go(l.other, 'tumble', 0.7);
        }
      } else if (l.state === 'tumble') {
        l.timer -= dt;
        const p = 1 - Math.max(0, l.timer) / 0.7;
        l.group.rotation.x = p * Math.PI * 2;
        onGround(l, Math.sin(p * Math.PI) * 0.8);
        if (l.timer <= 0) { l.group.rotation.x = 0; go(l, 'idle', rand(0.5, 1.5)); }
      } else if (l.state === 'mope') {
        // Crummies in their tummies. They sit and look at you.
        onGround(l);
        l.group.rotation.set(0, Math.atan2(player.x - l.x, player.z - l.z), 0);
        pose(l, -0.7, -0.7, -1.45, -1.45, true);
        l.head.rotation.x = 0.3;
      }
    }
  }

  // The relocation march: single file, heads down, toward the ridge. t = seconds into the cutscene.
  function march(t, startX) {
    loots.forEach((l, i) => {
      letGo(l);
      l.state = 'march';
      l.x = startX + t * 1.5 - i * 2.4;
      l.z = Math.sin(l.x * 0.06) * 3;
      const swing = Math.sin(t * 3 + i) * 0.35;
      pose(l, swing, -swing, -swing, swing, false);
      onGround(l, Math.abs(Math.sin(t * 3 + i)) * 0.04);
      l.group.rotation.set(0, Math.PI / 2, 0);
      l.head.rotation.x = 0.55;
      l.fruit.visible = false;
    });
  }

  const remove = () => loots.forEach((l) => { l.group.visible = false; });
  return {
    update, march, remove, all: () => loots,
    visibleCount: () => loots.filter((l) => l.group.visible).length,
    inTrees: () => loots.filter((l) => ['climb', 'perch', 'slide'].includes(l.state)).length,
  };
}

// ---------------------------------------------------------------- the Lorax

// He holds the ridge and never comes down. He is enormous, so you can always see him; fog does not hide him.
// Come too near and he sinks behind the ridge and comes up somewhere else. As the forest goes, he gathers company.
export function createLorax(scene) {
  const BODY = [new THREE.Color('#e07a1f'), new THREE.Color('#2a1a10')];
  const bodyMat = toon(BODY[0].clone(), { fog: false }), hairMat = toon('#f6d43c', { fog: false });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#17110d', fog: false });

  const group = new THREE.Group();
  const blob = (mat, sx, sy, sz, x, y, z, ink = true) => {
    const mesh = ink ? inked(ball, mat, 0.06) : new THREE.Mesh(ball, mat);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  blob(bodyMat, 0.55, 0.74, 0.5, 0, 0.86, 0);
  for (const side of [-1, 1]) {
    blob(bodyMat, 0.2, 0.11, 0.28, side * 0.22, 0.1, 0.12);
    blob(eyeMat, 0.1, 0.13, 0.05, side * 0.17, 1.2, 0.41, false);
    blob(pupilMat, 0.04, 0.05, 0.03, side * 0.16, 1.18, 0.46, false);
    const brow = inked(horn(0.42, 0.1, side * -0.12), hairMat, 0.02); // low in the middle, high outside: furious
    brow.position.set(side * 0.04, 1.33, 0.46);
    brow.rotation.z = -side * (Math.PI / 2 - 0.45);
    const tash = inked(horn(1.05, 0.25, side * 0.4), hairMat, 0.025); // a great drooping walrus moustache
    tash.position.set(side * 0.03, 0.98, 0.47);
    tash.rotation.z = -side * (Math.PI / 2 + 0.3);
    tash.scale.z = 0.55;
    group.add(brow, tash);
  }
  group.scale.setScalar(16);
  group.visible = false;
  scene.add(group);

  // His company: dark shapes along the ridge, more of them the more you cut.
  const HORDE = 260;
  const horde = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.5, 1, 3, 8), new THREE.MeshBasicMaterial({ color: '#1b1411', fog: false }), HORDE);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < HORDE; i++) {
    const a = rand(0, 6.28), r = RIDGE_RADIUS + rand(-9, 6), size = rand(1.5, 3.2);
    p.set(Math.cos(a) * r, groundHeight(Math.cos(a) * r, Math.sin(a) * r) + size * 0.8, Math.sin(a) * r);
    horde.setMatrixAt(i, m.compose(p, q, s.set(size * rand(0.7, 1.2), size, size * 0.8)));
  }
  horde.count = 0;
  horde.frustumCulled = false; // its bounds were measured while it was empty
  scene.add(horde);

  let active = false, pinned = false, angle = 0, sunk = 1, phase = 'rise', timer = 0;

  function place(player) {
    const x = Math.cos(angle) * RIDGE_RADIUS, z = Math.sin(angle) * RIDGE_RADIUS;
    group.position.set(x, groundHeight(x, z) - sunk * 34, z);
    group.rotation.y = Math.atan2(player.x - x, player.z - z);
  }

  // Somewhere on the ridge just inside your view, unless that is too close to you; then the far side of the valley.
  function pickAngle(player, viewDir) {
    const turn = (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.6);
    let a = Math.atan2(viewDir.z, viewDir.x) + turn;
    if (Math.hypot(Math.cos(a) * RIDGE_RADIUS - player.x, Math.sin(a) * RIDGE_RADIUS - player.z) < 100) a = Math.atan2(-player.z, -player.x);
    return a;
  }

  function update(dt, player, viewDir, ruin) {
    if (!active) return;
    bodyMat.color.lerpColors(BODY[0], BODY[1], ruin);
    horde.count = Math.floor(HORDE * Math.max(0, (ruin - 0.1) / 0.9));
    if (pinned) return;

    const dx = group.position.x - player.x, dz = group.position.z - player.z, dist = Math.hypot(dx, dz);
    const watched = (dx * viewDir.x + dz * viewDir.z) / dist > 0.5;
    timer -= dt;
    if (phase === 'hold' && (dist < 80 || (!watched && timer <= 0))) phase = 'sink';
    if (phase === 'sink') {
      sunk += dt / 1.2;
      if (sunk >= 1) { sunk = 1; angle = pickAngle(player, viewDir); phase = 'rise'; }
    } else if (phase === 'rise') {
      sunk -= dt / 1.6;
      if (sunk <= 0) { sunk = 0; phase = 'hold'; timer = rand(10, 18); }
    }
    place(player);
  }

  return {
    update, group,
    appear(player, viewDir) { active = true; group.visible = true; angle = Math.atan2(viewDir.z, viewDir.x) + 0.25; sunk = 1; phase = 'rise'; },
    isActive: () => active,
    distanceTo: (player) => Math.hypot(group.position.x - player.x, group.position.z - player.z),
    hordeSize: () => horde.count,
    // Cutscenes stand him at a fixed point on the ridge.
    pin(atAngle, player) { pinned = true; angle = atAngle; sunk = 0; place(player); },
    release() { pinned = false; phase = 'hold'; timer = 6; },
  };
}
