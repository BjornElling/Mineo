import {
  omitDerivedLoenindkomstSatser,
  projectLoenindkomstSatser,
} from '../../../domain/erstatningsopgoerelse/loenindkomstSatsProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  erstatningsopgoerelseSchema,
  persistedErstatningsopgoerelseSchema,
  type ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const createValues = (
  employment: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]>
): ErstatningsopgoerelseValues => erstatningsopgoerelseSchema.parse({
  tafBeregningsperiodeTil: toISODateString('2024-06-30'),
  loenindkomstAnsaettelsesforhold: [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    storeBededagPct: 0,
    id: 'af-1',
    harOverenskomst: true,
    overenskomstId: 'bygge-anlaeg',
    loenPaaHelligdage: 'Almindelig løn',
    ...employment,
  }],
});

describe('projectLoenindkomstSatser', () => {
  it('udleder låste satser uden at mutere det persisterede input', () => {
    const input = createValues({ fritvalgPct: 3.5, storeBededagPct: 9.9 });

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(input.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(3.5);
    expect(input.loenindkomstAnsaettelsesforhold[0]?.storeBededagPct).toBe(9.9);
    expect(projected.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(0);
    expect(projected.loenindkomstAnsaettelsesforhold[0]?.storeBededagPct).toBeGreaterThan(0);
  });

  it('bevarer brugerens sats, når den ikke er låst', () => {
    const input = createValues({ harOverenskomst: false, fritvalgPct: 3.5 });

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(projected.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(3.5);
  });

  it('udelader låste satser fra persistence men bevarer en redigerbar sats', () => {
    const locked = createValues({ fritvalgPct: 3.5, storeBededagPct: 9.9 });
    const unlocked = createValues({ harOverenskomst: false, fritvalgPct: 3.5 });

    const lockedSave = omitDerivedLoenindkomstSatser(locked, {
      skadedato: toISODateString('2024-06-01'),
    });
    const unlockedSave = omitDerivedLoenindkomstSatser(unlocked, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(lockedSave.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBeUndefined();
    expect(unlockedSave.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(3.5);
  });

  it('accepterer men fjerner et historisk Store Bededag-slot inbound', () => {
    const parsed = persistedErstatningsopgoerelseSchema.parse(createValues({ storeBededagPct: 9.9 }));
    expect(Object.hasOwn(parsed.loenindkomstAnsaettelsesforhold[0] ?? {}, 'storeBededagPct')).toBe(false);
  });
});
