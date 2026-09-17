import { toISODateString } from '../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { buildEoErstatningsopgoerelseRows } from '../../../domain/eoRowEvaluation/eoRowOverviewRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';

/**
 * Kravvalgene sættes eksplicit til «Ja», fordi nysagsdefaults kommer fra app-settings og dermed kunne
 * flytte sig uafhængigt af den regel, prøverne her måler. En sag, hvor der ER rejst krav, er samtidig
 * udgangspunktet for periode-prøverne, så «ingen krav rejst»-advarslen ikke støjer i dem.
 */
const rowsFor = (overrides: Partial<ErstatningsopgoerelseValues>): EoRowModel[] =>
  buildEoErstatningsopgoerelseRows(
    {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      kravPaaOevrigeErstatningskrav: 'Ja',
      ...overrides,
    },
    EMPTY_FIELD_ISSUE_SET
  );

const rowById = (overrides: Partial<ErstatningsopgoerelseValues>, id: string): EoRowModel | undefined =>
  rowsFor(overrides).find((row) => row.id === id);

const PERIODE_ID = 'erstatningsopgoerelse.vedroererPeriode';
const INGEN_KRAV_ID = 'erstatningsopgoerelse.ingenKravRejst';

describe('buildEoErstatningsopgoerelseRows – «Vedrører perioden» navngiver den manglende halvdel', () => {
  // Beskeden sagde før «'Vedrører perioden' er ikke angivet» om en periode, hvis fra-dato stod på
  // skærmen, og fokusmålet markerede netop den UDFYLDTE halvdel. Brugeren læste altså en besked, der
  // benægtede det, han kunne se, og fulgte et link til det felt, der var i orden.

  it('navngiver til-datoen og peger fokus på den, når kun fra-datoen er udfyldt', () => {
    expect(rowById({ vedroererPeriodeFra: toISODateString('2018-07-01'), vedroererPeriodeTil: undefined }, PERIODE_ID))
      .toMatchObject({
        displayValue: 'Fejl (Til-dato er ikke angivet)',
        status: 'error',
        focusFieldHint: 'til',
      });
  });

  it('navngiver fra-datoen og peger fokus på den, når kun til-datoen er udfyldt', () => {
    expect(rowById({ vedroererPeriodeFra: undefined, vedroererPeriodeTil: toISODateString('2018-12-31') }, PERIODE_ID))
      .toMatchObject({
        displayValue: 'Fejl (Fra-dato er ikke angivet)',
        status: 'error',
        focusFieldHint: 'fra',
      });
  });

  it('beholder den generiske tekst uden hint, når BEGGE halvdele er tomme', () => {
    const row = rowById({ vedroererPeriodeFra: undefined, vedroererPeriodeTil: undefined }, PERIODE_ID);
    expect(row).toMatchObject({ displayValue: '-', status: 'error' });
    expect(row?.focusFieldHint).toBeUndefined();
  });

  it('viser perioden uden hint, når begge halvdele er udfyldt', () => {
    const row = rowById(
      { vedroererPeriodeFra: toISODateString('2018-07-01'), vedroererPeriodeTil: toISODateString('2018-12-31') },
      PERIODE_ID
    );
    expect(row).toMatchObject({ displayValue: '01-07-2018 - 31-12-2018', status: 'ok' });
    expect(row?.focusFieldHint).toBeUndefined();
  });
});

describe('buildEoErstatningsopgoerelseRows – ingen krav rejst', () => {
  // Uden rækken forsvandt hele boksen «Fejl og advarsler», når alle tre kravvalg var fravalgt. Fraværet
  // af boksen er programmets måde at sige «alt er i orden» – her betød det «du har ikke rejst noget
  // krav», og de to så ens ud. Advarslen blokerer ikke: en bevidst nulopgørelse er et legitimt produkt.

  it('advarer, når alle tre kravvalg er fravalgt', () => {
    const row = rowById(
      {
        kravPaaSvieSmerteGodtgoerelse: 'Nej',
        kravPaaTabtArbejdsfortjeneste: 'Nej',
        kravPaaOevrigeErstatningskrav: 'Nej',
      },
      INGEN_KRAV_ID
    );
    expect(row).toMatchObject({ status: 'warning' });
    expect(row?.displayValue).toContain('0 kr.');
  });

  it('advarer også når kravene er skjult frem for fravalgt – heller ikke da rejses der et krav', () => {
    expect(rowById(
      {
        kravPaaSvieSmerteGodtgoerelse: 'Skjul',
        kravPaaTabtArbejdsfortjeneste: 'Skjul',
        kravPaaOevrigeErstatningskrav: 'Skjul',
      },
      INGEN_KRAV_ID
    )).toMatchObject({ status: 'warning' });
  });

  // Alle tre sættes eksplicit, så prøven måler reglen og ikke app-settings' valgte nysagsdefaults.
  it.each([
    ['svie/smerte', { kravPaaSvieSmerteGodtgoerelse: 'Ja', kravPaaTabtArbejdsfortjeneste: 'Nej', kravPaaOevrigeErstatningskrav: 'Nej' }],
    ['tabt arbejdsfortjeneste', { kravPaaSvieSmerteGodtgoerelse: 'Nej', kravPaaTabtArbejdsfortjeneste: 'Ja', kravPaaOevrigeErstatningskrav: 'Nej' }],
    ['øvrige erstatningskrav', { kravPaaSvieSmerteGodtgoerelse: 'Nej', kravPaaTabtArbejdsfortjeneste: 'Nej', kravPaaOevrigeErstatningskrav: 'Ja' }],
  ] as const)('udebliver, så snart ét krav er rejst (%s)', (_navn, overrides) => {
    expect(rowById(overrides, INGEN_KRAV_ID)).toBeUndefined();
  });
});
