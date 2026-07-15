import { createYearTableInputAdapter } from '../../../hooks/tableInput/adapters/yearAdapter';
import { createStringBackedFieldCodec, createYearFieldCodec } from '../../../input/fieldCodecs';

describe('createYearTableInputAdapter', () => {
  const config = {
    minYear: 2000,
    maxYear: 2030,
    twoDigitYearPolicy: 'infer' as const,
  };
  const codec = createStringBackedFieldCodec(createYearFieldCodec(config));
  const adapter = createYearTableInputAdapter(config);

  it.each(['2024', '24', ' 2024 ', '', '0', 'år'])(
    'bruger årscodecets canonical resolution for %j',
    (raw) => {
      const resolution = codec.parseForSettle(raw);
      const parsed = adapter.parse(raw);

      if (resolution.status === 'invalid') {
        expect(parsed.ok).toBe(false);
        return;
      }

      expect(parsed).toEqual({ ok: true, value: resolution.value ?? '' });
    }
  );

  it('bevarer den eksisterende commit-blokering for årsintervallet', () => {
    expect(codec.parseForSettle('1999')).toEqual({ status: 'valid', value: '1999' });
    expect(adapter.parse('1999')).toEqual({
      ok: false,
      errorMessage: 'Årstallet skal være mellem 2000 og 2030',
    });
  });
});
