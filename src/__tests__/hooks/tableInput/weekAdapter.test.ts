import { createWeekTableInputAdapter } from '../../../hooks/tableInput/adapters/weekAdapter';
import { createStringBackedFieldCodec, createWeekFieldCodec } from '../../../input/fieldCodecs';

describe('createWeekTableInputAdapter', () => {
  const config = {
    minYear: 2000,
    maxYear: 2030,
    twoDigitYearPolicy: 'infer' as const,
  };
  const codec = createStringBackedFieldCodec(createWeekFieldCodec({
    ...config,
    maxDraftLength: 8,
  }));
  const adapter = createWeekTableInputAdapter(config);

  it.each(['3/24', ' 03.2024 ', '', '0', '53/2023', 'uge'])(
    'bruger ugecodecets canonical resolution for %j',
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

  it('afviser årsintervallet i både codec og den midlertidige adapter', () => {
    expect(codec.parseForSettle('52/1999')).toEqual({ status: 'invalid' });
    expect(adapter.parse('52/1999')).toEqual({
      ok: false,
      errorMessage: 'Årstallet skal være mellem 2000 og 2030',
    });
  });
});
