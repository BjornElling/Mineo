import { z } from 'zod';
import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import type { ISODateString } from '../../types/branded';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import { createTrackedInputReader, type InputEvaluation } from '../../inputCore/inputReader';
import { erhvervsevnetabBeregningsdatoField } from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import { faellesAarsloenAslAarsloenField } from '../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { STAMDATA_DATE_ORDER_ERROR_MESSAGE } from '../stamdata/stamdataDateOrder';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from './erhvervsevnetabInitialValues';
import { readAslAfgoerelserCommittedRows } from './erhvervsevnetabReaderProjection';
import { eetIssueSchema, type EetIssue } from './eetTypes';
import { isAslAfgoerelseRowEmpty } from './eetAslAfgoerelser';
import { MISSING_BEREGNINGSDATO_ISSUE } from './eetIssueCatalog';
import {
  computeEetLoebendeYdelserForEoImport,
  EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS,
  eetLoebendePeriodeRowSchema,
} from './eetLoebendeYdelserCalculation';

const eetImportGroupSchema = z.object({
  afgoerelsesdato: isoDateString,
  eetPct: z.number().finite(),
  perioder: z.array(eetLoebendePeriodeRowSchema).readonly(),
}).strict().readonly();

export const eetImportContextSchema = z.object({
  revision: z.string().min(1),
  groups: z.array(eetImportGroupSchema).readonly(),
  issues: z.array(eetIssueSchema).readonly(),
}).strict().readonly();

export type EetImportContext = z.infer<typeof eetImportContextSchema>;

export type EetImportSource = Readonly<{
  revision: string;
  eetValues: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
  issues?: readonly EetIssue[];
}>;

/**
 * Importmotorens typed inputprojektion.
 *
 * Gaten var tidligere sektionsvis: ethvert rødt issue i `erhvervsevnetab`, `faellesAarsloen` eller `stamdata`
 * blokerede importen. Det var en overblokering — og overblokering er lige så forkert som falske tal (§1.10):
 * en bounds-fejl på fx `erhvervsevnetab.ealEetPct`, som `computeEetLoebendeYdelserForEoImport` aldrig læser,
 * fjernede hele den midlertidige EET-import og dens grupper fra Erstatningsopgørelsen.
 *
 * Listen er udledt af importens transitive call-graph (`eetLoebendeYdelserCalculation.ts`
 * → `computeEetLoebendeYdelserForContext` + `eetAslAfgoerelser.ts`):
 *
 * - `erhvervsevnetab.beregningsdato`: EET-beregningsdatoen (falder tilbage til TAF-slutdatoen, men læses).
 * - `erhvervsevnetab.aslAfgoerelser.*`: hele afgørelsesrækken — datoer, procenter, type og
 *   `fsTilbageholdtEet` — er periodiseringens og beløbenes grundlag.
 * - `faellesAarsloen.aslAarsloen`: `grundloen` ganges ind i HVERT periodebeløb, og feltet giver selv
 *   `aarsloen-missing`/`aarsloen-zero`. En maskeret værdi ville give et falsk beløb.
 * - `stamdata.skadedato` + `stamdata.skadelidteFodselsdato`: skadesår, 2011-/2024-grænserne og
 *   folkepensionsafgrænsningen af den løbende ydelse.
 *
 * BEVIDST UDE — læst, men uden talvirkning eller slet ikke læst:
 * - `faellesAarsloen.ealAarsloen`: læses ikke af EO-importen. EAL-årslønnen hører til EET-sidens
 *   EAL-beregning og er ikke en del af importens typed read-set.
 * - `erhvervsevnetab.ealEetPct`, `koen`, `bilag*`-toggles og de to differencekrav-toggles: ikke læst på
 *   denne vej (de hører til EET-siden selv / EET-efter-EAL).
 * - Stamdatas brevhovedfelter: importen sender dem som `''` og læser dem ikke.
 *
 * Hvert issue-sæt kommer fra den reader, der samtidig bygger den tilhørende del af motorinputtet. Der findes
 * derfor intet separat ID-inventar, som kan drive fra motorens konkrete reads.
 */
