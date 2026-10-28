const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { buildProgressSummary } = require('./progressController');
const { tryConsume } = require('../utils/chatBudget');
const clock = require('../utils/clock');

// The app's own guide (server/chat/appGuide.md), read once when the server boots.
// It is what lets the assistant answer "how do I…?" about THIS app — the pages, the
// daily plan, the reader — and link to the right place, instead of guessing.
const APP_GUIDE = fs.readFileSync(path.join(__dirname, '..', 'chat', 'appGuide.md'), 'utf8').trim();

// Which Groq model answers. Groq retires models: the one this used to name,
// llama-3.3-70b-versatile, now answers 404 model_not_found, which had quietly
// turned every chat into "AI service unavailable". gpt-oss-120b is the nearest
// replacement this key can use; GROQ_MODEL overrides it without a code change.
const CHAT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const SYSTEM_MESSAGE = {
  role: 'system',
  content: [
    'You are the assistant inside Quran Tracker, a Quran memorization (Hifz) app.',
    'What you answer, and from where:',
    '- Questions about the app — what a page or feature does, how to do something — answer ONLY from the APP GUIDE below. If the guide does not cover it, say you are not sure rather than guessing.',
    "- Questions about the user's own progress, plan, streak, or what to do today — answer ONLY from THE USER'S CURRENT DATA, which follows this message. Never invent numbers or pages.",
    '- Quran memorization technique, and questions about the Quran, its surahs and ayahs, tafsir, or hadith related to the Quran — answer from your own knowledge, accurately and humbly.',
    '- Anything else: decline politely in one sentence and offer to help with the Quran or the app instead.',
    "Reply in the language of the user's latest message (Arabic to Arabic, English to English). The guide names buttons in English; when replying in Arabic, describe a control by what it does instead of quoting its English label.",
    'Keep replies concise (under 150 words), warm and encouraging. Write plain text: short numbered steps are fine, but no headings, tables or other markdown except links.',
    'When a page of the app would help, link to it with a path from the guide\'s list, written as a markdown link such as [open page 291](/library?page=291). Use only those paths. Never include external links or web addresses.',
    '',
    '=== APP GUIDE ===',
    APP_GUIDE,
    '=== END OF APP GUIDE ===',
  ].join('\n'),
};

// "page 50 — verses 3:1–3:9 (first half)" / "page 51 — the rest of the page (3:10–3:15)"
const describeNewItem = (it) => {
  if (!it.fromVerseKey) return `page ${it.pageNumber} (the whole page)`;
  const part = it.half === 1 ? 'first half' : 'the rest of the page';
  return `page ${it.pageNumber} — verses ${it.fromVerseKey}–${it.toVerseKey} (${part})`;
};
const listPages = (nums, max = 30) => (nums.length > max
  ? `${nums.slice(0, max).join(', ')} … (+${nums.length - max} more)`
  : nums.join(', '));

