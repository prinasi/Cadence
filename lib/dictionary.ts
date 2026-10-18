import type { DictionaryEntry } from "./types";
import { normalizePhrase, normalizeWord } from "./text";

type LocalEntry = Omit<DictionaryEntry, "source">;

const WORD_ENTRIES: Record<string, LocalEntry> = {
  progress: {
    word: "progress",
    phonetic: "/ˈprɒɡres/",
    partOfSpeech: "noun",
    translation: "进步；进展",
    definition: "the process of improving or developing over time",
    examples: ["Small steps can lead to real progress.", "She made steady progress with her listening."],
    collocations: ["make progress", "steady progress", "real progress"],
  },
  rarely: {
    word: "rarely",
    phonetic: "/ˈreəli/",
    partOfSpeech: "adverb",
    translation: "很少；难得",
    definition: "not often; almost never",
    examples: ["Real change rarely happens overnight.", "I rarely miss a morning walk."],
    collocations: ["rarely happens", "very rarely", "rarely enough"],
  },
  arrive: {
    word: "arrive",
    phonetic: "/əˈraɪv/",
    partOfSpeech: "verb",
    translation: "到达；到来",
    definition: "to reach a place or a point in time",
    examples: ["The answer will arrive when you stop forcing it.", "We arrived just before the rain."],
    collocations: ["arrive at", "arrive late", "arrive quietly"],
  },
  single: {
    word: "single",
    phonetic: "/ˈsɪŋɡl/",
    partOfSpeech: "adjective",
    translation: "单一的；单个的",
    definition: "only one; not divided into parts",
    examples: ["One single choice can change a day.", "She read every single page."],
    collocations: ["a single moment", "every single day", "a single step"],
  },
  dramatic: {
    word: "dramatic",
    phonetic: "/drəˈmætɪk/",
    partOfSpeech: "adjective",
    translation: "戏剧性的；巨大的",
    definition: "sudden and very noticeable; exciting or impressive",
    examples: ["The improvement was slow, not dramatic.", "There was a dramatic change in the room."],
    collocations: ["dramatic change", "dramatic improvement", "dramatic leap"],
  },
  leap: {
    word: "leap",
    phonetic: "/liːp/",
    partOfSpeech: "noun",
    translation: "飞跃；跳跃",
    definition: "a big jump forward, either physical or figurative",
    examples: ["Learning a language is not one giant leap.", "The company took a leap forward."],
    collocations: ["a leap forward", "a huge leap", "take a leap"],
  },
  quietly: {
    word: "quietly",
    phonetic: "/ˈkwaɪətli/",
    partOfSpeech: "adverb",
    translation: "安静地；不声张地",
    definition: "in a way that is calm, unobtrusive, or not immediately noticed",
    examples: ["Good habits grow quietly.", "She quietly closed the book."],
    collocations: ["grow quietly", "quietly confident", "work quietly"],
  },
  choice: {
    word: "choice",
    phonetic: "/tʃɔɪs/",
    partOfSpeech: "noun",
    translation: "选择；选项",
    definition: "an act of choosing between possibilities",
    examples: ["You have a choice about what comes next.", "It was a small choice with a big effect."],
    collocations: ["make a choice", "a small choice", "the right choice"],
  },
  repeat: {
    word: "repeat",
    phonetic: "/rɪˈpiːt/",
    partOfSpeech: "verb",
    translation: "重复；重做",
    definition: "to do or say something again",
    examples: ["Repeat the phrase until it feels natural.", "History rarely repeats itself exactly."],
    collocations: ["repeat a phrase", "repeat after me", "repeat the process"],
  },
  finish: {
    word: "finish",
    phonetic: "/ˈfɪnɪʃ/",
    partOfSpeech: "verb",
    translation: "完成；结束",
    definition: "to bring a task or activity to an end",
    examples: ["She finished the book in a week.", "We finish what we start."],
    collocations: ["finish a book", "finish the task", "finish strong"],
  },
  strong: {
    word: "strong",
    phonetic: "/strɒŋ/",
    partOfSpeech: "adjective",
    translation: "强壮的；强烈的",
    definition: "having power, strength, or a strong effect",
    examples: ["A short walk can build a stronger body.", "She has a strong reason to keep going."],
    collocations: ["stronger body", "strong evidence", "strong habit"],
  },
  conversation: {
    word: "conversation",
    phonetic: "/ˌkɒnvəˈseɪʃn/",
    partOfSpeech: "noun",
    translation: "对话；谈话",
    definition: "an informal talk between people",
    examples: ["Practice turns into conversation.", "We had a long conversation after class."],
    collocations: ["have a conversation", "start a conversation", "real conversation"],
  },
  expect: {
    word: "expect",
    phonetic: "/ɪkˈspekt/",
    partOfSpeech: "verb",
    translation: "期待；预料",
    definition: "to think that something will happen",
    examples: ["You may surprise yourself more than you expect.", "I did not expect to enjoy the talk."],
    collocations: ["expect to", "never expected", "as expected"],
  },
  motivation: {
    word: "motivation",
    phonetic: "/ˌməʊtɪˈveɪʃn/",
    partOfSpeech: "noun",
    translation: "动力；动机",
    definition: "the reason or energy that makes someone act",
    examples: ["Do not wait for motivation to arrive.", "Curiosity is a stronger motivation than fear."],
    collocations: ["wait for motivation", "lose motivation", "inner motivation"],
  },
  system: {
    word: "system",
    phonetic: "/ˈsɪstəm/",
    partOfSpeech: "noun",
    translation: "系统；体系",
    definition: "an organized set of ideas or habits that works together",
    examples: ["Build a system you can return to.", "A simple system beats a perfect plan."],
    collocations: ["build a system", "a simple system", "learning system"],
  },
  return: {
    word: "return",
    phonetic: "/rɪˈtɜːn/",
    partOfSpeech: "verb",
    translation: "返回；回到",
    definition: "to come back to a place or activity",
    examples: ["Return to the lesson tomorrow.", "She returned to the same sentence."],
    collocations: ["return to", "return home", "return again"],
  },
  consistent: {
    word: "consistent",
    phonetic: "/kənˈsɪstənt/",
    partOfSpeech: "adjective",
    translation: "持续的；一致的",
    definition: "happening regularly and in a similar way over time",
    examples: ["Stay consistent, even on busy days.", "Her results were consistent."],
    collocations: ["stay consistent", "consistent practice", "consistently improve"],
  },
  ordinary: {
    word: "ordinary",
    phonetic: "/ˈɔːdnri/",
    partOfSpeech: "adjective",
    translation: "普通的；平凡的",
    definition: "normal, usual, and not special or exciting",
    examples: ["Let the ordinary do its work.", "It was an ordinary Tuesday."],
    collocations: ["ordinary day", "the ordinary", "ordinary people"],
  },
  perfect: {
    word: "perfect",
    phonetic: "/ˈpɜːfɪkt/",
    partOfSpeech: "adjective",
    translation: "完美的",
    definition: "as good as possible, with no mistakes",
    examples: ["You do not need a perfect morning.", "Practice does not have to be perfect."],
    collocations: ["perfect plan", "perfect conditions", "far from perfect"],
  },
  willingness: {
    word: "willingness",
    phonetic: "/ˈwɪlɪŋnəs/",
    partOfSpeech: "noun",
    translation: "意愿；乐意",
    definition: "the quality of being ready to do something without being forced",
    examples: ["The willingness to try again matters most.", "She showed a willingness to listen."],
    collocations: ["willingness to learn", "show willingness", "a willingness to try"],
  },
  tomorrow: {
    word: "tomorrow",
    phonetic: "/təˈmɒrəʊ/",
    partOfSpeech: "adverb / noun",
    translation: "明天",
    definition: "the day after today",
    examples: ["Take the next step again tomorrow.", "Tomorrow is another chance."],
    collocations: ["again tomorrow", "tomorrow morning", "by tomorrow"],
  },
  moment: {
    word: "moment",
    phonetic: "/ˈməʊmənt/",
    partOfSpeech: "noun",
    translation: "时刻；片刻",
    definition: "a particular point in time",
    examples: ["Wait for the right moment.", "For a moment, nobody spoke."],
    collocations: ["a big moment", "at the moment", "for a moment"],
  },
  change: {
    word: "change",
    phonetic: "/tʃeɪndʒ/",
    partOfSpeech: "verb",
    translation: "改变；变化",
    definition: "to become different or make something different",
    examples: ["Small choices can change your life.", "The plan changed after lunch."],
    collocations: ["change your life", "make a change", "change over time"],
  },
  practice: {
    word: "practice",
    phonetic: "/ˈpræktɪs/",
    partOfSpeech: "noun / verb",
    translation: "练习；实践",
    definition: "repeated activity done to improve a skill",
    examples: ["Five minutes of practice is enough to begin.", "Practice listening every day."],
    collocations: ["English practice", "daily practice", "practice listening"],
  },
  habit: {
    word: "habit",
    phonetic: "/ˈhæbɪt/",
    partOfSpeech: "noun",
    translation: "习惯",
    definition: "something you do regularly, often without thinking",
    examples: ["Small habits are easy to keep.", "Reading before bed is a useful habit."],
    collocations: ["small habit", "build a habit", "daily habit"],
  },
  consistency: {
    word: "consistency",
    phonetic: "/kənˈsɪstənsi/",
    partOfSpeech: "noun",
    translation: "持续性；一致性",
    definition: "the quality of doing something regularly over time",
    examples: ["Consistency matters more than intensity.", "Her consistency paid off."],
    collocations: ["consistency matters", "build consistency", "quiet consistency"],
  },
  page: {
    word: "page",
    phonetic: "/peɪdʒ/",
    partOfSpeech: "noun",
    translation: "页；页面",
    definition: "one side of a sheet of paper, or a screen of content",
    examples: ["A page read before bed becomes a book.", "Turn to the next page."],
    collocations: ["read a page", "next page", "a single page"],
  },
  walk: {
    word: "walk",
    phonetic: "/wɔːk/",
    partOfSpeech: "noun / verb",
    translation: "散步；步行",
    definition: "a journey on foot, usually for pleasure or exercise",
    examples: ["A short walk after lunch clears your head.", "We walked along the river."],
    collocations: ["short walk", "go for a walk", "walk after lunch"],
  },
  body: {
    word: "body",
    phonetic: "/ˈbɒdi/",
    partOfSpeech: "noun",
    translation: "身体；躯体",
    definition: "the physical part of a person",
    examples: ["Small movement builds a stronger body.", "Your body needs rest too."],
    collocations: ["stronger body", "the human body", "body and mind"],
  },
  morning: {
    word: "morning",
    phonetic: "/ˈmɔːnɪŋ/",
    partOfSpeech: "noun",
    translation: "早晨；上午",
    definition: "the early part of the day, from sunrise until noon",
    examples: ["A perfect morning is not required.", "I study English every morning."],
    collocations: ["morning routine", "early morning", "tomorrow morning"],
  },
  plan: {
    word: "plan",
    phonetic: "/plæn/",
    partOfSpeech: "noun / verb",
    translation: "计划；打算",
    definition: "a set of intentions or steps for doing something",
    examples: ["A brand new plan is optional.", "We planned the lesson together."],
    collocations: ["make a plan", "a new plan", "stick to the plan"],
  },
  step: {
    word: "step",
    phonetic: "/step/",
    partOfSpeech: "noun",
    translation: "步骤；一步",
    definition: "a single action that moves you toward a goal",
    examples: ["Take the next small step.", "One step at a time."],
    collocations: ["next step", "small step", "take a step"],
  },
  grow: {
    word: "grow",
    phonetic: "/ɡrəʊ/",
    partOfSpeech: "verb",
    translation: "生长；逐渐变得",
    definition: "to develop or increase gradually",
    examples: ["Progress grows quietly.", "Plants grow toward the light."],
    collocations: ["grow quietly", "grow over time", "grow into"],
  },
  book: {
    word: "book",
    phonetic: "/bʊk/",
    partOfSpeech: "noun",
    translation: "书；书籍",
    definition: "a set of printed or digital pages bound together",
    examples: ["A finished book begins with one page.", "She is reading a book about habits."],
    collocations: ["read a book", "finished book", "a good book"],
  },
  wait: {
    word: "wait",
    phonetic: "/weɪt/",
    partOfSpeech: "verb",
    translation: "等待",
    definition: "to stay somewhere or delay action until something happens",
    examples: ["Do not wait for a big moment.", "We waited for the bus."],
    collocations: ["wait for", "wait until", "wait patiently"],
  },
  read: {
    word: "read",
    phonetic: "/riːd/",
    partOfSpeech: "verb",
    translation: "读；阅读",
    definition: "to look at and understand written words",
    examples: ["Read one page before bed.", "I read the subtitles twice."],
    collocations: ["read a page", "read aloud", "read before bed"],
  },
  bed: {
    word: "bed",
    phonetic: "/bed/",
    partOfSpeech: "noun",
    translation: "床",
    definition: "a piece of furniture used for sleeping",
    examples: ["A page read before bed adds up.", "She went to bed early."],
    collocations: ["before bed", "go to bed", "in bed"],
  },
  lunch: {
    word: "lunch",
    phonetic: "/lʌntʃ/",
    partOfSpeech: "noun",
    translation: "午餐",
    definition: "a meal eaten in the middle of the day",
    examples: ["A short walk after lunch helps.", "We had lunch together."],
    collocations: ["after lunch", "have lunch", "lunch break"],
  },
  minute: {
    word: "minute",
    phonetic: "/ˈmɪnɪt/",
    partOfSpeech: "noun",
    translation: "分钟；片刻",
    definition: "a period of sixty seconds",
    examples: ["Five minutes of practice becomes a habit.", "Wait a minute."],
    collocations: ["five minutes", "a few minutes", "in a minute"],
  },
  life: {
    word: "life",
    phonetic: "/laɪf/",
    partOfSpeech: "noun",
    translation: "生活；人生",
    definition: "the experience of being alive, or the way someone lives",
    examples: ["Small choices can change your life.", "Life gets busy sometimes."],
    collocations: ["change your life", "daily life", "real life"],
  },
  real: {
    word: "real",
    phonetic: "/rɪəl/",
    partOfSpeech: "adjective",
    translation: "真实的；真正的",
    definition: "actually existing or happening, not imagined",
    examples: ["Real progress is often quiet.", "This is a real conversation."],
    collocations: ["real progress", "real life", "the real thing"],
  },
  become: {
    word: "become",
    phonetic: "/bɪˈkʌm/",
    partOfSpeech: "verb",
    translation: "变成；成为",
    definition: "to begin to be something",
    examples: ["A short walk becomes a habit.", "She became more confident."],
    collocations: ["become a habit", "become stronger", "become clear"],
  },
  quiet: {
    word: "quiet",
    phonetic: "/ˈkwaɪət/",
    partOfSpeech: "adjective",
    translation: "安静的；不张扬的",
    definition: "making little noise; not obvious or forceful",
    examples: ["Quiet progress still counts.", "The room was quiet."],
    collocations: ["quiet progress", "stay quiet", "a quiet voice"],
  },
};

