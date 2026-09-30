import {
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  resolveValgtReguleringDisplay,
  resolveValgtReguleringDisplayForPdf,
} from '../../../domain/erstatningsopgoerelse/helpers/loenudviklingDisplay';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type DisplayPatch = Omit<
  Partial<Ansaettelsesforhold>,
  'loenudviklingStatistikModel' | 'loenudviklingManuelNavn'
> & {
  loenudviklingStatistikModel?: string;
  loenudviklingManuelNavn?: string;
};

const createEmployment = (patch: DisplayPatch = {}): Ansaettelsesforhold => {
  // Displayhelperen er typed mod schema-input, men facitterne afprøver også dens defensive trim/fallback på rå runtime-tekst.
  return {
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    ...patch,
  } as Ansaettelsesforhold;
};

describe('resolveValgtReguleringDisplay', () => {
  it.each([
    ['manglende grundlag', { loenudviklingBeregningsgrundlag: undefined }, '-'],
    ['statistik uden model', { loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: '   ' }, '-'],
    ['statistik med model', { loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: '  Kommuner  ' }, 'Kommuner'],
    ['overenskomst', { loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg' }, 'Bygge-/anlægsoverenskomsten (3F / Dansk Industri)'],
    ['manuel regulering med navn', { loenudviklingBeregningsgrundlag: 'Manuelt angivet', loenudviklingManuelNavn: '  DA-tillægstrin  ' }, 'Manuelt angivet (DA-tillægstrin)'],
    ['manuel regulering uden navn', { loenudviklingBeregningsgrundlag: 'Manuelt angivet', loenudviklingManuelNavn: '   ' }, 'Manuelt angivet'],
    ['manuel regulering med manglende navnefelt', { loenudviklingBeregningsgrundlag: 'Manuelt angivet', loenudviklingManuelNavn: undefined }, 'Manuelt angivet'],
    ['manuel procentsats', { loenudviklingBeregningsgrundlag: 'Manuel procentsats' }, 'Manuel procentsats'],
    ['KRL uden tabel', { loenudviklingBeregningsgrundlag: 'KRL satstabel', loenudviklingKRLSatstabel: undefined }, '-'],
    ['KRL med tabel', { loenudviklingBeregningsgrundlag: 'KRL satstabel', loenudviklingKRLSatstabel: 'KTO (kommuner)' }, 'KRL-satstabel (KTO, kommuner)'],
    ['KL-lønaftaler', { loenudviklingBeregningsgrundlag: 'KL-lønaftaler' }, 'KL-lønaftaler'],
    ['Ingen', { loenudviklingBeregningsgrundlag: 'Ingen' }, 'Ingen'],
  ] as const)('viser %s korrekt', (_name, patch, expected) => {
    expect(resolveValgtReguleringDisplay(createEmployment(patch))).toBe(expected);
  });
});

describe('resolveValgtReguleringDisplayForPdf', () => {
  it('viser kun det brugerdefinerede navn for manuel regulering', () => {
    expect(resolveValgtReguleringDisplayForPdf(createEmployment({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelNavn: '  DA-tillægstrin  ',
    }))).toBe('DA-tillægstrin');
  });

  it('falder tilbage til den generiske tekst uden manuelt navn', () => {
    expect(resolveValgtReguleringDisplayForPdf(createEmployment({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelNavn: '   ',
    }))).toBe('Manuelt angivet');
  });

  it('falder også tilbage når det manuelle navnefelt mangler', () => {
    expect(resolveValgtReguleringDisplayForPdf(createEmployment({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelNavn: undefined,
    }))).toBe('Manuelt angivet');
  });

  it('bruger den almindelige displayresolver for andre grundlag', () => {
    expect(resolveValgtReguleringDisplayForPdf(createEmployment({
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
    }))).toBe('KL-lønaftaler');
  });
});
