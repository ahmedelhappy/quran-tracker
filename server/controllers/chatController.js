const Groq = require('groq-sdk');

const SYSTEM_MESSAGE = {
  role: 'system',
  content:
    'You are a knowledgeable Islamic assistant inside a Quran memorization (Hifz) app. ' +
    'Help users with: Quran memorization techniques, questions about specific Surahs or Ayahs, ' +
    'Hadith related to the Quran, and general Islamic knowledge. ' +
    'Keep responses concise (under 150 words). ' +
    'For off-topic questions, politely redirect to Islamic content.',
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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [SYSTEM_MESSAGE, ...messages],
    });

    const reply = completion.choices[0]?.message?.content ?? '';

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    console.error('Groq API error:', error);
    return res.status(502).json({ success: false, message: 'AI service unavailable' });
  }
};
