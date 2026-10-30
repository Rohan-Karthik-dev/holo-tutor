# Holo Tutor

A voice-first holographic tutor for a single-pane 45° Pepper's ghost holo box. It runs as a website on phones, iPads and laptops, and has a black, mirrored holo mode for the box. The screens follow the Holo Tutor design canvas.

## Screens
0. **Fun chat or Study** — the app opens by asking what you feel like doing. **Fun chat** is Holo Buddy, a playful companion for movies, shows, anime and cartoons (no spoilers unless asked, recommendations), clean jokes and riddles, and gaming (tips, strategies, lore, game picks), all kept family-friendly. Its screen shows fun facts instead of a whiteboard, "quiz me" gives a trivia quiz, and "show me a video" finds trailers and gameplay. **Study** goes to the tutor. Say "let's study" or "fun chat" anytime to switch; there's also a Fun chat button on the Study home.
1. **Home** — "Who should teach you today?" Pick a tutor: **Globe guide**, **Your face, as a tutor**, or **Holo human**. The Holo box card opens setup.
2. **Upload face** — choose a front-facing photo; it becomes a cyan hologram. The app maps the face (mouth corners, both lip lines, jaw, chin and eyes) and the photo really talks with the person's own lips: only the lips and the skin right around the mouth move (nothing beyond about one and a half mouth-widths, so the cheeks, jaw and the rest of the face stay still). The lower lip drops, the upper lip lifts a little, the corners spread or round, the lips press for m/b/p and tuck for f/v. The photo itself opens where the lips part: for each pixel the app works out where the edges of the upper and lower lip moved to and makes the photo see-through between them, with the inside of the mouth (dark, tongue, and teeth if the photo shows none) painted underneath. The real lips are the edge of the opening, so nothing spills past them, with beards and moustaches too. If the photo already shows teeth, the real teeth stay. Phones without high-precision graphics fall back to painting the mouth on top. Choose the framing: **Face only** (default — the app cuts the face out along its real outline, from forehead to chin, and fills the screen with it; the cut follows the jaw as it opens) or **Head & shoulders**. Choose the look: **Real person** (the photo in natural colour, default) or **Hologram tint**. The eyes always blink: if face mapping misses them, the app estimates them from the mouth and snaps them to the pupils. Tap the mouth to adjust it, then pick a voice (Warm, Clear, Lively).
3. **Session** — the tutor on a black stage, the conversation below, and the mic bar. Hands-free by default: just talk, even while the tutor is speaking; anything you say cuts in. The camera button shares a photo of your work, the keyboard button types instead, and tapping the mic pauses listening or stops the tutor mid-answer.
4. **Holo box setup** — side-view diagram, image orientation (Normal, Mirror, Flip, 180°), glow brightness, "Voice only" (hides the exit button) and "Keep screen awake".
5. **Holo mode** — only the tutor on pure black, oriented for the pane, with the whiteboard glowing underneath. Leave with "screen mode", a double-tap, or the exit button.
6. **Subject & level** — pick a subject (or Anything), and a level (Primary to College). The tutor teaches at that level.
7. **Whiteboard** — as the tutor talks, it writes the key formula, definition or steps on a board under the hologram. A process shows as steps joined by arrows.
7b. **Video references** — say "show me a video" (or tap Videos on the whiteboard). The tutor finds up to 3 short YouTube videos on the current topic using Claude's web search, keeps only videos that actually came back from the search, and plays the one you pick inside the app ("play the second one"). Say "close video" when done. The video's own sound is ignored, so it can't trigger the tutor. If the search finds nothing, you get suggested YouTube searches instead. Videos are saved with the lesson and shown on its recap. In the Claude preview, videos open on YouTube as searches, because the preview can't use web search or show other sites inside the page.
7a0. **Question of the day** — a surprising multiple-choice brain teaser on the home screen and in the Fun zone, new each day (written by Claude for your level; a built-in set is used offline). Right answer +40 XP, a try +10 XP; answer 3 days to unlock the 📅 Daily Thinker badge.
7a1. **Quick replies** — after each answer, one-tap chips steer the explanation: 🧒 Simpler, 🔭 Go deeper, 💡 Example, ❓ Quiz me (in Fun chat: 😂 Another!, 🤯 Fun fact, 🧠 Trivia, 🎲 Surprise me). Saying "simpler", "go deeper", "example", "another one" or "surprise me" does the same.
7a2. **Holo effects** — entering holo mode, the tutor materializes with a scan-line sweep, a flicker and a soft power-up sound; glowing particles drift through the hologram, and while it talks a halo pulses with its voice and rings ripple out from its base (cyan in study, amber in Fun chat).
7a3. **Showcase mode** (Holo box setup → Showcase mode, or `?showcase=1`) — for exhibitions. When nobody has talked for a while, the hologram shows a rotating "Ask me: …" caption, goes back from the board to the tutor, and every half a minute or so invites passers-by over or shares a "Did you know?" fact (mentioning "Hey Tutor" when the wake word is on). Anyone speaking wakes it straight away.
7a. **Fun zone (progress in Fun mode)** — Fun chat has its own progress, kept separate from study (study progress never counts fun chats or trivia). Tap the 🏆 Lv button in Fun chat, or open Progress → Fun:
   - **XP and levels** — +10 XP per message, +20 for the first fun chat of the day, +25 per trivia answer right, +50 for a perfect round, +30 per badge. Levels need 120, 280, 480, 720… XP and come with titles (Newbie, Rookie, Explorer, Fun Seeker, Joke Jockey, Trivia Tiger, Superstar, Legend, Holo Hero, Mega Legend), shown on a glowing level ring and XP bar.
   - **Fun streak** — a flame that lights up and grows, with this week's fun days.
   - **Stats** — messages, jokes, trivia answers right and best trivia score.
   - **Your fun mix** — what you chat about most (jokes, movies & shows, gaming, riddles, trivia, just chatting), with your favourite highlighted.
   - **15 badges** — Daily Thinker, Say Hi, Giggle Box, Movie Buff, Gamer, Riddle Solver, Quiz Whiz, Perfect Round, On Fire, Week Warrior, Chatterbox, All-Rounder, Night Owl, Early Bird, Superstar. Locked badges show how close you are.
   - **Recently chatted** topics, plus Play trivia (picks your favourite kind) and Fun chat buttons.
   - **Celebrations** — level-ups and new badges pop up with confetti and a chime (in holo mode the popup is part of the hologram), and the tutor says it out loud; a small +XP floats from the trophy after each message.
   - Say "my score", "my progress" or "how am I doing" to hear your level, XP, streak and badges.
