import type { TestConfig } from "./config";

// the ~200 most common English words — the default pool
export const ENGLISH_200 = [
  "the",
  "be",
  "of",
  "and",
  "a",
  "to",
  "in",
  "he",
  "have",
  "it",
  "that",
  "for",
  "they",
  "with",
  "as",
  "not",
  "on",
  "she",
  "at",
  "by",
  "this",
  "we",
  "you",
  "do",
  "but",
  "from",
  "or",
  "which",
  "one",
  "would",
  "all",
  "will",
  "there",
  "say",
  "who",
  "make",
  "when",
  "can",
  "more",
  "if",
  "no",
  "man",
  "out",
  "other",
  "so",
  "what",
  "time",
  "up",
  "go",
  "about",
  "than",
  "into",
  "could",
  "state",
  "only",
  "new",
  "year",
  "some",
  "take",
  "come",
  "these",
  "know",
  "see",
  "use",
  "get",
  "like",
  "then",
  "first",
  "any",
  "work",
  "now",
  "may",
  "such",
  "give",
  "over",
  "think",
  "most",
  "even",
  "find",
  "day",
  "also",
  "after",
  "way",
  "many",
  "must",
  "look",
  "before",
  "great",
  "back",
  "through",
  "long",
  "where",
  "much",
  "should",
  "well",
  "people",
  "down",
  "own",
  "just",
  "because",
  "good",
  "each",
  "those",
  "feel",
  "seem",
  "how",
  "high",
  "too",
  "place",
  "little",
  "world",
  "very",
  "still",
  "nation",
  "hand",
  "old",
  "life",
  "tell",
  "write",
  "become",
  "here",
  "show",
  "house",
  "both",
  "between",
  "need",
  "mean",
  "call",
  "develop",
  "under",
  "last",
  "right",
  "move",
  "thing",
  "general",
  "school",
  "never",
  "same",
  "another",
  "begin",
  "while",
  "number",
  "part",
  "turn",
  "real",
  "leave",
  "might",
  "want",
  "point",
  "form",
  "off",
  "child",
  "few",
  "small",
  "since",
  "against",
  "ask",
  "late",
  "home",
  "interest",
  "large",
  "person",
  "end",
  "open",
  "public",
  "follow",
  "during",
  "present",
  "without",
  "again",
  "hold",
  "govern",
  "around",
  "possible",
  "head",
  "consider",
  "word",
  "program",
  "problem",
  "however",
  "lead",
  "system",
  "set",
  "order",
  "eye",
  "plan",
  "run",
  "keep",
  "face",
  "fact",
  "group",
  "play",
  "stand",
  "increase",
  "early",
  "course",
  "change",
  "help",
  "line",
] as const;

// weighted roughly like real prose
const SENTENCE_ENDERS = [".", ".", ".", ".", ".", "?", "!"] as const;
const MID_MARKS = [",", ",", ",", ";", ":", "-"] as const;

/** deterministic PRNG (mulberry32) — same seed, same text */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

// time tests get a buffer sized for a very fast typist so the stream never
// runs dry mid-test
function wordBudget(config: TestConfig) {
  switch (config.mode) {
    case "time":
      return Math.ceil((config.seconds / 60) * 260) + 60;
    case "words":
      return config.wordCount;
    case "quote":
      return 0; // quotes carry their own text
  }
}

function applyNumbers(word: string, rand: () => number) {
  // ~1 in 12 words becomes a number
  if (rand() > 1 / 12) return word;
  const digits = 1 + Math.floor(rand() * 4);
  let out = "";
  for (let i = 0; i < digits; i++) out += Math.floor(rand() * 10);
  return out;
}

// sentence caps, mid-sentence marks, the occasional quoted/parenthesised word
function applyPunctuation(words: string[], rand: () => number): string[] {
  const out = [...words];
  let startOfSentence = true;

  for (let i = 0; i < out.length; i++) {
    let word = out[i];

    if (startOfSentence) {
      word = word[0].toUpperCase() + word.slice(1);
      startOfSentence = false;
    }

    const roll = rand();
    const isLast = i === out.length - 1;

    if (isLast || roll < 0.1) {
      word += SENTENCE_ENDERS[Math.floor(rand() * SENTENCE_ENDERS.length)];
      startOfSentence = true;
    } else if (roll < 0.2) {
      word += MID_MARKS[Math.floor(rand() * MID_MARKS.length)];
    } else if (roll < 0.23) {
      word = `"${word}"`;
    } else if (roll < 0.25) {
      word = `(${word})`;
    } else if (roll < 0.27 && word.length > 3) {
      word = `${word}'s`;
    }

    out[i] = word;
  }

  return out;
}

