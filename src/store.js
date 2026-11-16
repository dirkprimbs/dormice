// Progress and preferences, kept in localStorage.
const KEY = 'dormice.v1';
const defaults = () => ({
  settings: { lang: 'auto', theme: 'auto', sound: true, markers: false, motion: true },
  journey: {}, // level id -> { stars, best }
  best: {},    // free-play config key -> seconds
  scores: {},  // free-play config key -> fastest five wins, [{ t, d, st }]
  daily: {},   // yyyy-mm-dd -> { time, stars }
  seen: {},    // rule intro id -> true
  free: null,  // last free-play configuration
});

let data = defaults();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) data = { ...defaults(), ...raw, settings: { ...defaults().settings, ...raw.settings } };
  } catch { /* private mode or corrupted data: start fresh */ }
}
load();
// Another tab saved: pick its changes up, so this tab's next save does not undo them.
if (typeof addEventListener === 'function') addEventListener('storage', (e) => { if (e.key === KEY) load(); });

export const store = {
  get data() { return data; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } },
  reset() { data = defaults(); this.save(); },
};
