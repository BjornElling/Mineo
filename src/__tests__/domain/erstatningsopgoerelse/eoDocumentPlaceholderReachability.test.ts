// @vitest-environment jsdom
/// <reference types="vitest/globals" />

/**
 * NÅBARHEDS-PRØVE for dokument-lagets pladsholdere (brugerregel 2026-08-07).
 *
 * Reglen: et dokument må ALDRIG kunne dannes med en fejl i indholdet. En manglende eller
 * ubrugelig værdi skal blokere download, ikke blive til «Fejl (…)», «—» eller et substitueret
 * nul inde i den færdige fil.
 *
 * Kortlægningen fandt 17 steder i `src/document/`, hvor en pladsholder KAN skrives. Men en
 * pladsholder, der ikke kan NÅS — fordi download-gaten allerede blokerer på samme tilstand — er
 * død kode, ikke en risiko. Forskellen kan kun afgøres empirisk, og denne fil afgør den: for hver
 * mistænkt tilstand bygges en sag, der forsøger at fremkalde den, og gaten spørges.
 *
 * En prøve, der viser BLOKERET, beviser at værnet virker; den bliver samtidig et varigt værn mod,
 * at nogen senere fjerner blokeringen. En prøve, der viser TILLADT, er et reelt hul, der skal
 * lukkes efter reglen.
 */

import { evaluateErstatningsopgoerelseDownloadGates } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseDownloadGate';
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { selectBlockingLoenindkomstEntityIds } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { resolveEoIssueSummaryText } from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_EO_ROW_POLICY } from '../../../settings/sourceSettings';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

const catalog = getProductionInputCatalog();
const asAmount = (value: number) => ({ kind: 'number' as const, value });

const validStamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2022-03-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (eo: ErstatningsopgoerelseValues | null, stamdata: StamdataValues | null) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

const gatesFor = (eo: ErstatningsopgoerelseValues) => {
  const reader = buildReader(eo, validStamdata);
  const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
  return evaluateErstatningsopgoerelseDownloadGates(projection, DEFAULT_EO_ROW_POLICY);
};

/**
 * Fejlrækkerne fra samme motor, som fodrer «Fejl og advarsler» på EO-siden. Gaten viser kun den
 * FØRSTE årsag, så en dækket mangel kan være maskeret af en anden; rækkerne viser dem alle.
 */
const errorRowsFor = (eo: ErstatningsopgoerelseValues): string[] => {
  const reader = buildReader(eo, validStamdata);
  const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
  const { snapshot, eoValues, stamdataValues, eoErrors, stamdataErrors } = projection;
  const rows = collectAllEoRows(
    stamdataValues,
    stamdataErrors,
    eoValues,
    eoErrors,
    selectBlockingLoenindkomstEntityIds(eoErrors),
    DEFAULT_EO_ROW_POLICY,
    snapshot.data?.canonicalOutput,
    snapshot.data?.pdfModel
  );
  return rows.errors.map(
    (row) => row.summaryText ?? resolveEoIssueSummaryText(row) ?? row.message?.trim() ?? row.label
  );
};

/** Sag med TAF beregnet ud fra en manuelt angivet månedsløn — grundlaget for de to første prøver. */
const buildAngivetMaanedsloenCase = (
  maanedsloen: ErstatningsopgoerelseValues['maanedsloenenUdgoer']
): ErstatningsopgoerelseValues => {
  const base = createErstatningsopgoerelseInitialValues();
  return {
    ...base,
    kravPaaSvieSmerteGodtgoerelse: 'Nej',
    kravPaaOevrigeErstatningskrav: 'Nej',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    vedroererPeriodeFra: toISODateString('2022-01-01'),
    vedroererPeriodeTil: toISODateString('2022-12-31'),
    beregnesUdFra: 'Angivet månedsløn',
    // Udfyldt, så den ENESTE variabel mellem de to sager er selve månedslønnen. Uden dette
    // blokerede fixturet på «Arbejdssituation er ikke angivet», og prøven målte intet.
    tafArbejdsstatus: 'Uarbejdsdygtig',
    maanedsloenenUdgoer: maanedsloen,
    tafPerioder: [
      { id: 'taf-1', fra: toISODateString('2022-04-01'), til: toISODateString('2022-06-30'), loseFeriedage: 0 },
    ],
    loenindkomstAnsaettelsesforhold: [],
  };
};

