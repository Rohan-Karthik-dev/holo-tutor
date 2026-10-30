// Holo Tutor — Train AI mode: teach an AI twin to talk like you.
// The twin is built from what you teach it (interview answers in your own words, quick facts,
// writing samples and corrections), distilled by Claude into a profile, and used as the
// instructions when your twin talks. Nothing is fine-tuned; it's all kept with your account.

export const TWIN_CATS = {
  personality: { name: 'Personality', emoji: '✨' },
  voice: { name: 'How you talk', emoji: '🗣️' },
  background: { name: 'Your story', emoji: '📖' },
  interests: { name: 'Interests', emoji: '🎯' },
  opinions: { name: 'Opinions', emoji: '💭' },
  humor: { name: 'Humour', emoji: '😄' },
  knowledge: { name: 'What you know', emoji: '🧠' },
};
export const TWIN_QUESTIONS = [
  ['personality', 'How would your best friend describe you in three words?'],
  ['personality', 'What gets you really excited, and how do you show it?'],
  ['personality', 'How do you react when something goes wrong?'],
  ['personality', 'Are you more of a planner or do you go with the flow? Tell me about it.'],
  ['voice', 'How do you usually greet your friends? Say it exactly like you would.'],
  ['voice', 'Are there words or phrases you say all the time?'],
  ['voice', 'Tell me about your day today, the way you would tell a friend.'],
  ['voice', 'How do you say goodbye at the end of a chat?'],
  ['background', 'Where did you grow up, and what was it like?'],
  ['background', 'What do you do: study, work, or both? Tell me about it.'],
  ['background', 'What is one moment from your life you will never forget?'],
  ['background', 'Who are the important people in your life?'],
  ['interests', 'What do you love doing in your free time?'],
  ['interests', 'What is your favourite movie, show or book, and why?'],
  ['interests', 'If you could master any skill overnight, what would it be?'],
  ['interests', 'What food could you eat every single day?'],
  ['opinions', 'What is something you strongly believe in?'],
  ['opinions', 'What is the best advice you have ever been given?'],
  ['opinions', 'What is an opinion you have that most people disagree with?'],
  ['opinions', 'What does a perfect weekend look like to you?'],
  ['humor', 'Tell me a joke you like, the way you would tell it.'],
  ['humor', 'What is the funniest thing that has ever happened to you?'],
  ['humor', 'What kind of things make you laugh the most?'],
  ['knowledge', 'What is a topic you could talk about for hours? Explain a bit of it to me.'],
  ['knowledge', 'How would you explain your favourite subject to a ten year old?'],
  ['knowledge', 'What is something you are really good at, and how did you learn it?'],
  ['knowledge', 'If a friend asked you for advice on studying or work, what would you say?'],
];

export function freshTwin(name = '') {
  return { name, consent: false, answers: [], notes: [], samples: [], corrections: [], liked: [], profile: null, built: 0, created: Date.now() };
}
export function loadTwin(saved, name = '') {
  const f = freshTwin(name), s = saved || {};
  return { ...f, ...s, answers: s.answers || [], notes: s.notes || [], samples: s.samples || [], corrections: s.corrections || [], liked: s.liked || [] };
}

// How well the twin knows you, 0..100: interview coverage counts most; corrections, samples and facts add the rest.
export function twinStrength(t) {
  const per = {};
  for (const a of t.answers) per[a.cat] = (per[a.cat] || 0) + 1;
  const interview = Object.keys(TWIN_CATS).reduce((s, c) => s + Math.min(3, per[c] || 0), 0) / (Object.keys(TWIN_CATS).length * 3);
  const extra = Math.min(1, t.samples.length / 2) * 0.1 + Math.min(1, (t.corrections.length + t.liked.length * 0.5) / 4) * 0.1 + Math.min(1, t.notes.length / 5) * 0.1;
  return Math.round(Math.min(1, interview * 0.7 + extra) * 100);
}
export function twinStage(p) {
  return p >= 90 ? 'Twin unlocked' : p >= 70 ? 'Almost you' : p >= 45 ? 'Getting there' : p >= 20 ? 'Learning you' : 'Just met you';
}
export function catCounts(t) { const per = {}; for (const a of t.answers) per[a.cat] = (per[a.cat] || 0) + 1; return per; }

// The next interview question: from the least-covered topic, skipping ones already asked.
export function nextTwinQuestion(t, skip = []) {
  const asked = new Set([...t.answers.map((a) => a.q), ...skip]);
  const per = catCounts(t);
  const open = TWIN_QUESTIONS.filter(([, q]) => !asked.has(q));
  if (!open.length) return null;
  open.sort((a, b) => (per[a[0]] || 0) - (per[b[0]] || 0) || Math.random() - 0.5);
  return { cat: open[0][0], q: open[0][1] };
}

const twClip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
// Everything the person taught, as plain text: what the distiller reads and what the twin is given.
export function twinMaterial(t, budget = 14000) {
  const parts = [];
  if (t.profile) {
    const p = t.profile, L = (a) => (Array.isArray(a) && a.length ? a.join('; ') : '');
    parts.push('PROFILE', p.summary && `Who: ${p.summary}`, p.style && `How they talk: ${p.style}`, L(p.phrases) && `Phrases they use: ${L(p.phrases)}`, L(p.facts) && `Facts: ${L(p.facts)}`, L(p.interests) && `Interests: ${L(p.interests)}`, L(p.opinions) && `Opinions: ${L(p.opinions)}`, p.humor && `Humour: ${p.humor}`, p.greeting && `Greeting: ${p.greeting}`, '');
  }
  if (t.corrections.length) { parts.push('CORRECTIONS (they said "I would say it like this"; follow closely)'); t.corrections.slice(-12).forEach((c) => parts.push(`- When asked "${twClip(c.q, 160)}", don't say "${twClip(c.said, 200)}"; say: "${twClip(c.better, 400)}"`)); parts.push(''); }
  if (t.notes.length) { parts.push('FACTS THEY ADDED'); t.notes.slice(-30).forEach((n) => parts.push(`- ${twClip(n.text, 300)}`)); parts.push(''); }
  if (t.answers.length) { parts.push('IN THEIR OWN WORDS (interview)'); t.answers.slice(-40).forEach((a) => parts.push(`Q: ${twClip(a.q, 140)}\nA: ${twClip(a.a, 700)}`)); parts.push(''); }
  if (t.liked.length) { parts.push('REPLIES THEY APPROVED ("sounds like me")'); t.liked.slice(-8).forEach((l) => parts.push(`- "${twClip(l.a, 300)}"`)); parts.push(''); }
  if (t.samples.length) { parts.push('WRITING SAMPLES (their style)'); t.samples.slice(-4).forEach((s) => parts.push(twClip(s.text, 1500))); }
  return parts.filter((x) => x !== false && x !== undefined && x !== null).join('\n').slice(0, budget);
}
export function cleanProfile(j) {
  if (!j || typeof j !== 'object') return null;
  const arr = (a, n) => (Array.isArray(a) ? a.map((x) => twClip(x, 120)).filter(Boolean).slice(0, n) : []);
  return { summary: twClip(j.summary, 400), style: twClip(j.style, 300), phrases: arr(j.phrases, 6), facts: arr(j.facts, 12), interests: arr(j.interests, 8), opinions: arr(j.opinions, 8), humor: twClip(j.humor, 200), greeting: twClip(j.greeting, 160) };
}
