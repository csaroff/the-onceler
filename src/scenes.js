// Cutscenes. Each one takes the camera away from you for a short while.
import * as THREE from 'three';
import * as barbaloot from './art/barbaloot.js';
import * as swanArt from './art/swan.js';
import * as fishArt from './art/fish.js';
import { height, dist, NOMANS } from './terrain.js';

const MARCH = {
  loot: { art: barbaloot, variant: 'crummy', pose: 'march', speed: 1.4, gap: 2.3, name: 'Bar-ba-loots' },
  swan: { art: swanArt, variant: 'smogged', pose: 'fly', speed: 6, gap: 5, name: 'Swomee-Swans', flies: true },
  fish: { art: fishArt, variant: 'gummed', pose: 'walk', speed: 1.1, gap: 2, name: 'Humming-Fish' },
};
const HILL = { x: -120, z: -150 }; // the hill beside no-man's-land, where he stands to see them off

export function createScenes(g) {
  const scenes = { active: null, queue: [], t: 0 };
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  const lorax = () => g.lorax;

  const makers = {
    // The first tree is down. Out of its stump, up close, for the only time.
    firstTree(tree) {
      let spoke = false;
      const p = g.player;
      return {
        start() {
          const l = lorax();
          l.state = 'scene';
          l.model.visible = true;
          l.model.scale.setScalar(1);
          l.model.position.set(tree.x, tree.y, tree.z);
          l.model.rotation.y = Math.atan2(p.x - tree.x, p.z - tree.z);
          l.pose('emerge', 0);
          g.camera.fov = 50;
          g.camera.updateProjectionMatrix();
        },
        update(t) {
          // Crouch the camera three metres from the stump, on your side of it: close enough to count his eyelashes.
          const dx = p.x - tree.x, dz = p.z - tree.z, d = Math.hypot(dx, dz) || 1;
          eye.set(tree.x + (dx / d) * 3.1, 0, tree.z + (dz / d) * 3.1);
          eye.y = height(eye.x, eye.z) + 1.05;
          g.camera.position.copy(eye);
          g.camera.lookAt(aim.set(tree.x, tree.y + 0.95, tree.z));
          const l = lorax();
          if (t < 0.8) l.pose('emerge', 0);
          else if (t < 3.3) l.pose('emerge', (t - 0.8) / 2.5);
          else if (t < 14.5) {
            if (!spoke) { spoke = true; g.ui.say('firstTree', 5); }
            l.pose('speak', t);
          } else l.pose('glare', t);
          return t > 16.5;
        },
        end() {
          const l = lorax();
          g.fx.burst(tree.x, tree.y + 1, tree.z, '#f6d43c', 10, 3, 0.5);
          g.audio.pop();
          l.model.visible = false;
          l.state = 'hidden';
          p.yaw = Math.atan2(p.x - tree.x, p.z - tree.z);
          p.pitch = 0;
          g.war.enabled = true;
          g.war.calm = 35;
        },
      };
    },

    // A lieutenant is beaten. The Lorax sends its kind away, and you watch them go.
    march(kind) {
      const def = MARCH[kind], marchers = [];
      // From no-man's-land, where you beat their lieutenant, across open ground to the hill.
      const from = { x: NOMANS.x, z: NOMANS.z }, len = dist(from.x, from.z, HILL.x, HILL.z);
      const dir = { x: (HILL.x - from.x) / len, z: (HILL.z - from.z) / len };
      return {
        start() {
          g.wildlife.sendOff(kind);
          g.ui.say(kind, 5.5);
          g.audio.dirge();
          for (let i = 0; i < 11; i++) {
            const model = def.art.build({ variant: def.variant });
            model.rotation.y = Math.atan2(dir.x, dir.z);
            g.scene.add(model);
            marchers.push(model);
          }
          const l = lorax();
          l.state = 'scene';
          l.model.visible = true;
          l.model.scale.setScalar(4.5);
          l.model.position.set(HILL.x, height(HILL.x, HILL.z), HILL.z);
          l.model.rotation.y = Math.atan2(-dir.x, -dir.z);
          g.camera.fov = 40;
          g.camera.updateProjectionMatrix();
        },
        update(t) {
          marchers.forEach((model, i) => {
            const along = 6 + t * def.speed - i * def.gap, side = Math.sin(along * 0.12) * 1.5;
            const x = from.x + dir.x * along - dir.z * side, z = from.z + dir.z * along + dir.x * side;
            model.position.set(x, height(x, z) + (def.flies ? 3 + i * 0.4 + t * 0.9 : 0), z);
            def.art.pose(model, def.pose, t + i * 0.37, 0);
          });
          lorax().pose('glare', t);
          // Behind the column and a little above it, creeping after it, with him at the end of the road.
          const cx = from.x - dir.x * (10 - t * 0.3) - dir.z * 3, cz = from.z - dir.z * (10 - t * 0.3) + dir.x * 3;
          g.camera.position.set(cx, height(cx, cz) + 3.2, cz);
          const ax = from.x + dir.x * 34, az = from.z + dir.z * 34;
          g.camera.lookAt(aim.set(ax, height(ax, az) + (def.flies ? 7 : 2.5), az));
          if (t > 21) g.ui.fade(true);
          return t > 23.5;
        },
        end() {
          for (const model of marchers) g.scene.remove(model);
          const l = lorax();
          l.model.visible = false;
          l.state = 'hidden';
          g.ui.fade(false);
          g.ui.tip(`The ${def.name} are gone. It will be quiet for a while.`, 8);
        },
      };
    },

    // The last tree is down.
    lift() {
      const p = g.player;
      let at = null, said = 0;
      return {
        start() {
          const d = p.facing();
          at = { x: p.x + d.x * 45, z: p.z + d.z * 45 };
          const l = lorax();
          l.state = 'scene';
          l.model.visible = true;
          l.model.scale.setScalar(2.5);
          l.model.position.set(at.x, height(at.x, at.z), at.z);
          l.model.rotation.y = Math.atan2(p.x - at.x, p.z - at.z);
          g.camera.fov = 30;
          g.camera.updateProjectionMatrix();
          g.ui.say('lastTree', 4);
          g.audio.dirge();
        },
        update(t) {
          g.camera.position.set(p.x, p.y + 1.7, p.z);
          const rise = t > 5 ? Math.min(1, (t - 5) / 7) : 0;
          g.camera.lookAt(aim.set(at.x, height(at.x, at.z) + 2.5 + rise * 9, at.z));
          const l = lorax();
          if (t < 5) l.pose('glare', t);
          else if (t < 12.5) { if (said < 1) { said = 1; g.ui.say('lift', 4.5); } l.pose('lift', rise); }
          else if (said < 2) { said = 2; l.model.visible = false; g.ui.say('unless', 7); }
          if (t > 22 && said < 3) { said = 3; g.ui.say('seed', 6); }
          return t > 35;
        },
        end() {
          lorax().state = 'hidden';
          g.war.enabled = false;
          p.hasSeed = true;
        },
      };
    },
  };

  scenes.play = (name, arg) => scenes.queue.push(makers[name](arg));

  function finish() {
    scenes.active.end();
    scenes.active = null;
    g.camera.fov = 70;
    g.camera.updateProjectionMatrix();
    g.ui.letterbox(false);
    g.player.hands.visible = true;
  }
  scenes.skip = () => { if (scenes.active) finish(); };

  scenes.update = (dt) => {
    if (!scenes.active && scenes.queue.length) {
      scenes.active = scenes.queue.shift();
      scenes.t = 0;
      g.ui.letterbox(true);
      g.ui.menu('');
      g.player.hands.visible = false;
      g.player.knitting = false;
      g.defences.select(null);
      scenes.active.start();
    }
    if (!scenes.active) return;
    scenes.t += dt;
    if (scenes.active.update(scenes.t)) finish();
  };

  return scenes;
}
