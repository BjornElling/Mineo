/**
 * Ydelsestyper og periodiseringsregler for offentlige ydelser
 *
 * Denne fil indeholder alle understøttede typer af offentlige ydelser
 * samt deres periodiseringsregler for beregning af ydelse pr. dag.
 */

export type Periodisering = 'kalenderdage' | 'arbejdsdage';

export interface YdelsestypeConfig {
  label: string;
  // Alternativ visnings-label med linjeskift til smalle tabelkolonner (kontrol-/kontroltabellen).
  // Falder tilbage til `label`, når den ikke er sat.
  tabelLabel?: string;
  periodisering: Periodisering;
  periodiseringLabel: string;  // Vises i readonly-kolonne
}

const ydelsestyperLiteral = {
  dagpenge: {
    label: 'Dagpenge',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  efterloen: {
    label: 'Efterløn',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  feriepenge: {
    label: 'Feriepenge',
    periodisering: 'arbejdsdage',
    periodiseringLabel: 'Arbejdsdage',
  },
  flextilskud: {
    label: 'Flextilskud',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  foertidspension: {
    label: 'Førtidspension',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  kontanthjaelp: {
    label: 'Kontanthjælp',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  ledighedsydelse: {
    label: 'Ledighedsydelse',
    tabelLabel: 'Ledigheds-\nydelse',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  midlertidigt_eet: {
    label: 'Midlertidigt EET',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  pension: {
    label: 'Pension',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  ressourceforloebsydelse: {
    label: 'Ress. forløbsydelse',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  revalideringsydelse: {
    label: 'Revalideringsydelse',
    tabelLabel: 'Revaliderings-\nydelse',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  sygedagpenge: {
    label: 'Sygedagpenge',
    periodisering: 'arbejdsdage',
    periodiseringLabel: 'Arbejdsdage',
  },
  su: {
    label: 'SU',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  uddannelseshjaelp: {
    label: 'Uddannelseshjælp',
    tabelLabel: 'Uddannelses-\nhjælp',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  andet: {
    label: 'Andet',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
} as const satisfies Record<string, YdelsestypeConfig>;

export type YdelsestypeKey = keyof typeof ydelsestyperLiteral;

export const ydelsestyper:
  Readonly<Record<string, YdelsestypeConfig>> &
  Readonly<Record<YdelsestypeKey, YdelsestypeConfig>> = ydelsestyperLiteral;

export const ydelsestypeKeys = Object.keys(ydelsestyperLiteral) as YdelsestypeKey[];

/* ----------------------------------------------------------------------------------------
 * Valgrækkefølgen i Ydelsestype-dropdownen
 *
 * Dropdownen viser ydelsestyperne i TO grupper adskilt af en streg: de egentlige offentlige
 * ydelser over stregen, og de supplerende posteringer under. Inden for hver gruppe sorteres
 * alfabetisk; grupperne blandes aldrig på tværs af stregen.
 *
 * Rækkefølgen udledes HER frem for at blive vedligeholdt i hånden i tabelkomponenten. Objekt-
 * literalens egen nøglerækkefølge kan ikke bære den: den sorterer efter NØGLE (`su` før
 * `uddannelseshjaelp`, `ressourceforloebsydelse` før `revalideringsydelse`), mens brugeren ser
 * LABELS ('SU' efter 'Ress. forløbsydelse'), og æ/ø/å ville falde forkert i en ren kodepunkt-
 * sammenligning. Sorteringen bruger derfor dansk kollation på den viste label.
 * ------------------------------------------------------------------------------------- */

/**
 * De supplerende posteringer – dem under stregen. Feriepenge, midlertidigt EET og «Andet» er
 * ikke offentlige ydelser i egen ret, men posteringer, der indgår samme sted i opgørelsen.
 */
const SUPPLERENDE_YDELSESTYPE_KEYS = ['feriepenge', 'midlertidigt_eet', 'andet'] as const satisfies readonly YdelsestypeKey[];

const supplerendeKeySet = new Set<YdelsestypeKey>(SUPPLERENDE_YDELSESTYPE_KEYS);

/** Dansk kollation på den viste label, så æ/ø/å sorteres som i en dansk ordbog. */
const byDanishLabel = (a: YdelsestypeKey, b: YdelsestypeKey): number =>
  ydelsestyper[a].label.localeCompare(ydelsestyper[b].label, 'da');

/** Ydelsestyperne OVER stregen: de egentlige offentlige ydelser, alfabetisk efter label. */
export const primaereYdelsestypeKeys: readonly YdelsestypeKey[] =
  ydelsestypeKeys.filter((key) => !supplerendeKeySet.has(key)).sort(byDanishLabel);

/** Ydelsestyperne UNDER stregen: de supplerende posteringer, alfabetisk efter label. */
export const supplerendeYdelsestypeKeys: readonly YdelsestypeKey[] =
  [...SUPPLERENDE_YDELSESTYPE_KEYS].sort(byDanishLabel);
