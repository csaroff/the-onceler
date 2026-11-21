// Shared by the scenario tests: opens the game in a headless browser with the clock driven by hand.
import { mkdirSync } from 'node:fs';
import { launch, GAME_URL } from '../tools/browser.mjs';

export async function openGame({ query = '?test', start = true } = {}) {
  mkdirSync('tests/shots', { recursive: true });
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${GAME_URL}/${query}`);
  await page.waitForFunction(() => window.game, null, { timeout: 90000 });

  // Helpers that run inside the page. `g` is the whole game; `t` is these.
  await page.evaluate(() => {
    const g = window.game, land = g.land;
    window.t = {
      run(seconds) { for (let i = 0; i < seconds * 20; i++) g.step(0.05); },
      // Run until something is true, or give up. Says whether it became true.
      until(check, limit = 120) { for (let i = 0; i < limit * 20 && !check(); i++) g.step(0.05); return !!check(); },
      // Put the player somewhere, standing on the ground, looking at a point.
      stand(x, z, lookX, lookZ) {
        g.world.settle(x, z);
        Object.assign(g.player, { x, z, y: land.height(x, z), vy: 0, yaw: Math.atan2(x - lookX, z - lookZ), pitch: 0 });
        g.step(0.05);
      },
      // Hold keys down for a while, as a player would.
      hold(codes, seconds) { for (const c of [].concat(codes)) { g.keys[c] = true; g.pressed.add(c); } this.run(seconds); for (const c of [].concat(codes)) g.keys[c] = false; },
      press(code) { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); },
      // Walk up to the nearest standing tree and swing until it falls and has landed.
      chopTree() {
        const p = g.player, tree = g.world.nearestStanding(p.x, p.z, 400);
        this.stand(tree.x - 3, tree.z, tree.x, tree.z);
        for (let i = 0; i < 3; i++) { g.click(0); this.run(0.7); }
        this.until(() => tree.state === 'down' || tree.state === 'gone', 5);
        return tree;
      },
      // Fell trees without the ceremony, as a Super-Axe-Hacker would, until `count` are down near a spot.
      clearcut(x, z, count, wait = 3) {
        let n = 0;
        for (const tree of g.world.treesNear(x, z, 120).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))) {
          if (n >= count) break;
          if (tree.state !== 'standing') continue;
          tree.byMachine = true;
          g.world.fell(tree, x, z);
          n++;
        }
        this.run(wait);
        return n;
      },
      // Walk over every tuft lying about, then take them home.
      gather() {
        for (const tuft of [...g.business.pickups]) { if (g.player.tufts >= g.player.maxTufts) break; this.stand(tuft.x, tuft.z, tuft.x + 1, tuft.z); }
        this.stand(2, 6, 0, 0);
      },
      // A wide flat dry place, a long way from anything, for a fight with nothing in the way.
      field() {
        for (let r = 300; r < 1500; r += 20) for (let a = 0; a < 6.28; a += 0.1) {
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          if (land.height(x, z) < land.LAKE_Y + 3 || !land.isWild(x, z, 60)) continue;
          let flat = true;
          for (let b = 0; b < 6.28 && flat; b += 0.5) for (const d of [8, 16, 28]) if (land.steepness(x + Math.cos(b) * d, z + Math.sin(b) * d) > 0.25 || land.height(x + Math.cos(b) * d, z + Math.sin(b) * d) < land.LAKE_Y + 2) { flat = false; break; }
          if (flat) return { x, z };
        }
        return null;
      },
      // The nearest cliff to a spot: the foot of it (flat, dry), the top of it, and which way is uphill.
      findCliff(nearX = 0, nearZ = 0) {
        for (let r = 120; r < 900; r += 8) for (let a = 0; a < 6.28; a += 0.06) {
          const x = nearX + Math.cos(a) * r, z = nearZ + Math.sin(a) * r;
          if (land.steepness(x, z) < 1.8) continue;
          const gx = land.height(x + 2, z) - land.height(x - 2, z), gz = land.height(x, z + 2) - land.height(x, z - 2), gl = Math.hypot(gx, gz);
          const ux = gx / gl, uz = gz / gl, foot = { x: x - ux * 14, z: z - uz * 14 }, top = { x: x + ux * 14, z: z + uz * 14 };
          const drop = land.height(top.x, top.z) - land.height(foot.x, foot.z);
          if (drop < 9 || land.steepness(foot.x, foot.z) > 0.3 || land.steepness(top.x, top.z) > 0.3 || land.height(foot.x, foot.z) < land.LAKE_Y + 1) continue;
          return { foot, top, ux, uz, drop };
        }
        return null;
      },
      // Draw the view and say what share of the lower half of the picture is water-blue.
      waterShare() {
        g.render();
        const gl = document.querySelector('canvas').getContext('webgl2'), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let blue = 0, all = 0;
        for (let y = Math.floor(h * 0.12); y < h * 0.45; y += 6) for (let x = 0; x < w; x += 6) {
          const i = (y * w + x) * 4;
          all++;
          if (px[i + 2] > px[i] + 25 && px[i + 2] > px[i + 1]) blue++;
        }
        return blue / all;
      },
      read() {
        const { stock, player, war, lorax, business, wildlife, story } = g;
        return {
          money: stock.money, shopTufts: stock.tufts, shopThneeds: stock.thneeds, sold: stock.sold, made: stock.made,
          carryTufts: player.tufts, carryThneeds: player.thneeds, health: player.health, maxHealth: player.maxHealth,
          x: player.x, y: player.y, z: player.z,
          felled: story.felled, seen: [...story.seen], scene: !!g.scenes.active, ruin: g.ruin, dead: g.dead, ended: g.ended,
          loraxState: lorax.state, loraxDistance: lorax.distance(), loraxVisible: lorax.model.visible,
          phase: war.phase, raid: war.raid, enemies: war.alive(), line: war.standing(), champion: !!war.champion, duel: war.duel,
          reserves: war.reserves, locals: war.locals(), finale: war.finale, won: war.won,
          loots: wildlife.count('loot'), lootsInTrees: wildlife.lootsInTrees(), swans: wildlife.count('swan'),
          owned: { ...business.owned }, gear: { ...business.gear }, drawn: g.world.drawn(),
        };
      },
    };
  });

  const run = (code) => page.evaluate(`(() => { const g = window.game, t = window.t, land = g.land; ${code} })()`);
  const read = () => run('return t.read()');
  const shot = async (name) => { await run('g.render()'); await page.waitForTimeout(250); await page.screenshot({ path: `tests/shots/${name}.png` }); };
  if (start) await page.click('#start');
  const close = async () => { await browser.close(); if (errors.length) throw new Error(`the page reported errors:\n${errors.join('\n')}`); };
  return { page, run, read, shot, close, errors };
}
