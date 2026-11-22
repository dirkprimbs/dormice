// Offline support: try the network first so updates arrive immediately,
// fall back to the last copy we saw when there is no connection.
const CACHE = 'dormice-v2';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon.svg',
  'fonts/Fraunces-SoftBold.ttf',
  'src/main.js', 'src/boardview.js', 'src/game.js', 'src/generator.js', 'src/levels.js',
  'src/puzzle.js', 'src/rng.js', 'src/solver.js', 'src/store.js', 'src/topology.js',
  'src/audio.js', 'src/text.js', 'src/i18n.js', 'src/lang/en.js', 'src/lang/de.js', 'src/lang/fr.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
