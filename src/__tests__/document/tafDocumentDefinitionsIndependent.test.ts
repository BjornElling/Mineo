// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  projectMineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import {
  tafFordeltPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
  type TafFordeltPaaAarDocumentInput,
  type TafKravGrafDocumentInput,
  type TafOpreguleretPaaAarDocumentInput,
} from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createInputEvaluation } from '../../inputCore/inputReader';
import { erstatningsopgoerelseDocumentDefinition } from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import { resolveBlockedGateTooltip } from '../../document/layout/documentGateTypes';
import type { DocumentProjectionResult } from '../../document/definition/documentDefinition';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import { toISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  ErstatningsopgoerelseValues,
  StamdataValues,
} from '../../schemas/formSchemas';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

vi.mock('../../document/generators/tafFordelt/tafKravGrafChart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../document/generators/tafFordelt/tafKravGrafChart')>();
  return { ...actual, renderTafKravGrafChartPng: () => PNG_1X1 };
});

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const stamdata: StamdataValues = {
  journalnr: 'TAF-definition-orakel',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-01-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const erstatningsopgoerelse: ErstatningsopgoerelseValues = {
  ...createErstatningsopgoerelseInitialValues(),
  eoNummer: '1',
  indsaetUdkastStempel: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-12-31'),
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaOevrigeErstatningskrav: 'Nej',
  beregnesUdFra: 'Angivet månedsløn',
  maanedsloenenUdgoer: amount(30_000),
  tafArbejdsstatus: 'Fuldt arbejdsdygtig',
  tafPerioder: [{
    id: 'taf-definition-1',
    fra: iso('2024-07-01'),
    til: iso('2024-12-31'),
    loseFeriedage: 0,
  }],
  loenindkomstAnsaettelsesforhold: [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'taf-definition-af-1',
    harOverenskomst: false,
    feriePct: 12.5,
    loenudviklingBeregningsgrundlag: 'Ingen',
    indtaegtsoplysningerTableData: [{
      id: 'taf-definition-loen-1',
      col0_maaned: '6',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: amount(30_000),
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    }],
  }],
  sfggAnsaettelsesforhold: [{
    ansaettelsesforholdId: 'taf-definition-af-1',
    sfggBeregningskilde: 'Ingen',
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: 0,
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  }],
  eoAngivetLoenLoenudvikling: {
    ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'Ingen',
  },
};

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    erstatningsopgoerelse: false,
  },
}));

