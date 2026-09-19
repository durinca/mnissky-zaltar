// Gospel of the day, read after the III. nocturn of the Posvätné čítanie (Sundays, solemnities, feasts: only those days are in the data files).
// Texts come from public/data/gospel/<year>.json (see tools/extract-gospel.mjs).
export interface Gospel {
  ref: string;
  /** e.g. "Evanjelia podľa Matúša" */
  book: string;
  /** set when the day is a solemnity or feast (it overrides the weekday / Sunday) */
  rank?: 'slávnosť' | 'sviatok';
  title?: string;
  verse?: { r: string; v: string };
  text: string[];
}
