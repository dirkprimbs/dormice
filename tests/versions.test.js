// The desktop and Android apps are released together and carry the same version.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the Android version matches the desktop version', () => {
  const { version } = JSON.parse(read('desktop/package.json'));
  const gradle = read('android/app/build.gradle');
  const name = /versionName '([^']+)'/.exec(gradle)[1];
  const code = +/versionCode (\d+)/.exec(gradle)[1];
  const [major, minor, patch] = version.split('.').map(Number);
  assert.equal(name, version);
  assert.equal(code, major * 10000 + minor * 100 + patch);
});

test('the Android Back handler uses a language-independent selector present on every sub-screen', () => {
  const java = read('android/app/src/main/java/io/github/dirkprimbs/dormice/MainActivity.java');
  const main = read('src/main.js');
  assert.ok(java.includes('[data-back]'), 'BACK_JS must query [data-back]');
  assert.ok(!java.includes('aria-label=\\"Back\\"'), 'BACK_JS must not hardcode English aria-label');
  const backLinks = main.match(/class="iconbtn"[^>]*data-back/g) || [];
  assert.equal(backLinks.length, 4, 'Journey, Free play, Records and Game screens each have a data-back link');
});

test('open cells keep a hit-testable .top polygon for number chording and hover', () => {
  const css = read('styles.css');
  assert.ok(!/\.cell\.open[^}]*\.top[^}]*display\s*:\s*none/.test(css), '.cell.open .top must not be display: none');
});
