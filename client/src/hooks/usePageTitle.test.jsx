import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import { usePageTitle, PAGE_TITLE_KEYS } from './usePageTitle';
import { setTitlePrefix } from '../utils/documentTitle';

const inst = i18n.createInstance();
await inst.use(initReactI18next).init({
  lng: 'en', resources: { en: { translation: en }, ar: { translation: ar } }, interpolation: { escapeValue: false },
});

let go;
const Probe = () => {
  usePageTitle();
  go = useNavigate();
  return null;
};
const renderAt = (path) => render(
  <I18nextProvider i18n={inst}>
    <MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>
  </I18nextProvider>,
);

describe('usePageTitle (L-09)', () => {
  beforeEach(async () => { await inst.changeLanguage('en'); setTitlePrefix(''); });
  afterEach(cleanup);

  it('names every route, public and protected', () => {
    renderAt('/');
    const seen = new Set();
    for (const path of Object.keys(PAGE_TITLE_KEYS)) {
      act(() => go(path));
      expect(document.title).not.toMatch(/titles\./);   // a real string, not a raw key
      seen.add(document.title);
    }
    expect(seen.size).toBe(Object.keys(PAGE_TITLE_KEYS).length);
    act(() => go('/settings'));
    expect(document.title).toBe('Settings · Quran Tracker');
  });

  it('follows the language', async () => {
    renderAt('/library');
    expect(document.title).toBe('Quran Library · Quran Tracker');
    await act(() => inst.changeLanguage('ar'));
    expect(document.title).toBe('مكتبة القرآن · Quran Tracker');
  });

  it('keeps the timer readout in front of it across navigation', () => {
    renderAt('/dashboard');
    act(() => setTitlePrefix('12:04 · '));
    expect(document.title).toBe('12:04 · Dashboard · Quran Tracker');
    act(() => go('/progress'));
    expect(document.title).toBe('12:04 · My Progress · Quran Tracker');
    act(() => setTitlePrefix(''));
    expect(document.title).toBe('My Progress · Quran Tracker');
  });
});
