import type {
  ErstatningsopgoerelseValues,
  PersistedErstatningsopgoerelseValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import { isISODateString } from '../../types/branded';
import { deepEqual } from '../../utils/deepEqual';
import { getAngivetLoenOpreguleresFraDato } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';
import {
  applyAutoSatsFields,
  isOverenskomstSatsFieldLocked,
  syncManualBaseRowSatser,
} from './helpers/loenindkomstSatser';

/**
 * Udleder de låste overenskomst-/lovsatser til den beregningsklare EO-model.
 *
 * Satserne er en funktion af brugerens styrende valg, referencesatser og reguleringsdato. De må derfor
 * ikke skrives tilbage til inputaggregatet eller `.eo`. Den manuelle tabels låste basisrække spejles i
 * samme projektion, så UI, beregning og dokumenter fortsat læser én identisk model.
 */
export const projectLoenindkomstSatser = (
  eo: PersistedErstatningsopgoerelseValues,
  stamdata: Readonly<{ skadedato?: StamdataValues['skadedato'] }>
): ErstatningsopgoerelseValues => {
  const employments = eo.loenindkomstAnsaettelsesforhold;
  if (employments.length === 0) return eo;

  const angivetLoenMetodeOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(eo);
  let changed = false;
  const nextEmployments = employments.map((af) => {
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: eo.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato,
      saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering)
        ? af.saerligFraDatoRegulering
        : undefined,
      beregningsperiodeTil: eo.tafBeregningsperiodeTil,
      skadedato: isISODateString(stamdata.skadedato) ? stamdata.skadedato : undefined,
    });
    const withAutoSatser = applyAutoSatsFields(
      { ...af, storeBededagPct: 0 },
      anvendtReguleringsdato
    );
    const next = syncManualBaseRowSatser(withAutoSatser);

    // Basisrækken må kun spejles, når den findes med samme id. Helperens fallback opretter ellers en
    // tilfældig række, selv om brugeren ikke har oprettet den.
    const currentBase = af.loenudviklingManuelTableData[0];
    const nextBase = next.loenudviklingManuelTableData[0];
    const resolved = currentBase !== undefined && nextBase !== undefined && currentBase.id === nextBase.id
      ? next
      : { ...withAutoSatser, loenudviklingManuelTableData: af.loenudviklingManuelTableData };

    if (!deepEqual(resolved, af)) {
      changed = true;
      return resolved;
    }
    return af;
  });

  return changed ? { ...eo, loenindkomstAnsaettelsesforhold: nextEmployments } : eo;
};

/**
 * Fjerner de slots, der i den aktuelle tilstand er låste af en referencesats, fra `.eo`-projektionen.
 * Historiske filer kan fortsat indeholde slotsene; reader-projektionen ovenfor ignorerer deres værdi,
 * og næste save konvergerer filen til kun at indeholde brugerinput.
 */
export const omitDerivedLoenindkomstSatser = (
  eo: PersistedErstatningsopgoerelseValues,
  stamdata: Readonly<{ skadedato?: StamdataValues['skadedato'] }>
): PersistedErstatningsopgoerelseValues => {
  const angivetLoenMetodeOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(eo);
  return {
    ...eo,
    loenindkomstAnsaettelsesforhold: eo.loenindkomstAnsaettelsesforhold.map((af) => {
      const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
        beregnesUdFra: eo.beregnesUdFra,
        angivetLoenMetodeOpreguleresFraDato,
        saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering)
          ? af.saerligFraDatoRegulering
          : undefined,
        beregningsperiodeTil: eo.tafBeregningsperiodeTil,
        skadedato: isISODateString(stamdata.skadedato) ? stamdata.skadedato : undefined,
      });
      const manualRows = af.loenudviklingBeregningsgrundlag === 'Manuelt angivet'
        && af.tillaegAngivesSom !== 'beloeb'
        ? af.loenudviklingManuelTableData.map((row, index) => index === 0 ? {
          ...row,
          feriepenge: undefined,
          shSoSats: undefined,
          fritvalg: undefined,
          agPension: undefined,
        } : row)
        : af.loenudviklingManuelTableData;
      return {
        ...af,
        ...(isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'fritvalgPct')
          ? { fritvalgPct: undefined } : {}),
        ...(isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'shSoPct')
          ? { shSoPct: undefined } : {}),
        ...(isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'pensionPct')
          ? { pensionPct: undefined } : {}),
        loenudviklingManuelTableData: manualRows,
      };
    }),
  };
};
