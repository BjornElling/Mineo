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

describe('faellesAarsloen-descriptors – årsafhængigt ASL-maksimum', () => {
  it('bruger de godkendte fulde navne for begge fælles årslønsfelter', () => {
    expect(faellesAarsloenAslAarsloenField.label).toBe('Skadelidtes årsløn (efter ASL)');
    expect(faellesAarsloenEalAarsloenField.label).toBe('Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)');
  });

  it('bevarer fallback-loftet, når EET-beregningsdato mangler', () => {
    const input = settle(empty(), faellesAarsloenAslAarsloenField.bind(), '9999000');
    const read = evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind());

    expect(read).toMatchObject({ status: 'usable', value: { kind: 'number', value: 9999000 } });
  });

  it('viser maksimumssatsen for skadesåret, ikke EET-beregningsåret', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = dispatch(input, resetSection('stamdata', { skadedato: toISODateString('2024-01-01') }));
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '9999999');

    const read = evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind());

    // BB-125: skadesårsloftet er ikke længere en bounds-grænse. Det ejes alene af domænereglen
    // `validateAslAarsloenBySkadesaarMax`, så overskridelsen kommer nu som `reason: 'rule'` med
    // regelens egen besked – og uden `detail.maxValue`, som kun en bounds-grænse bærer.
    // Bounds er reduceret til det faste repræsentationsloft 1.000–9.999.999.
    expect(read).toMatchObject({
      status: 'error',
      issue: {
        reason: 'rule',
        message: 'Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret (608.000 kr.)',
      },
    });
  });

  it('accepterer den kanoniske skadesårs-maksimumsværdi præcis på grænsen', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = dispatch(input, resetSection('stamdata', { skadedato: toISODateString('2024-01-01') }));
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '608000');

    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      status: 'usable',
      value: { kind: 'number', value: 608000 },
    });
  });

  it('afviser en beregningsårs-maksimumsværdi med samme skadesårsregel som feltets fejl-tooltip', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = dispatch(input, resetSection('stamdata', { skadedato: toISODateString('2024-01-01') }));
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '632000');

    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      status: 'error',
      issue: { message: 'Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret (608.000 kr.)' },
    });
  });

  it('falder kun tilbage til det generelle loft når skadedatoen mangler', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '31-02-2025');
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '9999000');
    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      status: 'usable',
      value: { kind: 'number', value: 9999000 },
    });
  });

  it('bruger fortsat skadesårets loft når EET-beregningsdatoen er ugyldig', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '31-02-2025');
    input = dispatch(input, resetSection('stamdata', { skadedato: toISODateString('2024-01-01') }));
    input = settle(input, faellesAarsloenAslAarsloenField.bind(), '9999000');
    expect(evaluate(input).reader.read(faellesAarsloenAslAarsloenField.bind())).toMatchObject({
      issue: { message: 'Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret (608.000 kr.)' },
    });
  });

  it('ændrer ikke EAL-årslønnens generelle loft', () => {
    let input = settle(empty(), erhvervsevnetabBeregningsdatoField.bind(), '01-01-2025');
    input = settle(input, faellesAarsloenEalAarsloenField.bind(), '999');

    // Her rammes MINIMUM (999), som stadig er en bounds-grænse – kun formateringen er ny (BB-125):
    // grænserne vises dansk med tusindtalsseparator og feltets enhed.
    expect(evaluate(input).reader.read(faellesAarsloenEalAarsloenField.bind())).toMatchObject({
      status: 'error',
      issue: { message: 'Værdi skal være mellem 1.000 kr. og 9.999.999 kr.' },
    });
  });
});
