/**
 * Delte UI-konstanter for Erstatningsopgørelse-oplysninger-fanens sektion-komponenter.
 * Samlet ét sted så flere sektioner kan dele dem uden at importere fra hinanden.
 */

// Tre-tilstands-valg for emner (svie/smerte, tabt arbejdsfortjeneste).
// 'Ja' = beregnes og vises; 'Nej' = beregnes ikke, vises som "Ingen" i dokumentet;
// 'Skjul' = beregnes ikke og udelades helt fra erstatningsopgørelsen.
export const KRAV_JA_NEJ_SKJUL_OPTIONS = [
  { value: 'Ja', label: 'Ja' },
  { value: 'Nej', label: 'Nej' },
  { value: 'Skjul', label: 'Skjul' },
] as const;

export const PERIODE_INFO_TOOLTIP =
  'Indsæt alle perioder. Tidligere indtastede perioder skal ikke slettes ved senere opgørelse.';

export const DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP =
  'Juridisk omtvistet, men nyere\nretspraksis hælder mod fuld sats';
