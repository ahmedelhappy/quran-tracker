import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
const sendMessage = vi.fn();
vi.mock('../services/api', () => ({ chatAPI: { sendMessage: (...args) => sendMessage(...args) } }));

const { default: Chatbot } = await import('./Chatbot');

const openAndAsk = () => {
  render(<MemoryRouter><Chatbot /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'chatbot.toggleLabel' }));
  fireEvent.change(screen.getByPlaceholderText('chatbot.placeholder'), { target: { value: 'What should I do today?' } });
  fireEvent.click(screen.getByRole('button', { name: 'chatbot.send' }));
};

describe('Chatbot retry (M-14)', () => {
  beforeEach(() => {
    cleanup();
    sendMessage.mockReset();
    Element.prototype.scrollIntoView = () => {};
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('a failed reply offers Retry, which asks again for the same turn', async () => {
    sendMessage
      .mockRejectedValueOnce(Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' }))
      .mockResolvedValueOnce({ data: { data: { reply: 'Review page 5 today.' } } });
    openAndAsk();

    expect(await screen.findByText('chatbot.timeout')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('Review page 5 today.')).toBeTruthy();
    expect(screen.queryByText('chatbot.timeout')).toBeNull();
    // The question is on screen once, and went out once per attempt, unchanged.
    expect(screen.getAllByText('What should I do today?')).toHaveLength(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1][0]).toEqual([{ role: 'user', content: 'What should I do today?' }]);
  });

  it("today's spent budget is not offered a Retry", async () => {
    sendMessage.mockRejectedValueOnce({ response: { status: 429, data: { code: 'CHAT_DAILY_LIMIT' } } });
    openAndAsk();
    expect(await screen.findByText('chatbot.dailyLimit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'common.retry' })).toBeNull();
  });
});

describe('Chatbot keyboard and screen reader (M-12)', () => {
  beforeEach(() => {
    cleanup();
    sendMessage.mockReset();
    Element.prototype.scrollIntoView = () => {};
  });

  it('opens as a named dialog with focus in the message box, and Escape hands focus back to the launcher', () => {
    render(<MemoryRouter><Chatbot /></MemoryRouter>);
    const launcher = screen.getByRole('button', { name: 'chatbot.toggleLabel' });
    launcher.focus();
    fireEvent.click(launcher);
    expect(screen.getByRole('dialog', { name: 'chatbot.title' })).toBeTruthy();
    const box = screen.getByRole('textbox', { name: 'chatbot.placeholder' });
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'chatbot.toggleLabel' }));
  });

  it('replies land in a live log, and the box keeps focus while one is on its way', async () => {
    let answer;
    sendMessage.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    openAndAsk();
    const box = screen.getByRole('textbox', { name: 'chatbot.placeholder' });
    expect(box.disabled).toBe(false);
    expect(screen.getByText('chatbot.typing')).toBeTruthy();
    answer({ data: { data: { reply: 'Review page 5 today.' } } });
    const log = screen.getByRole('log');
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(await screen.findByText('Review page 5 today.')).toBeTruthy();
    expect(log.contains(screen.getByText('Review page 5 today.'))).toBe(true);
  });
});
