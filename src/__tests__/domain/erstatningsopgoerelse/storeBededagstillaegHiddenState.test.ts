import { manuelForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/manuelForm';
import { overenskomstForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstForm';
import type { FormKonsoliderContext } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveStoreBededagstillaegPct } from '../../../domain/erstatningsopgoerelse/helpers/storeBededagstillaeg';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const contextFor = (
  active: ReturnType<typeof createDefaultLoenindkomstAnsaettelsesforhold>[]
): FormKonsoliderContext => ({
  active,
  angivetLoen: false,
  anvendtReguleringsdato: undefined,
  tafRanges: [],
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
});

describe('Store Bededag-togglens skjulte tilstand i lønudviklingsformer', () => {
  it.each(['SH-udbetaling', 'Ingen'] as const)('giver ingen sats ved skjult helligdagsvalg – også når togglen er aktiv (%s)', (loenPaaHelligdage) => {
    expect(resolveStoreBededagstillaegPct(toISODateString('2024-01-01'), {
      loenPaaHelligdage,
      beregnStoreBededagstillaeg: true,
    })).toBe(0);
  });

  it('ignorerer forskellig toggle-værdi, når alle manuelle rækker er skjulte', () => {
    const base = createDefaultLoenindkomstAnsaettelsesforhold();
    const active = [
      {
        ...base,
        id: 'af-1',
        loenPaaHelligdage: 'SH-udbetaling' as const,
        beregnStoreBededagstillaeg: true,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      },
      {
        ...base,
        id: 'af-2',
        loenPaaHelligdage: 'SH-udbetaling' as const,
        beregnStoreBededagstillaeg: false,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      },
    ];

    expect(() => manuelForm.konsolider(contextFor(active))).not.toThrow();
  });

  it('ignorerer forskellig toggle-værdi, når alle overenskomstrækker er skjulte', () => {
    const base = createDefaultLoenindkomstAnsaettelsesforhold();
    const active = [
      {
        ...base,
        id: 'af-1',
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Ingen' as const,
        beregnStoreBededagstillaeg: true,
        loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
      },
      {
        ...base,
        id: 'af-2',
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Ingen' as const,
        beregnStoreBededagstillaeg: false,
        loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
      },
    ];

    expect(() => overenskomstForm.konsolider(contextFor(active))).not.toThrow();
  });

  it('fastholder uniformitetskontrollen, når togglen er synlig', () => {
    const base = createDefaultLoenindkomstAnsaettelsesforhold();
    const active = [
      {
        ...base,
        id: 'af-1',
        loenPaaHelligdage: 'Almindelig løn' as const,
        beregnStoreBededagstillaeg: true,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      },
      {
        ...base,
        id: 'af-2',
        loenPaaHelligdage: 'Almindelig løn' as const,
        beregnStoreBededagstillaeg: false,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      },
    ];

    expect(() => manuelForm.konsolider(contextFor(active))).toThrow('Store Bededagstillæg');
  });
});