/** Bygger den eneste EO-læsning af EET-input fra et tokenbundet reader-snapshot. */
export const buildMidlertidigtEetInsertSource = (evaluation: InputEvaluation): EetImportSource => {
  const eetProjection = createTrackedInputReader(evaluation.reader);
  const aarsloenProjection = createTrackedInputReader(evaluation.reader);
  const stamdataProjection = createTrackedInputReader(evaluation.reader);
  const beregningsdatoRead = eetProjection.reader.read(erhvervsevnetabBeregningsdatoField.bind());
  const aslAarsloenRead = aarsloenProjection.reader.read(faellesAarsloenAslAarsloenField.bind());
  const skadedatoRead = stamdataProjection.reader.read(stamdataSkadedatoField.bind());
  const fodselsdatoRead = stamdataProjection.reader.read(stamdataSkadelidteFodselsdatoField.bind());
  const eetValues: ErhvervsevnetabComposedValues = {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    beregningsdato: beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined,
    aslAfgoerelser: readAslAfgoerelserCommittedRows(eetProjection.reader),
    aslAarsloen: aslAarsloenRead.status === 'usable' ? aslAarsloenRead.value : undefined,
    skadelidteFodselsdato: fodselsdatoRead.status === 'usable' ? fodselsdatoRead.value : undefined,
  };
  const sourceIssues: EetIssue[] = [];

  if (eetProjection.readIssues().length > 0) {
    sourceIssues.push({
      id: 'midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: 'Afgørelsen er ikke gyldigt udfyldt.',
    });
  }
  if (aarsloenProjection.readIssues().length > 0) {
    sourceIssues.push({
      id: 'midlertidigt-eet-faelles-aarsloen-schema-invalid',
      severity: 'error',
      message: 'Årslønnen er ikke gyldigt udfyldt.',
    });
  }
  const skadedatoIssue = skadedatoRead.status === 'error' ? skadedatoRead.issue : undefined;
  const hasStamdataDateOrderIssue = skadedatoIssue?.code === 'stamdata.skadedato.bounds'
    && skadedatoIssue.message.toLocaleLowerCase('da').includes('fødselsdato');
  if (hasStamdataDateOrderIssue) {
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-date-order',
      severity: 'error',
      message: STAMDATA_DATE_ORDER_ERROR_MESSAGE,
    });
  } else if (stamdataProjection.readIssues().length > 0) {
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-schema-invalid',
      severity: 'error',
      message: 'Stamdata kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
    });
  }

  return Object.freeze({
    revision: `input-${String(evaluation.reader.sourceToken.inputRevision)}-settings-${String(evaluation.reader.sourceToken.settingsRevision)}`,
    eetValues,
    skadedato: skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined,
    ...(sourceIssues.length === 0 ? {} : { issues: Object.freeze(sourceIssues) }),
  });
};

const failedContext = (
  revision: string,
  issue: EetIssue
): EetImportContext => eetImportContextSchema.parse({
  revision,
  groups: [],
  issues: [issue],
});

export const buildEetImportContext = (
  source: EetImportSource,
  slutdato: ISODateString
): EetImportContext => {
  if (source.issues && source.issues.length > 0) {
    return eetImportContextSchema.parse({
      revision: source.revision,
      groups: [],
      issues: source.issues,
    });
  }

  const hasImportRelevantRow = source.eetValues.aslAfgoerelser.some((row) =>
    !isAslAfgoerelseRowEmpty(row)
    && (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig')
  );
  if (!hasImportRelevantRow) {
    return eetImportContextSchema.parse({
      revision: source.revision,
      groups: [],
      issues: [],
    });
  }

  try {
    // Importen er en særskilt canonical context: TAF-slutdatoen afgrænser ydelsen og kan
    // erstatte en manglende EET-beregningsdato. Selve beregningskernen er den samme som siden.
    const result = computeEetLoebendeYdelserForEoImport({
      erhvervsevnetab: source.eetValues,
      skadedato: source.skadedato,
      skadelidteFodselsdato: source.eetValues.skadelidteFodselsdato,
      slutdato,
    });
    const issues = result.issues.filter(
      (issue) => !EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS.has(issue.id)
    );
    const groups = (result.computation?.afgoerelser ?? []).flatMap((afgoerelse) => {
      if (afgoerelse.afgoerelseType === 'Endelig') return [];
      if (afgoerelse.afgoerelseType !== 'Midlertidig' && afgoerelse.afgoerelseType !== 'Delvist endelig') {
        throw new Error('Ukendt EET-afgørelsestype i midlertidigt EET-import');
      }
      return afgoerelse.perioder.length === 0 ? [] : [{
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        eetPct: afgoerelse.eetPct,
        perioder: afgoerelse.perioder,
      }];
    });

    const parsed = eetImportContextSchema.safeParse({
      revision: source.revision,
      groups,
      issues,
    });
    if (parsed.success) return parsed.data;
    throw new Error(parsed.error.message);
  } catch (error) {
    const normalizedError = asError(error);
    reportSystemIssue({
      code: 'eet_import_port:runtime',
      area: 'calculation',
      context: 'eetImportPort.buildEetImportContext',
      userMessage: 'Uventet fejl i EET-importen',
      developerMessage: normalizedError.message,
      error: normalizedError,
    });
    return failedContext(source.revision, {
      id: 'midlertidigt-eet-import-invariant',
      severity: 'error',
      message: 'EET-oplysningerne kunne ikke klargøres sikkert til Erstatningsopgørelsen.',
    });
  }
};

export const buildUnavailableEetImportContext = (
  source: EetImportSource | null | undefined,
  reason: 'source_missing' | 'taf_slutdato_missing'
): EetImportContext => {
  const manglerEetBeregningsdato = source !== null
    && source !== undefined
    && !source.eetValues.beregningsdato;
  const issue: EetIssue = reason === 'source_missing'
    ? {
      id: 'midlertidigt-eet-source-missing',
      severity: 'error',
      message: 'EET-oplysningerne kunne ikke indlæses sikkert til Erstatningsopgørelsen.',
    }
    : manglerEetBeregningsdato
      ? MISSING_BEREGNINGSDATO_ISSUE
      : {
        id: 'midlertidigt-eet-slutdato-missing',
        severity: 'error',
        message: 'Midlertidigt EET kan ikke importeres, fordi erstatningsperiodens slutdato mangler.',
      };
  return failedContext(source?.revision ?? 'missing-source', issue);
};
