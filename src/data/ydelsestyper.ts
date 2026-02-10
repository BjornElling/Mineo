/**
 * Ydelsestyper og periodiseringsregler for offentlige ydelser
 *
 * Denne fil indeholder alle understøttede typer af offentlige ydelser
 * samt deres periodiseringsregler for beregning af ydelse pr. dag.
 */

export type Periodisering = 'kalenderdage' | 'hverdage' | 'arbejdsdage';

export interface YdelsestypeConfig {
  label: string;
  debugLabel?: string;
  periodisering: Periodisering;
  periodiseringLabel: string;  // Vises i readonly-kolonne
}

export const ydelsestyper: Record<string, YdelsestypeConfig> = {
  dagpenge: {
    label: 'Dagpenge',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  flextilskud: {
    label: 'Flextilskud',
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
    debugLabel: 'Ledigheds-\nydelse',
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
    debugLabel: 'Revaliderings-\nydelse',
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
    debugLabel: 'Uddannelses-\nhjælp',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
  andet: {
    label: 'Andet',
    periodisering: 'kalenderdage',
    periodiseringLabel: 'Kalenderdage',
  },
};

export type YdelsestypeKey = keyof typeof ydelsestyper;

export const ydelsestypeKeys = Object.keys(ydelsestyper) as YdelsestypeKey[];
