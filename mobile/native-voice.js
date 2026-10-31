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
    // Android's recogniser only reports "stopped" when it heard speech; on silence, errors or
    // stop() it goes quiet. So every session here has a watchdog that polls isListening() and
    // always ends the session (onend), or the app would wait for it forever and stop listening.
    let current = null;
    SRP.addListener('partialResults', (d) => {
      const t = (d && d.matches && d.matches[0]) || '';
      if (current && t) current._partial(t);
    });
    SRP.addListener('listeningState', (d) => {
      if (!current) return;
      if (d.status === 'started') current._started(); else current._finish(500); // final words arrive just after
    });
    let permitted = false;
    class NativeRecognition {
      constructor() { this.lang = 'en-IN'; this.continuous = false; this.interimResults = true; this.maxAlternatives = 1; }
      _emit(t, isFinal) {
        const alt = [{ transcript: t, confidence: 1 }];
        alt.isFinal = isFinal;
        this.onresult && this.onresult({ resultIndex: 0, results: [alt] });
      }
      _started() { if (this._s && !this._s.spoke) { this._s.spoke = true; this.onspeechstart && this.onspeechstart(); } }
      _partial(t) { const s = this._s; if (!s || s.ending) { if (s) s.said = t; return; } s.said = t; this._started(); this._emit(t, false); }
      _finish(wait) {
        const s = this._s;
        if (!s || s.done) return;
        if (!s.ending) { s.ending = true; this.onspeechend && this.onspeechend(); }
        clearTimeout(s.endTimer);
        s.endTimer = setTimeout(() => this._close(), wait || 0);
      }
      _close(errorCode) {
        const s = this._s;
        if (!s || s.done) return;
        s.done = true; clearInterval(s.poll); clearTimeout(s.endTimer); clearTimeout(s.cap);
        if (current === this) current = null;
        this._s = null;
        if (s.aborted) { /* nothing to report */ }
        else if (s.said) this._emit(s.said, true);
        else if (errorCode !== null) this.onerror && this.onerror({ error: errorCode || 'no-speech' });
        this.onend && this.onend();
      }
      async start() {
        if (this._s) return;
        if (current && current !== this) current._close(null);
        const s = this._s = { said: '', spoke: false, ending: false, done: false, aborted: false, t0: Date.now() };
        current = this;
        try {
          if (!permitted) {
            let p = await SRP.checkPermissions();
            if (p.speechRecognition !== 'granted') p = await SRP.requestPermissions();
            if (p.speechRecognition !== 'granted') throw { error: 'not-allowed' };
            const av = await SRP.available();
            if (!av.available) throw { error: 'service-not-allowed' };
            permitted = true;
          }
          if (s.done) return;
          await SRP.start({ language: this.lang || 'en-IN', maxResults: 1, partialResults: true, popup: false });
          if (s.done) { SRP.stop().catch(() => {}); return; }
          this.onstart && this.onstart(); this.onaudiostart && this.onaudiostart();
          let idle = 0;
          s.poll = setInterval(() => {
            if (s.done || s.ending) return;
            SRP.isListening().then((r) => {
              if (s.done || s.ending) return;
              if (r && r.listening === false && Date.now() - s.t0 > 900) { if (++idle >= 2) this._finish(s.said ? 400 : 0); } else idle = 0;
            }).catch(() => {});
          }, 500);
          s.cap = setTimeout(() => { if (!s.done) { SRP.stop().catch(() => {}); this._finish(700); } }, 30000); // a phrase never runs this long
        } catch (e) {
          const code = (e && e.error) || (/permission|denied/i.test((e && e.message) || '') ? 'not-allowed' : 'no-speech');
          this._close(code);
        }
      }
      stop() { if (!this._s) return; SRP.stop().catch(() => {}); this._finish(700); }
      abort() { const s = this._s; if (!s) return; s.aborted = true; SRP.stop().catch(() => {}); setTimeout(() => this._close(), 0); }
    }
    window.SpeechRecognition = NativeRecognition;
    window.webkitSpeechRecognition = NativeRecognition;
  }

  // ---------- speaking ----------
  if (TTS) {
    let voices = [];
    const changed = [];
    const loadVoices = (tries) => TTS.getSupportedVoices().then((r) => { // the engine can take a moment to start
      // Android reports every voice's name as just "English India"; its real code (e.g.
      // "en-in-x-ene-local", which tells male from female) is in voiceURI, so use that as the name.
      voices = ((r && r.voices) || []).map((v) => ({ ...v, displayName: v.name, name: v.voiceURI || v.name }));
      if (!voices.length && tries > 0) return setTimeout(() => loadVoices(tries - 1), 1500);
      changed.forEach((f) => { try { f(); } catch (e) {} });
    }).catch(() => { if (tries > 0) setTimeout(() => loadVoices(tries - 1), 1500); });
    loadVoices(6);
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
      openInstall: () => (TTS.openInstall ? TTS.openInstall().catch(() => {}) : Promise.resolve()),
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
