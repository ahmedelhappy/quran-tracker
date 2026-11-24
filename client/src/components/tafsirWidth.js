import { storage } from '../utils/safeStorage';

// How wide the docked tafsir panel is, in px, remembered across visits. Only
// meaningful from lg up, where the panel is a column of the layout; below that
// it is a full-width sheet / fixed overlay and the width is ignored.
export const TAFSIR_MIN_W = 300;
export const TAFSIR_MAX_W = 720;
export const TAFSIR_DEFAULT_W = 400;

export const readSavedTafsirWidth = () => {
  const saved = Number(storage.get('tafsirPanelWidth'));
  return saved >= TAFSIR_MIN_W && saved <= TAFSIR_MAX_W ? saved : TAFSIR_DEFAULT_W;
};

// Capped so the reader can never squeeze the mushaf out or lose the panel.
export const clampTafsirWidth = (w) =>
  Math.round(Math.min(Math.max(w, TAFSIR_MIN_W), Math.min(TAFSIR_MAX_W, window.innerWidth * 0.55)));
