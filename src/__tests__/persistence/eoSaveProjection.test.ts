import { PERSISTED_SECTION_KEYS } from '../../config/persistenceRegistry';
import {
  insertRow,
  reduceInputCommand,
  serializeFieldAddress,
  settleField,
  type SettledInput,
} from '../../inputCore';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import {
  aargangField,
  belobField,
  createTestCatalog,
  makeRow,
  rentekravRowsRef,
} from '../inputCore/testCatalog';

const catalog = createTestCatalog();

const emptyInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null,
    satser: null,
    aarsloen: null,
    faellesAarsloen: null,
    renteberegning: null,
    varigemen: null,
    forsoergertab: null,
    erstatningsopgoerelse: null,
    erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

describe('projectEoSave', () => {
  it('blokerer rejected format og angiver den præcise feltadresse', () => {
    const input = reduceInputCommand(
      emptyInput(),
      settleField(aargangField.bind(), 'ikke-et-tal'),
      catalog
    ).input;

    expect(projectEoSave(input, catalog)).toEqual({
      status: 'blocked',
      rejectedAddresses: [serializeFieldAddress(aargangField.bind().address)],
    });
  });

  it('gemmer schema-gyldigt canonical input uændret trods afledte bounds-issues', () => {
    let input = reduceInputCommand(emptyInput(), insertRow(rentekravRowsRef(), makeRow('r1')), catalog).input;
    input = reduceInputCommand(input, settleField(aargangField.bind(), '1800'), catalog).input;
    input = reduceInputCommand(input, settleField(belobField.bind('r1'), '-25'), catalog).input;

    const result = projectEoSave(input, catalog);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.snapshot.satser?.aargang).toBe(1800);
    expect(result.snapshot.renteberegning?.rentekravRows[0]?.belob).toMatchObject({
      kind: 'number',
      value: -25,
    });
    expect(Object.keys(result.snapshot)).toEqual(PERSISTED_SECTION_KEYS);
  });

  it('validerer hele aggregaten før save og afviser korrupte rejected-adresser', () => {
    const corrupted = {
      ...emptyInput(),
      rejectedInputs: { 'ikke-en-feltadresse': { raw: 'x', reason: 'format' as const } },
    };

    expect(() => projectEoSave(corrupted, catalog)).toThrow();
  });
});
