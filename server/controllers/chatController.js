const Groq = require('groq-sdk');
const { buildProgressSummary } = require('./progressController');

const SYSTEM_MESSAGE = {
  role: 'system',
  content:
    'You are a knowledgeable Islamic assistant inside a Quran memorization (Hifz) app. ' +
    'Help users with: Quran memorization techniques, questions about specific Surahs or Ayahs, ' +
    'Hadith related to the Quran, and general Islamic knowledge. ' +
    'Keep responses concise (under 150 words). ' +
    'For off-topic questions, politely redirect to Islamic content.',
};

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
    lines.push(
      summary.newPagesDueToday > 0
        ? `- New pages to memorize today: ${summary.newPagesDueToday} (page ${summary.newPageNumbers.join(', ')})`
        : "- New pages to memorize today: none left (today's new-memorization goal is already met)."
    );
    lines.push(`- Reviews (Muraja'ah) due today: ${summary.reviewsDueToday}`);
  }

  lines.push(
    '',
    'When the user asks about their plan, progress, streak, what to memorize, how many ' +
    'pages are left, or what to do today, answer using ONLY the data above. Be encouraging ' +
    'and specific, and never invent numbers that are not given here.'
  );

  return { role: 'system', content: lines.join('\n') };
};

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
      model: 'llama-3.3-70b-versatile',
      messages: [...systemMessages, ...messages],
    });

    const reply = completion.choices[0]?.message?.content ?? '';

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    console.error('Groq API error:', error);
    return res.status(502).json({ success: false, message: 'AI service unavailable' });
  }
};
