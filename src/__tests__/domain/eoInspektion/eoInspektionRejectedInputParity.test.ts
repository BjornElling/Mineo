// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createEvaluationSourceToken, createInputEvaluation, createInputRevision, createSettingsRevision, reduceInputCommand, settleField, type FieldRef, type SettledInput } from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createValidationReader } from '../../../inputCore/inputReader';
import {
  eoTafBeregningsperiodeFraField, eoTafPeriodeTilField, eoTafPeriodeLoseFeriedageField,
  eoSvieSmertePeriodeTilField, eoSvieSmerteSatserAarField, eoSfggManuelDagssatsField,
  eoOffentligeYdelserYdelseField, eoOffentligeYdelserTilDatoField, eoOevrigeFravaersdageField,
  eoFerieperiodeTilField, eoFravaerPeriodeTilField, eoForligAnsvarsgradProcentField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { stamdataSkadedatoField } from '../../../inputCore/catalog/stamdataDescriptors';
import { eoStandardRowFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { persistedErstatningsopgoerelseSchema } from '../../../schemas/formSchemas';
import { toISODateString as iso } from '../../../types/branded';
import { createSfggIngenRow } from '../../utils/sfggTestSupport';
import { collectSammentaellingControlMismatchMessages } from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';

const catalog = getProductionInputCatalog();
const edit = <T,>(field: FieldRef<T>, raw: string) => ({
  apply: (input: SettledInput) => reduceInputCommand(input, settleField(field, raw), catalog),
  assertSettlement: (input: SettledInput, evaluation: ReturnType<typeof createInputEvaluation>, rejected: boolean, status: string) => {
    const validationReader = createValidationReader(input, catalog);
    expect(validationReader.readRejected(field) !== undefined).toBe(rejected);
    expect(field.descriptor.isEmpty(validationReader.readCanonical(field))).toBe(rejected);
    expect(evaluation.reader.read(field).status).toBe(status);
  },
});

const cases = [
  ['skadedato med forkert format', edit(stamdataSkadedatoField.bind(), 'forkert dato')],
  ['skadedato uden for grænserne', edit(stamdataSkadedatoField.bind(), '01-01-2099')],
  ['forligsprocent med forkert format', edit(eoForligAnsvarsgradProcentField.bind(), 'forkert tal')],
  ['forligsprocent uden for grænserne', edit(eoForligAnsvarsgradProcentField.bind(), '150')],
  ['TAF-feriedato med forkert format', edit(eoFerieperiodeTilField.bind('ferie'), 'forkert dato')],
  ['TAF-ferie med omvendte datoer', edit(eoFerieperiodeTilField.bind('ferie'), '01-12-2023')],
  ['fraværsdato med forkert format', edit(eoFravaerPeriodeTilField.bind('fravaer'), 'forkert dato')],
  ['fravær med omvendte datoer', edit(eoFravaerPeriodeTilField.bind('fravaer'), '01-12-2022')],
  ['beregningsdato med forkert format', edit(eoTafBeregningsperiodeFraField.bind(), 'forkert dato')],
  ['beregningsperiode med start efter slut', edit(eoTafBeregningsperiodeFraField.bind(), '01-01-2025')],
  ['TAF-dato med forkert format', edit(eoTafPeriodeTilField.bind('taf'), 'forkert dato')],
  ['TAF med omvendte datoer', edit(eoTafPeriodeTilField.bind('taf'), '01-12-2023')],
  ['TAF-ferie med forkert format', edit(eoTafPeriodeLoseFeriedageField.bind('taf'), 'forkert tal')],
  ['TAF-ferie med negativt antal', edit(eoTafPeriodeLoseFeriedageField.bind('taf'), '-2')],
  ['TAF-ferie med for stort antal', edit(eoTafPeriodeLoseFeriedageField.bind('taf'), '1000')],
  ['øvrigt fravær med forkert format', edit(eoOevrigeFravaersdageField.bind(), 'forkert tal')],
  ['øvrigt fravær med negativt antal', edit(eoOevrigeFravaersdageField.bind(), '-2')],
  ['sygdomsdato med forkert format', edit(eoSvieSmertePeriodeTilField.bind('ss'), 'forkert dato')],
  ['sygdom med omvendte datoer', edit(eoSvieSmertePeriodeTilField.bind('ss'), '01-12-2023')],
  ['sygdomsår med forkert format', edit(eoSvieSmerteSatserAarField.bind(), 'forkert år')],
  ['sygdomsår uden for grænserne', edit(eoSvieSmerteSatserAarField.bind(), '2100')],
  ['SFGG-sats med forkert format', edit(eoSfggManuelDagssatsField.bind('employment'), 'forkert tal')],
  ['SFGG-sats med negativt beløb', edit(eoSfggManuelDagssatsField.bind('employment'), '-100')],
  ['løn med forkert format', edit(eoStandardRowFields.col2.bind('employment', 'loen'), 'forkert tal')],
  ['lønår med forkert format', edit(eoStandardRowFields.col1_maaned.bind('employment', 'loen'), 'forkert år')],
  ['lønmåned uden for grænserne', edit(eoStandardRowFields.col0_maaned.bind('employment', 'loen'), '13')],
  ['ydelse med forkert format', edit(eoOffentligeYdelserYdelseField.bind('ydelse'), 'forkert tal')],
  ['ydelsesdato med forkert format', edit(eoOffentligeYdelserTilDatoField.bind('ydelse'), 'forkert dato')],
  ['ydelse med omvendte datoer', edit(eoOffentligeYdelserTilDatoField.bind('ydelse'), '01-12-2023')],
] as const;

describe('kontrolkolonnernes paritet efter rejected input og røde canonical felter', () => {
  it.each(cases)('%s', (_name, command) => {
    const values = persistedErstatningsopgoerelseSchema.parse({
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja', beregnesUdFra: 'Beregningsperiode',
      vedroererPeriodeFra: iso('2024-01-01'), vedroererPeriodeTil: iso('2024-12-31'),
      tafBeregningsperiodeFra: iso('2023-01-01'), tafBeregningsperiodeTil: iso('2023-12-31'),
      oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 2,
      tafPerioder: [{ id: 'taf', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 2 }],
      ferieperioder: [{ id: 'ferie', fra: iso('2024-01-10'), til: iso('2024-01-11') }],
      fravaerPerioder: [{ id: 'fravaer', fra: iso('2023-01-10'), til: iso('2023-01-11') }],
      forligAnsvarsgradProcent: 100,
      kravPaaSvieSmerteGodtgoerelse: 'Ja', tidligereSsMax: 'Nej', svieSmerteSatserAar: 2024,
      svieSmertePerioder: [{ id: 'ss', fra: iso('2024-01-01'), til: iso('2024-01-31'), tilstand: 'sygemeldt' }],
      loenindkomstAnsaettelsesforhold: [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'employment',
        loenperiode: 'maaned', fuldLoenUnderFerie: 'Nej', loenPaaHelligdage: 'Almindelig løn',
        indtaegtsoplysningerTableData: [{ id: 'loen', col0_maaned: '1', col1_maaned: '2023', col2: { kind: 'number', value: 1000 } }],
      }],
      offentligeYdelserRows: [{ id: 'ydelse', fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 100 } }],
      sfggAnsaettelsesforhold: [{ ...createSfggIngenRow('employment'), sfggBeregningskilde: 'Manuelt angivet', sfggManuelDagssats: { kind: 'number', value: 100 } }],
    });
    const initial = catalog.validateSettledInput({
      sections: { stamdata: STAMDATA_INITIAL_VALUES, erstatningsopgoerelse: values, satser: null, aarsloen: null,
        faellesAarsloen: null, renteberegning: null, varigemen: null, forsoergertab: null, erhvervsevnetab: null },
      rejectedInputs: {},
    });
    const initialEvaluation = createInputEvaluation({ input: initial, catalog,
      sourceToken: createEvaluationSourceToken(createInputRevision(0), createSettingsRevision(1)) });
    const initialControl = buildErstatningsopgoerelseReaderProjection(initialEvaluation.reader).snapshot.inspektionSnapshot;
    expect(initialControl?.sammentaelling.svieSmerteSygedage.beregnetValue).toBe(31);
    expect(initialControl?.sammentaelling.svieSmerteSygedage.tabelValue).toBe(31);
    expect(initialControl?.sammentaelling.beregningsperiodeIndtaegter.some((row) => (row.control.beregnetValue ?? 0) > 0)).toBe(true);
    const result = command.apply(initial);
    expect(result.changed).toBe(true);
    if (!result.changed) throw new Error('Indtastningen skal ændre feltet');
    const evaluation = createInputEvaluation({ input: result.input, catalog,
      sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)) });
    // For mange løse TAF-dage er en advarsel; de øvrige cases er røde format-/feltfejl.
    command.assertSettlement(result.input, evaluation, _name.includes('forkert format'),
      _name === 'TAF-ferie med for stort antal' ? 'usable' : 'error');
    const { snapshot } = buildErstatningsopgoerelseReaderProjection(evaluation.reader);
    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.inspektionSnapshot).not.toBeNull();
    const rows = snapshot.inspektionSnapshot?.sammentaellingRows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(collectSammentaellingControlMismatchMessages(rows)).toEqual([]);
    for (const row of rows) {
      const { control } = row;
      // 0 vises også som bindestreg; null/0 er derfor samme tomme kontrolside.
      expect(control.beregnetValue === null || control.beregnetValue === 0, row.key)
        .toBe(control.tabelValue === null || control.tabelValue === 0);
      expect(control.beregnetDisplay === '-', row.key).toBe(control.tabelDisplay === '-');
    }
  });
});
