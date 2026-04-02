import {
  applyAnsaettelsesforholdToggleCleanup,
  sanitizeSfggRowForBeregningskilde,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

describe('LoenindkomstTab hidden state cleanup', () => {
  it('rydder overenskomstafhængige felter når harOverenskomst slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      overenskomstFilter: {
        loenmodtager: '3F',
        arbejdsgiver: 'DI',
      },
    };

    const result = applyAnsaettelsesforholdToggleCleanup(
      initial,
      'harOverenskomst',
      false,
      { loenmodtager: undefined, arbejdsgiver: undefined }
    );

    expect(result.harOverenskomst).toBe(false);
    expect(result.overenskomstId).toBeUndefined();
    expect(result.overenskomstFilter).toEqual({ loenmodtager: undefined, arbejdsgiver: undefined });
  });

  it('rydder ophørsfelter når ansatPåSkadestidspunktet slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      ansatPaaSkadestidspunktet: true,
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: '2024-02-15',
    };

    const result = applyAnsaettelsesforholdToggleCleanup(
      initial,
      'ansatPaaSkadestidspunktet',
      false,
      initial.overenskomstFilter
    );

    expect(result.ansatPaaSkadestidspunktet).toBe(false);
    expect(result.ansaettelsesforholdOphoert).toBe(false);
    expect(result.sidsteArbejdsdag).toBeUndefined();
  });

  it('rydder sidsteArbejdsdag når ansaettelsesforholdOphoert slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: '2024-02-15',
    };

    const result = applyAnsaettelsesforholdToggleCleanup(
      initial,
      'ansaettelsesforholdOphoert',
      false,
      initial.overenskomstFilter
    );

    expect(result.ansaettelsesforholdOphoert).toBe(false);
    expect(result.sidsteArbejdsdag).toBeUndefined();
  });

  it('rydder anciennitetstillægfelter når tillæg slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harAnciennitetstillaegEfterSkadesdatoen: true,
      anciennitetstillaegDato: '2024-02-15',
      anciennitetstillaegSatsAngivesPer: 'Time' as const,
      anciennitetstillaegSats: 150,
    };

    const result = applyAnsaettelsesforholdToggleCleanup(
      initial,
      'harAnciennitetstillaegEfterSkadesdatoen',
      false,
      initial.overenskomstFilter
    );

    expect(result.harAnciennitetstillaegEfterSkadesdatoen).toBe(false);
    expect(result.anciennitetstillaegDato).toBeUndefined();
    expect(result.anciennitetstillaegSatsAngivesPer).toBe('Måned');
    expect(result.anciennitetstillaegSats).toBeUndefined();
  });

  it('rydder skjulte SFGG-felter når beregningskilde skifter til manuelt angivet', () => {
    const result = sanitizeSfggRowForBeregningskilde(
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Overenskomst',
        sfggReferenceperiodeFra: '2024-01-01',
        sfggReferenceperiodeTil: '2024-01-31',
        sfggReferenceperiodeFravaersdageUdenLoen: 2,
        sfggManuelDagssats: { kind: 'number', value: 100 },
        sfggManuelBeloebIHenholdTil: 'Arbejdsdage',
        sfggManuelFoerstEfterSygeloen: 'Ja',
        sfggSatsvalg: 'Faglaert-Koebenhavn',
        sfggAlleredeBetaltBeloeb: { kind: 'number', value: 200 },
      },
      'Manuelt angivet',
      {
        showReferenceperiodeFields: false,
        showManualFields: true,
        showSatsvalgField: false,
      }
    );

    expect(result.sfggBeregningskilde).toBe('Manuelt angivet');
    expect(result.sfggReferenceperiodeFra).toBeUndefined();
    expect(result.sfggReferenceperiodeTil).toBeUndefined();
    expect(result.sfggReferenceperiodeFravaersdageUdenLoen).toBe(0);
    expect(result.sfggManuelDagssats).toEqual({ kind: 'number', value: 100 });
    expect(result.sfggManuelFoerstEfterSygeloen).toBe('Ja');
    expect(result.sfggSatsvalg).toBeUndefined();
    expect(result.sfggAlleredeBetaltBeloeb).toEqual({ kind: 'number', value: 200 });
  });
});
