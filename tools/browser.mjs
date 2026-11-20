// Starts a headless browser that can draw WebGL without a graphics card.
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const dir of readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse()) {
    for (const sub of readdirSync(join(cache, dir))) {
      const exe = join(cache, dir, sub, 'chrome-headless-shell');
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

export const GAME_URL = process.env.GAME_URL || 'http://localhost:5199';
export const launch = () => chromium.launch({ executablePath: findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
