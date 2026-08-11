import {
  createEmptySettledInput,
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  resetSection,
  settleField,
  type FieldRef,
  type InputMutationCommand,
  type SettledInput,
} from '../../../inputCore';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../../inputCore/catalog/faellesAarsloenDescriptors';
import { erhvervsevnetabBeregningsdatoField } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { toISODateString } from '../../../types/branded';

const catalog = getProductionInputCatalog();
const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));

const empty = (): SettledInput => catalog.validateSettledInput(createEmptySettledInput());

const dispatch = <TField, TEntity>(
  input: SettledInput,
  command: InputMutationCommand<TField, TEntity>
): SettledInput => reduceInputCommand(input, command, catalog).input;

const settle = <T>(input: SettledInput, field: FieldRef<T>, raw: string): SettledInput =>
  dispatch(input, settleField(field, raw));

const evaluate = (input: SettledInput) => createInputEvaluation({ input, catalog, sourceToken });

describe('faellesAarsloen-descriptors — årsafhængigt ASL-maksimum', () => {
  it('bevarer fallback-loftet, når EET-beregningsdato mangler', () => {
    const input = settle(empty(), faellesAarsloenAslAarsloenField.bind(), '9999000');
    const read = evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind());

    expect(read).toMatchObject({ status: 'usable', value: { kind: 'number', value: 9999000 } });
  });

  it('viser maksimumssatsen for året med en gyldig EET-beregningsdato', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = dispatch(input, resetSection('stamdata', { skadedato: toISODateString('2024-01-01') }));
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '9999999');

    const read = evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind());

    expect(read).toMatchObject({
      status: 'error',
      issue: {
        reason: 'bounds',
        message: 'Værdi skal være mellem 1000 og 632000',
        detail: { minValue: 1000, maxValue: 632000 },
      },
    });
  });

  it('accepterer den årsafhængige maksimumsværdi præcis på grænsen', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '632000');

    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      status: 'usable',
      value: { kind: 'number', value: 632000 },
    });
  });

  it('falder tilbage til det generelle loft ved ugyldig eller rødmarkeret beregningsdato', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '31-02-2025');
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '9999000');
    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      status: 'usable',
      value: { kind: 'number', value: 9999000 },
    });

    input = dispatch(empty(), resetSection('stamdata', { skadedato: toISODateString('2024-01-01') }));
    input = settle(input, erhvervsevnetabBeregningsdatoField.bind(), '01-01-2020');
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '9999000');
    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      issue: { message: 'Årsløn kan ikke overstige maks årslønnen i skadesåret (608.000 kr.)' },
    });
  });

  it('ændrer ikke EAL-årslønnens generelle loft', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = settle(input, faellesAarsloenEalAarsloenField.bind(), '999');

    expect(evaluate(input).reader.read(faellesAarsloenEalAarsloenField.bind())).toMatchObject({
      status: 'error',
      issue: { message: 'Værdi skal være mellem 1000 og 9999999' },
    });
  });
});