const PHRASE_ENTRIES: Record<string, LocalEntry> = {
  "a big moment": {
    word: "a big moment",
    partOfSpeech: "phrase",
    translation: "一个重大时刻",
    definition: "a significant or dramatic point in time",
    examples: ["Most of us wait for a big moment."],
    collocations: ["wait for a big moment", "a big moment in life"],
  },
  "dramatic leap": {
    word: "dramatic leap",
    partOfSpeech: "noun phrase",
    translation: "戏剧性的飞跃",
    definition: "a sudden, large advance rather than a gradual one",
    examples: ["Real progress rarely arrives in a single, dramatic leap."],
    collocations: ["a dramatic leap forward", "make a dramatic leap"],
  },
  "day after day": {
    word: "day after day",
    partOfSpeech: "adverbial phrase",
    translation: "日复一日",
    definition: "repeatedly, on each successive day, often for a long time",
    examples: ["Small choices repeated day after day begin to matter."],
    collocations: ["repeat day after day", "day after day of practice"],
  },
  "before bed": {
    word: "before bed",
    partOfSpeech: "time phrase",
    translation: "睡前",
    definition: "before going to sleep",
    examples: ["A page read before bed becomes a finished book."],
    collocations: ["read before bed", "right before bed"],
  },
  "after lunch": {
    word: "after lunch",
    partOfSpeech: "time phrase",
    translation: "午饭后",
    definition: "in the period following the midday meal",
    examples: ["A short walk after lunch becomes a stronger body."],
    collocations: ["walk after lunch", "after lunch break"],
  },
  "expected to have": {
    word: "expected to have",
    partOfSpeech: "verb phrase",
    translation: "曾期待会拥有／进行",
    definition: "used to describe something you thought would happen but may not have anticipated",
    examples: ["A conversation you never expected to have."],
    collocations: ["never expected to", "expected to have"],
  },
  "instead of": {
    word: "instead of",
    partOfSpeech: "prepositional phrase",
    translation: "而不是；代替",
    definition: "in place of something else",
    examples: ["Instead of waiting for motivation, build a system."],
    collocations: ["instead of waiting", "instead of doing"],
  },
  "return to": {
    word: "return to",
    partOfSpeech: "phrasal verb",
    translation: "回到；重新投入",
    definition: "to come back to a place, activity, or topic",
    examples: ["Build a system you can return to."],
    collocations: ["return to a habit", "return to the lesson"],
  },
  "stay consistent": {
    word: "stay consistent",
    partOfSpeech: "verb phrase",
    translation: "保持持续",
    definition: "to keep doing something regularly in the same way",
    examples: ["Start small, stay consistent."],
    collocations: ["stay consistent with", "stay consistent over time"],
  },
  "brand new": {
    word: "brand new",
    partOfSpeech: "adjective phrase",
    translation: "全新的",
    definition: "completely new, not used or seen before",
    examples: ["You do not need a brand new plan."],
    collocations: ["brand new plan", "brand new start"],
  },
  "the willingness to": {
    word: "the willingness to",
    partOfSpeech: "noun phrase",
    translation: "愿意去……",
    definition: "the readiness to do something without being forced",
    examples: ["The willingness to take the next step matters."],
    collocations: ["willingness to learn", "willingness to try"],
  },
  "small habits": {
    word: "small habits",
    partOfSpeech: "noun phrase",
    translation: "小习惯",
    definition: "small actions done regularly that accumulate over time",
    examples: ["The quiet power of small habits."],
    collocations: ["build small habits", "small daily habits"],
  },
  "the ordinary": {
    word: "the ordinary",
    partOfSpeech: "noun phrase",
    translation: "平凡的事物",
    definition: "ordinary things or everyday life, considered as a whole",
    examples: ["Let the ordinary do its work."],
    collocations: ["the ordinary moments", "the beauty of the ordinary"],
  },
};

