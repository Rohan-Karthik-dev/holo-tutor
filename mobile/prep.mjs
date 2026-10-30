// Builds www/ for the Android app: the standalone Holo Tutor page, plus Capacitor's runtime,
// the two voice plugins and the voice bridge, loaded before the app starts.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const www = join(here, 'www');
mkdirSync(join(www, 'vendor'), { recursive: true });
const nm = (p) => join(here, 'node_modules', p);
copyFileSync(nm('@capacitor/core/dist/capacitor.js'), join(www, 'capacitor.js'));
copyFileSync(nm('@capacitor-community/speech-recognition/dist/plugin.js'), join(www, 'vendor', 'speech-recognition.js'));
copyFileSync(nm('@capacitor-community/text-to-speech/dist/plugin.js'), join(www, 'vendor', 'text-to-speech.js'));
copyFileSync(join(here, 'native-voice.js'), join(www, 'native-voice.js'));
let html = readFileSync(join(here, '..', 'standalone', 'holo-tutor.html'), 'utf8');
const tags = '<script src="capacitor.js"></script>\n<script src="vendor/speech-recognition.js"></script>\n<script src="vendor/text-to-speech.js"></script>\n<script src="native-voice.js"></script>\n';
html = html.replace('<title>', tags + '<title>');
writeFileSync(join(www, 'index.html'), html);
console.log('www ready');