// deterministic in seed: same config + seed → identical text on every client,
// which is what racing depends on
export function generateWords(config: TestConfig, seed: number): string[] {
  if (config.mode === "quote") {
    return pickQuote(config, seed).text.split(" ");
  }

  const rand = mulberry32(seed);
  const budget = wordBudget(config);
  const pool = ENGLISH_200;

  let words: string[] = [];
  let previous = "";
  for (let i = 0; i < budget; i++) {
    // reroll immediate repeats — "the the" looks like a rendering bug
    let word = pool[Math.floor(rand() * pool.length)];
    if (word === previous) word = pool[Math.floor(rand() * pool.length)];
    previous = word;
    words.push(word);
  }

  if (config.numbers) words = words.map((w) => applyNumbers(w, rand));
  if (config.punctuation) words = applyPunctuation(words, rand);

  return words;
}

/* -------------------------------------------------------------------------- */
/* Quotes                                                                      */
/* -------------------------------------------------------------------------- */

export type Quote = {
  text: string;
  source: string;
  length: "short" | "medium" | "long";
};

// Original sentences, not harvested quotations (no copyright headaches).
// Bands by word count: short ~10-20, medium ~25-45, long 70+. Keep them plain
// ASCII — a curly quote or em dash is a key most people can't type.
const SHORT_QUOTES = [
  "the quiet hours before dawn belong to the people who cannot sleep and the people who will not",
  "speed is a side effect of accuracy and never the other way around",
  "a keyboard rewards the patient far more than it rewards the frantic",
  "practice is just failure arranged in a useful order",
  "i type ninety words a minute and roughly four of them are the ones i meant",
  "the cat walked across my keyboard and the document got noticeably better",
  "my password is now strong enough that even i cannot get in",
  "the semicolon is just a comma that went away to graduate school",
  "i put my glasses somewhere safe, which means they are gone forever",
  "the printer can smell fear and it waits until you are already late",
  "coffee is bean soup and i will not be taking questions at this time",
  "i am not procrastinating, i am letting the task marinate in its own juices",
  "the escape key has never once helped me escape from anything at all",
  "my houseplant has outlived three hobbies and it is extremely smug about it",
  "the wifi is perfect until the exact moment somebody important needs my face",
  "i keep my inbox at zero by the simple method of refusing to look at it",
  "the vending machine took my coin and we both know how this ends",
  "socks vanish in the wash because the machine gets hungry between cycles",
  "i bought a planner to organise my life and it is still inside the bag",
  "every recipe online opens with a short novel about somebody's grandmother",
  "the mute button is the finest invention of the last hundred years",
  "my code works and i have decided not to ask it any follow up questions",
  "a sandwich cut diagonally tastes better and science has stopped arguing",
  "the fridge light is the only thing that judges me, and it does it quietly",
  "i type with eight fingers and two enthusiastic spectators",
  "the backspace key has done more for my reputation than any other key",
  "i said i would do it tomorrow, and tomorrow has been very understanding",
  "my alarm clock and i have a relationship built entirely on mutual lies",
  "i am fluent in three languages, none of them before the first coffee",
  "the shopping list is at home, which is precisely where the shopping is not",
  "you can lead a horse to water but you cannot make it answer its email",
  "i have read the terms and conditions the way i have read the ocean",
  "everybody claps for the person who fixes the printer and nobody asks how",
  "a pigeon made better eye contact with me last week than my own dentist",
  "the number lock key exists to ruin one specific afternoon every year",
  "there is no problem so small that a group chat cannot spend a day on it",
  "i alphabetised the spice rack and now i cannot find a single thing",
  "my step counter thinks pacing while on the phone is a personal triumph",
];

const MEDIUM_QUOTES = [
  "there is a particular kind of silence in a room where someone is typing quickly and thinking slowly, and it is not the same silence as a room where nobody is doing anything at all",
  "the trick to going faster is not moving your fingers faster but deciding what to write sooner, so that your hands never have to wait for a sentence that has not arrived yet",
  "every typist eventually discovers that the hardest words are not the long ones but the short ones that sit next to each other and share the same tired finger",
  "i told my computer that i needed a break and it froze for twenty minutes, which was technically compliant and emotionally devastating, and we have agreed never to discuss who won that argument",
  "the office printer has three states: out of paper, out of toner, and a mysterious third state where every light is green, every tray is full, and it simply declines on principle",
  "one letter on my keyboard sticks, and i have quietly rebuilt my whole vocabulary around avoiding it, which is either pure laziness or the most creative writing i have ever done",
  "the recipe said to let the dough rest for an hour, so i rested for an hour as well, and only one of us came out of it improved, which feels like a flaw in the arrangement",
  "a squirrel outside my window has been staring at me for six straight minutes, and i am starting to suspect it is not waiting for food but reviewing my choices and finding them thin",
  "my phone reported that my screen time was up forty percent this week, and instead of shame i felt the quiet pride of a person who is finally committing to something",
  "the mystery of the missing pen is not that it disappears but that it comes back weeks later in a drawer you have searched eleven times, smug, unexplained, and slightly warm",
  "i learned to touch type so that i could watch the screen instead of my hands, and now i mostly watch the window, which is a different skill but it has improved my life",
  "the group chat goes silent for two days and then forty messages land at once, at midnight, about a restaurant nobody intends to visit, and this is what friendship looks like now",
  "i once tried to fix a leaking tap with a video, a wrench, and completely unearned optimism, and the result was a very clean bathroom floor, because everything on it got rinsed",
  "the dog can hear the treat bag from four rooms away, sleeps through the smoke alarm, and i have stopped pretending that this is anything other than a deliberate arrangement",
  "i keep a notebook for good ideas and a phone for bad ones, and after two years the phone is full and the notebook holds one sentence and a drawing of a mildly angry frog",
  "some people alphabetise the bookshelf and some arrange it by colour, and i have arranged mine by which books i want visitors to believe i have read, which is its own honest system",
  "the microwave finishes at one second remaining and i stop it before the beep like a bomb technician, quietly, every single time, and no living person has ever witnessed this",
  "typing tests are the only sport where the equipment is free, the training is free, the audience is imaginary, and a personal best is still somehow the highlight of the whole week",
  "i have looked up the difference between a herb and a spice nine separate times, and the knowledge stays with me for exactly as long as it takes to close the tab",
  "the self checkout announced an unexpected item in the bagging area, and it was my hand, and the machine and i stared at each other until a teenager came over and forgave us both",
  "every time i open a new tab i promise it will be the last one, and every time the browser looks at me the way a doctor looks at a patient who has lied about the number",
  "i went to the gym once and all the machines looked at me the way you look at a stranger who has wandered into your kitchen, so i drank my water in the car park and went home",
];

