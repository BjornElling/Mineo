import type { AarsloenValues, TillaegAngivesSom } from '../../schemas/formSchemas';
import { resolveOverenskomstSatsBindings, resolveSatsForReguleringsdato } from '../loen/overenskomstSatser';
import { resolveStoreBededagstillaegPct } from '../loen/storeBededagstillaeg';
import { dateRange_systemramme } from '../../config/dateRanges';
import type { ISODateString } from '../../types/branded';

/** Descriptorens rå dato og readerens vurderede dato skal give samme låsning ved en boundsfejl. */
export const resolveAarsloenSatsdato = (dato: ISODateString | undefined): ISODateString | undefined =>
  dato !== undefined && dato >= dateRange_systemramme.min && dato <= dateRange_systemramme.max ? dato : undefined;

/** Overenskomsten leverer ét satsæt; den fælles tabelmotor skal fortsat regne i procent uden periodisering. */
export const resolveAarsloenTillaegsMode = (grundlag: AarsloenValues['tillaegAngivesSom']): TillaegAngivesSom =>
  grundlag === 'beloeb' ? 'beloeb' : 'procent';

export const resolveAarsloenOverenskomstValg = (values: Pick<AarsloenValues, 'tillaegAngivesSom' | 'overenskomstId' | 'loenPaaHelligdage'>) => ({
  harOverenskomst: values.tillaegAngivesSom === 'overenskomst',
  overenskomstId: values.overenskomstId,
  loenPaaHelligdage: values.loenPaaHelligdage,
});

/** Kun projektion: brugerens manuelle satser bevares til skift tilbage og til save/load. */
export const applyAarsloenOverenskomstSatser = (values: AarsloenValues): AarsloenValues => {
  if (values.tillaegAngivesSom !== 'overenskomst') return values;
  const dato = resolveAarsloenSatsdato(values.reguleringsdato);
  const bindings = resolveOverenskomstSatsBindings(resolveAarsloenOverenskomstValg(values), dato);
  return {
    ...values,
    fritvalgPct: resolveSatsForReguleringsdato(bindings.fritvalgPct, values.fritvalgPct),
    shSoPct: resolveSatsForReguleringsdato(bindings.shSoPct, values.shSoPct),
    pensionPct: resolveSatsForReguleringsdato(bindings.pensionPct, values.pensionPct),
    storeBededagPct: resolveStoreBededagstillaegPct(dato, { loenPaaHelligdage: values.loenPaaHelligdage, beregnStoreBededagstillaeg: values.beregnStoreBededagstillaeg }),
  };
};
