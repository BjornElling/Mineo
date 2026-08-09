// @vitest-environment jsdom
import { buildVarigeMenReaderProjection } from '../../../domain/varigemen/varigeMenReaderProjection';
import { computeVarigeMenEngine } from '../../../domain/varigemen/varigeMenEngine';
import { varigeMenPrGrad } from '../../../data/lovbestemteRates';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { StamdataValues, VarigeMenValues } from '../../../schemas/formSchemas';

// Greenfield Varige mén reader-projektion (§3.4/§5.4/§1.7): beviser at projektionen (a) kører den EKSISTERENDE
// `computeVarigeMenEngine` byte-identisk på de reader-læste værdier (§5.4 hårdt stop mod talændring), (b) blokerer
// på en canonical bounds-feltfejl (méngrad uden for 1..120, §1.6), (c) blokerer på en byttet stamdata-datoorden
// (rød feltfejl på skadedato/fødselsdato) og (d) udleder `missing` → blocked for et tomt påkrævet felt (§1.7).
// Spejler `renteberegningReaderProjection.test.ts` / `forsoergertabReaderProjection.test.ts`.

const catalog = getProductionInputCatalog();

const validVarigeMen: VarigeMenValues = {
  mengrad: 10,
  beregningsdato: toISODateString('2020-01-01'),
};

const validStamdata: StamdataValues = {
  journalnr: 'J',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2019-01-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (varigemen: VarigeMenValues, stamdata: StamdataValues | null) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null,
      varigemen, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

describe('buildVarigeMenReaderProjection', () => {
  it('kører computeVarigeMenEngine byte-identisk på de reader-læste værdier (§5.4)', () => {
    const reader = buildReader(validVarigeMen, validStamdata);
    const projection = buildVarigeMenReaderProjection(reader);

    expect(projection.status).toBe('ready');
    if (projection.status !== 'ready') throw new Error('forventede ready');

    // Golden: præcis samme motor-resultat som et direkte kald med de committede værdier.
    const expected = computeVarigeMenEngine({
      varigemen: validVarigeMen,
      skadestidspunkt: validStamdata.skadedato,
      rates: varigeMenPrGrad,
      fodselsdato: validStamdata.skadelidteFodselsdato,
    });
    expect(projection.value.beregningsResultat).toEqual(expected.result);
    expect(projection.value.mengrad).toBe(10);
    expect(projection.value.skadedato).toBe(validStamdata.skadedato);
  });

  it('blokerer på en canonical méngrad-bounds-fejl (uden for 1..120, §1.6)', () => {
    const reader = buildReader({ ...validVarigeMen, mengrad: 121 }, validStamdata);
    const projection = buildVarigeMenReaderProjection(reader);
    expect(projection.status).toBe('blocked');
    if (projection.status !== 'blocked') throw new Error('forventede blocked');
    // En rød feltfejl (ikke kun missing) driver blokeringen.
    expect(projection.issues.some((issue) => issue.kind === 'field')).toBe(true);
  });

  it('blokerer på en byttet stamdata-datoorden (rød feltfejl på skadedato/fødselsdato, §1.6)', () => {
    // Fødselsdato efter skadedato → rød feltfejl på stamdata-datoerne; readeren skjuler værdien → blocked.
    const reader = buildReader(validVarigeMen, {
      ...validStamdata,
      skadedato: toISODateString('2019-01-01'),
      skadelidteFodselsdato: toISODateString('2020-01-01'),
    });
    const projection = buildVarigeMenReaderProjection(reader);
    expect(projection.status).toBe('blocked');
    if (projection.status !== 'blocked') throw new Error('forventede blocked');
    expect(projection.issues.some((issue) => issue.kind === 'field')).toBe(true);
  });

  it('udleder missing → blocked for et tomt påkrævet felt uden rød markering (§1.7)', () => {
    const reader = buildReader({ ...validVarigeMen, mengrad: undefined }, validStamdata);
    const projection = buildVarigeMenReaderProjection(reader);
    expect(projection.status).toBe('blocked');
    if (projection.status !== 'blocked') throw new Error('forventede blocked');
    // Et tomt felt giver en consumer-`missing`-fejl, ikke en rød feltfejl.
    expect(projection.issues.some((issue) => issue.kind === 'consumer' && issue.reason === 'missing')).toBe(true);
    expect(projection.issues.some((issue) => issue.kind === 'field')).toBe(false);
  });

  /**
   * Motoren må ALDRIG kaldes i en blokeret projektion (§3.9).
   *
   * ÆRLIG AFGRÆNSNING af hvad denne test beviser. Med de fire aktuelle dependencies kommer ENHVER blokering
   * fra en `unavailable`-læsning, som den gamle form også standsede på — den gamle og den nye form er derfor
   * runtime-ækvivalente i dag, præcis som fundet selv konstaterede. Denne test er altså ikke det, der
   * skelner dem; den pinner invarianten mod en FREMTIDIG blokeringskilde (fx `collector.warn`-baseret eller
   * en kryds-felt-regel), hvor et kald inde i kroppen ville køre trods `blocked`.
   *
   * Den egentlige garanti er en TYPEGRÆNSE, ikke denne test: motorinputtet er en navngiven type, som kun
   * kan konstrueres, når hvert read er `usable`. Udelades et read af guarden, findes `.value` ikke på
   * `ProjectionReadResult`-unionen, og koden kompilerer ikke (verificeret ved probe: TS2339). En manuel
   * guard, der skal huskes udvidet, er erstattet af en, compileren håndhæver.
   */
  it('kalder ALDRIG motoren, når projektionen er blokeret (§3.9)', async () => {
    const engineModule = await import('../../../domain/varigemen/varigeMenEngine');
    const spy = vi.spyOn(engineModule, 'computeVarigeMenEngine');
    try {
      // Blokeret af en canonical bounds-fejl.
      buildVarigeMenReaderProjection(buildReader({ ...validVarigeMen, mengrad: 121 }, validStamdata));
      // Blokeret af et manglende påkrævet felt.
      buildVarigeMenReaderProjection(buildReader({ ...validVarigeMen, mengrad: undefined }, validStamdata));
      // Blokeret af en manglende tværsektionel dependency.
      buildVarigeMenReaderProjection(buildReader(validVarigeMen, null));
      expect(spy).not.toHaveBeenCalled();

      // Ankeret: samme spion SER motoren, når projektionen er ready — ellers kunne testen være tom, fordi
      // spionen slet ikke var koblet til den kaldte reference.
      buildVarigeMenReaderProjection(buildReader(validVarigeMen, validStamdata));
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
