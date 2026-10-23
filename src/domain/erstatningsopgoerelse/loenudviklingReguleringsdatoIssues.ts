import { eoEmploymentFields, eoAngivetLoenFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { isoToDanish, type ISODateString } from '../../types/branded';
import { buildTafRanges } from './helpers/indtaegtPerioder';
import { resolveKildeReguleringsIntervalIso } from './helpers/reguleringKildeCoverage';
import { shouldRequireSygeferiegodtgoerelseInput } from './helpers/sygeferiegodtgoerelseEligibility';
import { resolveSfggSource, sfggKildeUsesReferenceperiode } from './engines/sfggKilde';
import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import {
  eoAngivetDagsloenOpreguleresFraDatoField,
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoSfggReferenceperiodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';
import { resolveReguleringskildeNavn } from './helpers/loenudviklingDisplay';
import { erReguleringsdatoUdenOverenskomstSatserMeldt } from './helpers/loenindkomstSatser';
import { buildMissingLoenudviklingReguleringsdatoMessage } from './validation/loenudviklingReguleringsdato';

/**
 * Projekterer den fælles datokravsregel til det konkrete felt, så samme fejl både spærrer snapshot og giver
 * brugeren en rød indtastning. TAF-reglen køres kun, når TAF faktisk er aktiveret.
 */
export const collectMissingLoenudviklingReguleringsdatoIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadestype'>
): readonly FieldIssue[] => {
  if (
    values.kravPaaTabtArbejdsfortjeneste !== 'Ja' ||
    (values.beregnesUdFra !== 'Angivet månedsløn' && values.beregnesUdFra !== 'Angivet dagsløn')
  ) {
    return [];
  }

  const source = resolveLoenudviklingKilde(values)[0];
  if (!source || !source.loenudviklingBeregningsgrundlag || source.loenudviklingBeregningsgrundlag === 'Ingen') {
    return [];
  }

  const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
    beregnesUdFra: values.beregnesUdFra,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    saerligFraDatoRegulering: undefined,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    skadedato: stamdata.skadedato,
  });
  if (anvendtReguleringsdato !== undefined) return [];

  const field = values.beregnesUdFra === 'Angivet månedsløn'
    ? eoAngivetMaanedsloenOpreguleresFraDatoField
    : eoAngivetDagsloenOpreguleresFraDatoField;
  const fieldRef = field.bind();

  return [Object.freeze({
    kind: 'field' as const,
    code: `${fieldRef.descriptor.id}.manglerReguleringsdato`,
    severity: 'error' as const,
    field: toAnyFieldRef(fieldRef),
    reason: 'rule' as const,
    message: buildMissingLoenudviklingReguleringsdatoMessage(values.beregnesUdFra, stamdata.skadestype),
  })];
};

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

// Beskederne om reguleringsgrundlagets dækning. Validatoren bruger de samme, så sikkerhedsnettet i «Fejl og
// advarsler» genkender linjen som dækket og ikke gentager den (BB-306).

/** Reguleringsdatoen ligger før reguleringsgrundlagets første sats. */
export const formatReguleringsdatoFoerKildeBesked = (
  kildeNavn: string, reguleringsdato: ISODateString, foersteSats: ISODateString,
): string =>
  `Reguleringsdatoen (${danish(reguleringsdato)}) ligger før den første sats i ${kildeNavn}, som er fra `
  + `${danish(foersteSats)} – vælg en anden reguleringsform`;

/** TAF-perioden starter før reguleringsgrundlagets første sats. */
export const formatTafStartFoerKildeBesked = (kildeNavn: string, foersteSats: ISODateString): string =>
  `TAF-perioden starter før den første sats i ${kildeNavn}, som er fra ${danish(foersteSats)} – vælg en anden reguleringsform`;

/** En manuel form kan kun regulere frem fra reguleringsdatoen. */
export const formatTafStartFoerManuelReguleringsdatoBesked = (reguleringsdato: ISODateString): string =>
  `TAF-perioden starter før reguleringsdatoen (${danish(reguleringsdato)}) – vælg en anden reguleringsform for at regulere lønnen ned`;

/** Reguleringsdatoen ligger efter det, reguleringsgrundlaget dækker. */
export const formatReguleringsdatoEfterKildeBesked = (kildeNavn: string, daekketTil: ISODateString): string =>
  `${kildeNavn} har kun satser, der dækker til og med ${danish(daekketTil)} – reguleringsdatoen ligger senere. `
  + 'Vælg en anden reguleringsform';

