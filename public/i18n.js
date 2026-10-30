// Holo Tutor — the tutor's fixed spoken lines (English).

export const langBase = (lang) => String(lang || 'en').slice(0, 2);

const L = {
  en: {
    helloStudy: (k) => ({ globe: "Hi! I'm your globe guide.", photo: "Hi! I'm your holo tutor.", human: "Hi! I'm your holo human tutor." }[k]),
    helloFun: "Hey! I'm Holo Buddy.",
    askFun: ' Want a joke, some movie talk, or gaming tips?',
    askStudy: (subj) => (subj ? ` What would you like to learn in ${subj.toLowerCase()} today?` : ' What would you like to learn today?'),
    holoOn: 'Hologram mode on.', screenOn: 'Back to screen mode.', faceOn: 'Here I am.', boardOn: 'Here is the board.', noBoard: 'There is nothing on the board yet. Ask me something and I will explain.',
    studyTime: 'Okay, study time! What would you like to learn?',
    funTime: 'Yay, fun time! Want a joke, movie talk, or gaming tips?',
    fresh: 'Okay, fresh start. What would you like to learn?',
    sorry: "Sorry, I couldn't answer just now.",
    quizIntro: (t) => `Okay! Let me write a quiz on ${t}.`,
    question: (n) => `Question ${n}.`,
    praise: ['Correct!', "That's right!", 'Exactly!', 'Well done!'],
    notQuite: 'Not quite.', noProblem: 'No problem.',
    answerIs: (l, o) => `The answer is ${l}, ${o}.`,
    result: (c, n) => `You got ${c} out of ${n}.`,
    reviewNext: (w) => ` Let's review ${w} next.`,
    quizEnd: ' Say try again for a new quiz, or back to lesson.',
    sayChoice: 'Say A, B, C or D, or say hint.',
    findVideo: (t) => `Let me find a short video on ${t}.`,
    foundVideos: (n) => `I found ${n} short video${n > 1 ? 's' : ''}. Tell me which one to play, or tap a video.`,
    afterVideo: 'Any questions about that video?',
    picture: (t) => `Here's a picture of ${t}.`,
    levelUp: (n, title) => `Level up! You're now level ${n}, ${title}!`,
    badgeGot: (name) => `You unlocked a badge: ${name}!`,
    funSummary: (L, title, xp, st, b, total) => `You're level ${L}, ${title}, with ${xp} X P. ${st ? `Your fun streak is ${st} day${st > 1 ? 's' : ''}. ` : ''}You have ${b} of ${total} badges.`,
    studySummary: (st, lessons, acc) => `${st ? `You're on a ${st} day streak. ` : ''}You've done ${lessons} lesson${lessons === 1 ? '' : 's'}${acc ? `, and your quiz accuracy is ${acc} percent` : ''}.`,
    langSet: 'Okay, I will speak in English now.',
  },
};
export const T = (lang) => L[langBase(lang)] || L.en;

