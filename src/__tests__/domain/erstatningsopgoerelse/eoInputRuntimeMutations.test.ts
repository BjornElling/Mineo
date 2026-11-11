// @vitest-environment jsdom
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { persistedErstatningsopgoerelseSchema } from '../../../schemas/formSchemas';
import { runEoPage } from './helpers/eoRuntimePage';
import { amount, baseCase, iso, mutations } from './helpers/eoRuntimeMutationCase';

// SFGG-kombinationerne ligger i `eoInputRuntimeMutations.sfgg*.test.ts`, så de kører parallelt.
describe('EO-input – målrettede mutationer af en udfyldt TAF-sag', () => {
  it('har en schema-gyldig grundsag uden runtimefejl', () => {
    expect(runEoPage(baseCase())).toEqual([]);
  });

  it.each(mutations)('afviser eller beregner kontrolleret: %s', (_name, mutate) => {
    const input = baseCase();
    mutate(input);
    expect(persistedErstatningsopgoerelseSchema.safeParse(input.erstatningsopgoerelse).success).toBe(true);
    expect(runEoPage(input)).toEqual([]);
  });

  it.each([undefined, '2024-12-31'] as const)('tåler EET-import med beregningsdato %s og delvise afgørelser', (date) => {
    for (const complete of [false, true]) {
      const input = baseCase();
      input.erstatningsopgoerelse.midlertidigtEetFraEetSiden = 'Ja';
      expect(runEoPage({
        ...input,
        faellesAarsloen: { aslAarsloen: amount(400000), ealAarsloen: undefined },
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: date === undefined ? undefined : iso(date),
          aslAfgoerelser: [{
            id: 'afgoerelse', afgoerelsesDato: complete ? iso('2024-03-01') : undefined,
            virkningsDato: iso('2024-01-01'), eetPct: complete ? 50 : undefined,
            kapDato: undefined, kapPct: undefined, afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
          }],
        },
      })).toEqual([]);
    }
  });
});