const IRREGULAR: Record<string, string> = {
  lives: "life",
  grew: "grow",
  grown: "grow",
  became: "become",
  better: "good",
  stronger: "strong",
  finished: "finish",
  repeated: "repeat",
  waiting: "wait",
  choices: "choice",
  minutes: "minute",
  expected: "expect",
  arrives: "arrive",
};

function candidates(word: string): string[] {
  const normalized = normalizeWord(word);
  const found = new Set<string>([normalized]);
  if (IRREGULAR[normalized]) found.add(IRREGULAR[normalized]);
  if (normalized.endsWith("ies") && normalized.length > 4) found.add(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith("es") && normalized.length > 3) found.add(normalized.slice(0, -2));
  if (normalized.endsWith("s") && normalized.length > 3) found.add(normalized.slice(0, -1));
  if (normalized.endsWith("ed") && normalized.length > 3) {
    found.add(normalized.slice(0, -2));
    found.add(normalized.slice(0, -1));
  }
  if (normalized.endsWith("ing") && normalized.length > 5) {
    found.add(normalized.slice(0, -3));
    found.add(normalized.slice(0, -3) + "e");
  }
  if (normalized.endsWith("ly") && normalized.length > 4) found.add(normalized.slice(0, -2));
  if (normalized.endsWith("er") && normalized.length > 4) found.add(normalized.slice(0, -2));
  if (normalized.endsWith("est") && normalized.length > 5) found.add(normalized.slice(0, -3));
  return Array.from(found);
}

