const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { buildProgressSummary } = require('./progressController');

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
  const todayUTC = new Date().toISOString().split('T')[0];
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

  for (const msg of messages) {
    if (
      !msg ||
      !['user', 'assistant'].includes(msg.role) ||
      typeof msg.content !== 'string' ||
      msg.content.trim() === ''
    ) {
      return res.status(400).json({
        success: false,
        message: 'Each message must have a valid role ("user" or "assistant") and a non-empty content string',
      });
    }

    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Each message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
      });
    }
  }

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

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [...systemMessages, ...messages],
    });

    const reply = completion.choices[0]?.message?.content ?? '';

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    console.error('Groq API error:', error);
    return res.status(502).json({ success: false, message: 'AI service unavailable' });
  }
};
