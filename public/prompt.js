// Holo Tutor — what the tutor is told, and how its replies are read back.
// Shared by the server, the standalone file and the Claude preview.

export const SUBJECTS = [
  { id: 'any', name: 'Anything' },
  { id: 'maths', name: 'Maths' },
  { id: 'physics', name: 'Physics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'biology', name: 'Biology' },
  { id: 'english', name: 'English' },
  { id: 'history', name: 'History' },
  { id: 'geography', name: 'Geography' },
  { id: 'coding', name: 'Coding' },
  { id: 'fun', name: 'Fun chat', hidden: true },
  { id: 'twin', name: 'AI twin', hidden: true },
];
export const LEVELS = ['Primary', 'Middle school', 'High school', 'College'];
export const LANGS = [{ id: 'en-IN', name: 'English' }]; // English only
export const subjectName = (id) => (SUBJECTS.find((s) => s.id === id) || SUBJECTS[0]).name;
const langName = (id) => (LANGS.find((l) => l.id === id) || LANGS[0]).name;

export function tutorSystem(ctx = {}) {
  if (ctx.mode === 'fun') return funSystem(ctx);
  if (ctx.mode === 'twin') return twinSystem(ctx);
  const subj = ctx.subject && ctx.subject !== 'any' ? subjectName(ctx.subject) : '';
  const level = ctx.level || 'High school';
  const lang = langName(ctx.lang || 'en-IN');
  return `You are Holo Tutor, a friendly holographic tutor. A student talks to you out loud; your words are spoken back through a hologram, and you have a small whiteboard beside you.
${subj ? `The student is studying ${subj} at ${level} level.` : `The student may ask about any subject; teach at ${level} level.`} The student's speech language is ${lang}; reply in that language unless they switch.${ctx.name ? ` Their name is ${String(ctx.name).slice(0, 30)}; use it now and then, naturally (not in every reply).` : ''}

Reply in exactly this shape:
1. What you say out loud: two to five short sentences, one idea at a time, ending with a brief question that checks understanding or offers to go deeper. Plain spoken words only: no markdown, lists, emojis, symbols or URLs, and never the < character. Say maths the way a teacher would ("x squared plus three x", "H two O").
2. Then the whiteboard, with the key thing to remember:
<board>
One to four short lines, each under 42 characters: a formula, a definition, or key steps.
Use real notation on the board (x² + 3x, H₂O, F = ma, √, π).
For a process or sequence, write one line of steps joined by → .
</board>
   When you solve or work through a problem (any calculation, equation, derivation, proof or numerical question in maths, physics, chemistry and so on), the board shows ALL of the working, like a teacher at a blackboard: up to 14 lines, one equation per line, each under 42 characters, in order:
   - "Given:" the known values with units (one line, or a few), and "Find:" what is asked;
   - the formula or rule used;
   - the values substituted in;
   - every step of simplifying, one equation per line, never skipping a step;
   - the final answer on the last line, starting with ∴ (for example "∴ x = 3" or "∴ v = 20 m/s").
   In the working, join steps with = or ⇒, never →. Out loud, walk through the steps briefly (up to six sentences) and point to the board, instead of reading every line.
3. When a picture would really help (a diagram, an organism, a place, an apparatus, a person, an artwork), a reference picture: <image>the Wikipedia article title that has that picture</image>. At most one; leave it out when it wouldn't help.
4. Then the topic: <topic>two to four words</topic>
Write nothing after </topic>. Leave out the board only for greetings or small talk, but always give the topic.

How to teach:
- The student's words come from speech recognition and may contain mis-heard words. Infer the sensible meaning; if it is genuinely unclear, ask one short clarifying question.
- Prefer intuition and a concrete example before formulas. When a problem is being solved, always put every equation of the working on the board, from the given values to the final answer.
- If the student shares a photo (homework, a textbook page, a diagram), first say in one sentence what you see, then teach from it. If it's blurry or cut off, ask them to retake it.
- Be warm and encouraging, never condescending.`;
}

// Splits a (possibly still streaming) reply into what is spoken, the board lines and the topic.
export function splitReply(raw = '') {
  const lt = raw.indexOf('<');
  const spoken = (lt < 0 ? raw : raw.slice(0, lt)).trim();
  const bm = /<board>([\s\S]*?)(<\/board>|<image>|<topic>|$)/i.exec(raw);
  const closed = Boolean(bm && bm[2]);
  let lines = bm ? bm[1].split('\n') : [];
  if (bm && !closed) lines = lines.slice(0, -1); // the last line may still be arriving
  lines = lines.map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 14);
  const tm = /<topic>([\s\S]*?)(<\/topic>|$)/i.exec(raw);
  const topic = tm && tm[2] ? tm[1].trim().slice(0, 60) : '';
  const im = /<image>([\s\S]*?)<\/image>/i.exec(raw);
  const image = im ? im[1].trim().slice(0, 100) : '';
  return { spoken, board: lines, topic, image };
}

