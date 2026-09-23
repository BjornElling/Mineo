// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

// BB-228 (udviklerafgørelse 2026-09-22/23): et skjult felt er ikke udfyldt og må hverken påvirke beregning eller
// fejlmeddelelser. EO-felterne bag et valg bærer derfor descriptorens `relevance`, så ALLE læsere – validatoren,
// rækkebyggerne, dependency-projektionen og motorerne – ser tomværdien. Testene går gennem den rigtige reader.

const catalog = getProductionInputCatalog();
const iso = (value: string) => toISODateString(value);
const asAmount = (value: number) => ({ kind: 'number' as const, value });

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'Advokat A',
  sagsbehandler: 'Sagsbehandler S',
  skadelidte: 'Test Testesen',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2022-03-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const baseEo = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  eoNummer: '1',
  kravPaaTabtArbejdsfortjeneste: 'Nej',
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  vedroererPeriodeFra: iso('2022-03-01'),
  vedroererPeriodeTil: iso('2022-12-31'),
  opgørelseLavetDen: iso('2023-01-15'),
});

const project = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const reader = createInputEvaluation({ input, catalog, sourceToken }).reader;
  const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
  const rows = collectAllEoRows(
    projection.stamdataValues,
    projection.stamdataErrors,
    projection.eoValues,
    projection.eoErrors,
    {},
    undefined,
    projection.snapshot.data?.canonicalOutput,
    projection.snapshot.data?.pdfModel,
  );
  return { projection, rows };
};

const blockingMessages = (snapshot: ReturnType<typeof project>['projection']['snapshot']) =>
  snapshot.invariants.filter((invariant) => invariant.severity === 'error').map((invariant) => invariant.message);

describe('EO-felter bag et valg (descriptor-relevans)', () => {
  describe.each(['Nej', 'Skjul'] as const)('øvrige krav på «%s»', (kravvalg) => {
    it('lader en skjult, halvudfyldt række være tavs i både validator og rækkebygger (BB-228)', () => {
      const { projection, rows } = project({
        ...baseEo(),
        kravPaaOevrigeErstatningskrav: kravvalg,
        oevrigeKravPerioder: [{ id: 'ok-1', dato: undefined, udgiftTil: 'Medicin', beloeb: undefined }],
      });

      expect(blockingMessages(projection.snapshot)).toEqual([]);
      expect(rows.errors).toEqual([]);
      expect(projection.eoValues.oevrigeKravPerioder.every((row) => row.udgiftTil === '')).toBe(true);
    });

    it('danner ingen rød feltfejl for en skjult celle uden for sine grænser', () => {
      const { projection, rows } = project({
        ...baseEo(),
        kravPaaOevrigeErstatningskrav: kravvalg,
        // Før skadedatoen: en canonical værdi med et rødt bounds-issue, når cellen er synlig.
        oevrigeKravPerioder: [{ id: 'ok-1', dato: iso('2020-01-01'), udgiftTil: 'Medicin', beloeb: asAmount(0) }],
      });

      expect(projection.eoErrors.all).toEqual([]);
      expect(blockingMessages(projection.snapshot)).toEqual([]);
      expect(rows.errors).toEqual([]);
    });
  });

  it('bevarer den skjulte række canonical, så den vender tilbage med sine fejl ved «Ja»', () => {
    const { projection, rows } = project({
      ...baseEo(),
      kravPaaOevrigeErstatningskrav: 'Ja',
      oevrigeKravPerioder: [{ id: 'ok-1', dato: undefined, udgiftTil: 'Medicin', beloeb: undefined }],
    });

    expect(projection.eoValues.oevrigeKravPerioder[0]?.udgiftTil).toBe('Medicin');
    expect(rows.errors.map((row) => row.message)).toEqual(['Medicin: «Beløb» er ikke udfyldt']);
  });

  it('lader et skjult «Svie/smerte opgjort i tidligere erstatningsopgørelser» være uden virkning ved 1. opgørelse', () => {
    const svieSag = (tidligereTotal: number | undefined): ErstatningsopgoerelseValues => ({
      ...baseEo(),
      eoNummer: '1',
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Nej',
      svieSmerteSatserAar: 2022,
      svieSmertePerioder: [{ id: 'ss-1', fra: iso('2022-03-01'), til: iso('2022-03-31'), tilstand: 'sygemeldt' }],
      svieSmerteTidligereTotal: tidligereTotal === undefined ? undefined : asAmount(tidligereTotal),
    });

    const uden = project(svieSag(undefined)).projection.snapshot;
    const medSkjultBeloeb = project(svieSag(1_000_000)).projection.snapshot;

    expect(uden.data).not.toBeNull();
    expect(medSkjultBeloeb.data?.pdfModel.samlet).toEqual(uden.data?.pdfModel.samlet);
  });
});
