import { z } from 'zod';
import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import type { ISODateString } from '../../types/branded';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import { createTrackedInputReader, type InputEvaluation } from '../../inputCore/inputReader';
import { aslAfgoerelseAfgoerelseTypeField } from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import { faellesAarsloenAslAarsloenField } from '../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadestypeField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { isISODateString, isoToDanish } from '../../types/branded';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from './erhvervsevnetabInitialValues';
import { buildAslAfgoerelseRuleFieldIssues, readAslAfgoerelserCommittedRows } from './erhvervsevnetabReaderProjection';
import { eetIssueSchema, type EetIssue } from './eetTypes';
import { collectEetAslAfgoerelseValidationIssues, isAslAfgoerelseRowEmpty, isKnownAfgoerelseType, resolveAslVirkningsdato } from './eetAslAfgoerelser';
import { resolveEetIssueFocusTarget } from './eetIssueFocusTargets';
import { SKADELIDTES_AARSLOEN_ASL_LABEL } from '../aslEalAarsloen/aarsloenLabels';
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
 * blokerede importen. Det var en overblokering – og overblokering er lige så forkert som falske tal (§1.10):
 * en bounds-fejl på fx `erhvervsevnetab.ealEetPct`, som `computeEetLoebendeYdelserForEoImport` aldrig læser,
 * fjernede hele den midlertidige EET-import og dens grupper fra Erstatningsopgørelsen.
 *
 * Listen er udledt af importens transitive call-graph (`eetLoebendeYdelserCalculation.ts`
 * → `computeEetLoebendeYdelserForContext` + `eetAslAfgoerelser.ts`):
 *
 * - `erhvervsevnetab.aslAfgoerelser.*`: hele afgørelsesrækken – datoer, procenter, type og
 *   `fsTilbageholdtEet` – er periodiseringens og beløbenes grundlag.
 * - `faellesAarsloen.aslAarsloen`: `grundloen` ganges ind i HVERT periodebeløb, og feltet giver selv
 *   `aarsloen-missing`/`aarsloen-zero`. En maskeret værdi ville give et falsk beløb.
 * - `stamdata.skadedato` + `stamdata.skadelidteFodselsdato`: skadesår, 2011-/2024-grænserne og
 *   folkepensionsafgrænsningen af den løbende ydelse.
 *
 * BEVIDST UDE – læst, men uden talvirkning eller slet ikke læst:
 * - `erhvervsevnetab.beregningsdato`: importen afgrænses alene af TAF-slutdatoen, fordi løbende EET forudsættes
 *   at fortsætte til folkepensionsalderen, medmindre en afgørelse kapitaliseres (`eo-snapshot-contract.md` §13).
 *   Datoen blev tidligere læst som fallback-kilde, og en tom eller rød EET-beregningsdato – fx et år uden
 *   reguleringssats, som kun EAL-beregningen har brug for – spærrede derfor hele importen uden talvirkning.
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
  const aslAarsloenRead = aarsloenProjection.reader.read(faellesAarsloenAslAarsloenField.bind());
  const skadedatoRead = stamdataProjection.reader.read(stamdataSkadedatoField.bind());
  const skadestypeRead = stamdataProjection.reader.read(stamdataSkadestypeField.bind());
  const fodselsdatoRead = stamdataProjection.reader.read(stamdataSkadelidteFodselsdatoField.bind());
  const eetValues: ErhvervsevnetabComposedValues = {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    aslAfgoerelser: readAslAfgoerelserCommittedRows(eetProjection.reader),
    aslAarsloen: aslAarsloenRead.status === 'usable' ? aslAarsloenRead.value : undefined,
    skadelidteFodselsdato: fodselsdatoRead.status === 'usable' ? fodselsdatoRead.value : undefined,
  };
  const sourceIssues: EetIssue[] = [];

  if (eetProjection.readIssues().length > 0) {
    const issue = eetProjection.readIssues()[0];
    sourceIssues.push({
      id: 'midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: 'Afgørelsen er ikke gyldigt udfyldt.',
      ...(issue === undefined ? {} : { focusTarget: { kind: 'fieldAddress', address: issue.field.address } }),
    });
  } else {
    // Readerens felter kan hver for sig være gyldige, mens hele afgørelsesforløbet er rødt.
    // Brug præcis tabellens samlede regler og feltmapping, så EO ikke beregner på et afvist forløb.
    const issue = buildAslAfgoerelseRuleFieldIssues(collectEetAslAfgoerelseValidationIssues(
      eetValues.aslAfgoerelser,
      skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined,
      eetValues.skadelidteFodselsdato,
      skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined,
    ))[0];
    if (issue !== undefined) {
      sourceIssues.push({
        id: 'field-asl-afgoerelser',
        severity: 'error',
        message: issue.message,
        focusTarget: { kind: 'fieldAddress', address: issue.field.address },
      });
    }
  }
  if (aarsloenProjection.readIssues().length > 0) {
    const issue = aarsloenProjection.readIssues()[0];
    sourceIssues.push({
      id: 'midlertidigt-eet-faelles-aarsloen-schema-invalid',
      severity: 'error',
      message: `${SKADELIDTES_AARSLOEN_ASL_LABEL} er ikke gyldigt udfyldt.`,
      ...(issue === undefined ? {} : { focusTarget: { kind: 'fieldAddress', address: issue.field.address } }),
    });
  }
  const skadedatoIssue = skadedatoRead.status === 'error' ? skadedatoRead.issue : undefined;
  const hasStamdataDateOrderIssue = skadedatoIssue?.code === 'stamdata.skadedato.bounds'
    && skadedatoIssue.detail?.minBoundKind === 'fodselsdato';
  if (hasStamdataDateOrderIssue) {
    const datoReference = resolveStamdataDatoReference(
      skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined
    );
    const fodselsdatoDisplay = fodselsdatoRead.status === 'usable'
      ? isoToDanish(fodselsdatoRead.value)
      : skadedatoIssue?.detail?.minBoundReferenceISO;
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-date-order',
      severity: 'error',
      message: `Der er angivet en ${datoReference.label.toLowerCase()} før skadelidtes fødselsdato (${fodselsdatoDisplay ?? 'ukendt dato'})`,
      focusTarget: { kind: 'fieldAddress', address: stamdataSkadedatoField.bind().address },
    });
  } else if (stamdataProjection.readIssues().length > 0) {
    const issue = stamdataProjection.readIssues()[0];
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-schema-invalid',
      severity: 'error',
      message: 'Stamdata kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
      ...(issue === undefined ? {} : { focusTarget: { kind: 'fieldAddress', address: issue.field.address } }),
    });
  }

  return Object.freeze({
    revision: `input-${String(evaluation.reader.sourceToken.inputRevision)}-settings-${String(evaluation.reader.sourceToken.settingsRevision)}`,
    eetValues,
    skadedato: skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined,
    ...(sourceIssues.length === 0 ? {} : { issues: Object.freeze(sourceIssues) }),
  });
};

