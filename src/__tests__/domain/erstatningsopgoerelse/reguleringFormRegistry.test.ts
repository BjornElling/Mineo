import {
  FORM_REGISTRY,
  byggReguleringsResultat,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringFormRegistry';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

describe('reguleringFormRegistry', () => {
  it('registrerer alle og kun de offentliggjorte reguleringsformer', () => {
    expect(Object.keys(FORM_REGISTRY).sort()).toEqual([
      'Ingen',
      'KL-lønaftaler',
      'KRL satstabel',
      'Manuel procentsats',
      'Manuelt angivet',
      'Overenskomst',
      'Statistik',
    ]);
    expect(Object.values(FORM_REGISTRY).map((form) => form.strategi).sort()).toEqual([
      'ingen',
      'klLoenaftaler',
      'krl',
      'manual',
      'manualProcentsats',
      'overenskomst',
      'statistik',
    ]);
  });

  it('dispatcher et konsolideret resultat gennem strategiens registrerede form', () => {
    const result = byggReguleringsResultat({
      strategi: 'manualProcentsats',
      label: 'Manuel procentsats',
      reguleringsdato: iso('2024-01-01'),
      manualProcentsatsRows: [{ id: 'base', dato: undefined, procent: 0 }],
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }],
    });

    expect(result.segmenter).toEqual([{
      fra: iso('2024-01-01'),
      til: iso('2024-12-31'),
      deltaPct: 0,
    }]);
    expect(result.forloeb?.kind).toBe('manuelProcentsats');
  });

  it('afviser en strategi der ikke findes i registeret', () => {
    expect(() => byggReguleringsResultat({ strategi: 'ukendt' } as never))
      .toThrow('Loenudvikling kan ikke beregnes: ukendt strategi');
  });
});
