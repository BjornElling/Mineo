/**
 * Produktions-ejet kontrol-/audit-kerne for EO-sammentællingen.
 *
 * Dette er den trust-kritiske sammenlignings-semantik som snapshot-invarianten
 * `control:sammentaelling_mismatch` afhænger af (gater produktions-output). Den bor bevidst i
 * domæne-/produktionslaget – IKKE i `domain/eoInspektion` – så `eoSnapshot.ts` ikke importerer
 * sin gate-logik fra kontrollaget (jf. arkitektur-kandidat "adskil produktions-kontrol-model
 * fra domain/eoInspektion").
 *
 * Kontrollaget (`eoInspektionSammentaelling.ts`) *bygger* sammentællings-rækkerne (den "tabel"-side
 * der læses fra den committede EO-kontroltabel-projektion) og *forbruger* denne kontrakt; det
 * definerer den ikke. Selve afgørelsen "er der en uoverensstemmelse" + besked-formatet ejes her.
 */

export type SammentaellingControl = Readonly<{
  beregnetDisplay: string;
  tabelDisplay: string;
  beregnetValue: number | null;
  tabelValue: number | null;
  loseFeriedage: number;
  oevrigeFravaersdage: number;
  ferieDageCount?: number | null;
  dateredeFerieDageCount?: number | null;
  loseFerieDageCount?: number | null;
  shDageCount?: number | null;
}>;

export type SammentaellingControlStatus = 'ok' | 'error';

export type SammentaellingDisplayRow = Readonly<{
  key: string;
  label: string;
  control: SammentaellingControl;
}>;

export const getSammentaellingControlStatus = (control: SammentaellingControl): SammentaellingControlStatus => {
  // Eksplicit domænevalg: lille tolerance (0.005) for floating-afrunding; 0 og null behandles som tomt ("-") i UI.
  const EPS = 0.005;
  const normalizedBeregnet = control.beregnetValue === null || control.beregnetValue === 0 ? null : control.beregnetValue;
  const normalizedTabel = control.tabelValue === null || control.tabelValue === 0 ? null : control.tabelValue;

  if (normalizedBeregnet === null && normalizedTabel === null) {
    return 'ok';
  }

  if (
    typeof normalizedBeregnet === 'number' &&
    typeof normalizedTabel === 'number' &&
    Number.isFinite(normalizedBeregnet) &&
    Number.isFinite(normalizedTabel) &&
    Math.abs(normalizedBeregnet - normalizedTabel) <= EPS
  ) {
    return 'ok';
  }
  return 'error';
};

export const collectSammentaellingControlMismatchMessages = (
  rows: readonly SammentaellingDisplayRow[]
): readonly string[] => {
  return rows
    .filter((row) => getSammentaellingControlStatus(row.control) === 'error')
    .map((row) => `${row.label}: beregnet=${row.control.beregnetDisplay}, tabel=${row.control.tabelDisplay}`);
};
