import { textTableInputAdapter } from '../../../hooks/tableInput/adapters/textAdapter';
import { textFieldCodec } from '../../../input/fieldCodecs';

describe('textTableInputAdapter', () => {
  it.each(['Mineo', '  Mineo  ', '  flere ord\n  ', ''])(
    'bruger tekstcodecets canonical resolution for %j',
    (raw) => {
      const resolution = textFieldCodec.parseForSettle(raw);
      expect(resolution.status).toBe('valid');
      if (resolution.status === 'invalid') return;

      expect(textTableInputAdapter.parse(raw)).toEqual({
        ok: true,
        value: resolution.value,
      });
    }
  );
});
