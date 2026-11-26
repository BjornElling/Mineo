import { toAnyFieldRef, type AnyFieldRef } from '../../inputCore/fieldDescriptor';
import { EMPTY_FIELD_ISSUE_SET, type FieldIssue, type FieldIssueSet } from '../../inputCore/inputIssue';
import {
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggReferenceperiodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../types/branded';
import { roundKroner } from '../money/money';
import { resolveSfggSource, sfggKildeUsesReferenceperiode } from './engines/sfggKilde';
import { getFirstIndtastedeTafFraDato, resolveSfggReferenceperiodeDayCount } from './engines/sfggReferencesats';
import { buildEmploymentSfggCalculator } from './engines/sfggSegmentering';
import { erSfggFeltRelevant } from './helpers/eoLoenindkomstRelevance';
import { shouldRequireSygeferiegodtgoerelseInput } from './helpers/sygeferiegodtgoerelseEligibility';
import { selectLoenindkomstTableFieldIssues } from './eoInputIssues';

// Sygeferiegodtgørelsens referenceperiode-regler – ét sted, projekteret til feltets egen adresse, så feltet får
// rød ring med reglen i tooltippen, og «Fejl og advarsler» får én linje med link til feltet. En regel, der kun
// står i validatoren, spærrer uden ring og link; uden reglen om løn i perioden giver en periode uden løn satsen
// 0,00 kr. uden et ord. Perioden er i øvrigt bevidst fri: hverken længde eller placering kontrolleres ud over
// grænsen før første TAF-periode.

const formatDato = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

const issue = (field: AnyFieldRef, rule: string, message: string): FieldIssue => Object.freeze({
  kind: 'field' as const,
  code: `${field.descriptor.id}.${rule}`,
  severity: 'error' as const,
  field,
  reason: 'rule' as const,
  message,
});

const dagEnhed = (antal: number, label: 'kalenderdage' | 'arbejdsdage'): string => {
  if (antal !== 1) return `${antal} ${label}`;
  return label === 'kalenderdage' ? '1 kalenderdag' : '1 arbejdsdag';
};

/** Beskeden ved en referenceperiode, hvor der ingen løn er. Linjen og feltets tooltip bruger den. */
export const buildSfggReferenceperiodeUdenLoenBesked = (fra: ISODateString, til: ISODateString): string =>
  `Der er ingen løn i referenceperioden (${formatDato(fra)} – ${formatDato(til)}) – angiv perioden før sygeforløbet`;

/**
 * Højst så mange fraværsdage, at mindst én dag i referenceperioden er tilbage at dele lønnen med. Beskedens
 * «maksimalt» er derfor referenceperiodens antal dage minus én – ellers ville netop det nævnte antal selv være en fejl.
 */
const buildFravaersdageBesked = (
  tilgaengelige: number,
  label: 'kalenderdage' | 'arbejdsdage',
  udenFerie: boolean,
): string => {
  const periode = `referenceperioden har ${dagEnhed(tilgaengelige, label)}${udenFerie ? ' uden ferie' : ''}`;
  if (tilgaengelige <= 1) return `Der kan ikke angives fraværsdage – ${periode}`;
  const hoejst = tilgaengelige - 1;
  return `Højst ${hoejst} ${hoejst === 1 ? 'fraværsdag' : 'fraværsdage'} – ${periode}`;
};

const buildIngenDageBesked = (label: 'kalenderdage' | 'arbejdsdage'): string => label === 'kalenderdage'
  ? 'Referenceperioden har ingen kalenderdage uden ferie'
  : 'Referenceperioden har ingen arbejdsdage uden ferie og SH-dage';

/**
 * De røde feltfejl i sygeferiegodtgørelsens referenceperiode, i den rækkefølge brugeren skal rette dem: en dato
 * på eller efter første TAF-dag; en periode uden dage at dele lønnen med; for mange fraværsdage; og en periode
 * uden løn. Den næste regel prøves først, når den forrige er opfyldt, så én fejl ikke giver en følgefejl.
 */
export const collectSfggReferenceperiodeIssues = (
  values: ErstatningsopgoerelseValues,
  /** De strukturelle feltfejl, så en rød lønrække ikke læses som en manglende løn. */
  structuralIssues: FieldIssueSet = EMPTY_FIELD_ISSUE_SET,
): readonly FieldIssue[] => {
  const roedeLoencellerPrAnsaettelse = selectLoenindkomstTableFieldIssues(structuralIssues);
  const firstTafFraDato = getFirstIndtastedeTafFraDato(values);
  return Object.freeze((values.loenindkomstAnsaettelsesforhold ?? []).flatMap((employment): FieldIssue[] => {
    if (!shouldRequireSygeferiegodtgoerelseInput(values, employment)) return [];
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (!row) return [];
    const source = resolveSfggSource(row, employment);
    if (!sfggKildeUsesReferenceperiode(source.kind)) return [];
    if (!erSfggFeltRelevant('referenceperiode', {
      kravPaaTabtArbejdsfortjeneste: values.kravPaaTabtArbejdsfortjeneste,
      employment,
      sfggBeregningskilde: row.sfggBeregningskilde,
    })) return [];

    const fraField = toAnyFieldRef(eoSfggReferenceperiodeFraField.bind(employment.id));
    const tilField = toAnyFieldRef(eoSfggReferenceperiodeTilField.bind(employment.id));
    const { sfggReferenceperiodeFra: fra, sfggReferenceperiodeTil: til } = row;

    if (firstTafFraDato !== undefined) {
      const besked = `Datoen skal ligge før første TAF-periode (${formatDato(firstTafFraDato)})`;
      const datoIssues = [
        ...(fra !== undefined && fra >= firstTafFraDato ? [issue(fraField, 'foerTaf', besked)] : []),
        ...(til !== undefined && til >= firstTafFraDato ? [issue(tilField, 'foerTaf', besked)] : []),
      ];
      if (datoIssues.length > 0) return datoIssues;
    }
    if (fra === undefined || til === undefined || fra > til) return [];

    // Dagene uden fravær: det antal, fraværsdagene trækkes fra (ferie og – i arbejdsdage – SH-dage er fratrukket).
    const udenFravaer = resolveSfggReferenceperiodeDayCount(
      values,
      { ...row, sfggReferenceperiodeFravaersdageUdenLoen: 0 },
      source,
    );
    if (!udenFravaer) return [];
    if (udenFravaer.divisorDage <= 0) return [issue(fraField, 'ingenDage', buildIngenDageBesked(udenFravaer.divisorLabel))];

    const fravaersdage = row.sfggReferenceperiodeFravaersdageUdenLoen ?? 0;
    if (fravaersdage >= udenFravaer.divisorDage) {
      return [issue(
        toAnyFieldRef(eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(employment.id)),
        'maxFravaersdage',
        buildFravaersdageBesked(udenFravaer.divisorDage, udenFravaer.divisorLabel, udenFravaer.feriedage > 0),
      )];
    }

    // En samlet NEGATIV løn spærrer i motoren med sin egen besked; her fanges kun den tomme periode.
    // En rød lønrække læses som tom, men er ikke en manglende løn: rækkens egen linje siger, hvad der skal rettes.
    // Uden værnet bliver en korrekt referenceperiode rød med en opfordring til at flytte den.
    if ((roedeLoencellerPrAnsaettelse[employment.id]?.length ?? 0) > 0) return [];
    const loen = roundKroner(
      buildEmploymentSfggCalculator(employment, values.ferieperioder ?? []).sumLoenInRangesKroner([{ fra, til }])
    );
    if (loen === 0) return [issue(fraField, 'udenLoen', buildSfggReferenceperiodeUdenLoenBesked(fra, til))];
    return [];
  }));
};
