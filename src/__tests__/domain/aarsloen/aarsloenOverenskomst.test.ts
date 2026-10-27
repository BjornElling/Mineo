import {
  createInputEvaluation,
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  setImmediateField,
  settleField,
  type FieldRef,
  type SettledInput,
} from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  aarsloenFeriePctField,
  aarsloenFritvalgPctField,
  aarsloenPensionPctField,
  aarsloenShSoPctField,
  aarsloenReguleringsdatoField,
  aarsloenTillaegAngivesSomField,
} from '../../../inputCore/catalog/aarsloenDescriptors';
import { aarsloenSchema, type AarsloenValues, type StandardLoenTableRow } from '../../../schemas/formSchemas/sections/aarsloenSchemas';
import { createAarsloenInitialValues } from '../../../domain/aarsloen/aarsloenInitialValues';
import { buildAarsloenReaderProjection, readAarsloenValues } from '../../../domain/aarsloen/aarsloenProjection';
import { evaluateAarsloenDownloadGate } from '../../../domain/aarsloen/aarsloenDownloadGate';
import { resolveAarsloenOverenskomstValg } from '../../../domain/aarsloen/aarsloenTillaeg';
import { resolveOverenskomstSatsBindings } from '../../../domain/loen/overenskomstSatser';
import { resolveHoejFeriePctAdvarsel } from '../../../domain/loen/feriePctAdvarsel';
import { resolveFravalgtStoreBededagstillaegAdvarsel } from '../../../domain/loen/storeBededagstillaeg';
import { projectEoSave } from '../../../persistence/eoSaveProjection';
import { adaptPersistedSectionForLoad } from '../../../persistence/persistedLoadAdapter';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { toISODateString } from '../../../types/branded';

const catalog = getProductionInputCatalog();
const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
const iso = toISODateString;

const row = (id: string, month: string): StandardLoenTableRow => ({
  id,
  col0_maaned: month, col1_maaned: '2024', col0_uge: '', col1_uge: '',
  col0_dag: undefined, col1_dag: undefined,
  col2: { kind: 'number', value: 1000 }, col3: undefined, col4: undefined, col5: undefined,
  fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
});

const inputFor = (patch: Partial<AarsloenValues> = {}): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    aarsloen: {
      ...createAarsloenInitialValues(),
      tillaegAngivesSom: 'overenskomst',
      overenskomstId: 'bygge-anlaeg',
      reguleringsdato: iso('2024-03-01'),
      feriePct: 12.5,
      tableData: [row('r1', '1')],
      ...patch,
    },
  },
  rejectedInputs: {},
});

const readerFor = (input: SettledInput) => createInputEvaluation({ input, catalog, sourceToken }).reader;
const project = (patch: Partial<AarsloenValues> = {}) => buildAarsloenReaderProjection(readerFor(inputFor(patch)));

type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];
const settle = <T>(input: SettledInput, field: FieldRef<T>, raw: string): SettledInput =>
  reduceInputCommand(input, settleField(field, raw) as AnyInputCommand, catalog).input;

