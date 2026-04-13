import {
  applyAnsaettelsesforholdToggleCleanup,
  applyLoenudviklingBeregningsgrundlagChange,
  applySfggBeregningskildeChange,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

describe('LoenindkomstTab hidden state cleanup', () => {
  it('bevarer overenskomstId og overenskomstFilter når harOverenskomst slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      overenskomstFilter: { loenmodtager: '3F', arbejdsgiver: 'DI' },
    };

    const result = applyAnsaettelsesforholdToggleCleanup(initial, 'harOverenskomst', false);

    expect(result.harOverenskomst).toBe(false);
    expect(result.overenskomstId).toBe('industriens-overenskomst');
    expect(result.overenskomstFilter).toEqual({ loenmodtager: '3F', arbejdsgiver: 'DI' });
  });

  it('bevarer ophørsfelter når ansatPaaSkadestidspunktet slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      ansatPaaSkadestidspunktet: true,
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: '2024-02-15',
    };

    const result = applyAnsaettelsesforholdToggleCleanup(initial, 'ansatPaaSkadestidspunktet', false);

    expect(result.ansatPaaSkadestidspunktet).toBe(false);
    expect(result.ansaettelsesforholdOphoert).toBe(true);
    expect(result.sidsteArbejdsdag).toBe('2024-02-15');
  });

  it('bevarer sidsteArbejdsdag når ansaettelsesforholdOphoert slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: '2024-02-15',
    };

    const result = applyAnsaettelsesforholdToggleCleanup(initial, 'ansaettelsesforholdOphoert', false);

    expect(result.ansaettelsesforholdOphoert).toBe(false);
    expect(result.sidsteArbejdsdag).toBe('2024-02-15');
  });

  it('bevarer anciennitetstillægfelter når tillæg slås fra', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: '2024-02-15',
      anciennitetstillaegSatsAngivesPer: 'Time' as const,
      anciennitetstillaegSats: { kind: 'number' as const, value: 150 },
    };

    const result = applyAnsaettelsesforholdToggleCleanup(initial, 'harAnciennitetstillaegEfterSkadedatoen', false);

    expect(result.harAnciennitetstillaegEfterSkadedatoen).toBe(false);
    expect(result.anciennitetstillaegDato).toBe('2024-02-15');
    expect(result.anciennitetstillaegSatsAngivesPer).toBe('Time');
    expect(result.anciennitetstillaegSats).toEqual({ kind: 'number', value: 150 });
  });

  it('bevarer skjulte lønudvikling-felter når beregningsgrundlag skifter', () => {
    const initial = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenudviklingBeregningsgrundlag: 'Statistik' as const,
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
      loenudviklingKRLSatstabel: 'KRL-2024' as never,
      loenudviklingManuelNavn: 'DA-tillægstrin',
      loenudviklingManuelTableData: [{ id: 'row-1', dato: '2024-01-01', grundloen: { kind: 'number' as const, value: 50000 }, feriepenge: '', shSoSats: '', fritvalg: '', agPension: '' }],
    };

    const result = applyLoenudviklingBeregningsgrundlagChange(initial, 'Manuelt angivet');

    expect(result.loenudviklingBeregningsgrundlag).toBe('Manuelt angivet');
    expect(result.loenudviklingStatistikModel).toBe('ILON12 (Danmarks Statistik)');
    expect(result.loenudviklingKRLSatstabel).toBe('KRL-2024');
    expect(result.loenudviklingManuelNavn).toBe('DA-tillægstrin');
    expect(result.loenudviklingManuelTableData).toHaveLength(1);
  });

  it('bevarer skjulte SFGG-felter når beregningskilde skifter til manuelt angivet', () => {
    const result = applySfggBeregningskildeChange(
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Overenskomst',
        sfggReferenceperiodeFra: '2024-01-01',
        sfggReferenceperiodeTil: '2024-01-31',
        sfggReferenceperiodeFravaersdageUdenLoen: 2,
        sfggManuelDagssats: { kind: 'number', value: 100 },
        sfggManuelBeloebIHenholdTil: 'Overenskomstens tabel 3.2', // fritekstfelt — ingen enum
        sfggManuelFoerstEfterSygeloen: 'Ja',
        sfggSatsvalg: 'Faglaert-Koebenhavn',
        sfggAlleredeBetaltBeloeb: { kind: 'number', value: 200 },
      },
      'Manuelt angivet'
    );

    expect(result.sfggBeregningskilde).toBe('Manuelt angivet');
    expect(result.sfggReferenceperiodeFra).toBe('2024-01-01');
    expect(result.sfggReferenceperiodeTil).toBe('2024-01-31');
    expect(result.sfggReferenceperiodeFravaersdageUdenLoen).toBe(2);
    expect(result.sfggManuelDagssats).toEqual({ kind: 'number', value: 100 });
    expect(result.sfggManuelBeloebIHenholdTil).toBe('Overenskomstens tabel 3.2');
    expect(result.sfggManuelFoerstEfterSygeloen).toBe('Ja');
    expect(result.sfggSatsvalg).toBe('Faglaert-Koebenhavn');
    expect(result.sfggAlleredeBetaltBeloeb).toEqual({ kind: 'number', value: 200 });
  });
});