/**
 * Kapitaliseringsdatoerne for de delvist endelige afgørelser på Erhvervsevnetab-siden, sorteret og uden dubletter.
 *
 * Den ENESTE EO-læsning af EET-siden uden for midlertidigt EET-togglen (`domain-boundary-contract.md` §9 pkt. 11):
 * EO bruger datoerne alene til en gul, ikke-blokerende advarsel, når TAF fortsætter forbi en kapitalisering
 * (BB-187, udviklerafgørelse 2026-10-30). Ingen beregning på EO læser dem. Datoen læses af samme committed
 * rækkeprojektion som importen, så en rød kapitaliseringsdato er tom her og meldes på Erhvervsevnetab-siden.
 */
export const resolveDelvistEndeligeKapitaliseringsdatoer = (
  source: EetImportSource | null | undefined
): readonly ISODateString[] => {
  if (!source) return [];
  const datoer = new Set<ISODateString>();
  for (const row of source.eetValues.aslAfgoerelser) {
    if (isAslAfgoerelseRowEmpty(row) || row.afgoerelseType !== 'Delvist endelig') continue;
    if (isISODateString(row.kapDato)) datoer.add(row.kapDato);
  }
  return Object.freeze([...datoer].sort((left, right) => left.localeCompare(right)));
};

export type EetAfgoerelseDatoer = Readonly<{
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  afgoerelsesdato: ISODateString;
  /** Udledt som i beregningen: den særskilte virkningsdato, ellers afgørelsesdatoen (BB-368). */
  virkningsdato: ISODateString;
}>;

