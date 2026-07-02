/**
 * Ydelsestyper og periodiseringsregler for offentlige ydelser
 *
 * Denne fil indeholder alle understøttede typer af offentlige ydelser
 * samt deres periodiseringsregler for beregning af ydelse pr. dag.
 */

export type Periodisering = 'kalenderdage' | 'arbejdsdage';

export interface YdelsestypeConfig {
  label: string;
  // Alternativ visnings-label med linjeskift til smalle tabelkolonner (kontrol-/gennemsynstabellen).
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
