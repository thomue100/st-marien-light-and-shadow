// Kleine Helfer: DOM-Abkürzung $, Browserspeicher, Parameter im Link (#…), weiche Übergänge.
import './loader.js'; // Aufbau-Reihenfolge: nach core/loader

export const lsGet = k => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  };
export const HASHQ = new URLSearchParams((location.hash || '').replace(/^#/, ''));
export const $ = s => document.querySelector(s);
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
