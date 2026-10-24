import {
  assessSvieSmertePerioder,
  evaluateSvieSmertePerioder,
  type SvieSmertePeriodeBoundsContext,
} from '../../../domain/erstatningsopgoerelse/validation/svieSmertePeriodeValidation';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import { eoSvieSmertePeriodeFraField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { buildTestFieldIssueSet } from '../../utils/fieldIssueTestSupport';
import { DATE_ORDER_ERROR_MESSAGE } from '../../../utils/dateOrderValidation';

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

describe('assessSvieSmertePerioder – fælles canonical vurdering', () => {
  it('samler tomhed, mangler, datoorden, cutoff og overlap i samme rækkefacit', () => {
    const result = assessSvieSmertePerioder([
      { id: 'tom' },
      { id: 'mangler', fra: iso('2024-01-01'), tilstand: 'sygemeldt' },
      complete('omvendt', iso('2024-01-10'), iso('2024-01-01')),
      complete('cutoff', iso('2024-01-01'), iso('2024-01-10')),
      complete('overlap-1', iso('2024-02-01'), iso('2024-02-05')),
      complete('overlap-2', iso('2024-02-05'), iso('2024-02-08')),
    ], {
      menAfgoerelseDato: iso('2024-01-10'),
      verserendeKlageMen: false,
    });

    expect(result.get('tom')?.kind).toBe('skip');
    expect(result.get('mangler')?.missingFields).toEqual(['til']);
    expect(result.get('omvendt')?.dateOrderError).toBe(true);
    expect(result.get('cutoff')?.tilCutoffError)
      .toBe('Der er angivet svie/smerte på eller efter datoen for en ménafgørelse (10-01-2024)');
    expect(result.get('overlap-1')?.hasOverlap).toBe(true);
    expect(result.get('overlap-2')?.hasOverlap).toBe(true);
  });
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

  it('viser cutoff-fejlen og linker til den røde dato, når rækken også mangler en dato', () => {
    const result = evaluateSvieSmertePerioder([
      { id: 'mangler-til', fra: iso('2024-01-10'), tilstand: 'sygemeldt' },
    ], context({ menAfgoerelseDato: iso('2024-01-10') }));

    expect(result.get('mangler-til')).toEqual({
      kind: 'error',
      message: 'Hele perioden ligger på eller efter datoen for ménafgørelsen (10-01-2024); Til-dato er ikke angivet',
      field: 'fra',
    });
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
      summaryDeduplicationGroup: 'sviesmerte-overlap',
    });
    expect(result.get('anden')).toEqual({
      kind: 'error',
      message: 'Der er overlappende svie/smerte-perioder',
      field: undefined,
      summaryDeduplicationGroup: 'sviesmerte-overlap',
    });
    expect(result.get('første')).toMatchObject({ summaryDeduplicationGroup: 'sviesmerte-overlap' });
  });

  it('bevarer en udfyldt grænsedato og viser samtidig overlap', () => {
    const fraIssue = buildTestFieldIssueSet(
      eoSvieSmertePeriodeFraField.bind('første'),
      'Datoen kan ikke være før skadedatoen (01-06-2018)',
      'bounds',
    ).get(serializeFieldAddress(eoSvieSmertePeriodeFraField.bind('første').address));
    const result = evaluateSvieSmertePerioder([
      complete('første', iso('2018-05-31'), iso('2018-06-01')),
      complete('anden', iso('2018-06-01'), iso('2018-06-02')),
    ], context({ skadedatoISO: iso('2018-06-01') }), (rowId) => rowId === 'første' ? { fra: fraIssue } : {});

    expect(result.get('første')).toMatchObject({
      kind: 'error',
      field: 'fra',
      message: 'Datoen kan ikke være før skadedatoen (01-06-2018); Der er overlappende svie/smerte-perioder',
    });
    expect(result.get('anden')).toMatchObject({
      kind: 'error',
      message: 'Der er overlappende svie/smerte-perioder',
      summaryDeduplicationGroup: 'sviesmerte-overlap',
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

  it('viser kun datoordrefejlen for en omvendt periode og lader den uden for overlap', () => {
    const result = evaluateSvieSmertePerioder([
      complete('omvendt', iso('2024-01-10'), iso('2024-01-05')),
      complete('gyldig', iso('2024-01-06'), iso('2024-01-09')),
    ], context());

    expect(result.get('omvendt')).toEqual({
      kind: 'error',
      message: DATE_ORDER_ERROR_MESSAGE,
      field: 'til',
    });
    expect(result.get('gyldig')).toEqual({ kind: 'ok' });
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
