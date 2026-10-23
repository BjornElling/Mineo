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

/** Er den forhøjede grundløn – omregnet til løntrinnets enhed – større end trinlønnen på reguleringsdatoen? */
const erForhoejetGrundloenStoerreEndTrinloen = (
  values: ErstatningsopgoerelseValues,
  source: LoenudviklingSource,
  skadedato: ISODateString | undefined,
): boolean => {
  if (source.loenudviklingBeregningsgrundlag !== 'Overenskomst') return false;
  const offentligType = getOffentligOverenskomstTypeById(source.overenskomstId ?? '');
  if (offentligType === undefined) return false;
  const beloeb = amountValueToNumber(source.offentligLoenEkstraGrundloen);
  if (beloeb === undefined || !Number.isFinite(beloeb) || beloeb <= 0) return false;

  const selection = parseOffentligLoenSelection({
    offentligType,
    offentligLoenType: source.offentligLoenType,
    offentligLoenTrin: source.offentligLoenTrin,
    offentligLoenGruppe: source.offentligLoenGruppe,
  });
  if (!selection.ok) return false;
  const reguleringsdato = resolveAnvendtReguleringsdato({
    beregnesUdFra: values.beregnesUdFra,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    saerligFraDatoRegulering: isISODateString(source.saerligFraDatoRegulering) ? source.saerligFraDatoRegulering : undefined,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    skadedato,
  });
  const reguleringsdatoDa = reguleringsdato === undefined ? undefined : isoToDanish(reguleringsdato);
  if (reguleringsdatoDa === undefined) return false;

  let trinloen: ReturnType<typeof getOffentligLoenForDato>;
  try {
    trinloen = getOffentligLoenForDato(offentligType, reguleringsdatoDa, selection.selection.loentrin, selection.selection.loengruppe);
  } catch {
    // Et løntrin, tabellen ikke har, meldes af reguleringen selv; advarslen har intet at sammenligne med.
    return false;
  }
  if (trinloen === undefined) return false;
  const enhed = resolveOffentligLoenEnhed(selection.selection.loenType);
  const trinbeloeb = enhed === 'Time' ? trinloen.timeLoen : trinloen.maanedsLoen;
  return resolveOffentligLoenEkstraGrundloen(beloeb, source.offentligLoenEkstraGrundloenAngivesPer, enhed) > trinbeloeb;
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
