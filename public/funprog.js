// Holo Tutor — Fun mode progress: XP and levels, a fun-day streak, what you chat about,
// trivia scores, and badges to unlock. Kept on this device, separate from study progress.

export const FUN_CATS = {
  jokes: { name: 'Jokes', emoji: '😂', color: '#FFB547' },
  movies: { name: 'Movies & shows', emoji: '🎬', color: '#FF6B9A' },
  games: { name: 'Gaming', emoji: '🎮', color: '#7C8CFF' },
  riddles: { name: 'Riddles', emoji: '🧩', color: '#5BE3A1' },
  trivia: { name: 'Trivia', emoji: '🧠', color: '#4FE3FF' },
  chat: { name: 'Just chatting', emoji: '💬', color: '#C9A7FF' },
};

const CAT_RE = [
  ['riddles', /riddle|puzzle|brain ?teaser|पहेली|पहेलियाँ|పొడుపు|పజిల్/iu],
  ['jokes', /joke|funny|laugh|pun\b|make me laugh|मज़ाक|मजाक|चुटकुल|हंसा|జోక్|నవ్వించు|నవ్వు/iu],
  ['games', /game|gaming|gamer|minecraft|roblox|fortnite|bgmi|pubg|free ?fire|pok[eé]mon|mario|zelda|fifa|ea fc|valorant|among us|xbox|playstation|ps5|nintendo|switch|gta|clash|brawl|chess|गेम|ఆట|గేమ్/iu],
  ['movies', /movie|film|cinema|series|web ?series|\bshow\b|cartoon|anime|actor|actress|hero|bollywood|tollywood|kollywood|hollywood|netflix|prime video|hotstar|marvel|dc\b|disney|pixar|spider|batman|avengers|harry potter|फिल्म|मूवी|सिनेमा|कार्टून|సినిమా|మూవీ|హీరో|కార్టూన్/iu],
  ['trivia', /trivia|quiz|fact|did you know|क्विज़|तथ्य|క్విజ్|వాస్తవం/iu],
];
export function funCategory(text) {
  const t = String(text || '');
  for (const [cat, re] of CAT_RE) if (re.test(t)) return cat;
  return 'chat';
}

// XP needed to reach a level: 120, 280, 480, 720, ... (each level a bit longer than the last)
export const xpForLevel = (L) => (L <= 1 ? 0 : 80 * (L - 1) + 20 * (L - 1) * L);
export function levelOf(xp) { let L = 1; while (xp >= xpForLevel(L + 1)) L++; return L; }
const TITLES = ['Newbie', 'Rookie', 'Explorer', 'Fun Seeker', 'Joke Jockey', 'Trivia Tiger', 'Superstar', 'Legend', 'Holo Hero', 'Mega Legend'];
export const levelTitle = (L) => TITLES[Math.min(L, TITLES.length) - 1];
export const XP = { chat: 10, firstOfDay: 20, triviaRight: 25, triviaPerfect: 50, badge: 30, dailyRight: 40, dailyTry: 10 };

export const BADGES = [
  { id: 'hello', emoji: '👋', name: 'Say Hi', desc: 'Have your first fun chat', goal: 1, val: (f) => f.msgs },
  { id: 'jokes', emoji: '😂', name: 'Giggle Box', desc: 'Ask for 5 jokes', goal: 5, val: (f) => f.cats.jokes },
  { id: 'movies', emoji: '🎬', name: 'Movie Buff', desc: 'Talk movies or shows 5 times', goal: 5, val: (f) => f.cats.movies },
  { id: 'games', emoji: '🎮', name: 'Gamer', desc: 'Talk gaming 5 times', goal: 5, val: (f) => f.cats.games },
  { id: 'riddles', emoji: '🧩', name: 'Riddle Solver', desc: 'Try 3 riddles', goal: 3, val: (f) => f.cats.riddles },
  { id: 'trivia10', emoji: '🧠', name: 'Quiz Whiz', desc: 'Get 10 trivia answers right', goal: 10, val: (f) => f.trivia.correct },
  { id: 'perfect', emoji: '🏆', name: 'Perfect Round', desc: 'Get every trivia question right', goal: 1, val: (f) => f.trivia.perfect },
  { id: 'fire3', emoji: '🔥', name: 'On Fire', desc: 'Have fun 3 days in a row', goal: 3, val: (f, s) => s },
  { id: 'fire7', emoji: '⚡', name: 'Week Warrior', desc: 'Have fun 7 days in a row', goal: 7, val: (f, s) => s },
  { id: 'chatter', emoji: '💬', name: 'Chatterbox', desc: 'Send 50 fun messages', goal: 50, val: (f) => f.msgs },
  { id: 'mix', emoji: '🌈', name: 'All-Rounder', desc: 'Try jokes, movies, games and trivia', goal: 4, val: (f) => ['jokes', 'movies', 'games', 'trivia'].filter((c) => f.cats[c] > 0).length },
  { id: 'owl', emoji: '🦉', name: 'Night Owl', desc: 'Have a fun chat after 9 pm', goal: 1, val: (f) => f.owl },
  { id: 'bird', emoji: '🐦', name: 'Early Bird', desc: 'Have a fun chat before 8 am', goal: 1, val: (f) => f.bird },
  { id: 'daily3', emoji: '📅', name: 'Daily Thinker', desc: 'Answer 3 questions of the day', goal: 3, val: (f) => f.daily || 0 },
  { id: 'lv5', emoji: '⭐', name: 'Superstar', desc: 'Reach level 5', goal: 5, val: (f) => levelOf(f.xp) },
];