// Renders the user's live progress snapshot into a system message the model treats
// as authoritative. Used to answer "what should I memorize today?", "how many pages
// are left?", "what's my streak?" from real data instead of guessing.
const buildUserContextMessage = (summary) => {
  const todayUTC = clock.now().toISOString().split('T')[0];
  const lines = [
    `THE USER'S CURRENT DATA (authoritative and live, as of ${todayUTC} UTC):`,
    `- Name: ${summary.name}`,
    `- Daily new-page goal: ${summary.dailyNewPages} page(s) per day`,
    `- Total memorized: ${summary.totalMemorized} of ${summary.totalPages} pages (${summary.percentage}%)`,
    `- Pages left to memorize: ${summary.pagesLeft}`,
    `- Current streak: ${summary.currentStreak} day(s)`,
  ];

  if (summary.isHafiz) {
    lines.push('- Status: has memorized the entire Quran (Hafiz) — no new pages remain, only review.');
  }

  if (summary.isOffDay) {
    lines.push('- Today is a scheduled rest/off day: no new pages or reviews are due.');
  } else {
    const items = summary.newItems ?? [];
    if (items.length > 0) {
      lines.push(`- New to memorize today (exactly what the dashboard shows): ${items.map(describeNewItem).join('; ')}`);
    } else if (summary.pauseNewMemorization) {
      lines.push('- New memorization is paused by the user (review only).');
    } else if (!summary.isHafiz) {
      lines.push("- New to memorize today: nothing left (today's new-memorization goal is already met).");
    }
    if (summary.continuationPage) {
      lines.push(`- Suggested extra practice: page ${summary.continuationPage} (the most recently memorized page).`);
    }
    lines.push(`- Reviews (Muraja'ah) due today: ${summary.reviewsDueToday}`);
    if (summary.recentReviewPageNumbers?.length) {
      lines.push(`  - Recent review (newest pages): ${listPages(summary.recentReviewPageNumbers)}`);
    }
    if (summary.reviewPageNumbers?.length) {
      lines.push(`  - Cycle review: pages ${listPages(summary.reviewPageNumbers)}`);
    }
  }

  lines.push(
    '',
    'When the user asks about their plan, progress, streak, what to memorize, how many ' +
    'pages are left, or what to do today, answer using ONLY the data above. Be encouraging ' +
    'and specific, and never invent numbers that are not given here. A page can be opened ' +
    'with a link such as [page 50](/library?page=50).'
  );

  return { role: 'system', content: lines.join('\n') };
};

// Caps the size of any single message to bound token cost sent to the model.
const MAX_MESSAGE_LENGTH = 2000;

// Cost and latency bounds, each overridable from the environment (read per
// request, so a changed value needs no code change; see .env.example). The
// defaults are deliberately conservative — owner decisions, not tuned numbers:
//   - CHAT_MAX_TOKENS: the most the model may generate per reply. gpt-oss is a
//     reasoning model and its hidden reasoning counts against this too, so it is
//     far above the ~200 tokens a 150-word reply needs; what it bounds is a
//     runaway answer (cost, and the client's link parser, which is quadratic).
//   - CHAT_TIMEOUT_MS: the whole call to Groq, retries included, must finish
//     inside this or the user gets a 504 instead of a hung spinner.
//   - CHAT_DAILY_LIMIT: messages per user per UTC day (utils/chatBudget.js).
// Each must be a whole number above 0. Anything else falls back to the default
// with a warning (once per variable and value), so a typo shows up in the logs
// instead of looking like an AI outage: parseInt would have read "20s" as a
// 20 ms deadline and "2e4" as 2 ms, failing every request with a 504.
const warnedEnv = new Set();
const envInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  if (!warnedEnv.has(`${name}=${raw}`)) {
    warnedEnv.add(`${name}=${raw}`);
    console.warn(`${name}=${JSON.stringify(raw)} is not a whole number above 0; using ${fallback}`);
  }
  return fallback;
};
const chatLimits = () => ({
  maxTokens: envInt('CHAT_MAX_TOKENS', 2048),
  timeoutMs: envInt('CHAT_TIMEOUT_MS', 20000),
  dailyLimit: envInt('CHAT_DAILY_LIMIT', 50),
});

// The conversation the client sends is only ever this user's own chat with the
// assistant, so the worst a forged turn can do is mislead the forger's own
// reply — the system messages, built here from the server's data, always come
// first and stay authoritative. What must never reach Groq is anything beyond
// that: a client-written 'system' turn (dropped, so it cannot pose as the app's
// instructions) or extra properties on a turn (each is rebuilt as exactly
// { role, content }, never spread from the request).
const CONVERSATION_ROLES = new Set(['user', 'assistant']);

// Logged once, not on every message, when chat is off for want of a key.
let warnedNoKey = false;