/**
 * Reguleringsgrundlagets dækning holdt op mod reguleringsdatoen og TAF-perioden – én linje pr. problem, med ringen
 * på det felt, brugeren skal ændre (BB-306). Det er næsten altid «Lønudvikling beregnes ud fra»: datoen er rigtig,
 * men formen dækker den ikke. Undtagelsen er en «Evt. særlig fra-dato for regulering», som brugeren selv har sat
 * – den er en reel udvej og bærer ringen. Før stod ringen på beregningsperiodens «Til og med», og samme problem
 * gav en linje mere fra kontroltabellen med et internt rækkenavn.
 */
export const collectLoenudviklingCoverageIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>
): readonly FieldIssue[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  const issues: FieldIssue[] = [];
  const tafRanges = buildTafRanges(values, { skadedatoISO: stamdata.skadedato });
  const add = (field: ReturnType<typeof toAnyFieldRef>, message: string) => {
    issues.push({ kind: 'field', code: `${field.descriptor.id}.reguleringCoverage`,
      severity: 'error', field, reason: 'rule', message });
  };
  const sources = resolveLoenudviklingKilde(values);
  for (const source of sources) {
    const basis = source.loenudviklingBeregningsgrundlag;
    if (!basis || basis === 'Ingen') continue;
    const date = resolveAnvendtReguleringsdato({ beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: source.saerligFraDatoRegulering,
      beregningsperiodeTil: values.tafBeregningsperiodeTil, skadedato: stamdata.skadedato });
    if (!date) continue;
    const isEmployment = values.beregnesUdFra === 'Beregningsperiode';
    const formField = toAnyFieldRef(isEmployment
      ? eoEmploymentFields.loenudviklingBeregningsgrundlag.bind(source.id)
      : eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind());
    const dateField = isEmployment && source.saerligFraDatoRegulering
      ? toAnyFieldRef(eoEmploymentFields.saerligFraDatoRegulering.bind(source.id))
      : formField;
    const tafStart = tafRanges.reduce<ISODateString | undefined>(
      (first, range) => (first === undefined || range.fra < first ? range.fra : first), undefined);

    if (basis === 'Manuelt angivet' || basis === 'Manuel procentsats') {
      if (tafStart !== undefined && tafStart < date) add(formField, formatTafStartFoerManuelReguleringsdatoBesked(date));
      continue;
    }
    const interval = resolveKildeReguleringsIntervalIso(source);
    if (!interval?.fraIso) continue;
    const foersteSats = interval.fraIso;
    const kildeNavn = resolveReguleringskildeNavn(source);
    if (date < foersteSats) {
      // En privat overenskomst, der både giver kortets satser og lønudviklingen, melder allerede datoen med
      // «… har ingen satser før X – vælg en senere reguleringsdato» ved «Vælg overenskomst». To linjer med hver
      // sit råd om ét problem forvirrede; satsernes linje står alene (udviklerafgørelse 2026-10-23, BB-306).
      if (isEmployment && basis === 'Overenskomst' && erReguleringsdatoUdenOverenskomstSatserMeldt(source, date)) continue;
      add(dateField, formatReguleringsdatoFoerKildeBesked(kildeNavn, date, foersteSats));
    } else if (tafStart !== undefined && tafStart < foersteSats) {
      add(formField, formatTafStartFoerKildeBesked(kildeNavn, foersteSats));
    } else if (interval.tilIso && date > interval.tilIso) {
      add(dateField, formatReguleringsdatoEfterKildeBesked(kildeNavn, interval.tilIso));
    }
  }
  for (const row of values.sfggAnsaettelsesforhold) {
    const employment = values.loenindkomstAnsaettelsesforhold.find((entry) => entry.id === row.ansaettelsesforholdId);
    if (!employment || !shouldRequireSygeferiegodtgoerelseInput(values, employment) ||
      !sfggKildeUsesReferenceperiode(resolveSfggSource(row, employment).kind)) continue;
    const source = values.beregnesUdFra === 'Beregningsperiode' ? employment : sources[0];
    const first = source ? resolveKildeReguleringsIntervalIso(source)?.fraIso : undefined;
    if (first && row.sfggReferenceperiodeTil && row.sfggReferenceperiodeTil < first) {
      add(toAnyFieldRef(eoSfggReferenceperiodeTilField.bind(row.ansaettelsesforholdId)),
        `Referenceperioden slutter før reguleringsgrundlagets første sats (${isoToDanish(first)}). Vælg en anden reguleringsform.`);
    }
  }
  return Object.freeze(issues);
};
