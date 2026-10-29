// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkApiUrl } from '../vite.config.js';

// The build's guard on VITE_API_URL (vite.config.js): the value is baked into
// the bundle exactly as given, so it is checked exactly as given.
describe('checkApiUrl', () => {
  const prod = { production: true };

  it('accepts an http(s) API address', () => {
    expect(checkApiUrl('https://api.example.com/api', prod)).toEqual([]);
    expect(checkApiUrl('http://api.example.com/api', prod)).toEqual([]);
  });

  it('refuses a missing or blank value', () => {
    expect(() => checkApiUrl(undefined, prod)).toThrow(/not set/);
    expect(() => checkApiUrl('   ', prod)).toThrow(/not set/);
  });

  it('refuses spaces or a line break around the value, which would ship with it', () => {
    expect(() => checkApiUrl('https://api.example.com/api ', prod)).toThrow(/spaces or a line break/);
    expect(() => checkApiUrl(' https://api.example.com/api', prod)).toThrow(/spaces or a line break/);
    expect(() => checkApiUrl('https://api.example.com/api\n', prod)).toThrow(/spaces or a line break/);
  });

  it('refuses something that is not an http(s) URL', () => {
    expect(() => checkApiUrl('api.example.com/api', prod)).toThrow(/not an http\(s\) URL/);
    expect(() => checkApiUrl('ftp://api.example.com/api', prod)).toThrow(/not an http\(s\) URL/);
  });

  it('only warns when a production build points at this machine (e2e and CI do that on purpose)', () => {
    for (const url of ['http://127.0.0.1:5000/api', 'http://localhost:5000/api', 'http://[::1]:5000/api']) {
      const warnings = checkApiUrl(url, prod);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/visitor's own machine/);
    }
    expect(checkApiUrl('http://127.0.0.1:5000/api', { production: false })).toEqual([]);
  });
});
