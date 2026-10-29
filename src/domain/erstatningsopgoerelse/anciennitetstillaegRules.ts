import { toAnyFieldRef, type AnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import { eoAngivetLoenFields, eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { isISODateString, type ISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, type LoenudviklingSource } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdatoReferenceText } from './helpers/eoDateReferenceText';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';

// Anciennitetstillæggets regler – ét sted for begge ejere (ansættelsesforholdet og den angivne løn). Tillægget
// indgår kun ved reguleringsformen Overenskomst; relevansen på felterne sørger for, at et skjult tillæg læses som
// slået fra (BB-301).

const anvendtReguleringsdatoFor = (
  values: ErstatningsopgoerelseValues,
  source: LoenudviklingSource,
  skadedato: ISODateString | undefined,
): ISODateString | undefined => resolveAnvendtReguleringsdato({
  beregnesUdFra: values.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
  saerligFraDatoRegulering: isISODateString(source.saerligFraDatoRegulering) ? source.saerligFraDatoRegulering : undefined,
  beregningsperiodeTil: values.tafBeregningsperiodeTil,
  skadedato,
});

/** Beskeden ved en anciennitetsdato på eller før reguleringsdatoen. Validatoren bruger samme tekst (BB-305). */
export const resolveAnciennitetstillaegDatoForTidligBesked = (
  values: ErstatningsopgoerelseValues,
  source: LoenudviklingSource,
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadestype'>,
): string | undefined => {
  const anvendtReguleringsdato = anvendtReguleringsdatoFor(values, source, stamdata.skadedato);
  const dato = source.anciennitetstillaegDato;
  if (!source.harAnciennitetstillaegEfterSkadedatoen || !isISODateString(dato) || !anvendtReguleringsdato) return undefined;
  if (dato > anvendtReguleringsdato) return undefined;
  const reference = resolveAnvendtReguleringsdatoReferenceText({
    anvendtReguleringsdato,
    skadedato: stamdata.skadedato,
    skadestype: stamdata.skadestype,
    beregnesUdFra: values.beregnesUdFra,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    saerligFraDatoRegulering: isISODateString(source.saerligFraDatoRegulering) ? source.saerligFraDatoRegulering : undefined,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
  });
  return `Datoen skal være efter ${reference}`;
};

const datoField = (values: ErstatningsopgoerelseValues, source: LoenudviklingSource) =>
  values.beregnesUdFra === 'Beregningsperiode'
    ? eoEmploymentFields.anciennitetstillaegDato.bind(source.id)
    : eoAngivetLoenFields.anciennitetstillaegDato.bind();

const satsField = (values: ErstatningsopgoerelseValues, source: LoenudviklingSource) =>
  values.beregnesUdFra === 'Beregningsperiode'
    ? eoEmploymentFields.anciennitetstillaegSats.bind(source.id)
    : eoAngivetLoenFields.anciennitetstillaegSats.bind();

/**
 * En anciennitetsdato på eller før reguleringsdatoen som rød feltfejl. Spørgsmålet over feltet siger selv «efter
 * beregningsperiodens udløb (…)», men reglen stod kun i validatoren og spærrede uden rød ring og uden link
 * (BB-305).
 */
export const collectAnciennitetstillaegDatoIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadestype'>,
): readonly FieldIssue[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  return Object.freeze(resolveLoenudviklingKilde(values).flatMap((source) => {
    if (source.loenudviklingBeregningsgrundlag !== 'Overenskomst') return [];
    const message = resolveAnciennitetstillaegDatoForTidligBesked(values, source, stamdata);
    if (message === undefined) return [];
    const field = toAnyFieldRef(datoField(values, source));
    return [Object.freeze({
      kind: 'field' as const,
      code: `${field.descriptor.id}.efterReguleringsdato`,
      severity: 'error' as const,
      field,
      reason: 'rule' as const,
      message,
    })];
  }));
};

export type AnciennitetstillaegMangel = Readonly<{
  message: string;
  focusAddress: ReturnType<typeof datoField>['address'];
}>;

/**
 * Et anciennitetstillæg, der er slået til uden dato eller sats. Det blev før droppet tavst, mens papiret trykte
 * «Indtastning mangler» (BB-304). Linjen spærrer og peger på det første tomme felt; felterne får ingen rød ring,
 * fordi brugeren ikke har skrevet i dem (samme afgørelse som den tomme feriesats, BB-274).
 */
export const resolveAnciennitetstillaegMangel = (
  values: ErstatningsopgoerelseValues,
  source: LoenudviklingSource,
): AnciennitetstillaegMangel | undefined => {
  if (source.loenudviklingBeregningsgrundlag !== 'Overenskomst' || !source.harAnciennitetstillaegEfterSkadedatoen) {
    return undefined;
  }
  const manglerDato = !isISODateString(source.anciennitetstillaegDato);
  const manglerSats = amountValueToNumber(source.anciennitetstillaegSats) === undefined;
  if (!manglerDato && !manglerSats) return undefined;
  const mangler = manglerDato && manglerSats ? 'dato og sats mangler' : manglerDato ? 'datoen mangler' : 'satsen mangler';
  return {
    message: `Anciennitetstillæg er slået til, men ${mangler}`,
    focusAddress: (manglerDato ? datoField(values, source) : satsField(values, source)).address,
  };
};

/** Gul advarsel: tillægget opnås først efter erstatningsperioden og ændrer derfor intet (BB-305). */
export const ANCIENNITETSTILLAEG_EFTER_TAF_ADVARSEL = 'Tillægget opnås først efter EO-perioden og indgår ikke';

export const erAnciennitetstillaegEfterTafPerioden = (
  source: Pick<LoenudviklingSource, 'loenudviklingBeregningsgrundlag' | 'harAnciennitetstillaegEfterSkadedatoen' | 'anciennitetstillaegDato'>,
  tafSlut: ISODateString | undefined,
): boolean =>
  source.loenudviklingBeregningsgrundlag === 'Overenskomst'
  && source.harAnciennitetstillaegEfterSkadedatoen === true
  && isISODateString(source.anciennitetstillaegDato)
  && tafSlut !== undefined
  && source.anciennitetstillaegDato > tafSlut;

export type AnciennitetstillaegEfterTafAdvarsel = Readonly<{
  ownerKey: string;
  cells: readonly AnyFieldRef[];
  cellMessage: string;
  summaryMessage: string;
}>;

/** De gule anciennitetsdatoer efter erstatningsperioden – for fladens ring og for linjen i «Fejl og advarsler». */
export const resolveAnciennitetstillaegEfterTafAdvarsler = (
  values: ErstatningsopgoerelseValues,
  tafSlut: ISODateString | undefined,
): readonly AnciennitetstillaegEfterTafAdvarsel[] =>
  resolveLoenudviklingKilde(values).flatMap((source) => erAnciennitetstillaegEfterTafPerioden(source, tafSlut)
    ? [{
      ownerKey: source.id,
      cells: [toAnyFieldRef(datoField(values, source))],
      cellMessage: ANCIENNITETSTILLAEG_EFTER_TAF_ADVARSEL,
      summaryMessage: `Anciennitetstillæg: ${ANCIENNITETSTILLAEG_EFTER_TAF_ADVARSEL}`,
    }]
    : []);
