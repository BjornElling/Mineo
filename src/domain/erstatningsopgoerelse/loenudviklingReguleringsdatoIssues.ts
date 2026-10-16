import { eoEmploymentFields, eoAngivetLoenFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { isoToDanish } from '../../types/branded';
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
  eoTafBeregningsperiodeTilField,
  eoSfggReferenceperiodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';
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

/** Kildens nedre grænse skal både blokere opgørelsen og markere det konkrete input. */
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
    const manual = basis === 'Manuelt angivet' || basis === 'Manuel procentsats';
    const first = manual ? date : resolveKildeReguleringsIntervalIso(source)?.fraIso;
    if (!first || !date) continue;
    const firstDisplay = isoToDanish(first) ?? first;
    const isEmployment = values.beregnesUdFra === 'Beregningsperiode';
    const formField = isEmployment
      ? eoEmploymentFields.loenudviklingBeregningsgrundlag.bind(source.id)
      : eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind();
    if (tafRanges.some((range) => range.fra < first)) {
      add(toAnyFieldRef(formField), manual
        ? 'TAF-perioden starter før reguleringsdatoen. Vælg en anden reguleringsform for at nedregulere.'
        : `TAF-perioden starter før reguleringsgrundlagets første sats (${firstDisplay}). Vælg en anden reguleringsform.`);
    }
    if (date < first) {
      const dateField = isEmployment
        ? (source.saerligFraDatoRegulering
          ? eoEmploymentFields.saerligFraDatoRegulering.bind(source.id) : eoTafBeregningsperiodeTilField.bind())
        : (values.beregnesUdFra === 'Angivet dagsløn'
          ? eoAngivetDagsloenOpreguleresFraDatoField.bind() : eoAngivetMaanedsloenOpreguleresFraDatoField.bind());
      add(toAnyFieldRef(dateField), `Reguleringsdatoen ligger før reguleringsgrundlagets første sats (${firstDisplay}). Vælg en anden reguleringsform.`);
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
