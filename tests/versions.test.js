// The desktop, Android and iOS apps are released together and carry the same version.
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

test('the iOS version matches the desktop version', () => {
  const { version } = JSON.parse(read('desktop/package.json'));
  const project = read('ios/project.yml');
  const name = /MARKETING_VERSION: "([^"]+)"/.exec(project)[1];
  const build = +/CURRENT_PROJECT_VERSION: "(\d+)"/.exec(project)[1];
  const [major, minor, patch] = version.split('.').map(Number);
  assert.equal(name, version);
  assert.equal(build, major * 10000 + minor * 100 + patch);
});
