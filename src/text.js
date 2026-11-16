// The "how it works" cards, shown the first time each idea turns up.
// Their words live in the language files (src/lang/); this decides which apply.
import { t } from './i18n.js';

const touch = () => matchMedia('(pointer: coarse)').matches;
// Devices with both a touchscreen and a mouse get both sets of instructions.
const both = () => matchMedia('(any-pointer: coarse)').matches && matchMedia('(any-pointer: fine)').matches;
const how = () => (both()
  ? `<p class="how">${t('how.withMouse')} ${t('how.mouse')}</p><p class="how">${t('how.byTouch')} ${t('how.touch')}</p>`
  : `<p class="how">${touch() ? t('how.touch') : t('how.mouse')}</p>`);

const card = (id, arg) => ({ get title() { return t(`rule.${id}`); }, body: () => t(`rule.${id}.body`, arg()) });

export const RULES = {
  basics: card('basics', how),
  hex: card('hex', () => null),
  tri: card('tri', touch),
  counts: card('counts', () => null),
  lines: card('lines', touch),
  split: card('split', () => null),
  owls: card('owls', touch),
  twins: card('twins', () => null),
};