7b1. **Full working on the whiteboard** — when the tutor solves a problem (any calculation, equation, derivation or numerical question), the board shows every equation in order, like a teacher at a blackboard: Given and Find, the formula, the values substituted in, each simplifying step on its own line (up to 14 lines), and the final answer starting with ∴ in a glowing box. Out loud it walks through the steps briefly and points to the board. On screen the board scrolls to follow the working; in holo mode the whole working is shown and shrinks to fit the glass.
7b2. **Board or face in holo mode** — while the tutor explains with the board, the whiteboard fills the glass (topic heading, big glowing lines, voice bars that move while it talks) and the face is hidden. Say "show your face" to see the tutor, and "show the board" to bring the board back. Said mid-explanation, these switch the view without interrupting. Each new question starts on the face, and the board comes back when the answer uses it. The admin console has Show face / Show board buttons too.
7c. **Holographic references** — in holo mode, pictures and videos float above the tutor as part of the hologram, mirrored for the glass with a glowing edge and scanlines. When a picture helps, the tutor picks one itself (it names a Wikipedia article; the app loads its main image from Wikipedia/Wikimedia Commons, free and without a key). White-background diagrams are flipped to light-on-dark so they glow in the pane instead of showing as a white box. Say "show me a diagram of a leaf" for a picture on demand, "show me a video" then "play the first one" to play a video as a hologram, "close video" or "hide picture" to clear it. In screen mode, pictures appear in the conversation with a Wikipedia credit. The Claude preview can't load pictures from other sites, so it links to them instead.
8. **Quiz** — say "quiz me" (or tap Quiz me). The tutor writes a short multiple-choice quiz on what you just covered and reads each question out. Answer by voice ("B", "the second one", or the answer itself) or by tapping. "Hint", "skip" and "repeat" work too. Results show your score and what to review.
9. **Progress** — streak, lessons, questions asked, quiz accuracy, topics per subject, and weak spots from missed quiz questions, each with a Practice button.
10. **History & recap** — every lesson is saved with a short recap the tutor reads back to you, its key points and board, the full conversation, "Quiz me on this" and "Continue topic".
11. **Settings** — voice, speaking speed, talking over the tutor, the "Hey Tutor" wake word, holo box and tutor face.

