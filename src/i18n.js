// Which language the game speaks, and the lookup for its text.
// The language follows the device unless the player picks one in Settings.
import en from './lang/en.js';
import de from './lang/de.js';
import fr from './lang/fr.js';

export const LANGS = { en, de, fr };
// Each language is offered under its own name.
export const LANG_NAMES = { en: 'English', de: 'Deutsch', fr: 'Français' };

let cur = 'en';

// The first of the device's preferred languages that the game speaks, else English.
export function deviceLang() {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const code = String(p || '').slice(0, 2).toLowerCase();
    if (LANGS[code]) return code;
  }
  return 'en';
}

// pref: a language code, or 'auto' / nothing to follow the device.
export function setLang(pref) {
  cur = LANGS[pref] ? pref : deviceLang();
  if (typeof document !== 'undefined') document.documentElement.lang = cur;
  return cur;
}
export const lang = () => cur;

// t('key', ...values): the text for key in the current language.
export function t(key, ...args) {
  const v = LANGS[cur][key] ?? en[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}
