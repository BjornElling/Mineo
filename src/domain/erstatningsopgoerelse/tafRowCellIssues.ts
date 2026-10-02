import { toAnyFieldRef, type FieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { isISODateString, isoToDanish, type ISODateString } from '../../types/branded';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, getToday } from '../../config/dateRanges';
import {
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeLoseFeriedageField,
  eoTafPeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { isFerieRowEmpty, isTafRowEmpty } from './helpers/rowEmpty';
import {
  collectPeriodOverlapIssues,
  collectSourcesOverlapIssues,
  tableOverlapSource,
  type PeriodOverlapSource,
} from './periodOverlapIssues';
import { resolveSagensTafCutoffDates } from './tafCutoffDateIssues';
import { buildFerieCutoffErrorMessage } from './validation/tafPeriodConstraints';
import { buildTafLoseFeriedageMaxMessage, resolveTafLoseFeriedageMaksimum } from './validation/tafRowRules';

// TAF- og ferierækkernes regler, som ikke kan ligge på descriptoren, projekteret til de konkrete celler –
// inklusive beregningsperiodens to datoer, når de overlapper en TAF-periode (BB-262).
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
 * TAF-periodernes overlap – indbyrdes OG mod beregningsperioden – i ét kald, så en TAF-celle, der overlapper
 * begge, får ét issue med begge modparter (§1.8). Beregningsperioden spærrede før uden en rød celle og med et
 * link kun til sektionen (BB-262); nu farves dens to datoer og den overlappende TAF-rækkes to datoer, og hver
 * tooltip navngiver modparten. Beregningsperiodens datoer er readerens: uden «Beregningsperiode» er de tomme.
 */
const collectTafOverlapIssues = (values: ErstatningsopgoerelseValues): readonly FieldIssue[] => {
  const tafSource = tableOverlapSource(
    'tafPerioder',
    { ental: 'TAF-perioden', flertal: 'TAF-perioderne' },
    values.tafPerioder.filter((row) => !isTafRowEmpty(row)),
    { fra: eoTafPeriodeFraField, til: eoTafPeriodeTilField },
  );
  const beregningsperiodeSource: PeriodOverlapSource = {
    id: 'beregningsperiode',
    navn: { ental: 'beregningsperioden', flertal: 'beregningsperioderne' },
    indbyrdes: false,
    entries: values.beregnesUdFra === 'Beregningsperiode'
      ? [{
        id: 'beregningsperiode',
        fra: values.tafBeregningsperiodeFra,
        til: values.tafBeregningsperiodeTil,
        fields: { fra: eoTafBeregningsperiodeFraField.bind(), til: eoTafBeregningsperiodeTilField.bind() },
      }]
      : [],
  };
  return collectSourcesOverlapIssues([tafSource, beregningsperiodeSource], [['beregningsperiode', 'tafPerioder']]);
};

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
    ...collectTafOverlapIssues(values),
    ...collectTafLoseFeriedageIssues(values, stamdata),
    ...collectPeriodOverlapIssues(
      values.ferieperioder.filter((row) => !isFerieRowEmpty(row)),
      { fra: eoFerieperiodeFraField, til: eoFerieperiodeTilField },
    ),
    ...collectFerieperiodeBoundIssues(values, stamdata),
  ];
};

