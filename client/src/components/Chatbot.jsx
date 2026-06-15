import { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiSend } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { chatAPI } from '../services/api';
import { useDraggable } from '../hooks/useDraggable';

export default function Chatbot() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [{
    role: 'assistant',
    content: t('chatbot.welcome'),
    isWelcome: true,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  // Launcher is draggable vertically only; the panel opens in a fixed spot.
  const { ref: launcherRef, style: dragStyle, moved, dragHandlers } = useDraggable('chatbotPosY', { axis: 'y' });

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Prompts offered when the conversation is empty (only the welcome message shown).
  const suggestionKeys = ['plan', 'memorized', 'streak'];
  const showSuggestions = !loading && messages.every((m) => m.isWelcome);

  const send = async (textArg) => {
    const text = (typeof textArg === 'string' ? textArg : input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    // Send last 6 messages (3 turns) excluding the static welcome
    const history = next.filter((m) => !m.isWelcome).slice(-6);

    try {
      const res = await chatAPI.sendMessage(history);
      const reply = res.data?.data?.reply ?? '';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      // 429 = rate limited: nudge the user to slow down rather than show a
      // generic failure.
      const messageKey = err.response?.status === 429 ? 'chatbot.rateLimit' : 'chatbot.error';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t(messageKey) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating launcher — draggable vertically. Hidden while open so it can
          never overlap the (fixed) panel. The drag offset lives on the wrapper
          so the button keeps its own transform-based hover/press scale. */}
      {!open && (
        <div
          ref={launcherRef}
          {...dragHandlers}
          style={dragStyle}
          className="fixed bottom-24 end-6 z-50 touch-none cursor-grab active:cursor-grabbing"
        >
          <button
            onClick={() => { if (!moved.current) setOpen(true); }}
            aria-label={t('chatbot.toggleLabel')}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#004f35' }}
          >
            <FiMessageSquare className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Chat panel — opens in a fixed spot, independent of the launcher */}
      {open && (
        <div
          className="fixed bottom-6 end-6 z-50 w-80 max-h-[480px] flex flex-col rounded-2xl shadow-xl border border-[#dce2f3] dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-[#dce2f3] dark:border-gray-700"
            style={{ backgroundColor: '#004f35' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white font-semibold text-sm">{t('chatbot.title')}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white text-lg leading-none"
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: '#004f35' } : undefined}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-xl">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            {/* Suggested prompts — shown only on an empty conversation */}
            {showSuggestions && (
              <div className="flex flex-col gap-2 pt-1">
                {suggestionKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => send(t(`chatbot.suggestions.${key}`))}
                    className="text-start text-sm px-3 py-2 rounded-xl border border-[#dce2f3] dark:border-gray-700 text-[#004f35] dark:text-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {t(`chatbot.suggestions.${key}`)}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="p-3 border-t border-[#dce2f3] dark:border-gray-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('chatbot.placeholder')}
              disabled={loading}
              className="flex-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#004f35]/40 disabled:opacity-60"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label={t('chatbot.send')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: '#004f35' }}
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
