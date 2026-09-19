// Shapes of the JSON produced by tools/extract.mjs

export interface Psalm {
  t: 'psalm' | 'canticle';
  num?: string;
  alt?: string;
  title: string;
  ref?: string;
  id?: 'benedictus' | 'magnificat' | 'nunc';
  epigraph?: string;
  lines: string[];
  /** Latin text of the same canticle (when the book prints it) */
  la?: string[];
}
export interface AntAlt { season: string; text: string }
export interface Unit {
  t: 'unit';
  ant: { n: string; text: string } | null;
  alts: AntAlt[];
  body: Psalm[];
  again: { n: string } | null;
  /** filled by assemble(): antiphon variants to choose from (e.g. Sunday propers) */
  antOptions?: { label: string; text: string }[];
  /** filled by assemble(): resolved antiphon text for the current season */
  antText?: string;
  antDefault?: number;
}
export interface Stanza { n: string; lines: string[]; amen?: boolean }
export interface HymnOption { note: string; sk?: Stanza[]; la?: Stanza[]; laRef?: string }
export interface Hymn { t: 'hymn'; title: string; options: HymnOption[] }
export interface ReadingOption { n: string; ref: string; text: string; resp: string[] | null }
export interface VersicleOption { season: string; label: string; text: string }

export type Block =
  | Unit
  | Hymn
  | { t: 'alt'; options: Unit[] }
  | { t: 'readings'; options: ReadingOption[]; def?: number }
  | { t: 'prosby' | 'prayers'; options: { n: string; lines: string[]; label?: string }[]; def?: number }
  | { t: 'versicles'; options: VersicleOption[]; memorials: string[]; def?: number }
  | { t: 'seasonal'; options: Record<string, Block[]> }
  | { t: 'text'; lines: string[] }
  | { t: 'note'; text: string }
  | { t: 'nokturn'; n: string }
  | { t: 'gospelhead'; which: string }
  | { t: 'opening'; either: boolean }
  | { t: 'closing'; kind: string; lines: string[] }
  | { t: 'or' }
  | { t: 'pcreadings'; set: import('./pc').PcSet }
  | { t: 'formula'; id: string; formulas: import('./common').Formula[] }; // added by assemble()

export interface DayData { day: number; hours: Record<string, Block[]> }
export interface SundayProper {
  n: number;
  notes: string[];
  prayer: string;
  v1: { k: string; text: string }[];
  lauds: { k: string; text: string }[];
  v2: { k: string; text: string }[];
  hymns: { head: string; options: HymnOption[] }[];
}
