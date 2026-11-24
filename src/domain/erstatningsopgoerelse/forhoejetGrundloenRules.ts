import { toAnyFieldRef, type AnyFieldRef } from '../../inputCore/fieldDescriptor';
import { eoAngivetLoenFields, eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { isISODateString, isoToDanish, type ISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { getOffentligOverenskomstTypeById } from '../../data/overenskomstRates';
import { getOffentligLoenForDato } from '../../data/offentligLoenLookup';
import { resolveOffentligLoenEnhed } from '../../data/offentligLoenTypes';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, type LoenudviklingSource } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato, resolveOffentligLoenEkstraGrundloen } from './helpers/eoSharedUtils';
import { parseOffentligLoenSelection } from './helpers/offentligLoenSelection';

/**
 * Gul advarsel: «Evt. forhøjet grundløn udover løntrin» er større end selve løntrinnets løn. Typisk et beløb pr.
 * måned angivet pr. time (500 kr./time = 80.165 kr./måned oven på en trinløn på 27.157 kr.). Udviklerafgørelse
 * 2026-10-23 (BB-313): gul ring og linje, ingen spærring.
 */
export const FORHOEJET_GRUNDLOEN_STOERRE_END_TRINLOEN_ADVARSEL =
  'Den forhøjede grundløn er større end løntrinnets løn – kontrollér beløb og enhed';

export type LoentrinetsLoen = Readonly<{ beloeb: number; enhed: 'Time' | 'Måned' }>;

/**
 * Løntrinnets løn efter overenskomsttabellen på reguleringsdatoen, i indplaceringens enhed – den enhed, motoren
 * regner tillæg om til (jf. `getGrundloenAngivetPerForOverenskomst`). Kun offentlige overenskomster har et
 * løntrin; `undefined`, når lønnen ikke kan slås op. Sammenligningsgrundlag for de gule advarsler om forhøjet
 * grundløn (BB-313) og anciennitetstillæg (BB-446).
 */
export const resolveLoentrinetsLoen = (
  values: ErstatningsopgoerelseValues,
  source: LoenudviklingSource,
  skadedato: ISODateString | undefined,
): LoentrinetsLoen | undefined => {
  if (source.loenudviklingBeregningsgrundlag !== 'Overenskomst') return undefined;
  const offentligType = getOffentligOverenskomstTypeById(source.overenskomstId ?? '');
  if (offentligType === undefined) return undefined;
  const selection = parseOffentligLoenSelection({
    offentligType,
    offentligLoenType: source.offentligLoenType,
    offentligLoenTrin: source.offentligLoenTrin,
    offentligLoenGruppe: source.offentligLoenGruppe,
  });
  if (!selection.ok) return undefined;
  const reguleringsdato = resolveAnvendtReguleringsdato({
    beregnesUdFra: values.beregnesUdFra,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    saerligFraDatoRegulering: isISODateString(source.saerligFraDatoRegulering) ? source.saerligFraDatoRegulering : undefined,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    skadedato,
  });
  const reguleringsdatoDa = reguleringsdato === undefined ? undefined : isoToDanish(reguleringsdato);
  if (reguleringsdatoDa === undefined) return undefined;

  let trinloen: ReturnType<typeof getOffentligLoenForDato>;
  try {
    trinloen = getOffentligLoenForDato(offentligType, reguleringsdatoDa, selection.selection.loentrin, selection.selection.loengruppe);
  } catch {
    // Et løntrin, tabellen ikke har, meldes af reguleringen selv; advarslerne har intet at sammenligne med.
    return undefined;
  }
  if (trinloen === undefined) return undefined;
  const enhed = resolveOffentligLoenEnhed(selection.selection.loenType);
  return { beloeb: enhed === 'Time' ? trinloen.timeLoen : trinloen.maanedsLoen, enhed };
};

/** Er den forhøjede grundløn – omregnet til løntrinnets enhed – større end trinlønnen på reguleringsdatoen? */
const erForhoejetGrundloenStoerreEndTrinloen = (
  values: ErstatningsopgoerelseValues,
  source: LoenudviklingSource,
  skadedato: ISODateString | undefined,
): boolean => {
  const beloeb = amountValueToNumber(source.offentligLoenEkstraGrundloen);
  if (beloeb === undefined || !Number.isFinite(beloeb) || beloeb <= 0) return false;
  const trinloen = resolveLoentrinetsLoen(values, source, skadedato);
  if (trinloen === undefined) return false;
  return resolveOffentligLoenEkstraGrundloen(beloeb, source.offentligLoenEkstraGrundloenAngivesPer, trinloen.enhed)
    > trinloen.beloeb;
};

export type ForhoejetGrundloenAdvarsel = Readonly<{
  ownerKey: string;
  cells: readonly AnyFieldRef[];
  cellMessage: string;
  summaryMessage: string;
}>;

/** De gule forhøjede grundlønninger – for fladens ring og for linjen i «Fejl og advarsler», på begge flader. */
export const resolveForhoejetGrundloenAdvarsler = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>,
): readonly ForhoejetGrundloenAdvarsel[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  return resolveLoenudviklingKilde(values).flatMap((source) =>
    erForhoejetGrundloenStoerreEndTrinloen(values, source, stamdata.skadedato)
      ? [{
        ownerKey: source.id,
        cells: [toAnyFieldRef(values.beregnesUdFra === 'Beregningsperiode'
          ? eoEmploymentFields.offentligLoenEkstraGrundloen.bind(source.id)
          : eoAngivetLoenFields.offentligLoenEkstraGrundloen.bind())],
        cellMessage: FORHOEJET_GRUNDLOEN_STOERRE_END_TRINLOEN_ADVARSEL,
        summaryMessage: FORHOEJET_GRUNDLOEN_STOERRE_END_TRINLOEN_ADVARSEL,
      }]
      : []);
};
