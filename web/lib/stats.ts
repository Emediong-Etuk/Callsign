/**
 * Problem statistics shown on the landing page and README. Each was checked
 * against its primary source on 2026-11-08 (see PROGRESS.md decision log).
 */
export interface Stat {
  figure: string;
  text: string;
  source: string;
  url: string;
}
export const STATS: Stat[] = [
  {
    figure: "$893M",
    text: "Reported 2025 US losses in 22,364 complaints that mention AI — counted only when victims themselves mentioned it.",
    source: "FBI IC3, 2025 Internet Crime Report",
    url: "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf",
  },
  {
    figure: "+263%",
    text: "Reported deepfake-scam losses in 2026 so far already exceed all of 2025 by 263%.",
    source: "TRM Labs, 2026 AI-in-Crime Adoption Index",
    url: "https://www.trmlabs.com/reports-and-whitepapers/the-2026-ai-in-crime-adoption-index",
  },
  {
    figure: "$25.6M",
    text: "Sent in 15 transfers by an Arup employee after a video call where the “colleagues” were deepfakes.",
    source: "CNN, May 2024",
    url: "https://edition.cnn.com/2024/05/16/tech/arup-deepfake-scam-loss-hong-kong-intl-hnk",
  },
];
