/// <reference types="vitest/globals" />

import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const context = {
  skadedatoISO: iso('2023-01-01'),
  erErhvervssygdom: false,
  menAfgoerelseDatoForTabel: undefined,
  verserendeKlageMen: false,
} as const;

const getTidligereTotalRow = (
  patch: Partial<ErstatningsopgoerelseValues> = {},
  errors: Parameters<typeof buildEoSvieSmerteRows>[1] = {}
) => {
  const values = {
    ...createErstatningsopgoerelseInitialValues(),
    eoNummer: '2',
    kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
    tidligereSsMax: 'Nej' as const,
    ...patch,
  };

  return buildEoSvieSmerteRows(values, errors, context).find(
    (row) => row.id === 'sviesmerte.tidligereTotal'
  );
};

describe('buildEoSvieSmerteRows — tidligere svie-/smertebeløb', () => {
  it.each([
    ['tomt', undefined],
    ['nul', amount(0)],
  ])('viser advarslen ved anden opgørelse, når beløbet er %s', (_label, value) => {
    const row = getTidligereTotalRow({ svieSmerteTidligereTotal: value });

    expect(row).toMatchObject({
      status: 'warning',
      message: 'Der er ikke angivet et svie-/smertebeløb for tidligere erstatningsopgørelser',
      summaryDisplay: 'messageOnly',
    });
  });

  it('viser ikke advarslen, når beløbet er større end nul', () => {
    const row = getTidligereTotalRow({ svieSmerteTidligereTotal: amount(1) });

    expect(row).toMatchObject({ status: 'ok', displayValue: '1,00' });
    expect(row?.message).toBeUndefined();
  });

  it('opretter ikke rækken ved første erstatningsopgørelse', () => {
    const row = getTidligereTotalRow({ eoNummer: '1' });

    expect(row).toBeUndefined();
  });

  it('viser ikke advarslen, når beløbsfeltet er skjult efter tidligere maksimum', () => {
    const row = getTidligereTotalRow({ tidligereSsMax: 'Ja', svieSmerteTidligereTotal: undefined });

    expect(row?.status).toBe('ok');
    expect(row?.message).toBeUndefined();
  });

  it('lader en egentlig feltfejl have forrang for advarslen', () => {
    const row = getTidligereTotalRow(
      { svieSmerteTidligereTotal: undefined },
      {
        svieSmerteTidligereTotal: {
          input: { message: 'Beløbet er ugyldigt', severity: 'error', source: 'input', reason: 'format' },
        },
      }
    );

    expect(row).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Beløbet er ugyldigt)',
    });
    expect(row?.message).toBeUndefined();
  });
});

describe('collectAllEoRows — tidligere svie-/smertebeløb', () => {
  it('viser teksten og linker til det konkrete beløbsfelt', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      eoNummer: '2',
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmerteTidligereTotal: undefined,
    };

    const { warnings } = collectAllEoRows(STAMDATA_INITIAL_VALUES, {}, values, {});
    const warning = warnings.find((row) => row.id === 'sviesmerte.tidligereTotal');

    expect(warning).toMatchObject({
      summaryText: 'Der er ikke angivet et svie-/smertebeløb for tidligere erstatningsopgørelser',
      focusTarget: { kind: 'fieldPath', fieldPath: 'svieSmerteTidligereTotal' },
      navigation: {
        kind: 'erstatningsopgoerelse-tab',
        tabId: 'eo_oplysninger',
        sectionId: 'sviesmerte',
        sectionTitle: 'Svie- og smertegodtgørelse',
      },
    });
  });
});
