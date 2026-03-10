import { describe, expect, it } from 'vitest';
import { buildReguleringsvaerdierTableData, buildReguleringIndexRows } from '../../../domain/erstatningsopgoerelse/eoPdfReguleringEngine';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold.map((af) => ({
    ...af,
    indtaegtsoplysningerTableData: [...af.indtaegtsoplysningerTableData],
    loenudviklingManuelTableData: [...af.loenudviklingManuelTableData],
  })),
});

describe('eoPdfReguleringEngine', () => {
  it('starter reguleringsværdier-tabellen ved første tilgængelige overenskomstdato ved manglende tidlig dækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      reguleringsdato: iso('2020-01-01'),
      tafFra: iso('2020-04-01'),
      tafTil: iso('2026-02-26'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.length).toBeGreaterThan(0);
    // 01-03-2024 er første satsdato i laasesmedeoverenskomsten i testdata.
    // Hvis datagrundlaget ændres historisk, skal denne forventning opdateres.
    expect(table?.rows[0]?.[0]).toBe('01-03-2024');
  });

  it('bygger reguleringsindeks-rækker selv når segmenter starter før første overenskomstdækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2020-04-01'),
          til: iso('2024-02-29'),
          maaneder: 47,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
        {
          kind: 'maaneder',
          fra: iso('2024-03-01'),
          til: iso('2024-03-31'),
          maaneder: 1,
          maanedsloenOre: 100000,
          deltaPct: 10,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      reguleringsdato: iso('2020-01-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.fraDato).toBe('01-04-2020');
    expect(rows[0]?.indeks).toBe('100,00');
  });

  it('indsætter Store Bededag som separat række 01-01-2024 i offentlig reguleringsværdier-tabel', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'kl-overenskomst';
    af.offentligLoenType = 'Timeløn';
    af.offentligLoenTrin = 20;
    af.offentligLoenGruppe = 0;
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 16.95;
    af.pensionPct = 14.37;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      reguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2025-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toEqual(['Fra-dato', 'Månedsløn', 'Feriepenge', 'AG pens. bidrag']);
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(true);
  });

  it('bruger samme første tabelkolonner som eodebug for manuel arbejdsdagsbaseret regulering', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        dato: '26-01-2024',
        grundloen: '177,56',
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '14,37',
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      reguleringsdato: iso('2024-01-26'),
      tafFra: iso('2024-01-26'),
      tafTil: iso('2024-10-20'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toEqual(['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'AG pens. bidrag']);
  });
});
