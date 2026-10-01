import {
  evaluateSvieSmertePerioder,
  type SvieSmertePeriodeBoundsContext,
} from '../../../domain/erstatningsopgoerelse/validation/svieSmertePeriodeValidation';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const context = (patch: Partial<SvieSmertePeriodeBoundsContext> = {}): SvieSmertePeriodeBoundsContext => ({
  skadedatoISO: iso('2020-01-01'),
  erErhvervssygdom: false,
  menAfgoerelseDatoForTabel: undefined,
  menAfgoerelseDato: undefined,
  verserendeKlageMen: false,
  ...patch,
});

const complete = (id: string, fra: ISODateString, til: ISODateString) => ({
  id,
  fra,
  til,
  tilstand: 'sygemeldt',
});

describe('evaluateSvieSmertePerioder – direkte rækkegrene', () => {
  it('springer en tom række over og samler manglende datoer for en tilstand alene', () => {
    const result = evaluateSvieSmertePerioder([
      { id: 'tom' },
      { id: 'kun-tilstand', tilstand: 'sygemeldt' },
      { id: 'kun-datoer', fra: iso('2024-01-01'), til: iso('2024-01-10') },
    ], context());

    expect(result.get('tom')).toEqual({ kind: 'skip' });
    expect(result.get('kun-tilstand')).toEqual({
      kind: 'error',
      message: 'Fra-dato og til-dato er ikke angivet',
      field: 'fra',
    });
    expect(result.get('kun-datoer')).toEqual({
      kind: 'error',
      message: 'Tilstand er ikke angivet',
      field: 'tilstand',
    });
  });

  it('accepterer en komplet række uden overlap, cutoff eller boundsfejl', () => {
    const result = evaluateSvieSmertePerioder([
      complete('gyldig', iso('2024-01-01'), iso('2024-01-10')),
    ], context());

    expect(result.get('gyldig')).toEqual({ kind: 'ok' });
  });

  it('giver en fælles overlapfejl uden feltforankring', () => {
    const result = evaluateSvieSmertePerioder([
      complete('første', iso('2024-01-01'), iso('2024-01-10')),
      complete('anden', iso('2024-01-05'), iso('2024-01-15')),
    ], context());

    expect(result.get('første')).toEqual({
      kind: 'error',
      message: 'Der er overlappende svie/smerte-perioder',
      field: undefined,
    });
    expect(result.get('anden')).toEqual({
      kind: 'error',
      message: 'Der er overlappende svie/smerte-perioder',
      field: undefined,
    });
  });

  it('forankrer både en nedre fra-boundsfejl og en øvre til-boundsfejl', () => {
    const forTidlig = evaluateSvieSmertePerioder([
      complete('for-tidlig', iso('2019-01-01'), iso('2024-01-10')),
    ], context()).get('for-tidlig');
    const forSen = evaluateSvieSmertePerioder([
      complete('for-sen', iso('2024-01-01'), iso('2099-01-01')),
    ], context()).get('for-sen');

    expect(forTidlig?.kind).toBe('error');
    if (forTidlig?.kind === 'error') expect(forTidlig.field).toBe('fra');
    expect(forSen?.kind).toBe('error');
    if (forSen?.kind === 'error') expect(forSen.field).toBe('til');
  });

  it('dækker manglende skadedato og klagesuspenderet ménafgørelses-cutoff', () => {
    const udenSkadedato = evaluateSvieSmertePerioder([
      { id: 'uden-skadedato', tilstand: 'sygemeldt' },
    ], context({ skadedatoISO: undefined }));
    const underKlage = evaluateSvieSmertePerioder([
      complete('under-klage', iso('2024-01-01'), iso('2024-01-10')),
    ], context({
      menAfgoerelseDatoForTabel: iso('2023-01-01'),
      menAfgoerelseDato: iso('2023-01-02'),
      verserendeKlageMen: true,
    }));

    expect(udenSkadedato.get('uden-skadedato')).toEqual({
      kind: 'error',
      message: 'Fra-dato og til-dato er ikke angivet',
      field: 'fra',
    });
    expect(underKlage.get('under-klage')).toEqual({ kind: 'ok' });
  });
});
