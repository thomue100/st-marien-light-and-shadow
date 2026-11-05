// Ansichtstiefe: einfache oder erweiterte Bedienung (Schalter „mehr“).
import './i18n.js'; // Aufbau-Reihenfolge: nach core/i18n
import { HASHQ, lsGet, lsSet } from './util.js';

export let EXPERT = lsGet('stm-expert') === '1' || HASHQ.get('x') === '1';
document.body.classList.toggle('expert', EXPERT);

export function setExpert(v) {
  EXPERT = !!v;
  document.body.classList.toggle('expert', EXPERT);
  lsSet('stm-expert', EXPERT ? '1' : '0');
}