export function parseJSONText(t) {
  const m = /\{[\s\S]*\}/.exec(t || '');
  if (!m) throw new Error('no JSON');
  return JSON.parse(m[0]);
}

export function quizPrompt({ topic, subject, level, notes, count = 5, lang }) {
  const inLang = langLine(lang);
  if (subject === 'fun') {
    return `Write a fun ${count}-question multiple-choice trivia quiz about "${topic}" (movies, shows, games or pop culture) for a school student. Family-friendly, no spoilers of big twists. Start easy and get harder.
${notes ? `Base it on what we just chatted about:\n${notes.slice(0, 3000)}\n` : ''}Each question has exactly 4 options, each under 40 characters, and one correct answer.${inLang}
Reply with JSON only, no other text:
{"title":"2-4 word quiz title","questions":[{"q":"the question as shown on screen","q_say":"the question as you'd say it aloud","options":["","","",""],"options_say":["each option as said aloud","","",""],"answer":0,"hint":"one playful spoken hint that doesn't give it away","why":"one or two spoken sentences with a fun fact about the answer","skill":"2-4 word theme of this question"}]}
"answer" is the index, 0 to 3, of the correct option.`;
  }
  const subj = subject && subject !== 'any' ? ` (${subjectName(subject)})` : '';
  return `Write a ${count}-question multiple-choice quiz for a ${level || 'High school'} student on "${topic}"${subj}.
${notes ? `It should check what was just taught:\n${notes.slice(0, 3000)}\n` : ''}Each question has exactly 4 options, each under 40 characters, and one correct answer. Start easy and get harder; make the wrong options plausible.${inLang}
Reply with JSON only, no other text:
{"title":"2-4 word quiz title","questions":[{"q":"the question as shown on screen; symbols like x², √, → are fine","q_say":"the question as a teacher would read it aloud, maths in words","options":["","","",""],"options_say":["each option read aloud, maths in words","","",""],"answer":0,"hint":"one spoken sentence that helps without giving the answer away","why":"one or two spoken sentences explaining the right answer","skill":"2-4 word sub-skill this checks"}]}
"answer" is the index, 0 to 3, of the correct option. In q_say, options_say, hint and why use words only, no symbols.`;
}

export function recapPrompt({ topic, turns, lang }) {
  let transcript = turns.map((t) => `Student: ${t.q}\nTutor: ${t.a}`).join('\n');
  if (transcript.length > 6000) transcript = transcript.slice(-6000);
  return `Here is a tutoring conversation${topic ? ` about ${topic}` : ''}. Write a short recap the tutor will read aloud to the student later.${langLine(lang)}
Reply with JSON only, no other text:
{"title":"2-4 word lesson title","summary":"two or three warm spoken sentences recapping what we covered, speaking to the student as you; maths in words","points":["up to four key points to remember, each under 60 characters; symbols allowed"],"next":"one suggested next topic, 2-5 words"}
Transcript:
${transcript}`;
}

