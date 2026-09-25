import { toAnyFieldRef, type FieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { isISODateString, isoToDanish, type ISODateString } from '../../types/branded';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, getToday } from '../../config/dateRanges';
import {
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeLoseFeriedageField,
  eoTafPeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { isFerieRowEmpty, isTafRowEmpty } from './helpers/rowEmpty';
import { collectPeriodOverlapIssues } from './periodOverlapIssues';
import { resolveSagensTafCutoffDates } from './tafCutoffDateIssues';
import { buildFerieCutoffErrorMessage } from './validation/tafPeriodConstraints';
import { buildTafLoseFeriedageMaxMessage, resolveTafLoseFeriedageMaksimum } from './validation/tafRowRules';

// TAF- og ferierækkernes regler, som ikke kan ligge på descriptoren, projekteret til de konkrete celler.
//
// Tre regler spærrede opgørelsen uden en eneste rød celle (M-20 i BB-218's form): overlap i begge tabeller
// (BB-251), for mange løse feriedage (BB-252) og en ferieperiode uden for sit vindue (BB-248). Descriptoren
// kan ikke bære dem: de afhænger af andre rækker, af beregningens clamping og af domæneudledte afskæringer.
// Samme vej som `tafCutoffDateIssues`: domænet binder selv feltadressen, UI'et leverer issuet til cellen via
// `collectionRuleIssue`, og issuet blokerer TAF-grenen som enhver rød cellefejl.

const ruleIssue = <T>(field: FieldRef<T>, code: string, message: string): FieldIssue =>
  Object.freeze({
    kind: 'field' as const,
    code: `${field.descriptor.id}.${code}`,
    severity: 'error' as const,
    field: toAnyFieldRef(field),
    reason: 'rule' as const,
    message,
  });

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

/**
 * En ferieperiodes grænser – de samme som TAF-periodens, fordi ferien kun fradrages inden for TAF: tidligst
 * skadedatoen, senest dags dato og dagen før en afskæring. Udviklerafgørelse 2026-09-25 (BB-248): alle tre
 * SPÆRRER fortsat – også når ferien ikke påvirker den aktuelle beregning – så brugeren retter den, før en
 * senere ændret periode gør den virksom. Hver dato prøves for sig og bærer sin egen besked i fladens sprog.
 */
const collectFerieperiodeBoundIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadestype'>,
): readonly FieldIssue[] => {
  const minRule = computeSkadedatoMinRule({
    skadedatoISO: stamdata.skadedato,
    erErhvervssygdom: stamdata.skadestype === 'Erhvervssygdom',
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
  });
  const today = getToday();
  const cutoffs = resolveSagensTafCutoffDates(values, stamdata);

  const messageFor = (value: ISODateString): string | undefined => {
    if (value < minRule.minDate) {
      const reference = danish(minRule.minBoundReferenceISO ?? minRule.minDate);
      if (minRule.minBoundKind === 'skadedato') return `Ferien ligger før skadedatoen (${reference})`;
      if (minRule.minBoundKind === 'anmeldelsesdatoMinus5Aar') {
        return `Ferien ligger mere end 5 år før anmeldelsesdatoen (${reference})`;
      }
      return `Ferien ligger før ${danish(minRule.minDate)}`;
    }
    if (value > today) return `Ferien ligger efter dags dato (${danish(today)})`;
    return buildFerieCutoffErrorMessage({ value, ...cutoffs });
  };

  return values.ferieperioder.flatMap((row) =>
    ([['fra', eoFerieperiodeFraField], ['til', eoFerieperiodeTilField]] as const).flatMap(([key, descriptor]) => {
      const value = row[key];
      if (!isISODateString(value)) return [];
      const message = messageFor(value);
      return message === undefined ? [] : [ruleIssue(descriptor.bind(row.id), 'ferieVindue', message)];
    }));
};

const collectTafLoseFeriedageIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>,
): readonly FieldIssue[] =>
  values.tafPerioder.flatMap((row) => {
    const maksimum = resolveTafLoseFeriedageMaksimum(row, values, stamdata.skadedato);
    return maksimum === undefined
      ? []
      : [ruleIssue(eoTafPeriodeLoseFeriedageField.bind(row.id), 'maksimum', buildTafLoseFeriedageMaxMessage(maksimum))];
  });

/**
 * Alle projekterede regelfejl på TAF-afsnittets to tabeller. Tavst, når TAF-kravet ikke er «Ja»: rækkerne
 * indgår da ikke, og felterne er skjulte. Værdierne er readerens, så en skjult celle allerede er tom.
 */
export const collectTafRowCellIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadestype'>,
): readonly FieldIssue[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  return [
    ...collectPeriodOverlapIssues(
      values.tafPerioder.filter((row) => !isTafRowEmpty(row)),
      { fra: eoTafPeriodeFraField, til: eoTafPeriodeTilField },
    ),
    ...collectTafLoseFeriedageIssues(values, stamdata),
    ...collectPeriodOverlapIssues(
      values.ferieperioder.filter((row) => !isFerieRowEmpty(row)),
      { fra: eoFerieperiodeFraField, til: eoFerieperiodeTilField },
    ),
    ...collectFerieperiodeBoundIssues(values, stamdata),
  ];
};

/** Overlaps-issuets kode – rækkebyggeren skelner overlap (én linje pr. tabel) fra rækkens øvrige fejl. */
export const isPeriodOverlapIssue = (issue: FieldIssue): boolean => issue.code.endsWith('.overlap');
