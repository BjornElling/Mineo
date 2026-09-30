import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildSvieSmerteContext,
  buildTaftContext,
} from '../../../domain/erstatningsopgoerelse/validation/eoPeriodeBlockingContext';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const makeEo = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  ...patch,
});

const makeStamdata = (patch: Partial<StamdataValues> = {}): StamdataValues => ({
  ...STAMDATA_INITIAL_VALUES,
  ...patch,
});

describe('eoPeriodeBlockingContext', () => {
  it('bygger svie/smerte-kontekst uden aktiv ménafgørelse', () => {
    expect(buildSvieSmerteContext(
      makeStamdata({ skadedato: iso('2024-01-01'), skadestype: 'Arbejdsulykke' }),
      makeEo(),
    )).toEqual({
      skadedatoISO: iso('2024-01-01'),
      erErhvervssygdom: false,
      menAfgoerelseDatoForTabel: undefined,
      menAfgoerelseDato: undefined,
      verserendeKlageMen: false,
    });
  });

  it('bygger svie/smerte-kontekst med erhvervssygdom og dagen før endelig ménafgørelse', () => {
    expect(buildSvieSmerteContext(
      makeStamdata({ skadestype: 'Erhvervssygdom' }),
      makeEo({
        varigeMenAfgorelse: 'Ja',
        verserendeKlageMen: 'Nej',
        menAfgoerelseDato: iso('2024-05-20'),
      }),
    )).toMatchObject({
      erErhvervssygdom: true,
      menAfgoerelseDatoForTabel: iso('2024-05-19'),
      menAfgoerelseDato: iso('2024-05-20'),
      verserendeKlageMen: false,
    });
  });

  it('suspenderer svie/smerte-cutoff ved verserende klage', () => {
    expect(buildSvieSmerteContext(
      makeStamdata(),
      makeEo({
        varigeMenAfgorelse: 'Ja',
        verserendeKlageMen: 'Ja',
        menAfgoerelseDato: iso('2024-05-20'),
      }),
    )).toMatchObject({
      menAfgoerelseDatoForTabel: undefined,
      menAfgoerelseDato: undefined,
      verserendeKlageMen: true,
    });
  });

  it('bygger TAF-kontekst med endelig EET-virkningsdato og differencekrav', () => {
    expect(buildTaftContext(
      makeStamdata(),
      makeEo({
        endeligtEETAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2024-06-10'),
        endeligEETAfgoerelseDato: iso('2024-07-01'),
        differencekravDato: iso('2024-08-01'),
        verserendeKlageEet: 'Nej',
      }),
    )).toMatchObject({
      endeligEETBeregnetDato: iso('2024-06-10'),
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: iso('2024-08-01'),
      verserendeKlageEet: false,
    });
  });

  it('bruger endelig afgørelsesdato som fallback og fastholder relevant EET-klage', () => {
    expect(buildTaftContext(
      makeStamdata(),
      makeEo({
        endeligtEETAfgorelse: 'Ja',
        endeligEETVirkningsdato: undefined,
        endeligEETAfgoerelseDato: iso('2024-07-01'),
        verserendeKlageEet: 'Ja',
      }),
    )).toMatchObject({
      endeligEETBeregnetDato: iso('2024-07-01'),
      verserendeKlageEet: true,
    });
  });

  it('bruger midlertidig EET-dato før 2011-skæringen og ignorerer skjult klage', () => {
    expect(buildTaftContext(
      makeStamdata({ skadedato: iso('2010-01-01') }),
      makeEo({
        midlertidigtEETAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: undefined,
        midlertidigEETAfgoerelseDato: iso('2010-06-01'),
        verserendeKlageEet: 'Ja',
      }),
    )).toMatchObject({
      midlertidigEETBeregnetDato: iso('2010-06-01'),
      verserendeKlageEet: true,
    });
  });

  it('sætter ikke klageflag uden en truffet EET-afgørelse', () => {
    expect(buildTaftContext(
      makeStamdata(),
      makeEo({ verserendeKlageEet: 'Ja' }),
    ).verserendeKlageEet).toBe(false);
  });
});