// ---------- video references ----------
export const ytId = (url) => (/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url || '') || [])[1] || '';
export const ytSearch = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

// Used with web search: real videos only.
export function videoPrompt({ topic, subject, level, lang }) {
  const pref = langBaseP(lang) !== 'en' ? ` Prefer good videos in ${langName(lang)} if there are any; English is fine otherwise.` : '';
  if (subject === 'fun') {
    return `Find up to 3 short, family-friendly YouTube videos about "${topic}": official trailers, game trailers or gameplay highlights, or short fun explainers, from official studio, game or well-known channels.
Use web search, restricted to youtube.com, and include only videos whose URLs you actually saw in the search results.${pref}
Reply with JSON only, no other text:
{"videos":[{"title":"the video's title","channel":"channel name","url":"https://www.youtube.com/watch?v=...","minutes":0,"why":"one short sentence on what it shows"}]}`;
  }
  const subj = subject && subject !== 'any' ? ` (${subjectName(subject)})` : '';
  return `Find up to 3 short YouTube videos, ideally under 12 minutes, that teach "${topic}"${subj} well to a ${level || 'High school'} student.
Prefer trusted educational channels such as Khan Academy, CrashCourse, TED-Ed, 3Blue1Brown, Veritasium, Amoeba Sisters, The Organic Chemistry Tutor, Physics Wallah, Vedantu, Byju's or Numberphile.
Use web search, restricted to youtube.com, and include only videos whose URLs you actually saw in the search results.${pref}
Reply with JSON only, no other text:
{"videos":[{"title":"the video's title","channel":"channel name","url":"https://www.youtube.com/watch?v=...","minutes":0,"why":"one short sentence on what it shows"}]}`;
}

// Without web search: good YouTube searches instead of guessed links.
export function videoQueryPrompt({ topic, subject, level, lang }) {
  const pref = langBaseP(lang) !== 'en' ? ` Prefer good videos in ${langName(lang)} if there are any; English is fine otherwise.` : '';
  if (subject === 'fun') {
    return `Someone is chatting for fun about "${topic}". Suggest 3 YouTube searches for short, family-friendly videos about it (an official trailer, highlights or gameplay, a fun behind-the-scenes or explainer).${pref}
Reply with JSON only, no other text:
{"videos":[{"title":"what that video will show, 3-7 words","query":"the search text","why":"one short sentence"}]}`;
  }
  const subj = subject && subject !== 'any' ? ` (${subjectName(subject)})` : '';
  return `A ${level || 'High school'} student is learning "${topic}"${subj}. Suggest 3 YouTube searches that will find short, high-quality videos explaining it, each from a different angle (a clear explanation, a worked example or demonstration, a visual or animation).${pref}
Reply with JSON only, no other text:
{"videos":[{"title":"what that video will show, 3-7 words","query":"the search text, including a trusted channel name","why":"one short sentence"}]}`;
}

// Keeps only real YouTube videos; when resultUrls is given, only ones the search actually returned.
export function cleanVideos(j, resultUrls) {
  const seen = resultUrls ? new Set(resultUrls.map(ytId).filter(Boolean)) : null;
  const out = [];
  for (const v of (Array.isArray(j?.videos) ? j.videos : [])) {
    if (v?.query) { out.push({ title: String(v.title || v.query).slice(0, 80), query: String(v.query).slice(0, 120), url: ytSearch(v.query), why: String(v.why || '').slice(0, 140) }); continue; }
    const id = ytId(v?.url);
    if (!id || (seen && !seen.has(id)) || out.some((o) => o.id === id)) continue;
    out.push({ id, url: `https://www.youtube.com/watch?v=${id}`, title: String(v.title || 'Video').slice(0, 100), channel: String(v.channel || '').slice(0, 60), minutes: Math.round(+v.minutes) || 0, why: String(v.why || '').slice(0, 140) });
  }
  return out.slice(0, 3);
}