On the photo tutor, a blink is a real eyelid: the skin just above the eye (never the eyebrow) slides down over it like a shutter, the lash line rides on the lid's edge at its natural thickness and a soft shadow falls under it, while the eye itself is never squashed (about 75 ms to close, a short hold, 170 ms to open). All tutors behave like a person: irregular blinks (about 15–20 a minute, with the odd double blink, a blink when a phrase starts or the eyes jump, half-blinks while thinking), quick eye movements that mostly hold your gaze and glance away while talking, a soft resting smile, small nods at commas and sentence ends, a slow head tilt and breathing. On the photo tutor the irises and lip corners move inside the photo itself; the eyebrows stay still. Lips are driven by mouth shapes read from the words: open vowels (a), spread (ee), rounded and pushed out (o, oo), lips pressed shut (m, b, p), lower lip tucked under the top teeth (f, v), and tongue up behind the teeth (l, t, d, n, th). Each shape blends into the next, closes faster than it opens, and — when the cloud voice is playing — opens wider on loud syllables and closes on quiet ones. All three tutors lip-sync: the holo human's mouth, the photo's jaw and the globe's voice ring all move with the words being spoken. Settings and the face photo are remembered on the device.


## Android app (APK)

`mobile/` turns Holo Tutor into an Android app with [Capacitor](https://capacitorjs.com). Inside the app, voice uses **Android's own engines**: speech recognition (`@capacitor-community/speech-recognition`, Android SpeechRecognizer) and text-to-speech (`@capacitor-community/text-to-speech`, the phone's TTS voices). `mobile/native-voice.js` makes them look like the browser's `SpeechRecognition` and `speechSynthesis`, so the app code is the same everywhere. It listens after the tutor finishes speaking (no echo loop), asks for the microphone once, keeps the screen on, and has the Holo Tutor icon and a dark splash screen.

The AI is the same as the standalone file: paste your Anthropic API key once in the app (stored only on the phone). Without a key the tutor can't answer.

**Get the APK without installing anything:** push this repo to GitHub; the **Build Android APK** workflow (`.github/workflows/android-apk.yml`) builds it in the cloud and publishes `HoloTutor.apk` under **Releases**. You can also run it by hand from the Actions tab.

**Or build it yourself** (needs Node 20+, JDK 21 and Android Studio):
```
python3 build.py
cd mobile
npm install
npm run sync            # copies the latest app into the Android project
cd android && ./gradlew assembleDebug    # or open mobile/android in Android Studio → Build → Build APK
```
The APK is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. It's signed with `mobile/android/holo-tutor-debug.keystore` so new builds install over old ones; that key is for sideloading only; make a private release key before publishing to the Play Store.

**Install on a phone:** copy or download the APK to the phone, open it, and allow "Install unknown apps" when Android asks.

## Free speech-to-speech (browser voice console)

Listening and speaking use only free, built-in browser features: **Web Speech API `SpeechRecognition`** for your voice and **`speechSynthesis`** for the tutor's. No extra service, key or cost. Your words still go to the same AI connection as before (`askBrain` in `brain.js` / `brain-direct.js` / `brain-preview.js`); nothing new was connected.

- **Voice console** (bottom of the chat): a large glowing mic (tap to pause or resume; tap while the tutor talks to stop it), a state pill (Listening → Hearing you → Thinking → Speaking / Speaking · muted / Mic paused / Text mode), a live waveform (follows the tutor's mouth while it speaks, your speech while it listens, a pulse while it thinks), **Stop**, **Replay** (says the last answer again) and **Mute** (answers stay on screen and the face still mouths them silently).
- **Live transcript**: what you're saying shows in the chat as you speak, then becomes your message.
- **Continuous conversation**: the mic restarts itself after every phrase and stays open while the tutor talks, so you can interrupt by speaking (Settings → Talk over the tutor).
- **Voice picker**: Settings → *Voice on this device* lists every English voice the device has (marking ones that need internet), or Auto.
- **No overlapping audio**: replies are spoken one sentence at a time from a single queue; a new question, Stop, Replay or talking over the tutor clears the queue first.
- **Face**: the existing hologram face lip-syncs to each sentence (using the voice's word timing where the browser provides it), returns to a closed, resting mouth when speech ends, and has listening (attentive, smiling, steady gaze), thinking (eyes up and aside, slight head tilt) and speaking states.
- **Problems, in plain words**: unsupported browser (Firefox has no speech recognition: type instead, answers are still spoken), microphone blocked (with how to allow it and *Try again*), no microphone found, no internet for recognition (Chrome sends audio to its speech service), no voices on the device; the text box is always there as a fallback.

**Cost, honestly:** listening and speaking are free everywhere. The AI's answers come from Claude through your existing connection: in the **published preview** that is the `sample` capability (your Claude account; no API key or credits). The **standalone file** and **server version** call the Anthropic API with *your* key, which is billed by Anthropic; that wasn't changed. Inside the claude.ai preview the page isn't allowed to use the microphone, so it offers **voice typing** instead: tap the mic, speak with your keyboard's 🎤 (phone) or the computer's dictation (Windows + H; on a Mac turn on Dictation in System Settings → Keyboard, then use its shortcut or Edit → Start Dictation; stop dictation (same shortcut, or Esc) when you finish speaking, because macOS mutes other sound while it's listening, so the answer can only be heard once dictation is off), and it sends by itself when you pause (about 2 seconds), then answers out loud. Speaking while the tutor talks interrupts it, and the box is ready for your next question when it finishes; tap the mic again to turn voice typing off. For fully hands-free voice (no tapping), use the standalone file or the server version.

## Train AI twin: teach an AI to talk like you

A third card on the opening screen (or say "train my twin"). You train an **AI twin** of yourself, then meet it as a hologram that talks the way you do, with your face if you've uploaded your photo.

1. **Permission first.** Enter whose twin it is and tick that it's of you, or of someone who has said yes.
2. **Interview, out loud.** The tutor asks questions one at a time across seven areas: ✨ Personality, 🗣️ How you talk, 📖 Your story, 🎯 Interests, 💭 Opinions, 😄 Humour, 🧠 What you know. Just answer the way you normally talk (or type). Say "skip" for another question, "stop" to pause. Questions come from the area you've covered least.
3. **Add facts and writing.** Quick facts ("I always say 'super' when I'm happy") and messages or posts you've written, so it learns your style.
4. **Twin profile.** Every few answers (or when you tap ✨ Update my twin), Claude turns everything into a profile: who you are, how you talk, your catchphrases, facts, interests, opinions, humour and how you greet friends. A **twin strength** ring and stage (Just met you → Learning you → Getting there → Almost you → Twin unlocked) shows how well it knows you.
5. **Talk to your twin.** It answers in the first person as you, greets people your way, and works in holo mode too. After each reply: **👍 Sounds like me** (saved as a good example) or **✏️ I'd say it…** (say or type how you'd really say it; corrections are followed closely next time).

How it stays honest and safe: the twin only states personal facts you taught it (otherwise it says you haven't taught it that yet), says it's your AI twin if someone sincerely asks whether it's really you, never makes promises or decisions on your behalf, and never repeats private details such as addresses, phone numbers or passwords. Twin chats don't count towards study or Fun zone progress. **Delete my twin** erases everything it learned.

This is not fine-tuning a model: the twin is built from what you teach it (sent to Claude as instructions with each chat), and it speaks with the app's voices; it doesn't clone your voice. The twin is saved with your account (synced on the server version; per learner profile in the standalone file).

## Accounts: sign in and create account

The first time the app opens, it asks you to **sign in**, **create an account** or **continue as a guest** (a guest isn't asked again, and showcase / `?mode=holo` / `?guest=1` links skip it). Your avatar and name show on the start screen, the tutor greets you by name ("Good evening, Asha") and uses your first name now and then, and Settings has an account card (tap the avatar to change it, Edit to rename, Sign out / Switch learner).

- **Server version — real accounts.** Email and password. Passwords are hashed with scrypt and a random salt per user and checked in constant time; sign-in is limited to 10 tries per 15 minutes; the session is a random token in an HttpOnly, SameSite=Lax cookie (Secure behind HTTPS), and only its SHA-256 is stored. Your learner data (progress, Fun zone XP and badges, lesson history, question of the day, face photo, tutor choice and voice settings) syncs to your account, so signing in on another phone brings it all back. Signing out removes your data from that phone. Anything you did as a guest before creating an account is kept. Data is stored as JSON in `DATA_DIR` (default `./data`, files readable only by the server user); back that folder up. For a real deployment, serve over HTTPS.
- **Standalone file and preview — learner profiles on this device.** No server, so accounts are profiles saved on the device: "Who's learning?" shows each learner's avatar and name, with an optional 4-digit PIN (5 wrong tries locks it for 5 minutes). Each learner has their own progress, badges, history and settings. Good for a family phone or a holo box at a showcase.

Device settings (holo box orientation and brightness, voice engine, showcase mode, API keys) are shared by everyone on the device.

## Fastest way to try speech-to-speech (no server)
`standalone/holo-tutor.html` is the whole app in one file. It talks to Claude directly from the browser using your own Anthropic API key, which you paste on the Home screen and which stays in that browser.
1. Go to app.netlify.com/drop and drag `holo-tutor.html` onto the page. You get an `https://` link in seconds. (GitHub Pages works too.)
2. Open that link on your phone in Chrome (Android) or Safari (iPhone), paste your API key, tap Start learning and allow the microphone.
3. From then on it's hands-free: just talk.

Don't share that link with a key already saved on a device you hand to strangers; anyone using that browser can use your key. For a public showcase, use the server version below so the key stays on the server.

The Claude preview of this app can't use the microphone (the preview frame blocks it), so it falls back to typing there.

## Voice replies
The tutor always answers out loud, using one of two voices:
- **Built-in voice** — the phone or browser's own text-to-speech. Free, but it only works if the device has a voice for the language and if the browser allows speech (some in-app browsers don't).
- **Cloud voice** — Google Cloud Text-to-Speech: a natural English voice on any phone. Server version: set `GOOGLE_TTS_KEY` on the server. Standalone file: paste the key in Settings → Voice. (Create it in Google Cloud Console → enable "Cloud Text-to-Speech API" → Credentials → API key; restrict it to that API and your site.)
Settings → Voice engine: **Auto** (default) uses the built-in voice when it can and switches to the cloud voice when there's no voice for the language or the device doesn't actually speak; **Built-in** or **Cloud** force one. "Test voice" plays a sample, and the line above it says which voice is in use. If neither voice can speak, the tutor says why in the chat and how to fix it. The Claude preview can only use the device's built-in voice.

## Admin console (testing)
An amber **ADM** button sits in the bottom-left corner of every screen (or press **Shift+D** on a keyboard). It opens a panel that is never mirrored, even in holo mode, with:
- a text box to **type as the student** — typed text goes exactly where speech would: questions, commands ("hologram mode", "quiz me", "show me a video"), quiz answers. Typing from the start screen jumps straight into a session.
- quick buttons: Fun chat, Study, Holo mode, Screen, Quiz me, Video, Picture, Flip, Repeat, Stop talking, Mic on/paused, Start screen;
- the API key field (standalone build);
- a live log of what was heard or typed, what the tutor said (with its board, picture and topic), and any mic or network errors.
Turn it off in Settings → Admin console when testing is done, or force it with `?admin=1` / `?admin=0`.

## Run it (server version)

Needs Node 18.17+ and an Anthropic API key. No dependencies to install.

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
# open http://localhost:3000
```

Optional: `HOLO_MODEL` (default `claude-sonnet-5-5`), `PORT`.

### On a phone
Browsers only allow the microphone and camera on **HTTPS** (or localhost). Two options:
- **Quick test:** `npx cloudflared tunnel --url http://localhost:3000` and open the `https://…trycloudflare.com` link on the phone.
- **Real deployment:** push this folder to Render, Railway or Fly.io as a Node web service with `ANTHROPIC_API_KEY` set. The key stays on the server; the phone never sees it.

Then "Add to Home Screen" so it opens full screen without browser bars.

**Browser support:** Chrome on Android is the best experience. Safari on iPhone/iPad works (needs Settings → Siri → *Siri & Dictation* on, because Safari uses Apple's dictation service). Chrome and Edge on laptops work. Firefox has no speech recognition, so it falls back to typing.

## Voice commands (in a session or in holo mode)

| Say | Does |
|---|---|
| anything else | asks the tutor |
| "look at this", "check my homework", "take a photo" | 3-2-1 camera snapshot, then the tutor teaches from it |
| "hologram mode" / "screen mode" | switch views |
| "flip" | cycle orientation: Normal → Mirror → Flip → 180° |
| "switch camera" | front ↔ back camera |
| "repeat" | says the last answer again |
| "start over" | clears the conversation |
| "quiz me" / "quiz me on fractions" | starts a quiz on the current or named topic |
| "show me a video" / "find a video about tides" | finds short videos on the current or named topic |
| "play the first one", "close video" | plays a found video in the app; closes it |
| "show me a picture/diagram/map of …", "hide picture" | shows or hides a reference picture (a hologram in holo mode) |
| "read the board" | reads out the whiteboard |
| in a quiz: "A"…"D", "hint", "skip", "repeat", "try again", "back to lesson" | answers and moves through the quiz |
| "help" | lists the commands |

## Settings (URL parameters)

| Param | Default | Meaning |
|---|---|---|
| `wake=1` | off | only respond after "Hey Tutor"; recommended at a crowded showcase |
| `mode=holo` | off | the Home button goes straight into holo mode |
| `bargein=0` | on | turn off talking over the tutor. By default the mic stays open while it speaks, so you can cut in with a new question or "stop"; its own voice coming back through the speaker is ignored |
| `rate` | `1` | speaking speed |

Example for the showcase: `https://your-app/?mode=holo&wake=1`

## Holo box tips
1. Lay the phone flat, screen up, under the pane, brightness at maximum.
2. Enter holo mode. Everything except the glowing tutor is black, and black is invisible in the reflection.
3. If the tutor looks backwards or upside down in the glass, say "flip" until it's right (or change it on the setup screen).
4. Darken the area behind the pane; the illusion depends on contrast.

Inside the box the phone faces up, so its camera can't see the student's work. When someone says "look at this" in holo mode, the app switches back to the session screen for the snapshot.

## How it works
```
mic ─► Web Speech recognition ─► command? ─► ask()
                                              │  POST /api/chat (history + optional photo)
                                              ▼
                             server.js ─► Claude (streaming)
                                              │  text as it is written
                                              ▼
                 sentence splitter ─► speechSynthesis queue ─► tutor lip sync
```
- `server.js` — serves the app and streams answers from the Claude Messages API with the tutor's instructions (short spoken answers, no markdown, teach from photos).
- `public/app.js` — screens, the full-duplex voice loop (the mic stays open while the tutor talks, with an echo filter so it ignores its own voice), commands, photos, holo mode.
- `public/face.js` — the talking-photo engine: a WebGL mesh warp driven by the face rig, plus the painted mouth interior.
- `public/lips.js` — finds the lips: MediaPipe Face Landmarker on the device first (mouth corners 61/291, 11-point inner lip curves), and Claude vision as a fallback (`/api/locate` on the server), which also traces 5 points along each inner lip edge.
- `public/prompt.js` — the tutor's instructions (spoken reply, then `<board>` lines and a `<topic>`), and the quiz and recap prompts.
- `public/media.js` — reference pictures from Wikipedia and the light-background check for diagrams.
- `public/visemes.js` — turns spoken text into mouth shapes (visemes) (English).
- `public/tutor.js` — the globe, holo human and photo-hologram renderers and the lip-sync engine.
- `public/brain.js` — how the app reaches Claude (here: via the server).
- `src/body.html` + `build.py` — the screens' markup. Run `python3 build.py` after editing it to regenerate `public/index.html` (and the single-file preview in `preview/`).

## Roadmap
- **References & short videos:** let the tutor search the web and suggest a short clip, as the design's "Suggested reference" card shows.
- **Better photo faces:** face-landmark detection so the mouth is found automatically, then a 3D talking head.
- **Natural voice:** cloud speech-to-text and neural TTS (or a realtime voice model) for accuracy in noise, Indian languages, barge-in without headphones, and lip sync driven by the audio itself.