const LONG_QUOTES = [
  "when you first learn to type you watch your hands, and the watching costs you more than the mistakes ever would. later you stop watching, and for a while everything gets worse, because your fingers are learning the shape of the board without your permission. then one morning the words simply arrive on the screen a fraction of a second after you think them, and you cannot remember when that started, and you cannot make it happen on purpose, and it never entirely goes away again",
  "the measure of a good practice session is not the number at the end of it. the number is a souvenir. what matters is whether your hands found a rhythm they can return to tomorrow, whether the difficult pairs got a little less difficult, and whether you stopped before the point where frustration starts teaching you the wrong lessons. a bad session leaves you faster and tighter. a good one leaves you slower and looser, and faster next week",
  "i spent an entire evening trying to remember the word for the small metal thing that holds paper together, and my brain offered me, in order: stapler, no, the other one, the bendy one, the silver one, the tortured wire one. then at four in the morning, while i was asleep, it whispered paperclip directly into my ear like a spy passing a message in a train station, and i woke up, said thank you out loud to an empty room, and went back to sleep entirely satisfied with how the night had gone",
  "the assembly instructions had twelve steps and i completed eleven of them with what i can only describe as flair. step twelve required a small wooden dowel that was not in the box, has never been in the box, and may not exist anywhere outside of the illustration. the shelf stands today, holding books, defying the diagram, wobbling only when somebody walks past it with intent. i have not told anyone which shelf it is, and i would gently ask that you do not go looking for it",
  "there is a pigeon near my office that has decided we are colleagues. it arrives when i arrive. it watches me eat. it has, on two separate occasions, been present for a phone call i would have preferred it did not hear. i have never fed it, which matters, because that means this is not a transaction, it is a friendship, and i am not the one who started it. yesterday it brought a second pigeon and stood slightly behind it, and i now believe that i am being quietly onboarded",
  "my grandmother could type a hundred words a minute on a machine that fought back, where every letter was a small act of violence and the carriage came home with the sound of a door being shut on an argument. she used to say that people who type quietly do not really mean it. i have a keyboard that whispers, an undo button, a spellchecker that corrects me gently and never raises its voice, and i am still slower than she was, which i think about more often than is strictly healthy",
  "i have a drawer that contains nine cables, and i know what two of them are for. the other seven are kept because the day i throw them away is the day something in this house will need exactly one of them, and the universe has made its position on this very clear over many years. twice a year i take them all out, lay them on the bed, look at them the way an archaeologist looks at a burial site, learn nothing whatsoever, and put every single one of them back",
  "the first rule of the shared kitchen is that the mug is not yours, it has never been yours, and the person whose mug it actually is has been watching you drink from it for eleven months without saying anything. the second rule is that whoever finishes the milk becomes, in that moment, a fugitive. the third rule is that nobody knows who bought the good biscuits, nobody will ever admit to buying them, and yet the good biscuits keep appearing, which is the closest thing to faith i have",
];

const quotes = (texts: string[], length: Quote["length"]): Quote[] =>
  texts.map((text) => ({ text, source: "wpmlab", length }));

export const QUOTES: Quote[] = [
  ...quotes(SHORT_QUOTES, "short"),
  ...quotes(MEDIUM_QUOTES, "medium"),
  ...quotes(LONG_QUOTES, "long"),
];

export function pickQuote(config: TestConfig, seed: number): Quote {
  const pool = QUOTES.filter((q) => config.quoteLength === "any" || q.length === config.quoteLength);
  const list = pool.length > 0 ? pool : QUOTES;
  const rand = mulberry32(seed);
  return list[Math.floor(rand() * list.length)];
}
