// Takes the Play Store phone screenshots (1080 × 1920) in every language the game speaks.
// Needs the game served locally (npm start). Usage:
//   node tools/store-art/screens.mjs <path to playwright-core> [chrome path]
// Replaces fastlane/metadata/android/<locale>/images/phoneScreenshots/ with one picture per scene below.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const [pw = 'playwright-core', chrome = '/usr/bin/google-chrome'] = process.argv.slice(2);
const { chromium } = require(pw);
const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8377/';
const LOCALES = { en: 'en-US', de: 'de-DE', fr: 'fr-FR' };

// A player who has been at it for a few days, so the screens don't look empty.
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const progress = (lang, theme = 'light') => ({
  settings: { lang, theme, sound: false, markers: false, motion: false, snapLeaf: true },
  journey: Object.fromEntries([
    ['meadow-1', 3, 21], ['meadow-2', 3, 34], ['meadow-3', 3, 52], ['meadow-4', 2, 75], ['meadow-5', 3, 118],
    ['honeycomb-1', 3, 40], ['honeycomb-2', 3, 66], ['honeycomb-3', 2, 131], ['honeycomb-4', 3, 160],
    ['beds-1', 3, 38], ['beds-2', 1, 95], ['beds-3', 2, 140], ['beds-4', 3, 170],
    ['rows-1', 3, 60], ['rows-3', 2, 150], ['rows-4', 3, 200], ['twotone-1', 3, 50], ['twotone-2', 3, 90], ['twotone-4', 2, 210],
    ['trellis-1', 3, 55], ['trellis-2', 3, 110], ['trellis-4', 3, 230], ['owls-1', 3, 70],
  ].map(([id, stars, best]) => [id, { stars, best }])),
  best: {}, scores: {},
  daily: { [day(1)]: { time: 143, stars: 3 }, [day(2)]: { time: 188, stars: 2 }, [day(3)]: { time: 120, stars: 3 } },
  seen: Object.fromEntries(['basics', 'hex', 'tri', 'counts', 'lines', 'split', 'owls', 'twins'].map((k) => [k, true])),
  free: { grid: 'hex', shape: 'hexagon', size: 'm', density: 'standard', color: 'none', lines: false, owls: true, noGuess: true, lives: 3 },
});

// Follow the game's own hints for a while: leaves on sleepers, safe tiles turned (right-click turns on the Leaf setting).
async function playHints(p, steps) {
  for (let i = 0; i < steps; i++) {
    await p.click('button[data-act="hint"]'); await p.waitForTimeout(80);
    const cells = await p.$$eval('.cell.hint-safe, .cell.hint-mine', (els) => els.map((e) => [e.dataset.id, e.classList.contains('hint-mine')]));
    for (const [id, mine] of cells) await p.click(`.cell[data-id="${id}"]`, { button: mine ? 'left' : 'right' });
    await p.waitForTimeout(80);
  }
}

// The scenes: games in progress, one per idea, like the README. [file, journey level, theme, hint steps, show a hint]
const SCENES = [
  ['1-classic.png', 'meadow-5', 'light', 6, false],
  ['2-honeycomb.png', 'honeycomb-3', 'light', 6, false],
  ['3-flowerbeds-hint.png', 'beds-3', 'light', 4, true],
  ['4-sun-and-shade-dark.png', 'twotone-3', 'dark', 5, false],
  ['5-row-clues.png', 'rows-2', 'light', 4, false],
  ['6-owls.png', 'owls-2', 'light', 5, false],
  ['7-triangles.png', 'trellis-3', 'light', 3, false],
];

const b = await chromium.launch({ executablePath: chrome });
for (const [lang, locale] of Object.entries(LOCALES)) {
  const dir = path.join(here, `../../fastlane/metadata/android/${locale}/images/phoneScreenshots`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [file, level, theme, steps, hint] of SCENES) {
    const ctx = await b.newContext({ locale, viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: theme });
    await ctx.addInitScript((data) => { if (!sessionStorage.seeded) { localStorage.setItem('dormice.v1', data); sessionStorage.seeded = 1; } }, JSON.stringify(progress(lang, theme)));
    const p = await ctx.newPage();
    await p.goto(BASE + '#/journey'); await p.waitForTimeout(300);
    await p.click(`button[data-level="${level}"]`); await p.waitForTimeout(600);
    await playHints(p, steps);
    await p.click('button[data-act="fit"]');
    if (hint) await p.click('button[data-act="hint"]');
    else await p.click('button[data-act="hint-close"]', { timeout: 500 }).catch(() => {});
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(dir, file) });
    await ctx.close();
  }
  console.log('screenshots for', locale);
}
await b.close();
