// Every language must have every piece of text, of the same kind, so none falls back to English unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, t, setLang } from '../src/i18n.js';

const en = LANGS.en;
// Sample values for the texts that are built from values.
const SAMPLE = ['1', '2', '3', '4'];

for (const [code, dict] of Object.entries(LANGS)) {
  test(`${code} has exactly the same texts as English`, () => {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort());
    for (const k of Object.keys(en)) assert.equal(typeof dict[k], typeof en[k], `${code}: ${k}`);
  });

  test(`${code} builds every text without gaps`, () => {
    setLang(code);
    for (const k of Object.keys(en)) {
      const args = k.startsWith('free.') ? ['l', 'hex', 'tricky'] : k === 'toast.woke' ? [2] : k.startsWith('rule.') ? ['<p>how</p>'] : SAMPLE;
      const out = t(k, ...args);
      assert.equal(typeof out, 'string', `${code}: ${k}`);
      assert.ok(out.trim().length, `${code}: ${k} is empty`);
      assert.ok(!/undefined|NaN|\[object/.test(out), `${code}: ${k} -> ${out}`);
    }
  });
}

test('an unknown language falls back to English', () => {
  setLang('xx');
  assert.equal(t('free.play'), 'Play');
});
