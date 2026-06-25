import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { buildSvieSmerteContext, buildTaftContext } from '../../../domain/eoRowEvaluation/eoRowContextBuilders';
import {
  buildEoSvieSmerteRows,
  buildEoTaftRows,
} from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { toISODateString } from '../../../types/branded';
import { formatCurrency } from '../../../utils/formatUtils';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('eoDebug canonical parity', () => {
  it('læser sviesmerte.beregnetBeloeb fra canonical totals.svieSmerteOre', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = {
      ...initial,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tidligereSsMax: 'Nej' as const,
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' as const },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmerteTidligereTotal: amount(0),
      svieSmerteAktuelPeriode: amount(0),
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen' as const,
          indtaegtsoplysningerTableData: [],
        },
      ],
    };
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2024-01-01'),
    };
    const canonical = computeEoSnapshot({ revision: 'test', stamdataValues, eoValues: withSfggIngenForEmployments(eoValues) }).data!.canonicalOutput;

    const rows = buildEoSvieSmerteRows(
      eoValues,
      {},
      buildSvieSmerteContext(stamdataValues, eoValues),
      canonical
    );
    const row = rows.find((entry) => entry.id === 'sviesmerte.beregnetBeloeb');

    expect(row?.status).toBe('ok');
    expect(row?.displayValue).toBe(`${formatCurrency(canonical.totals.svieSmerteOre / 100)} kr.`);
  });

  it('læser taf.tidligereModtagetTaf fra canonical taf.tidligereModtagetTafOre', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: amount(30000),
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-03-31'), loseFeriedage: 0 },
      ],
      tidligereModtagetTaf: amount(12345.67),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen' as const,
          indtaegtsoplysningerTableData: [],
        },
      ],
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
      },
    };
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2024-01-01'),
    };
    const canonical = computeEoSnapshot({ revision: 'test', stamdataValues, eoValues: withSfggIngenForEmployments(eoValues) }).data!.canonicalOutput;

    const rows = buildEoTaftRows(
      eoValues,
      {},
      buildTaftContext(stamdataValues, eoValues),
      canonical
    );
    const row = rows.find((entry) => entry.id === 'taf.tidligereModtagetTaf');

    expect(row?.status).toBe('ok');
    expect(row?.displayValue).toBe(
      canonical.taf.tidligereModtagetTafOre !== null
        ? formatCurrency(canonical.taf.tidligereModtagetTafOre / 100)
        : formatCurrency(12345.67)
    );
  });

  it('viser ikke sviesmerte.beregnetBeloeb når canonical output mangler', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: iso('2019-04-01'),
      vedroererPeriodeTil: iso('2026-02-26'),
      tidligereSsMax: 'Nej' as const,
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2019-04-01'), til: iso('2026-02-26'), tilstand: 'sygemeldt' as const },
      ],
      svieSmerteSatserAar: 2020,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      svieSmerteTidligereTotal: amount(0),
      svieSmerteAktuelPeriode: amount(0),
    };
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: iso('2019-04-01'),
    };

    const rows = buildEoSvieSmerteRows(
      eoValues,
      {},
      buildSvieSmerteContext(stamdataValues, eoValues),
      undefined
    );
    const row = rows.find((entry) => entry.id === 'sviesmerte.beregnetBeloeb');

    expect(row?.status).toBe('ok');
    expect(row?.displayValue).toBe('-');
  });
});