describe('nåbarhed: «Fejl (…)» i Beregningsgrundlag (kortlægningens A1)', () => {
  it('BLOKERET: et tomt «Månedslønnen udgør» blokerer download frem for at nå dokumentet', () => {
    const blocked = gatesFor(buildAngivetMaanedsloenCase(undefined));

    expect(blocked.erstatningsopgoerelse.canDownload).toBe(false);
    // Blokeringen skal bære en konkret, brugervendt årsag — aldrig en tavs blokering.
    expect(blocked.erstatningsopgoerelse.reasons[0]?.message ?? '').toBeTruthy();

    // Gaten rapporterer kun ÉN årsag, så den kan ikke i sig selv vise, om lønnen er dækket eller
    // blot maskeret af en anden blokering. Rækkemotoren — samme kilde som «Fejl og advarsler» —
    // spørges derfor direkte: findes der en fejlrække, som KUN opstår uden lønnen?
    const errorsWithout = errorRowsFor(buildAngivetMaanedsloenCase(undefined));
    const errorsWith = new Set(errorRowsFor(buildAngivetMaanedsloenCase(asAmount(42_500))));
    const causedByMissingSalary = errorsWithout.filter((message) => !errorsWith.has(message));

    // Uden denne assertion ville prøven være grøn af tomhed: enhver blokeret sag ville bestå.
    expect(causedByMissingSalary).not.toHaveLength(0);
    // Og rækken skal navngive DEN manglende løn, så brugeren kan handle på den.
    expect(causedByMissingSalary.join(' | ').toLowerCase()).toContain('månedsløn');
  });

  it('kontrast: samme sag MED en månedsløn er ikke blokeret af den grund', () => {
    const gates = gatesFor(buildAngivetMaanedsloenCase(asAmount(42_500)));
    const message = gates.erstatningsopgoerelse.reasons[0]?.message ?? '';

    expect(message.toLowerCase()).not.toContain('månedsløn er ikke angivet');
  });
});

describe('nåbarhed: substitueret nul i «Samlet»-kolonnen (kortlægningens A7)', () => {
  /**
   * `amountValueToNumber` returnerer `undefined` BÅDE for et tomt felt og for et beløbsudtryk,
   * hvis værdi ikke er finit. I offentligeYdelserSection bliver det til `?? 0` og lægges sammen i
   * «Samlet» — altså et forkert tal, der ser rigtigt ud. Spørgsmålet er, om en ikke-finit værdi
   * overhovedet kan nå frem gennem det persisterede schema, eller om den afvises før.
   */
  it('dokumenterer om en ikke-finit beløbsværdi kan passere schema-valideringen', () => {
    const base = createErstatningsopgoerelseInitialValues();
    const eo = {
      ...base,
      kravPaaSvieSmerteGodtgoerelse: 'Nej',
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      kravPaaOevrigeErstatningskrav: 'Nej',
      vedroererPeriodeFra: toISODateString('2022-01-01'),
      vedroererPeriodeTil: toISODateString('2022-12-31'),
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [
        {
          id: 'oy-1',
          fraDato: toISODateString('2022-04-01'),
          tilDato: toISODateString('2022-04-30'),
          // Bevidst ikke-finit: dette er den tilstand `?? 0` ville skjule.
          ydelse: { kind: 'number' as const, value: Number.POSITIVE_INFINITY },
          tillaeg: undefined,
          ydelsestype: 'Sygedagpenge',
        },
      ],
    } as unknown as ErstatningsopgoerelseValues;

    // Zod 4 afviser Infinity på `z.number()`. Overlever værdien ikke valideringen, kan
    // `?? 0`-grenen aldrig nås fra persisteret input, og pladsholderen er død kode.
    const validate = () => catalog.validateSettledInput({
      sections: {
        stamdata: validStamdata, satser: null, aarsloen: null, faellesAarsloen: null,
        renteberegning: null, varigemen: null, forsoergertab: null,
        erstatningsopgoerelse: eo, erhvervsevnetab: null,
      },
      rejectedInputs: {},
    });

    // Prøvens FORMÅL er at fastslå, om en ikke-finit værdi kan lagres. Kastes der, er svaret nej.
    expect(validate).toThrow();
  });
});
