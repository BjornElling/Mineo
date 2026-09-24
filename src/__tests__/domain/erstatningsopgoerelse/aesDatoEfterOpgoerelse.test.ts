import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { buildEoAesRows } from '../../../domain/eoRowEvaluation/eoRowOverviewRows';
import { resolveAesDatoEfterOpgoerelseMessage } from '../../../domain/erstatningsopgoerelse/validation/aesDatoEfterOpgoerelse';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const eoWith = (overrides: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  opgørelseLavetDen: iso('2025-02-01'),
  ...overrides,
});

describe('resolveAesDatoEfterOpgoerelseMessage', () => {
  it.each([
    ['menAfgoerelseDato', { varigeMenAfgorelse: 'Ja', menAfgoerelseDato: iso('2025-06-01') }],
    ['midlertidigEETAfgoerelseDato', { midlertidigtEETAfgorelse: 'Ja', midlertidigEETAfgoerelseDato: iso('2025-06-01') }],
    ['endeligEETAfgoerelseDato', { endeligtEETAfgorelse: 'Ja', endeligEETAfgoerelseDato: iso('2025-06-01') }],
  ] as const)('advarer, når %s ligger efter «Opgørelse lavet den»', (felt, overrides) => {
    expect(resolveAesDatoEfterOpgoerelseMessage(felt, eoWith(overrides)))
      .toBe('Afgørelsen er dateret efter opgørelsens dato (01-02-2025)');
  });

  it('navngiver differencekravet med den dato, det er opgjort pr.', () => {
    expect(resolveAesDatoEfterOpgoerelseMessage('differencekravDato', eoWith({ differencekravDato: iso('2025-06-01') })))
      .toBe('Differencekravet er opgjort pr. en dato efter opgørelsens dato (01-02-2025)');
  });

  it('er tavs på selve opgørelsens dato og før den', () => {
    expect(resolveAesDatoEfterOpgoerelseMessage('menAfgoerelseDato', eoWith({
      varigeMenAfgorelse: 'Ja',
      menAfgoerelseDato: iso('2025-02-01'),
    }))).toBeUndefined();
  });

  it('er tavs uden «Opgørelse lavet den»', () => {
    expect(resolveAesDatoEfterOpgoerelseMessage('differencekravDato', eoWith({
      opgørelseLavetDen: undefined,
      differencekravDato: iso('2025-06-01'),
    }))).toBeUndefined();
  });

  it('er tavs for et skjult felt (afgørelsen er Nej)', () => {
    expect(resolveAesDatoEfterOpgoerelseMessage('endeligEETAfgoerelseDato', eoWith({
      endeligtEETAfgorelse: 'Nej',
      endeligEETAfgoerelseDato: iso('2025-06-01'),
    }))).toBeUndefined();
  });
});

describe('buildEoAesRows', () => {
  it('giver en ikke-blokerende advarsel på en afgørelsesdato efter opgørelsens dato', () => {
    const rows = buildEoAesRows(eoWith({ varigeMenAfgorelse: 'Ja', menAfgoerelseDato: iso('2025-06-01') }), EMPTY_FIELD_ISSUE_SET);

    expect(rows.find((row) => row.id === 'aes.menAfgoerelseDato')).toEqual(expect.objectContaining({
      status: 'warning',
      displayValue: 'Advarsel (Afgørelsen er dateret efter opgørelsens dato (01-02-2025))',
    }));
    expect(rows.filter((row) => row.status === 'error')).toEqual([]);
  });

  it('advarer ikke om virkningsdatoer, som lovligt kan ligge frem i tid', () => {
    const rows = buildEoAesRows(eoWith({
      endeligtEETAfgorelse: 'Ja',
      endeligEETAfgoerelseDato: iso('2025-01-15'),
      endeligEETVirkningsdato: iso('2025-06-01'),
    }), EMPTY_FIELD_ISSUE_SET);

    expect(rows.filter((row) => row.status !== 'ok')).toEqual([]);
  });

  // BB-243: «Fejl og advarsler» navngiver feltet med skærmens egen tekst.
  it('bruger datofelternes synlige navne som rækkeetiketter', () => {
    const labels = Object.fromEntries(
      buildEoAesRows(eoWith({}), EMPTY_FIELD_ISSUE_SET).map((row) => [row.id, row.label])
    );

    expect(labels).toEqual(expect.objectContaining({
      'aes.menAfgoerelseDato': 'Dato for første ménafgørelse',
      'aes.midlertidigEETAfgoerelseDato': 'Dato for første midlertidige erhvervsevnetabsafgørelse',
      'aes.midlertidigEETVirkningsdato': 'Virkningsdato for den midlertidige afgørelse',
      'aes.endeligEETAfgoerelseDato': 'Dato for endelig erhvervsevnetabsafgørelse',
      'aes.endeligEETVirkningsdato': 'Virkningsdato for den endelige afgørelse',
      'aes.differencekravDato': 'Evt. differencekrav opgjort per',
    }));
  });
});