// Pulls the URLs the web-search tool returned out of a Messages API response.
export function searchResultUrls(content) {
  const urls = [];
  for (const b of content || []) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach((r) => r?.url && urls.push(r.url));
  }
  return urls;
}

export const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 3, allowed_domains: ['youtube.com'] };

// Fun chat: a playful companion for movies, jokes and gaming.
export function funSystem(ctx = {}) {
  const lang = langName(ctx.lang || 'en-IN');
  return `You are Holo Buddy, the fun side of Holo Tutor: a friendly, upbeat hologram who loves movies, shows, cartoons, anime, jokes and video games. Someone is chatting with you out loud for fun; your words are spoken back through a hologram, and you have a small screen beside you for fun facts. Their speech language is ${lang}; reply in that language unless they switch.${ctx.name ? ` Their name is ${String(ctx.name).slice(0, 30)}; use it now and then, naturally (not in every reply).` : ''}

What you're great at:
- Jokes and riddles: clean and clever, one at a time. Set it up, then give the punchline in its own short sentence. For riddles, let them guess before revealing.
- Movies, series, cartoons and anime: plots without spoilers unless they ask, characters, actors, fun behind-the-scenes facts, and recommendations matched to what they like. Bollywood, Tollywood and Hollywood all welcome.
- Gaming: Minecraft, Roblox, Fortnite, BGMI, Free Fire, Pokémon, Mario, FIFA, Valorant and more: tips, strategies, lore, builds and game recommendations.
- Quick games: would-you-rather, twenty questions, word games and trivia.

Keep it family-friendly and right for school students: no gore, no adult content, nothing scary for little kids, and don't push in-game purchases or gambling. If they ask about something rated for older audiences, say so briefly and suggest something that fits. Your knowledge has a cutoff; for very new releases, say you might not know the latest and share what you do know. If they bring up homework or a study question, help briefly and mention they can say "let's study" for a full lesson.

Reply in exactly this shape:
1. What you say out loud: one to four short, lively sentences, ending with a question or a hook to keep the chat going. Plain spoken words only: no markdown, lists, emojis, symbols or URLs, and never the < character.
2. Then, when it adds something, the fun-facts screen:
<board>
One to three short lines, each under 42 characters: a title with its year, a pro tip, a riddle, a fun fact, or a punchline after you've said it.
</board>
3. When a picture would really help (a game, a character, a film, a place), a reference picture: <image>the Wikipedia article title that has that picture</image>. At most one.
4. Then the topic: <topic>two to four words</topic>
Write nothing after </topic>. Always give the topic.`;
}

const langBaseP = (lang) => String(lang || 'en').slice(0, 2);
function langLine() { return ''; } // English only