describe('årslønnens overenskomstgrundlag', () => {
  it('regner ikke på manuelle fallback-satser, hvis et indlæst overenskomstvalg kun indeholder mellemrum', () => {
    const result = project({ overenskomstId: '   ', pensionPct: 7 });
    expect(result.calculation).toBeNull();
    expect(result.fieldIssues).toContainEqual(expect.objectContaining({ kind: 'consumer', reason: 'missing' }));
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(false);
  });

  it('viser og beregner de fire afledte satser sammen med brugerens manuelle feriesats', () => {
    const result = project();

    expect(result.values).toMatchObject({
      feriePct: 12.5,
      fritvalgPct: 0,
      shSoPct: 8.8,
      storeBededagPct: 0.45,
      pensionPct: 10.15,
    });
    expect(result.fieldIssues).toEqual([]);
    // 21,75 % tillæg; pensionen beregnes også af tillæggene: 1.217,50 × 10,15 % = 123,58.
    expect(result.calculation?.beregnetAarsloen).toBe(1341.08);
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(true);
  });

  it('anvender datoens satser på alle rækker, også rækker før satsændringen', () => {
    const result = project({ tableData: [row('januar', '1'), row('december', '12')] });

    expect(result.calculation?.beregnetAarsloen).toBe(2682.16);
    expect(result.fieldIssues).toEqual([]);
    expect(result.tableValidation.errors).toEqual([]);
  });

  it.each([
    ['bygge-anlaeg', 'shSoPct', 8.8, 14.7],
    ['industriens-overenskomst', 'fritvalgPct', 9, 13],
  ] as const)('genberegner helligdagsreglen for %s uden at kræve helårsomregning', (overenskomstId, field, almindelig, sh) => {
    const medLoen = project({ overenskomstId, loenPaaHelligdage: 'Almindelig løn' });
    const udenLoen = project({ overenskomstId, loenPaaHelligdage: 'SH-udbetaling' });

    expect(medLoen.omregningGate.effectiveEnabled).toBe(false);
    expect(medLoen.values[field]).toBe(almindelig);
    expect(udenLoen.values[field]).toBe(sh);
    expect(udenLoen.values.storeBededagPct).toBe(0);
  });

  it.each([
    ['2023-12-31', true, 0],
    ['2024-01-01', true, 0.45],
    ['2024-01-01', false, 0],
  ] as const)('Store Bededag på %s med tilvalg %s giver %s procent', (dato, tilvalg, forventet) => {
    const result = project({ reguleringsdato: iso(dato), beregnStoreBededagstillaeg: tilvalg });
    expect(result.values.storeBededagPct).toBe(forventet);
  });

  it('lader offentlige overenskomsters ukendte satser være brugerens indtastning', () => {
    const result = project({ overenskomstId: 'kl-overenskomst', fritvalgPct: 3, shSoPct: 4, pensionPct: 17 });
    expect(result.values).toMatchObject({ feriePct: 12.5, fritvalgPct: 3, shSoPct: 4, pensionPct: 17 });
    expect(result.fieldIssues).toEqual([]);
  });

  it('blander offentlige kendte satser og manuelle satser uden at overskrive brugerinput', () => {
    const result = project({ overenskomstId: 'laerer-overenskomsten', shSoPct: 2, fritvalgPct: 99, pensionPct: 98 });
    expect(result.values).toMatchObject({ feriePct: 12.5, fritvalgPct: 1.38, shSoPct: 2, pensionPct: 17.3 });
    expect(result.fieldIssues).toEqual([]);
  });

  it.each([
    { overenskomstId: undefined },
    { reguleringsdato: undefined },
    { reguleringsdato: iso('2011-02-28') },
    { overenskomstId: 'ukendt-overenskomst' },
  ])('spærrer beregning og dokument ved manglende eller utilgængeligt satsopslag: %j', (patch) => {
    const result = project(patch);
    expect(result.fieldIssues.length).toBeGreaterThan(0);
    expect(result.calculation).toBeNull();
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(false);
  });

  it('bevarer offentlige manuelle satsfelter ved en dato uden for grænserne og spærrer resultatet', () => {
    const input = inputFor({
      overenskomstId: 'laerer-overenskomsten', reguleringsdato: iso('2100-01-01'),
      fritvalgPct: 3, shSoPct: 4, pensionPct: 5,
    });
    const reader = readerFor(input);
    const result = buildAarsloenReaderProjection(reader);
    expect(result.calculation).toBeNull();
    expect(result.values.reguleringsdato).toBeUndefined();
    expect(result.fieldIssues).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'bounds' })]));

    // UI'ens låsning læser den vurderede dato; descriptoren læser den rå dato. De skal vise samme felter.
    const uiBindings = resolveOverenskomstSatsBindings(resolveAarsloenOverenskomstValg(result.values), result.values.reguleringsdato);
    for (const [key, descriptor, expected] of [
      ['fritvalgPct', aarsloenFritvalgPctField, 3],
      ['shSoPct', aarsloenShSoPctField, 4],
      ['pensionPct', aarsloenPensionPctField, 5],
    ] as const) {
      expect(uiBindings[key].kind).toBe('bruger');
      expect(reader.read(descriptor.bind())).toMatchObject({ status: 'usable', value: expected });
      expect(result.values[key]).toBe(expected);
    }
  });

  it('advarer om 12,5 procent sammen med fuld løn under ferie, også uden helårsomregning', () => {
    const result = project();
    expect(result.omregningGate.effectiveEnabled).toBe(false);
    expect(result.calculation?.fejlmeddelelser).toContain(
      'En sats for Feriegodtgørelse/-tillæg på 12,5 % gør det højst usandsynligt, at der er ret til løn under ferie.'
    );
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(true);
  });

  it('genbruger den høje ferieadvarsel og Bededag-fravalgets tekst uden at blokere dokumentet', () => {
    const result = project({ feriePct: 21, beregnStoreBededagstillaeg: false });
    const highFerie = resolveHoejFeriePctAdvarsel(21);
    const fravalgtBededag = resolveFravalgtStoreBededagstillaegAdvarsel(iso('2024-03-01'), {
      loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false,
    });
    expect(highFerie).toBeDefined();
    expect(fravalgtBededag).toBeDefined();
    expect(result.calculation?.fejlmeddelelser).toEqual(expect.arrayContaining([highFerie, fravalgtBededag]));
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(true);
  });

  it('advarer kun om den skjulte 6. ferieuge, når helårsomregningen faktisk bruger valget', () => {
    const udenOmregning = project({ fuldLoenUnderFerie: false, retTilSjetteFerieuge: true });
    const medOmregning = project({ fuldLoenUnderFerie: false, retTilSjetteFerieuge: true, omregningTilFuldtAar: true });
    const ferieugeTekst = 'Retten til 6. ferieuge vil typisk skulle omsættes til feriegodtgørelse med 15 %.';
    expect(udenOmregning.omregningGate.effectiveEnabled).toBe(false);
    expect(udenOmregning.calculation?.fejlmeddelelser).not.toContain(ferieugeTekst);
    expect(medOmregning.omregningGate.effectiveEnabled).toBe(true);
    expect(medOmregning.calculation?.fejlmeddelelser).toContain(ferieugeTekst);
  });

  it('bevarer procenttilstandens hidtidige advarsler og giver den ingen nye overenskomstadvarsler', () => {
    const values = {
      tillaegAngivesSom: 'procent', feriePct: 21, shSoPct: 0,
      fuldLoenUnderFerie: false, retTilSjetteFerieuge: false, beregnStoreBededagstillaeg: false,
    } as const;
    const udenOmregning = project(values);
    const medOmregning = project({ ...values, omregningTilFuldtAar: true });
    expect(udenOmregning.calculation?.fejlmeddelelser).toEqual([]);
    expect(medOmregning.calculation?.fejlmeddelelser).toEqual([
      'En sats for Feriegodtgørelse/-tillæg på 21 % skaber en klar formodning for, at der er ret til 6. ferieuge.',
    ]);
  });

  it('forklarer den manglende dækning med samme konkrete grænse som lønindkomst', () => {
    const result = project({ reguleringsdato: iso('2011-02-28') });
    expect(result.fieldIssues.some((issue) => issue.message.includes('har ingen satser før 01-03-2011 – vælg en senere reguleringsdato'))).toBe(true);
    expect(result.values.shSoPct).toBeUndefined();
    expect(result.values.pensionPct).toBeUndefined();
  });

  it('spærrer ved rejected dato og tillader ikke save af den rå fejltekst', () => {
    const input = settle(inputFor(), aarsloenReguleringsdatoField.bind(), 'umulig');
    const result = buildAarsloenReaderProjection(readerFor(input));
    expect(result.values.reguleringsdato).toBeUndefined();
    expect(result.calculation).toBeNull();
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(false);
    expect(projectEoSave(input, catalog).status).toBe('blocked');
  });

  it.each([
    { field: aarsloenFeriePctField.bind(), overenskomstId: 'bygge-anlaeg' },
    { field: aarsloenPensionPctField.bind(), overenskomstId: 'kl-overenskomst' },
  ])('spærrer stadig ved fejl i en manuel sats i overenskomsttilstanden', ({ field, overenskomstId }) => {
    const input = settle(inputFor({ overenskomstId }), field, '150');
    const result = buildAarsloenReaderProjection(readerFor(input));
    expect(result.fieldIssues.length).toBeGreaterThan(0);
    expect(result.calculation).toBeNull();
    expect(evaluateAarsloenDownloadGate(result).canDownload).toBe(false);
  });

  it('bevarer manuelle satser gennem overenskomstvalg, save/load og skift tilbage til procent', () => {
    const input = inputFor({ fritvalgPct: 3, shSoPct: 4, pensionPct: 5, storeBededagPct: 6 });
    const projected = readAarsloenValues(readerFor(input));
    expect(projected).toMatchObject({ fritvalgPct: 0, shSoPct: 8.8, pensionPct: 10.15, storeBededagPct: 0.45 });

    const saved = projectEoSave(input, catalog);
    expect(saved.status).toBe('ready');
    if (saved.status !== 'ready') throw new Error('Gyldigt input skal kunne gemmes');
    // Filens JSON-rundtur er reel: undefined bliver ikke en skjult, lokal recovery-kilde.
    const fileSection: unknown = JSON.parse(JSON.stringify(saved.snapshot.aarsloen));
    const adapted = adaptPersistedSectionForLoad('aarsloen', fileSection, PERSISTED_DATA_VERSION);
    expect(adapted.preflightMissingFields).toEqual([]);
    const loadedValues = aarsloenSchema.parse(adapted.value);
    expect(loadedValues).toMatchObject({ fritvalgPct: 3, shSoPct: 4, pensionPct: 5, storeBededagPct: 6 });
    const loaded = catalog.validateSettledInput({ sections: { ...input.sections, aarsloen: loadedValues }, rejectedInputs: {} });
    expect(readAarsloenValues(readerFor(loaded))).toEqual(projected);

    const manual = reduceInputCommand(loaded, setImmediateField(aarsloenTillaegAngivesSomField.bind(), 'procent') as AnyInputCommand, catalog).input;
    expect(readAarsloenValues(readerFor(manual))).toMatchObject({ feriePct: 12.5, fritvalgPct: 3, shSoPct: 4, pensionPct: 5, storeBededagPct: 6 });
  });

  it('indlæser gamle procent- og beløbssager uden nye værdier, advarsel eller ændrede satser', () => {
    for (const mode of ['procent', 'beloeb'] as const) {
      const oldSection = {
        feriePct: 12.5, fritvalgPct: 3, shSoPct: 4, pensionPct: 5, storeBededagPct: 6,
        tillaegAngivesSom: mode, loenperiode: 'maaned', tableData: [row('r1', '1')],
        omregningTilFuldtAar: false, fuldLoenUnderFerie: true, retTilSjetteFerieuge: true,
        loenPaaHelligdage: 'Almindelig løn',
      };
      const adapted = adaptPersistedSectionForLoad('aarsloen', oldSection, '3.16');
      expect(adapted.preflightMissingFields).toEqual([]);
      expect(aarsloenSchema.parse(adapted.value)).toEqual(oldSection);
    }
    expect(createAarsloenInitialValues().beregnStoreBededagstillaeg).toBe(true);
  });
});
