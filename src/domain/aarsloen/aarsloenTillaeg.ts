import type { AarsloenValues, TillaegAngivesSom } from '../../schemas/formSchemas';
import {
  resolveLockedOverenskomstSatsTooltip,
  resolveOverenskomstSatsBindings,
  resolvePrivatOverenskomstDaekning,
  resolveSatsForReguleringsdato,
  type OverenskomstSatsBinding,
  type OverenskomstSatsBindings,
} from '../loen/overenskomstSatser';
import { resolveStoreBededagstillaegPct } from '../loen/storeBededagstillaeg';
import { dateRange_systemramme } from '../../config/dateRanges';
import { resolveOverenskomstDisplay } from '../../data/overenskomstRates';
import { isoToDanish, type ISODateString } from '../../types/branded';

/** Descriptorens rå dato og readerens vurderede dato skal give samme låsning ved en boundsfejl. */
export const resolveAarsloenSatsdato = (dato: ISODateString | undefined): ISODateString | undefined =>
  dato !== undefined && dato >= dateRange_systemramme.min && dato <= dateRange_systemramme.max ? dato : undefined;

/** Overenskomsten leverer ét satsæt; den fælles tabelmotor skal fortsat regne i procent uden periodisering. */
export const resolveAarsloenTillaegsMode = (grundlag: AarsloenValues['tillaegAngivesSom']): TillaegAngivesSom =>
  grundlag === 'beloeb' ? 'beloeb' : 'procent';

type AarsloenSatsValg = Pick<AarsloenValues, 'tillaegAngivesSom' | 'overenskomstId' | 'loenPaaHelligdage' | 'reguleringsdato'>;

export const resolveAarsloenOverenskomstValg = (values: Pick<AarsloenValues, 'tillaegAngivesSom' | 'overenskomstId' | 'loenPaaHelligdage'>) => ({
  harOverenskomst: values.tillaegAngivesSom === 'overenskomst',
  overenskomstId: values.overenskomstId,
  loenPaaHelligdage: values.loenPaaHelligdage,
});

const harValgtOverenskomst = (values: AarsloenSatsValg): boolean =>
  values.overenskomstId !== undefined && values.overenskomstId.trim() !== '';

const LAASTE_UDEN_OPSLAG: OverenskomstSatsBindings = {
  fritvalgPct: { kind: 'utilgaengelig' },
  shSoPct: { kind: 'utilgaengelig' },
  pensionPct: { kind: 'utilgaengelig' },
};

/**
 * Årslønnens satsbindinger – ét sted for felternes låsning, descriptorernes relevans og projektionen (BB-351).
 *
 * I Overenskomst står de tre tillæg låste og tomme, indtil både overenskomst og en gyldig dato kendes. Først
 * da åbnes de felter, overenskomsten ikke har en sats for. Ellers kunne brugeren taste et tal, som datoen et
 * øjeblik senere ville erstatte uden besked.
 */
export const resolveAarsloenSatsBindings = (values: AarsloenSatsValg): OverenskomstSatsBindings => {
  const dato = resolveAarsloenSatsdato(values.reguleringsdato);
  if (values.tillaegAngivesSom === 'overenskomst' && (!harValgtOverenskomst(values) || dato === undefined)) {
    return LAASTE_UDEN_OPSLAG;
  }
  return resolveOverenskomstSatsBindings(resolveAarsloenOverenskomstValg(values), dato);
};

/**
 * Forklaringen ved et låst felt. Uden overenskomst eller gyldig dato er det DET, der mangler – ikke
 * overenskomstens satsdækning (BB-349).
 */
export const resolveAarsloenLaastSatsTooltip = (
  binding: OverenskomstSatsBinding,
  values: AarsloenSatsValg,
): string | undefined => {
  if (!harValgtOverenskomst(values)) return 'Vælg overenskomst og reguleringsdato for at hente overenskomstens satser';
  const dato = resolveAarsloenSatsdato(values.reguleringsdato);
  return resolveLockedOverenskomstSatsTooltip(
    binding,
    resolvePrivatOverenskomstDaekning(resolveAarsloenOverenskomstValg(values)),
    dato,
    AARSLOEN_MANGLENDE_DATO_TOOLTIP,
  );
};

export const AARSLOEN_MANGLENDE_DATO_TOOLTIP = 'Angiv en gyldig reguleringsdato for at hente overenskomstens satser';

/** Dokumentets kildeangivelse for satserne (BB-355). `null` uden for Overenskomst. */
export type AarsloenSatsKilde = Readonly<{ overenskomst: string; dato: string }>;

export const resolveAarsloenSatsKilde = (values: AarsloenSatsValg): AarsloenSatsKilde | null => {
  const dato = isoToDanish(resolveAarsloenSatsdato(values.reguleringsdato));
  if (values.tillaegAngivesSom !== 'overenskomst' || !harValgtOverenskomst(values) || dato === undefined) return null;
  return { overenskomst: resolveOverenskomstDisplay(values.overenskomstId ?? ''), dato };
};

/**
 * Kun projektion: brugerens manuelle satser bevares til skift tilbage og til save/load. Uden gyldig dato er
 * Store Bededagstillæg ukendt – ikke 0 % (BB-349).
 */
export const applyAarsloenOverenskomstSatser = (values: AarsloenValues): AarsloenValues => {
  if (values.tillaegAngivesSom !== 'overenskomst') return values;
  const dato = resolveAarsloenSatsdato(values.reguleringsdato);
  const bindings = resolveAarsloenSatsBindings(values);
  return {
    ...values,
    fritvalgPct: resolveSatsForReguleringsdato(bindings.fritvalgPct, values.fritvalgPct),
    shSoPct: resolveSatsForReguleringsdato(bindings.shSoPct, values.shSoPct),
    pensionPct: resolveSatsForReguleringsdato(bindings.pensionPct, values.pensionPct),
    storeBededagPct: dato === undefined
      ? undefined
      : resolveStoreBededagstillaegPct(dato, { loenPaaHelligdage: values.loenPaaHelligdage, beregnStoreBededagstillaeg: values.beregnStoreBededagstillaeg }),
  };
};