export function freshFun() {
  return { xp: 0, msgs: 0, chats: 0, days: [], cats: { jokes: 0, movies: 0, games: 0, riddles: 0, trivia: 0, chat: 0 }, trivia: { asked: 0, correct: 0, best: 0, rounds: 0, perfect: 0 }, badges: {}, recent: [], owl: 0, bird: 0 };
}
export function loadFun(saved) {
  const f = freshFun(), s = saved || {};
  return { ...f, ...s, cats: { ...f.cats, ...(s.cats || {}) }, trivia: { ...f.trivia, ...(s.trivia || {}) }, badges: { ...(s.badges || {}) }, days: s.days || [], recent: s.recent || [] };
}

export const funDayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function funStreak(f) {
  const set = new Set(f.days);
  let n = 0, t = Date.now();
  if (!set.has(funDayKey(t))) t -= 864e5;
  while (set.has(funDayKey(t))) { n++; t -= 864e5; }
  return n;
}

// Adds XP, and checks for a new level and newly unlocked badges. Returns what happened.
function funSettle(f, gained) {
  const before = levelOf(f.xp);
  f.xp += gained;
  const unlocked = [];
  const s = funStreak(f);
  for (const b of BADGES) {
    if (f.badges[b.id]) continue;
    if (b.val(f, s) >= b.goal) { f.badges[b.id] = Date.now(); unlocked.push(b); f.xp += XP.badge; }
  }
  const after = levelOf(f.xp);
  return { gained: gained + unlocked.length * XP.badge, levelUp: after > before ? after : 0, unlocked };
}
function markFunDay(f) {
  const k = funDayKey();
  if (f.days.includes(k)) return 0;
  f.days.push(k); f.days = f.days.slice(-120);
  return XP.firstOfDay;
}

// One fun message and the tutor's reply topic.
export function funMessage(f, question, topic) {
  const cat = funCategory(question + ' ' + (topic || ''));
  f.msgs++; f.cats[cat] = (f.cats[cat] || 0) + 1;
  const h = new Date().getHours();
  if (h >= 21) f.owl = 1;
  if (h < 8 && h >= 4) f.bird = 1;
  if (topic) { f.recent = [{ topic, cat, t: Date.now() }, ...f.recent.filter((r) => r.topic.toLowerCase() !== topic.toLowerCase())].slice(0, 8); }
  return { cat, ...funSettle(f, XP.chat + markFunDay(f)) };
}
export function funChatEnded(f) { f.chats++; }
// A finished trivia round.
export function funTrivia(f, correct, total) {
  f.trivia.asked += total; f.trivia.correct += correct; f.trivia.rounds++;
  f.trivia.best = Math.max(f.trivia.best, Math.round((100 * correct) / Math.max(1, total)));
  f.cats.trivia += 1;
  const perfect = total > 0 && correct === total;
  if (perfect) f.trivia.perfect++;
  return funSettle(f, correct * XP.triviaRight + (perfect ? XP.triviaPerfect : 0) + markFunDay(f));
}
// The question of the day: answered once a day, right or wrong.
export function funDaily(f, right) {
  f.daily = (f.daily || 0) + 1;
  return funSettle(f, right ? XP.dailyRight : XP.dailyTry);
}
