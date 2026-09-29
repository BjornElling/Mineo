/// <reference types="vitest/globals" />

import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { eoSvieSmerteTidligereTotalField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { buildTestFieldIssueSet } from '../../utils/fieldIssueTestSupport';

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
  errors: Parameters<typeof buildEoSvieSmerteRows>[1] = EMPTY_FIELD_ISSUE_SET
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

describe('buildEoSvieSmerteRows – tidligere svie-/smertebeløb', () => {
  it.each([
    ['tomt', undefined],
    ['nul', amount(0)],
  ])('viser advarslen ved anden opgørelse, når beløbet er %s', (_label, value) => {
    const row = getTidligereTotalRow({ svieSmerteTidligereTotal: value });

    expect(row).toMatchObject({
      status: 'warning',
      message: 'Der er ikke angivet svie/smerte opgjort i tidligere erstatningsopgørelser',
      summaryDisplay: 'messageOnly',
    });
  });

  it('viser ikke advarslen, når beløbet er større end nul', () => {
    const row = getTidligereTotalRow({ svieSmerteTidligereTotal: amount(1) });

    // Beløbet vises med enhed som naborækkerne i kontroltabellen.
    expect(row).toMatchObject({ status: 'ok', displayValue: '1,00 kr.' });
    expect(row?.message).toBeUndefined();
  });

  it('advarer, når beløbet overstiger maksimum – men blokerer ikke', () => {
    // 2024-maksimum er 88.500 kr. Beløbet KAN være rigtigt (rammen er reelt opbrugt), så
    // advarslen er gul og ikke en fejl (BB-219).
    const row = getTidligereTotalRow({
      svieSmerteSatserAar: 2024,
      svieSmerteTidligereTotal: amount(100_000),
    });

    expect(row?.status).toBe('warning');
    expect(row?.message).toBe(
      'Svie/smerte opgjort i tidligere erstatningsopgørelser overstiger maksimum (88.500,00 kr.)'
    );
  });

  it('advarer ikke, når satsåret ikke har et maksimum', () => {
    const row = getTidligereTotalRow({
      svieSmerteSatserAar: 2030,
      svieSmerteTidligereTotal: amount(100_000),
    });

    expect(row?.message).toBeUndefined();
  });

  it('måler mod det FORLIGSREDUCEREDE maksimum, som beregningen bruger', () => {
    // 50 % af 88.500 = 44.250. Et beløb derimellem er over grænsen i denne sag, men ikke i en sag
    // uden forlig.
    const row = getTidligereTotalRow({
      svieSmerteSatserAar: 2024,
      forligAnsvarsgradProcent: 50,
      svieSmerteTidligereTotal: amount(50_000),
    });

    expect(row?.status).toBe('warning');
    expect(row?.message).toContain('44.250,00 kr.');
  });

  it('advarer ikke, når beløbet er præcis lig maksimum', () => {
    const row = getTidligereTotalRow({
      svieSmerteSatserAar: 2024,
      svieSmerteTidligereTotal: amount(88_500),
    });

    expect(row?.status).toBe('ok');
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
      buildTestFieldIssueSet(
        eoSvieSmerteTidligereTotalField.bind(),
        'Beløbet er ugyldigt',
        'format'
      )
    );

    expect(row).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Beløbet er ugyldigt)',
    });
    expect(row?.message).toBeUndefined();
  });
});

describe('collectAllEoRows – tidligere svie-/smertebeløb', () => {
  it('viser teksten og linker til det konkrete beløbsfelt', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      eoNummer: '2',
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmerteTidligereTotal: undefined,
    };

    const { warnings } = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      EMPTY_FIELD_ISSUE_SET,
      values,
      EMPTY_FIELD_ISSUE_SET
    );
    const warning = warnings.find((row) => row.id === 'sviesmerte.tidligereTotal');

    expect(warning).toMatchObject({
      summaryText: 'Der er ikke angivet svie/smerte opgjort i tidligere erstatningsopgørelser',
      focusTarget: { kind: 'fieldAddress', address: eoSvieSmerteTidligereTotalField.bind().address },
      navigation: {
        kind: 'erstatningsopgoerelse-tab',
        tabId: 'eo_oplysninger',
        sectionId: 'sviesmerte',
        sectionTitle: 'Svie- og smertegodtgørelse',
      },
    });
  });
});