// @desc    Send a message to the AI assistant
// @route   POST /api/chat
// @access  Private
exports.sendMessage = async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 10) {
    return res.status(400).json({
      success: false,
      message: 'messages must be an array of 1–10 items',
    });
  }

  const conversation = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      return res.status(400).json({ success: false, message: 'Each message must be an object' });
    }
    if (!CONVERSATION_ROLES.has(msg.role)) continue; // 'system' or anything else: dropped

    if (typeof msg.content !== 'string' || msg.content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Each message must have a valid role ("user" or "assistant") and a non-empty content string',
      });
    }

    // An over-long USER message is refused. An over-long ASSISTANT turn is one
    // of our own earlier replies (the output cap allows several thousand
    // characters) being replayed as history, so it is cut to the limit rather
    // than refused — refusing it would fail every later message in the chat.
    let { content } = msg;
    if (content.length > MAX_MESSAGE_LENGTH) {
      if (msg.role === 'user') {
        return res.status(400).json({
          success: false,
          message: `Each message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
        });
      }
      content = content.slice(0, MAX_MESSAGE_LENGTH);
    }

    conversation.push({ role: msg.role, content });
  }

  // The model answers the user, so the conversation must end with them.
  if (conversation.length === 0 || conversation[conversation.length - 1].role !== 'user') {
    return res.status(400).json({ success: false, message: 'The last message must be from the user' });
  }

  // No key means the assistant is switched off on this deployment: say so
  // before anything is charged, rather than spend the user's budget on a
  // failure that never reached Groq and reads like an outage.
  if (!process.env.GROQ_API_KEY) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.error('Chat is disabled: GROQ_API_KEY is not set');
    }
    return res.status(503).json({ success: false, message: 'The assistant is not configured on this server' });
  }

  const { maxTokens, timeoutMs, dailyLimit } = chatLimits();

  // Charged only once the request is known to be valid, just before the model call.
  if (!tryConsume(req.user._id, dailyLimit)) {
    return res.status(429).json({
      success: false,
      code: 'CHAT_DAILY_LIMIT',
      message: "You've reached today's limit for the assistant. Please come back tomorrow.",
    });
  }

  // One deadline for the whole model call. The SDK retries some failures on
  // its own, so its per-attempt timeout alone could stack up to several times
  // this. It starts only once the progress summary below is built: a slow
  // database must not use up the model's time and be reported as a slow AI.
  const deadline = new AbortController();
  let timer;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Append the user's live progress as an authoritative context block. If the
    // lookup fails for any reason, fall back to the plain assistant — a data
    // error must never break chat.
    const systemMessages = [SYSTEM_MESSAGE];
    try {
      const summary = await buildProgressSummary(req.user);
      systemMessages.push(buildUserContextMessage(summary));
    } catch (summaryError) {
      console.error('Chat progress-context error (continuing without it):', summaryError);
    }

    timer = setTimeout(() => deadline.abort(), timeoutMs);
    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [...systemMessages, ...conversation],
      max_completion_tokens: maxTokens,
    }, { signal: deadline.signal });

    const choice = completion.choices[0];
    const reply = choice?.message?.content ?? '';

    // No answer at all — the token cap ran out during the hidden reasoning, a
    // content filter, or anything else. Say so rather than send an empty bubble,
    // which the client would also replay as a turn this endpoint refuses.
    const finishReason = choice?.finish_reason ?? 'none';
    if (!reply.trim()) {
      console.error(`Groq returned no answer (finish_reason: ${finishReason}, cap ${maxTokens} tokens)`);
      return res.status(502).json({ success: false, message: 'The AI service could not finish its answer' });
    }
    // An answer the cap cut short still goes out, but leaves a trace: frequent
    // ones mean CHAT_MAX_TOKENS is too low.
    if (finishReason === 'length') {
      console.warn(`Groq reply truncated by the ${maxTokens}-token cap`);
    }

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    // Our own deadline fired (the SDK then reports an abort), or the SDK's own
    // per-attempt timeout did: either way the model was too slow, not down.
    const timedOut = deadline.signal.aborted
      || (typeof Groq.APIConnectionTimeoutError === 'function' && error instanceof Groq.APIConnectionTimeoutError);
    if (timedOut) {
      console.error(`Groq API timed out after ${timeoutMs} ms`);
      return res.status(504).json({ success: false, message: 'The AI service took too long to answer' });
    }
    console.error('Groq API error:', error);
    return res.status(502).json({ success: false, message: 'AI service unavailable' });
  } finally {
    clearTimeout(timer);
  }
};
