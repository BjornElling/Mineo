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

/**
 * Brandet gør en kontrolrække UKONSTRUERBAR uden for {@link buildSammentaellingControl}.
 *
 * Det er ikke ceremoni. Rækkerne blev før bygget som håndskrevne objektliteraler ét sted pr. række,
 * og præcis dér opstod fejlen: en række kunne have en TOM beregnet side og en UDFYLDT tabelside,
 * fordi kun den ene side respekterede sit inputkrav. Symmetrien kan ikke håndhæves af en regel, alle
 * skal huske – kun af en konstruktør, man ikke kan gå uden om.
 */
declare const sammentaellingControlBrand: unique symbol;

export type SammentaellingControl = Readonly<{
  readonly [sammentaellingControlBrand]: true;
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

/**
 * Den beregnede side af en kontrolrække.
 *
 * `null` betød før to vidt forskellige ting, og kontrollen kunne ikke skelne dem:
 *
 *  - **Grundlaget findes ikke (endnu).** Inputtet er ikke et gyldigt, færdigt grundlag – et tomt
 *    påkrævet felt, to perioder der overlapper, en fraslået sektion. Manglen er ALLEREDE fortalt
 *    brugeren som rødt felt eller rød række, og der er intet at sammenligne.
 *  - **Grundlaget fandtes, men opgørelsen kunne ikke dannes.** Det er et ægte fund, som skal meldes.
 *
 * Sammenblandingen gjorde en helt almindelig indtastning til en systemfejl: en tom beregnet side
 * mod et udfyldt tabeltal blev læst som uoverensstemmelse, og `control:sammentaelling_mismatch` er
 * `source: 'system'` og åbner notitsen «Teknisk fejl registreret» (brugerfund 2026-09-17).
 */
export type SammentaellingBeregnetSide =
  /**
   * Opgørelsen blev dannet. `null` betyder her «dannet, men uden værdi» – ikke «kunne ikke dannes».
   * `display` må afvige fra `value`: fx viser TAF-rækken råtallet «6 (- 2)», mens 4 sammenlignes.
   */
  | Readonly<{ kind: 'vaerdi'; value: number | null; display: string }>
  /** Grundlaget er ikke til stede. Tabelsiden tømmes med, så rækken ikke kan give en uoverensstemmelse. */
  | Readonly<{ kind: 'grundlag-mangler' }>;

export const beregnetVaerdi = (value: number | null, display: string): SammentaellingBeregnetSide =>
  ({ kind: 'vaerdi', value, display });

export const grundlagMangler: SammentaellingBeregnetSide = Object.freeze({ kind: 'grundlag-mangler' as const });

/** Visningen for en side uden værdi. Ét sted, så «tom» ser ens ud i alle rækker. */
export const SAMMENTAELLING_TOM_VISNING = '-';

export type SammentaellingControlInput = Readonly<{
  beregnet: SammentaellingBeregnetSide;
  /**
   * Tabelsiden. `value` er det, der SAMMENLIGNES; `display` er det, brugeren ser. De to må afvige,
   * fordi fradrag vises ved siden af råtallet i stedet for at være regnet ind i det. Begge tømmes,
   * når grundlaget mangler.
   */
  tabel: Readonly<{ value: number | null; display: string }>;
  loseFeriedage?: number;
  oevrigeFravaersdage?: number;
  ferieDageCount?: number | null;
  dateredeFerieDageCount?: number | null;
  loseFerieDageCount?: number | null;
  shDageCount?: number | null;
}>;

/**
 * Den ENE måde at bygge en kontrolrække på.
 *
 * Invarianten, konstruktøren håndhæver: **en uoverensstemmelse kan kun opstå mellem to faktisk
 * dannede opgørelser.** Mangler grundlaget, tømmes BEGGE sider – både værdi og visning – så rækken
 * hverken kan melde en falsk uoverensstemmelse eller vise et tal, der ikke hviler på noget.
 */
export const buildSammentaellingControl = (input: SammentaellingControlInput): SammentaellingControl => {
  const manglerGrundlag = input.beregnet.kind === 'grundlag-mangler';

  return {
    beregnetDisplay: manglerGrundlag ? SAMMENTAELLING_TOM_VISNING : input.beregnet.display,
    tabelDisplay: manglerGrundlag ? SAMMENTAELLING_TOM_VISNING : input.tabel.display,
    beregnetValue: input.beregnet.kind === 'grundlag-mangler' ? null : input.beregnet.value,
    tabelValue: manglerGrundlag ? null : input.tabel.value,
    loseFeriedage: input.loseFeriedage ?? 0,
    oevrigeFravaersdage: input.oevrigeFravaersdage ?? 0,
    ferieDageCount: input.ferieDageCount,
    dateredeFerieDageCount: input.dateredeFerieDageCount,
    loseFerieDageCount: input.loseFerieDageCount,
    shDageCount: input.shDageCount,
  } as SammentaellingControl;
};

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
