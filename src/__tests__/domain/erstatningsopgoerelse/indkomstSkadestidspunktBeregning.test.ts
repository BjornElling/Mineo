import { moneyOre } from '../../../domain/money/money';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildIndkomstSkadestidspunkt } from '../../../domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const buildMonthlyIncomeRow = (id: string, amount: number) => ({
  id,
  col0_maaned: '1',
  col1_maaned: '2024',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: asAmount(amount),
  col3: undefined,
  col4: undefined,
  col5: undefined,
});

const buildEmployment = (
  patch: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]> = {}
): ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  navnPaaArbejdssted: 'Arbejdsgiver A',
  loenudviklingBeregningsgrundlag: 'Ingen',
  ...patch,
});

describe('buildIndkomstSkadestidspunkt', () => {
  it('projekterer direkte månedsløn og dagsløn samt deres manglende input', () => {
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') };
    const maanedsloen = createErstatningsopgoerelseInitialValues();
    maanedsloen.beregnesUdFra = 'Angivet månedsløn';
    maanedsloen.maanedsloenenUdgoer = asAmount(30_000);
    const maanedsloenModel = buildIndkomstSkadestidspunkt(
      maanedsloen,
      stamdata,
      TAF_BEREGNES_SOM.MAANEDER
    );

    expect(maanedsloenModel).toMatchObject({
      beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      beregnesUdFra: 'Angivet månedsløn',
      skadedato: iso('2024-01-01'),
      maanedsloen: { status: 'ok', value: moneyOre(3_000_000) },
      dagsloen: { status: 'not_calculable', reason: 'Ikke angivet' },
    });

    maanedsloen.maanedsloenenUdgoer = undefined;
    expect(buildIndkomstSkadestidspunkt(maanedsloen, stamdata, TAF_BEREGNES_SOM.MAANEDER)?.maanedsloen).toEqual({
      status: 'not_calculable',
      reason: 'Månedsløn mangler',
    });

    const dagsloen = createErstatningsopgoerelseInitialValues();
    dagsloen.beregnesUdFra = 'Angivet dagsløn';
    dagsloen.dagsloenenUdgoer = asAmount(1_500);
    expect(buildIndkomstSkadestidspunkt(dagsloen, STAMDATA_INITIAL_VALUES, TAF_BEREGNES_SOM.ARBEJDSDAGE)).toMatchObject({
      skadedato: null,
      beregnesUdFra: 'Angivet dagsløn',
      maanedsloen: { status: 'not_calculable', reason: 'Ikke angivet' },
      dagsloen: { status: 'ok', value: moneyOre(150_000) },
    });

    dagsloen.dagsloenenUdgoer = undefined;
    expect(buildIndkomstSkadestidspunkt(dagsloen, STAMDATA_INITIAL_VALUES, TAF_BEREGNES_SOM.ARBEJDSDAGE)?.dagsloen).toEqual({
      status: 'not_calculable',
      reason: 'Dagsløn mangler',
    });
  });

  it('bygger beregningsgrundlag med arbejdssted, offentlige ydelser og mellemregning', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.oevrigtFravaerUdenLoen = 'Ja';
    values.oevrigeFravaersdage = 1;
    values.oevrigeFravaersdageBeskrivelse = 'lægebesøg';
    values.loenindkomstAnsaettelsesforhold = [buildEmployment({
      feriePct: 12.5,
      fritvalgPct: 2,
      shSoPct: 1,
      pensionPct: 4,
      indtaegtsoplysningerTableData: [buildMonthlyIncomeRow('loen-1', 30_000)],
    })];
    values.offentligeYdelserRows = [{
      id: 'dagpenge-1',
      fraDato: iso('2024-01-01'),
      tilDato: iso('2024-01-31'),
      ydelse: asAmount(1_000),
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];

    const range = { fra: iso('2024-01-01'), til: iso('2024-01-31') } as const;
    const model = buildIndkomstSkadestidspunkt(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      { incomeForBeregningsperiode: buildIncomeForRanges(values, [range]) }
    );

    expect(model).not.toBeNull();
    if (!model) return;
    expect(model.periodeTilBeregning).toEqual(range);
    expect(model.beregningsperiodeLabel).toBe('Opgøres på baggrund af indkomsten i perioden 01-01-2024 - 31-01-2024.');
    expect(model.arbejdssteder).toHaveLength(1);
    expect(model.arbejdssteder[0]).toMatchObject({
      navn: 'Arbejdsgiver A',
      fpLabel: 'Feriegodtgørelse/-tillæg (12,5 %) + Fritvalg (2 %) + S/H (1 %) + Store Bededag (0,45 %)',
      pensionLabel: 'Arbejdsgivers pensionsbidrag (4 % af løn + tillæg)',
    });
    expect(model.offentligeYdelser).toEqual([{ label: 'Dagpenge', amountOre: moneyOre(100_000) }]);
    expect(model.offentligeYdelserTotalOre).toBe(moneyOre(100_000));
    expect(model.totalBreakdown?.samletOre).toBeGreaterThan(0);
    expect(model.samletBeregningsgrundlagOre).toBeGreaterThan(0);
    expect(model.maaneder).toBe(0.952);
    expect(model.maanedsloen.status).toBe('ok');
    expect(model.beregningsgrundlagMellemregningLabel).toContain('1 fraværsdag pga. lægebesøg uden løn');
    expect(model.beregningsgrundlagMellemregningResultat).toBe('0,952 måneder');
  });

  it('bygger arbejdsdagsmellemregning med løse feriedage og øvrigt fravær', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-02');
    values.tafBeregningsperiodeTil = iso('2024-01-05');
    values.oevrigtFravaerUdenLoen = 'Ja';
    values.oevrigeFravaersdage = 1;
    values.uspecificeredeFerieFridage = 1;

    const model = buildIndkomstSkadestidspunkt(
      values,
      STAMDATA_INITIAL_VALUES,
      TAF_BEREGNES_SOM.ARBEJDSDAGE,
      { incomeForBeregningsperiode: { employers: [], benefits: [] } }
    );

    expect(model).not.toBeNull();
    if (!model) return;
    expect(model.arbejdsdage).toBe(2);
    expect(model.beregningsgrundlagMellemregningLabel).toBe(
      'I perioden var der 4 hverdage - 1 ferie-/feriefridag - 1 øvrig fraværsdag ='
    );
    expect(model.beregningsgrundlagMellemregningResultat).toBe('2 arbejdsdage');
    expect(model.maaneder).toBeCloseTo(0.08103225806451612, 12);
  });

  it('bruger seneste manuelle satser ved beregningsperiodens reguleringsdato', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [buildEmployment({
      tillaegAngivesSom: 'procent',
      feriePct: 1,
      fritvalgPct: 1,
      shSoPct: 1,
      pensionPct: 1,
      saerligFraDatoRegulering: iso('2023-12-31'),
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        {
          id: 'manuel-base',
          dato: iso('2023-12-30'),
          grundloen: asAmount(30_000),
          feriepenge: 10,
          fritvalg: 1,
          shSoSats: 1,
          agPension: 1,
        },
        {
          id: 'manuel-aktuel',
          dato: iso('2023-12-31'),
          grundloen: asAmount(30_000),
          feriepenge: 20,
          fritvalg: 2,
          shSoSats: 3,
          agPension: 4,
        },
      ],
      indtaegtsoplysningerTableData: [buildMonthlyIncomeRow('loen-manuel', 30_000)],
    })];

    const range = { fra: iso('2024-01-01'), til: iso('2024-01-31') } as const;
    const model = buildIndkomstSkadestidspunkt(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      { incomeForBeregningsperiode: buildIncomeForRanges(values, [range]) }
    );

    expect(model?.arbejdssteder[0]).toMatchObject({
      fpLabel: 'Feriegodtgørelse/-tillæg (20 %) + Fritvalg (2 %) + S/H (3 %)',
      pensionLabel: 'Arbejdsgivers pensionsbidrag (4 % af løn + tillæg)',
    });
  });

  it('sorterer flere manuelle satser før reguleringsdatoen og vælger den seneste', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [buildEmployment({
      tillaegAngivesSom: 'procent',
      feriePct: 1,
      fritvalgPct: 1,
      shSoPct: 1,
      pensionPct: 1,
      saerligFraDatoRegulering: iso('2023-12-31'),
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        {
          id: 'manuel-base',
          dato: undefined,
          grundloen: asAmount(30_000),
          feriepenge: 10,
          fritvalg: 1,
          shSoSats: 1,
          agPension: 1,
        },
        {
          id: 'manuel-senere',
          dato: iso('2023-12-31'),
          grundloen: asAmount(30_000),
          feriepenge: 20,
          fritvalg: 2,
          shSoSats: 3,
          agPension: 4,
        },
        {
          id: 'manuel-tidligere',
          dato: iso('2023-12-29'),
          grundloen: asAmount(30_000),
          feriepenge: 11,
          fritvalg: 1,
          shSoSats: 2,
          agPension: 2,
        },
      ],
      indtaegtsoplysningerTableData: [buildMonthlyIncomeRow('loen-sorteret', 30_000)],
    })];

    const range = { fra: iso('2024-01-01'), til: iso('2024-01-31') } as const;
    const model = buildIndkomstSkadestidspunkt(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      { incomeForBeregningsperiode: buildIncomeForRanges(values, [range]) }
    );

    expect(model?.arbejdssteder[0]).toMatchObject({
      fpLabel: 'Feriegodtgørelse/-tillæg (20 %) + Fritvalg (2 %) + S/H (3 %)',
      pensionLabel: 'Arbejdsgivers pensionsbidrag (4 % af løn + tillæg)',
    });
  });

  it('beregner dagsløn fra et arbejdsdagsbaseret beregningsgrundlag', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-02');
    values.tafBeregningsperiodeTil = iso('2024-01-05');
    values.loenindkomstAnsaettelsesforhold = [buildEmployment({
      indtaegtsoplysningerTableData: [buildMonthlyIncomeRow('loen-dagsloen', 30_000)],
    })];

    const range = { fra: iso('2024-01-02'), til: iso('2024-01-05') } as const;
    const model = buildIndkomstSkadestidspunkt(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.ARBEJDSDAGE,
      { incomeForBeregningsperiode: buildIncomeForRanges(values, [range]) }
    );

    expect(model?.arbejdsdage).toBe(4);
    expect(model?.dagsloen).toMatchObject({ status: 'ok', value: moneyOre(97_210) });
  });
});
