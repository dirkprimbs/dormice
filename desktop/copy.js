// Copies the web game into desktop/app so the installers carry their own copy.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'app');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'icons'])
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
console.log('copied the game into desktop/app');
