// Holo Tutor — Android app voice bridge.
// Android's built-in web view has no speech recognition and no reliable speech synthesis, so in
// the app this file provides both, backed by Android's own engines (Capacitor plugins):
//   window.SpeechRecognition  → @capacitor-community/speech-recognition (Android SpeechRecognizer)
//   window.speechSynthesis    → @capacitor-community/text-to-speech (Android TextToSpeech)
// They behave like the browser APIs Holo Tutor already uses, so the app itself is unchanged.
// It only does anything when running inside the native app.
(function () {
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;
  const reg = (name) => (C.registerPlugin ? C.registerPlugin(name) : C.Plugins && C.Plugins[name]);
  const SRP = (window.capacitorSpeechRecognition && window.capacitorSpeechRecognition.SpeechRecognition) || reg('SpeechRecognition');
  const TTS = (window.capacitorTextToSpeech && window.capacitorTextToSpeech.TextToSpeech) || reg('TextToSpeech');
  window.__holoNative = true;

  // ---------- listening ----------
  if (SRP) {
    let current = null, lastPartial = '';
    SRP.addListener('partialResults', (d) => {
      const t = (d && d.matches && d.matches[0]) || '';
      if (!current || !t) return;
      lastPartial = t;
      current._emit(t, false);
    });
    SRP.addListener('listeningState', (d) => {
      const r = current;
      if (!r) return;
      if (d.status === 'started') { r.onstart && r.onstart(); r.onaudiostart && r.onaudiostart(); return; }
      // stopped: Android ends a session after each phrase; the last partial result is what was said
      current = null;
      const said = lastPartial; lastPartial = '';
      if (said && !r._aborted) r._emit(said, true);
      r.onspeechend && r.onspeechend();
      r.onend && r.onend();
    });
    let permitted = false;
    class NativeRecognition {
      constructor() { this.lang = 'en-IN'; this.continuous = false; this.interimResults = true; this.maxAlternatives = 1; }
      _emit(t, isFinal) {
        if (!isFinal && this.onspeechstart) this.onspeechstart();
        const alt = [{ transcript: t, confidence: 1 }];
        alt.isFinal = isFinal;
        this.onresult && this.onresult({ resultIndex: 0, results: [alt] });
      }
      async start() {
        if (current) return;
        current = this; this._aborted = false; lastPartial = '';
        try {
          if (!permitted) {
            let p = await SRP.checkPermissions();
            if (p.speechRecognition !== 'granted') p = await SRP.requestPermissions();
            if (p.speechRecognition !== 'granted') throw { error: 'not-allowed' };
            const av = await SRP.available();
            if (!av.available) throw { error: 'service-not-allowed' };
            permitted = true;
          }
          await SRP.start({ language: this.lang || 'en-IN', maxResults: 1, partialResults: true, popup: false });
        } catch (e) {
          if (current === this) current = null;
          const code = (e && e.error) || (/permission/i.test((e && e.message) || '') ? 'not-allowed' : 'no-speech');
          this.onerror && this.onerror({ error: code });
          this.onend && this.onend();
        }
      }
      stop() { SRP.stop().catch(() => {}); }
      abort() { this._aborted = true; SRP.stop().catch(() => {}); }
    }
    window.SpeechRecognition = NativeRecognition;
    window.webkitSpeechRecognition = NativeRecognition;
  }

  // ---------- speaking ----------
  if (TTS) {
    let voices = [];
    const changed = [];
    TTS.getSupportedVoices().then((r) => { voices = (r && r.voices) || []; changed.forEach((f) => { try { f(); } catch (e) {} }); }).catch(() => {});
    let active = null, speaking = false;
    const queue = [];
    if (TTS.addListener) TTS.addListener('onRangeStart', (info) => { if (active && active.onboundary) active.onboundary({ name: 'word', charIndex: info.start }); });
    function next() {
      if (speaking) return;
      const u = queue.shift();
      if (!u) return;
      if (u.volume === 0 || !String(u.text || '').trim()) { setTimeout(() => { u.onend && u.onend({}); next(); }, 0); return; } // silent "unlock" utterances
      speaking = true; active = u;
      const vi = u.voice ? voices.findIndex((v) => v.voiceURI === u.voice.voiceURI || v.name === u.voice.name) : -1;
      setTimeout(() => { if (active === u && u.onstart) u.onstart({}); }, 0);
      TTS.speak({ text: u.text, lang: u.lang || 'en-IN', rate: u.rate || 1, pitch: u.pitch || 1, volume: u.volume == null ? 1 : u.volume, voice: vi >= 0 ? vi : undefined, category: 'playback', queueStrategy: 0 })
        .then(() => { if (active === u) { active = null; speaking = false; u.onend && u.onend({}); } next(); })
        .catch(() => { if (active === u) { active = null; speaking = false; u.onerror && u.onerror({ error: 'synthesis-failed' }); } next(); });
    }
    const synth = {
      get speaking() { return speaking; }, get pending() { return queue.length > 0; }, paused: false,
      getVoices: () => voices,
      speak(u) { queue.push(u); next(); },
      cancel() {
        queue.length = 0;
        const u = active; active = null; speaking = false;
        TTS.stop().catch(() => {});
        if (u && u.onerror) u.onerror({ error: 'interrupted' });
      },
      pause() {}, resume() {},
      addEventListener(type, f) { if (type === 'voiceschanged') changed.push(f); },
      removeEventListener() {},
    };
    try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true }); } catch (e) { window.speechSynthesis = synth; }
    window.SpeechSynthesisUtterance = function (text) { this.text = text || ''; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; };
  }
})();