export function lookupLocalWord(word: string): DictionaryEntry | null {
  for (const key of candidates(word)) {
    const entry = WORD_ENTRIES[key];
    if (entry) return { ...entry, source: "local" };
  }
  return null;
}

export function lookupLocalPhrase(phrase: string): DictionaryEntry | null {
  const key = normalizePhrase(phrase);
  const entry = PHRASE_ENTRIES[key];
  return entry ? { ...entry, source: "local" } : null;
}

export function lookupLocalEntry(text: string, type: "word" | "phrase" | "sentence"): DictionaryEntry | null {
  if (type === "word") return lookupLocalWord(text);
  if (type === "phrase") return lookupLocalPhrase(text);
  return null;
}

const dictionaryCache = new Map<string, DictionaryEntry>();
const phraseCache = new Map<string, string[]>();
const glossCache = new Map<string, string>();

async function fetchChineseGloss(word: string, signal?: AbortSignal): Promise<string | null> {
  const normalized = normalizeWord(word);
  if (!normalized) return null;
  const cached = glossCache.get(normalized);
  if (cached) return cached;
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=en%7Czh-CN`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { responseData?: { translatedText?: string } };
    const translated = payload.responseData?.translatedText?.trim();
    if (!translated || translated.length > 60 || translated.toLowerCase() === normalized) return null;
    glossCache.set(normalized, translated);
    return translated;
  } catch {
    return null;
  }
}
const PHRASE_BLOCKLIST = new Set([
  "the", "a", "an", "and", "or", "of", "is", "are", "was", "were", "be", "been", "being",
  "its", "his", "her", "their", "our", "your", "my", "this", "that", "these", "those",
  "i", "you", "we", "they", "he", "she", "it", "as", "at", "by", "from", "on", "in",
]);

type DatamuseWord = { word?: string; score?: number };

async function fetchDatamuse(
  word: string,
  relation: "rel_bga" | "rel_bgb" | "rel_jjb",
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const response = await fetch(
      `https://api.datamuse.com/words?${relation}=${encodeURIComponent(word)}&max=8`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as DatamuseWord[];
    return payload
      .map((item) => item.word?.trim().toLowerCase() ?? "")
      .filter((item) => /^[a-z][a-z'-]*$/.test(item) && !PHRASE_BLOCKLIST.has(item))
      .slice(0, 4);
  } catch {
    return [];
  }
}

/** Public Datamuse bigram/related-word data, used as a lightweight phrase hint. */
export async function fetchRelatedPhrases(word: string, signal?: AbortSignal): Promise<string[]> {
  const normalized = normalizeWord(word);
  if (!normalized) return [];
  const cached = phraseCache.get(normalized);
  if (cached) return cached;

  const [followers, predecessors] = await Promise.all([
    fetchDatamuse(normalized, "rel_bga", signal),
    fetchDatamuse(normalized, "rel_bgb", signal),
  ]);
  let phrases = [
    ...followers.map((item) => `${normalized} ${item}`),
    ...predecessors.map((item) => `${item} ${normalized}`),
  ];

  // Bigrams are the most natural phrases. If they are too sparse, use
  // adjectives that commonly describe the word ("rapid progress").
  if (phrases.length < 2) {
    const adjectives = await fetchDatamuse(normalized, "rel_jjb", signal);
    phrases.push(...adjectives.map((item) => `${item} ${normalized}`));
  }
  phrases = phrases
    .filter((phrase) => phrase.split(" ").length === 2)
    .filter((phrase, index, array) => array.indexOf(phrase) === index)
    .slice(0, 6);
  if (phrases.length) phraseCache.set(normalized, phrases);
  return phrases;
}

export async function fetchDictionaryEntry(
  word: string,
  signal?: AbortSignal,
): Promise<DictionaryEntry | null> {
  const local = lookupLocalWord(word);
  if (local) return local;
  const normalized = normalizeWord(word);
  if (!normalized) return null;
  const cached = dictionaryCache.get(normalized);
  if (cached) return cached;
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as Array<{
      word?: string;
      phonetic?: string;
      phonetics?: Array<{ text?: string; audio?: string }>;
      meanings?: Array<{
        partOfSpeech?: string;
        definitions?: Array<{ definition?: string; example?: string }>;
        synonyms?: string[];
      }>;
    }>;
    const first = payload[0];
    if (!first) return null;
    const meanings = first.meanings?.slice(0, 6) ?? [];
    // The first API sense is not always the most useful one. Prefer the
    // part of speech with the richest definition set (e.g. adjective for
    // "small"), and keep other senses visible in the UI.
    const ordered = [...meanings].sort(
      (a, b) => (b.definitions?.length ?? 0) - (a.definitions?.length ?? 0),
    );
    const primary = ordered[0];
    const definition = primary?.definitions?.[0]?.definition;
    if (!definition) return null;
    const senses = ordered
      .flatMap((meaning) =>
        (meaning.definitions ?? []).slice(0, 2).map((item) => ({
          partOfSpeech: meaning.partOfSpeech,
          definition: item.definition ?? "",
          example: item.example,
        })),
      )
      .filter((sense) => sense.definition)
      .slice(0, 5);
    const examples = senses
      .map((sense) => sense.example)
      .filter((example): example is string => Boolean(example))
      .slice(0, 2);
    const gloss = await fetchChineseGloss(normalized, signal);
    const entry: DictionaryEntry = {
      word: first.word ?? normalized,
      phonetic: first.phonetic ?? first.phonetics?.find((item) => item.text)?.text,
      partOfSpeech: primary?.partOfSpeech,
      definition,
      senses,
      examples,
      translation: gloss ?? undefined,
      translationSource: gloss ? "machine" : undefined,
      audio: first.phonetics?.find((item) => item.audio)?.audio,
      note: "English dictionary data: Free Dictionary API. Chinese quick gloss: MyMemory machine translation.",
      source: "api",
    };
    dictionaryCache.set(normalized, entry);
    return entry;
  } catch {
    return null;
  }
}

export function dictionaryForContext(
  text: string,
  type: "word" | "phrase" | "sentence",
  translation?: string,
): DictionaryEntry {
  if (type === "sentence") {
    return {
      word: text,
      translation,
      definition: "Use the full line as a model for rhythm, collocation, and meaning in context.",
      source: "context",
    };
  }
  if (type === "phrase") {
    return {
      word: text,
      translation,
      definition: "Phrase meaning is best read inside the original line. Save it now and refine the note later.",
      source: "context",
    };
  }
  return {
    word: text,
    translation,
    definition: "No dictionary entry was found. The saved item still keeps its original video context.",
    source: "context",
  };
}