const buildInput = (values: ErstatningsopgoerelseValues = erstatningsopgoerelse) => getProductionInputCatalog().validateSettledInput({
  sections: {
    stamdata,
    satser: null,
    aarsloen: null,
    faellesAarsloen: null,
    renteberegning: null,
    varigemen: null,
    forsoergertab: null,
    erstatningsopgoerelse: values,
    erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const context = (values: ErstatningsopgoerelseValues = erstatningsopgoerelse) => {
  const catalog = getProductionInputCatalog();
  const evaluation = createInputEvaluation({
    input: buildInput(values),
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  return createDocumentSourceContext(evaluation, gateSettings);
};

const projectTafFordelt = (): TafFordeltPaaAarDocumentInput => {
  const result = tafFordeltPaaAarDocumentDefinition.project(context(), undefined);
  if (result.status !== 'ready') throw new Error(JSON.stringify(result.reasons));
  return result.input;
};

const projectTafOpreguleret = (): TafOpreguleretPaaAarDocumentInput => {
  const result = tafOpreguleretPaaAarDocumentDefinition.project(context(), undefined);
  if (result.status !== 'ready') throw new Error(JSON.stringify(result.reasons));
  return result.input;
};

const projectTafGraf = (): TafKravGrafDocumentInput => {
  const result = tafKravGrafDocumentDefinition.project(context(), undefined);
  if (result.status !== 'ready') throw new Error(JSON.stringify(result.reasons));
  return result.input;
};

const tooltipOf = (result: DocumentProjectionResult<unknown>): string | undefined =>
  result.status === 'blocked' ? resolveBlockedGateTooltip(result.reasons) : undefined;

describe('CALC-006/DOC-001 – TAF-dokumentdefinitioner og renderers', () => {
  it('blokerer alle tre TAF-definitioner, når sagen ikke beregner TAF', () => {
    const withoutTaf: ErstatningsopgoerelseValues = {
      ...erstatningsopgoerelse,
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      tafPerioder: createErstatningsopgoerelseInitialValues().tafPerioder,
      loenindkomstAnsaettelsesforhold: [],
      sfggAnsaettelsesforhold: [],
    };

    const blockedFordelt = tafFordeltPaaAarDocumentDefinition.project(context(withoutTaf), undefined);
    const blockedOpreguleret = tafOpreguleretPaaAarDocumentDefinition.project(context(withoutTaf), undefined);
    const blockedGraf = tafKravGrafDocumentDefinition.project(context(withoutTaf), undefined);

    expect(blockedFordelt.status).toBe('blocked');
    expect(blockedOpreguleret.status).toBe('blocked');
    expect(blockedGraf.status).toBe('blocked');
    // Knappen siger tilstanden, ikke «Indtastning mangler» – TAF «Nej» er et valg, ikke en mangel (BB-371).
    for (const result of [blockedFordelt, blockedOpreguleret, blockedGraf]) {
      expect(tooltipOf(result)).toBe('Der er ikke krav på tabt arbejdsfortjeneste i EO-perioden');
    }
  });

  it('siger «Der er ingen TAF-perioder i EO-perioden», når TAF er rejst uden periode i EO-perioden (BB-371)', () => {
    const tafFoerEoPerioden: ErstatningsopgoerelseValues = {
      ...erstatningsopgoerelse,
      tafPerioder: [{ id: 'taf-foer', fra: iso('2024-01-01'), til: iso('2024-03-31'), loseFeriedage: 0 }],
      vedroererPeriodeFra: iso('2024-06-01'),
    };
    for (const definition of [
      tafFordeltPaaAarDocumentDefinition,
      tafOpreguleretPaaAarDocumentDefinition,
      tafKravGrafDocumentDefinition,
    ]) {
      expect(tooltipOf(definition.project(context(tafFoerEoPerioden), undefined)))
        .toBe('Der er ingen TAF-perioder i EO-perioden');
    }
  });

  describe('fejl i krav, TAF-dokumenterne ikke viser (BB-370)', () => {
    const medFejlISvieSmerteOgOevrigeKrav: ErstatningsopgoerelseValues = {
      ...erstatningsopgoerelse,
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Nej',
      // Omvendt periode: rød fejl i svie/smerte.
      svieSmertePerioder: [{ id: 'ss-omvendt', fra: iso('2024-10-01'), til: iso('2024-09-20'), tilstand: 'sygemeldt' }],
      kravPaaOevrigeErstatningskrav: 'Ja',
      // En post uden beløb: fejl i øvrige krav.
      oevrigeKravPerioder: [{ id: 'oevrige-medicin', dato: iso('2024-08-01'), udgiftTil: 'Medicin' }],
    };

    it('spærrer opgørelsen, men ikke de tre TAF-dokumenter – og tallene er de samme som uden fejlene', () => {
      const ctx = context(medFejlISvieSmerteOgOevrigeKrav);
      expect(erstatningsopgoerelseDocumentDefinition.project(ctx, undefined).status).toBe('blocked');

      const fordelt = tafFordeltPaaAarDocumentDefinition.project(ctx, undefined);
      const opreguleret = tafOpreguleretPaaAarDocumentDefinition.project(ctx, undefined);
      const graf = tafKravGrafDocumentDefinition.project(ctx, undefined);
      if (fordelt.status !== 'ready') throw new Error(JSON.stringify(fordelt.reasons));
      expect(opreguleret.status).toBe('ready');
      expect(graf.status).toBe('ready');

      // Varianten uden de to krav regner TAF præcis som sagen uden fejl.
      expect(fordelt.input.document.presentation).toEqual(projectTafFordelt().document.presentation);
    });

    it('spærrer fortsat med en TAF-relevant fejl, og tooltippen nævner dokumentet', () => {
      const medTafFejl: ErstatningsopgoerelseValues = {
        ...medFejlISvieSmerteOgOevrigeKrav,
        tafPerioder: [{ id: 'taf-omvendt', fra: iso('2024-12-31'), til: iso('2024-07-01'), loseFeriedage: 0 }],
      };
      const ctx = context(medTafFejl);
      expect(tooltipOf(tafFordeltPaaAarDocumentDefinition.project(ctx, undefined)))
        .toBe('TAF fordelt på kalenderår kan ikke hentes, når der er fejl ovenfor');
      expect(tooltipOf(tafOpreguleretPaaAarDocumentDefinition.project(ctx, undefined)))
        .toBe('TAF opreguleret til beregningsåret kan ikke hentes, når der er fejl ovenfor');
      expect(tooltipOf(tafKravGrafDocumentDefinition.project(ctx, undefined)))
        .toBe('Visuel graf over indtægtsniveau kan ikke hentes, når der er fejl ovenfor');
      expect(tooltipOf(erstatningsopgoerelseDocumentDefinition.project(ctx, undefined)))
        .toBe('Opgørelse kan ikke hentes, når der er fejl ovenfor');
    });
  });

  it('fører TAF fordelt på år gennem definitionen til Word', async () => {
    const input = projectTafFordelt();
    expect(input.document.presentation?.years.length).toBeGreaterThan(0);
    expect(input.visUdkastStempel).toBe(false);

    const renderer = await tafFordeltPaaAarDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );

    // Samme navn som knappen (BB-376).
    expect(filename).toContain('TAF fordelt på kalenderår');
    expect(xmlToPlainText(documentXml)).toContain('TAF fordelt på kalenderår');
  });

  it('fører TAF opreguleret til beregningsår gennem definitionen til Word', async () => {
    const input = projectTafOpreguleret();
    expect(input.document.presentation?.years.length).toBeGreaterThan(0);
    expect(input.selectedElements.opgoerelse).toBe(true);

    const renderer = await tafOpreguleretPaaAarDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );

    expect(filename).toContain('TAF opreguleret til beregningsåret');
    expect(xmlToPlainText(documentXml)).toContain('TAF opreguleret til beregningsåret');
  });

  it('fører TAF-kravgrafen gennem definitionen til Word', async () => {
    const input = projectTafGraf();
    expect(input.document.series.length).toBeGreaterThan(0);
    expect(input.visUdkastStempel).toBe(false);

    const renderer = await tafKravGrafDocumentDefinition.loadRenderer();
    const { filename, zip } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );

    expect(filename).toContain('Visuel graf over indtægtsniveau');
    expect(Object.keys(zip.files).some((name) => /^word\/media\//.test(name))).toBe(true);
  });
});
