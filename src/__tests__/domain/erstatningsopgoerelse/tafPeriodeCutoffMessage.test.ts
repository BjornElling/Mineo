import { buildTafPeriodeCutoffErrorMessage } from '../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { evaluateTafPerioder } from '../../../domain/erstatningsopgoerelse/validation/tafPeriodeValidation';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

// BB-244: periodens linje i «Fejl og advarsler» nævner hver afskæring én gang.
describe('buildTafPeriodeCutoffErrorMessage', () => {
  it('siger «hele perioden», når også fra-datoen ligger efter afskæringen', () => {
    expect(buildTafPeriodeCutoffErrorMessage({
      fra: iso('2024-01-01'),
      til: iso('2024-12-31'),
      midlertidigEETDato: iso('2023-03-01'),
    })).toBe('Hele perioden ligger efter afgørelsen om midlertidigt erhvervsevnetab (01-03-2023)');
  });

  it('bruger til-cellens besked, når kun til-datoen ligger efter afskæringen', () => {
    expect(buildTafPeriodeCutoffErrorMessage({
      fra: iso('2024-01-01'),
      til: iso('2024-12-31'),
      differencekravDato: iso('2024-07-01'),
    })).toBe('Der er angivet tabt arbejdsfortjeneste efter den dato, differencekravet er opgjort pr. (01-07-2024)');
  });

  it('nævner flere afskæringer i datoorden, hver én gang', () => {
    expect(buildTafPeriodeCutoffErrorMessage({
      fra: iso('2024-04-01'),
      til: iso('2024-12-31'),
      endeligEETDato: iso('2024-03-01'),
      differencekravDato: iso('2024-07-01'),
    })).toBe(
      'Hele perioden ligger efter afgørelsen om endeligt erhvervsevnetab (01-03-2024); '
      + 'Der er angivet tabt arbejdsfortjeneste efter den dato, differencekravet er opgjort pr. (01-07-2024)'
    );
  });

  it('er tavs, når perioden slutter før alle afskæringer', () => {
    expect(buildTafPeriodeCutoffErrorMessage({
      fra: iso('2024-01-01'),
      til: iso('2024-06-30'),
      differencekravDato: iso('2024-07-01'),
    })).toBeUndefined();
  });
});

describe('evaluateTafPerioder', () => {
  it('gentager ikke afskæringsbeskeden, når hele perioden ligger efter afgørelsen', () => {
    const evaluation = evaluateTafPerioder(
      [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31') }],
      {
        skadedatoISO: iso('2010-06-01'),
        erErhvervssygdom: false,
        differencekravDato: undefined,
        endeligEETBeregnetDato: undefined,
        midlertidigEETBeregnetDato: iso('2023-03-01'),
        aktivMidlertidigEETBeregnetDato: iso('2023-03-01'),
        verserendeKlageEet: false,
      }
    ).get('taf-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Hele perioden ligger efter afgørelsen om midlertidigt erhvervsevnetab (01-03-2023)',
      field: 'fra',
    });
  });
});