/**
 * Datoerne for Erhvervsevnetab-sidens afgørelser, læst af samme committed rækkeprojektion som importen.
 *
 * EO bruger dem alene, mens midlertidigt EET hentes fra siden, til en gul advarsel, når datoerne for den
 * midlertidige eller endelige afgørelse på EO oplysninger ikke svarer til en afgørelse her
 * (`domain-boundary-contract.md` §9 pkt. 12, udviklerafgørelse 2026-11-04). Ingen beregning læser dem.
 */
export const resolveEetAfgoerelseDatoer = (
  source: EetImportSource | null | undefined
): readonly EetAfgoerelseDatoer[] => {
  if (!source) return [];
  return Object.freeze(source.eetValues.aslAfgoerelser.flatMap((row) => {
    if (isAslAfgoerelseRowEmpty(row) || !isKnownAfgoerelseType(row.afgoerelseType)) return [];
    const afgoerelsesdato = isISODateString(row.afgoerelsesDato) ? row.afgoerelsesDato : undefined;
    const virkningsdato = resolveAslVirkningsdato(row);
    if (afgoerelsesdato === undefined || virkningsdato === undefined) return [];
    return [Object.freeze({ afgoerelseType: row.afgoerelseType, afgoerelsesdato, virkningsdato })];
  }));
};

const failedContext = (
  revision: string,
  issue: EetIssue
): EetImportContext => eetImportContextSchema.parse({
  revision,
  groups: [],
  issues: [issue],
});

/**
 * Importen uden noget at fradrage: ingen clampet TAF-periode (og dermed ingen slutdato) eller ingen midlertidig
 * eller delvist endelig afgørelse. Tom og uden issue – det er ikke en fejl, at der intet midlertidigt EET er at
 * trække fra (`eo-snapshot-contract.md` §13).
 */
export const buildEmptyEetImportContext = (source: EetImportSource): EetImportContext => eetImportContextSchema.parse({
  revision: source.revision,
  groups: [],
  issues: [],
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

  const unknownAfgoerelseTypeRow = source.eetValues.aslAfgoerelser.find((row) =>
    !isAslAfgoerelseRowEmpty(row)
    && !isKnownAfgoerelseType(row.afgoerelseType)
  );
  if (unknownAfgoerelseTypeRow) {
    // Relevansfilteret må ikke gøre en malformed, delvist udfyldt afgørelse usynlig. En ukendt type
    // er et invariantbrud, også når rækken ellers ikke ville give en importérbar periode.
    return failedContext(source.revision, {
      id: 'midlertidigt-eet-import-invariant',
      severity: 'error',
      message: 'EET-oplysningerne kunne ikke klargøres sikkert til Erstatningsopgørelsen.',
      focusTarget: { kind: 'fieldAddress', address: aslAfgoerelseAfgoerelseTypeField.bind(unknownAfgoerelseTypeRow.id).address },
    });
  }

  const hasImportRelevantRow = source.eetValues.aslAfgoerelser.some((row) =>
    !isAslAfgoerelseRowEmpty(row)
    && (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig')
  );
  if (!hasImportRelevantRow) return buildEmptyEetImportContext(source);

  try {
    // Importen er en særskilt canonical context: TAF-slutdatoen afgrænser ydelsen i stedet for
    // EET-sidens beregningsdato. Selve beregningskernen er den samme som siden.
    const result = computeEetLoebendeYdelserForEoImport({
      erhvervsevnetab: source.eetValues,
      skadedato: source.skadedato,
      skadelidteFodselsdato: source.eetValues.skadelidteFodselsdato,
      slutdato,
    });
    const focusContext = {
      aslAfgoerelser: source.eetValues.aslAfgoerelser,
      skadedato: source.skadedato,
      skadelidteFodselsdato: source.eetValues.skadelidteFodselsdato,
    };
    const issues = result.issues
      .filter((issue) => !EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS.has(issue.id))
      .map((issue) => {
        const focusTarget = issue.focusTarget ?? resolveEetIssueFocusTarget(issue.id, focusContext);
        return focusTarget === undefined ? issue : { ...issue, focusTarget };
      });
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
