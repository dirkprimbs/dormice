// Renders the store art: node tools/store-art/render.mjs <path to playwright-core> [chrome path]
// Writes fastlane/metadata/android/en-US/images/featureGraphic.png (1024 × 500).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const [pw = 'playwright-core', chrome = '/usr/bin/google-chrome'] = process.argv.slice(2);
const { chromium } = require(pw);
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../fastlane/metadata/android/en-US/images/featureGraphic.png');
const b = await chromium.launch({ executablePath: chrome });
const p = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await p.goto('file://' + path.join(here, 'feature.html'));
await p.waitForTimeout(300);
await p.screenshot({ path: out });
await b.close();
console.log('wrote', out);
