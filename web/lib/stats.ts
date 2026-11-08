/**
 * Problem statistics shown on the landing page and README. Only entries checked
 * against their primary source are listed (see PROGRESS.md decision log).
 */
export interface Stat {
  figure: string;
  text: string;
  source: string;
  url: string;
}
export const STATS: Stat[] = [];