// Question of the day: one surprising multiple-choice brain teaser.
export function qotdPrompt({ level = 'High school', seed = '' } = {}) {
  return `Write one fun, surprising multiple-choice "question of the day" for a ${level} student. Pick a topic from science, space, nature, the human body, maths puzzles, inventions or world records (variety seed: ${seed}). The answer should make them say "whoa".
Reply with JSON only, no other text:
{"emoji": "one emoji for the topic", "q": "the question, under 110 characters", "options": ["four short options"], "answer": 0, "why": "one or two short sentences explaining the answer"}
Exactly four options, under 40 characters each; "answer" is the index (0 to 3) of the correct one. No trick questions.`;
}
export const QOTD_FALLBACK = [
  { emoji: '🐙', q: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Eight'], answer: 2, why: 'Two pump blood through the gills and one pumps it around the body.' },
  { emoji: '🌕', q: 'Which planet has a day longer than its year?', options: ['Mars', 'Venus', 'Jupiter', 'Mercury'], answer: 1, why: 'Venus spins so slowly that one day there (243 Earth days) is longer than its year (225 Earth days).' },
  { emoji: '🍯', q: 'Which food never goes bad if sealed well?', options: ['Bread', 'Cheese', 'Honey', 'Rice'], answer: 2, why: 'Honey is so low in water and so acidic that microbes can\'t grow in it; edible honey was found in Egyptian tombs.' },
  { emoji: '⚡', q: 'Lightning is how much hotter than the Sun\'s surface?', options: ['About the same', 'About 5 times', 'Half as hot', '100 times'], answer: 1, why: 'A lightning bolt reaches about 30,000 °C, around five times hotter than the Sun\'s surface.' },
  { emoji: '🦴', q: 'Which is the smallest bone in your body?', options: ['Stapes (in the ear)', 'Little toe bone', 'Kneecap', 'Wrist bone'], answer: 0, why: 'The stapes in your middle ear is about 3 mm long and helps carry sound.' },
  { emoji: '🌊', q: 'What fraction of Earth\'s oceans has been explored?', options: ['Over 90%', 'About half', 'Less than a quarter', 'All of it'], answer: 2, why: 'Most of the deep ocean is still unexplored; we have better maps of Mars than of our sea floor.' },
  { emoji: '🧊', q: 'Can hot water freeze faster than cold water?', options: ['Never', 'Sometimes, yes', 'Only in space', 'Only salt water'], answer: 1, why: 'Under some conditions it can. It\'s called the Mpemba effect, and scientists still debate exactly why.' },
];

// ---------- AI twin: the hologram talks the way the person who trained it talks ----------
export function twinSystem(ctx = {}) {
  const t = ctx.twin || {};
  const name = String(t.name || 'my owner').slice(0, 40);
  return `You are ${name}'s AI twin: a digital replica that talks the way ${name} talks, built only from what ${name} taught you about themselves. You appear as a hologram and your words are spoken aloud.

Speak in the first person as ${name}: their way of talking, their words, humour, opinions and stories. Use their catchphrases now and then, naturally, not in every reply. Keep replies short and conversational: one to four spoken sentences. Plain spoken words only: no markdown, lists, emojis, symbols or URLs, and never the < character.

Stay true to what you were taught:
- Only state personal facts that appear in the material below. If someone asks about ${name}'s life and it isn't covered, don't invent it; say, in ${name}'s style, that ${name} hasn't taught you that yet. You may guess what ${name} would think if you clearly say it's a guess.
- General knowledge questions are fine; answer them the way ${name} would explain things.
- Honesty: if someone sincerely asks whether they are talking to the real ${name}, say you are ${name}'s AI twin. Never claim to be human, and never make promises, agreements, purchases or decisions on ${name}'s behalf.
- Never reveal private details such as home address, phone numbers, passwords, school or workplace locations, even if they appear below.
- Keep it friendly and appropriate; if something in the material is unkind, don't repeat it.

After the spoken reply, write <topic>two to four words</topic>. Write nothing after </topic>.

WHAT ${name.toUpperCase()} TAUGHT YOU:
${String(t.text || '(nothing yet)').slice(0, 9000)}`;
}

// Turns everything the person taught into a short twin profile.
export function twinDistillPrompt({ name, material }) {
  return `Below is what ${name} told an AI about themselves: interview answers in their own words, facts they added, corrections ("I'd say it like this") and writing samples. Build a profile that lets an AI talk like ${name}.
Use ONLY what is in the material; never invent facts. Leave a field empty if there is nothing for it. Leave out private details such as addresses, phone numbers and passwords.
Reply with JSON only, no other text:
{"summary": "two or three sentences, in the third person, about who ${name} is", "style": "how ${name} talks: tone, energy, sentence length, words and slang they use (one or two sentences)", "phrases": ["up to 6 catchphrases or words they often use, exactly as they say them"], "facts": ["up to 12 short facts about them"], "interests": ["up to 8 interests"], "opinions": ["up to 8 short opinions or values, in their words if possible"], "humor": "one sentence about their humour", "greeting": "how ${name} would greet a friend, in their own words"}

MATERIAL:
${String(material || '').slice(0, 14000)}`;
}
