import { describe, it, expect, afterEach } from 'vitest';
import API, { API_TIMEOUT_MS, API_WRITE_TIMEOUT_MS, chatAPI, progressAPI, authAPI, bookmarksAPI } from './api';

// Capture the config each request would go out with, instead of sending it.
const seen = [];
API.defaults.adapter = async (config) => {
  seen.push(config);
  return { data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config };
};
afterEach(() => { seen.length = 0; });

describe('API deadlines (M-14)', () => {
  it('every read has a 20 s deadline unless it names its own', async () => {
    expect(API_TIMEOUT_MS).toBe(20_000);
    await progressAPI.getTodayTasks();
    await authAPI.getMe();
    expect(seen.map((c) => c.timeout)).toEqual([20_000, 20_000]);
  });

  it('a write waits 60 s, out past a cold start, so a slow save is not reported as failed', async () => {
    expect(API_WRITE_TIMEOUT_MS).toBe(60_000);
    await progressAPI.markComplete({ pageNumber: 5, type: 'review' });   // POST
    await authAPI.updateProfile({ name: 'x' });                          // PUT
    await progressAPI.changeMemorized({ add: [5] });                      // PATCH
    await bookmarksAPI.remove('b1');                                      // DELETE
    expect(seen.map((c) => [c.method, c.timeout])).toEqual([
      ['post', 60_000], ['put', 60_000], ['patch', 60_000], ['delete', 60_000],
    ]);
  });

  it('a chat message waits longer than the server-side 20 s model deadline', async () => {
    await chatAPI.sendMessage([{ role: 'user', content: 'hi' }]);
    expect(seen[0].timeout).toBeGreaterThan(20_000);
  });
});
