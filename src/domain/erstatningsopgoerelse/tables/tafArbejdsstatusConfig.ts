import type { Arbejdsstatus } from '../../../schemas/formSchemas';

export type TafArbejdsstatusPrefix = 'i' | 'på' | 'under' | 'bevilget' | null;
export type TafArbejdsstatusSuffix = 'Uarbejdsdygtig' | 'Delvist uarbejdsdygtig' | null;

type TafArbejdsstatusConfig = Readonly<{
  prefix: TafArbejdsstatusPrefix;
  suffix: TafArbejdsstatusSuffix;
  statusTekst: string;
  fortsat: boolean;
}>;

type BuildTafArbejdsstatusLinjeOptions = Readonly<{
  opgjortFremTilPeriodeTil: boolean;
}>;

export const TAF_ARBEJDSSTATUS_CONFIG: Readonly<Record<Arbejdsstatus, TafArbejdsstatusConfig>> = {
  Uarbejdsdygtig: {
    prefix: null,
    suffix: null,
    statusTekst: 'uarbejdsdygtig',
    fortsat: true,
  },
  'Delvist raskmeldt': {
    prefix: null,
    suffix: null,
    statusTekst: 'delvist uarbejdsdygtig',
    fortsat: true,
  },
  'Fuldt arbejdsdygtig': {
    // NOTE: Denne entry bevares af hensyn til config-konsistens på tværs af alle Arbejdsstatus.
    // buildTafArbejdsstatusLinje overstyrer teksten med en særregel ("var/blev ... raskmeldt").
    prefix: null,
    suffix: null,
    statusTekst: 'raskmeldt',
    fortsat: false,
  },
  Fleksjob: {
    prefix: 'bevilget',
    suffix: 'Delvist uarbejdsdygtig',
    statusTekst: 'fleksjob',
    fortsat: false,
  },
  Revalidering: {
    prefix: 'i',
    suffix: 'Delvist uarbejdsdygtig',
    statusTekst: 'revalidering',
    fortsat: false,
  },
  Uddannelse: {
    prefix: 'under',
    suffix: null,
    statusTekst: 'uddannelse',
    fortsat: false,
  },
  Førtidspension: {
    prefix: 'på',
    suffix: 'Uarbejdsdygtig',
    statusTekst: 'førtidspension',
    fortsat: false,
  },
  Seniorpension: {
    prefix: 'på',
    suffix: null,
    statusTekst: 'seniorpension',
    fortsat: false,
  },
  Folkepension: {
    prefix: 'på',
    suffix: null,
    statusTekst: 'folkepension',
    fortsat: false,
  },
  Efterløn: {
    prefix: 'på',
    suffix: null,
    statusTekst: 'efterløn',
    fortsat: false,
  },
  Kontanthjælp: {
    prefix: 'på',
    suffix: null,
    statusTekst: 'kontanthjælp',
    fortsat: false,
  },
} as const;

const normalizeSuffix = (suffix: Exclude<TafArbejdsstatusSuffix, null>): string => {
  return suffix.charAt(0).toLowerCase() + suffix.slice(1);
};

export const buildTafArbejdsstatusLinje = (
  dagenEfter: string,
  status: Arbejdsstatus,
  options?: BuildTafArbejdsstatusLinjeOptions
): string => {
  if (status === 'Fuldt arbejdsdygtig') {
    const verb = options?.opgjortFremTilPeriodeTil ? 'blev' : 'var';
    return `Den ${dagenEfter} ${verb} skadelidte raskmeldt.`;
  }

  const config = TAF_ARBEJDSSTATUS_CONFIG[status];
  const fortsatSegment = config.fortsat ? 'fortsat ' : '';
  const prefixSegment = config.prefix ? `${config.prefix} ` : '';
  const base = `Den ${dagenEfter} var skadelidte ${fortsatSegment}${prefixSegment}${config.statusTekst}`;

  if (!config.suffix) {
    return `${base}.`;
  }

  return `${base} og således fortsat ${normalizeSuffix(config.suffix)}.`;
};
