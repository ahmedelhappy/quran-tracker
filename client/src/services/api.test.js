import { describe, it, expect, afterEach } from 'vitest';
import API, { API_TIMEOUT_MS, chatAPI, progressAPI, authAPI } from './api';

// Capture the config each request would go out with, instead of sending it.
const seen = [];
API.defaults.adapter = async (config) => {
  seen.push(config);
  return { data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config };
};
afterEach(() => { seen.length = 0; });

describe('API deadlines (M-14)', () => {
  it('every request has a 20 s deadline unless it names its own', async () => {
    expect(API_TIMEOUT_MS).toBe(20_000);
    expect(API.defaults.timeout).toBe(API_TIMEOUT_MS);
    await progressAPI.getTodayTasks();
    await authAPI.getMe();
    expect(seen.map((c) => c.timeout)).toEqual([20_000, 20_000]);
  });

  it('a chat message waits longer than the server-side 20 s model deadline', async () => {
    await chatAPI.sendMessage([{ role: 'user', content: 'hi' }]);
    expect(seen[0].timeout).toBeGreaterThan(20_000);
  });
});
