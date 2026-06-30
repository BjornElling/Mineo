// @vitest-environment jsdom
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import {
  buildEoValuesWithTransientMidlertidigtEet,
  buildMidlertidigtEetSourceResult,
} from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetTransientInjection';
import { buildMidlertidigtEetPdfGroupsForTafRanges } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetBilagGroups';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { toISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const createValidEoBase = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  return withSfggIngenForEmployments({
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    tafPerioder: [
      { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-04-30'), loseFeriedage: 0 },
    ],
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
        indtaegtsoplysningerTableData: [],
      },
    ],
    eoAngivetLoenLoenudvikling: {
      ...initial.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
    },
    offentligeYdelserRows: [],
  });
};

const stamdata = {
  ...STAMDATA_INITIAL_VALUES,
  skadestype: 'Arbejdsulykke' as const,
  skadedato: iso('2024-01-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const eetValues: ErhvervsevnetabComposedValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: iso('2024-12-31'),
  koen: undefined,
  aslAfgoerelser: [
    {
      id: 'asl-1',
      afgoerelsesDato: toISODateString('2024-02-01'),
      virkningsDato: toISODateString('2024-01-01'),
      eetPct: 20,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
  ealEetPct: undefined,
  eetDifferencekravBilagSelection: {
    loebendeYdelser: true,
    kapitalisering: true,
    eetEfterEal: true,
    proformaKapitalisering: true,
    merErstatningPensionsalder: false,
    visUdvidetSpecifikation: false,
    visUdvidetSpecifikationLoebendeYdelserBilag: false,
  },
  aslAarsloen: asAmountValue(300000),
  ealAarsloen: undefined,
  skadelidteFodselsdato: stamdata.skadelidteFodselsdato,
};

describe('midlertidigt EET transient injection', () => {
  it('ignorerer EET-kilden når togglen er slået fra', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Nej' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-off',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues,
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.some((entry) => entry.label === 'Midlertidigt EET')).toBe(false);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual([]);
  });

  it('injicerer EET-rækker transient i TAF-fradraget når togglen er slået til', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-on',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues,
        skadedato: stamdata.skadedato,
      },
    });

    const midlertidigtEetEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    expect(midlertidigtEetEntry?.amountOre).toBeGreaterThan(0);
    expect(snapshot.debugSnapshot?.eoValues.offentligeYdelserRows.some((row) => row.ydelsestype === 'midlertidigt_eet')).toBe(true);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual([]);
  });

  it('fordeler importeret midlertidigt EET efter faktisk månedsbrøk ved delvist overlap', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      eetPct: 20,
      rows: [],
      perioder: [{
        fra: iso('2024-01-01'),
        til: iso('2024-02-29'),
        satsAar: 2024,
        maanederPraecis: 2,
        grundydelseAfrundet: 12000,
        reguleringPct: 0,
        maanedligYdelse: 1000,
        beregnetEet: 2000,
      }],
    }];

    const effectiveValues = buildEoValuesWithTransientMidlertidigtEet(eoValues, groups);
    const income = buildIncomeForRanges(effectiveValues, [{ fra: iso('2024-01-11'), til: iso('2024-01-12') }]);
    const midlertidigtEet = income.benefits.find((entry) => entry.typeKey === 'midlertidigt_eet');

    expect(midlertidigtEet?.amount).toBeCloseTo(1000 * (2 / 31), 10);
  });

  it('afgrænser importeret midlertidigt EET efter TAF-periodens udløb og ikke EET-beregningsdatoen', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-taf-slutdato',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: iso('2024-02-29'),
        },
        skadedato: stamdata.skadedato,
      },
    });
    const importedRows = snapshot.debugSnapshot?.eoValues.offentligeYdelserRows.filter(
      (row) => row.ydelsestype === 'midlertidigt_eet'
    ) ?? [];

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.midlertidigtEetGroups.flatMap((group) => group.perioder).at(-1)?.til).toBe(toISODateString('2024-04-30'));
    expect(importedRows.at(-1)?.tilDato).toBe(toISODateString('2024-04-30'));
  });

  it('importerer midlertidigt EET uden EET-beregningsdato ved at bruge TAF-slutdatoen som fallback', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-uden-beregningsdato',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
        },
        skadedato: stamdata.skadedato,
      },
    });
    const importedRows = snapshot.debugSnapshot?.eoValues.offentligeYdelserRows.filter(
      (row) => row.ydelsestype === 'midlertidigt_eet'
    ) ?? [];

    // Manglende EET-beregningsdato må ikke længere blokere EO-importen.
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'midlertidigt_eet_source:beregningsdato-missing')).toBe(false);
    // De importerede rækker afgrænses af TAF-periodens slutdato (capped af EO-periodens slutdato).
    expect(snapshot.data?.midlertidigtEetGroups.flatMap((group) => group.perioder).length).toBeGreaterThan(0);
    expect(snapshot.data?.midlertidigtEetGroups.flatMap((group) => group.perioder).at(-1)?.til).toBe(toISODateString('2024-04-30'));
    expect(importedRows.at(-1)?.tilDato).toBe(toISODateString('2024-04-30'));
  });

  it('blokerer fortsat midlertidigt EET-import uden beregningsdato når der ingen TAF-periode findes til fallback', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
      tafPerioder: [],
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-uden-beregningsdato-uden-taf',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
        },
        skadedato: stamdata.skadedato,
      },
    });

    // Uden TAF-periode findes ingen fallback-slutdato; importen fail-closer på manglende beregningsdato.
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:beregningsdato-missing',
      severity: 'error',
      blocksAuthoritativeComputation: true,
    }));
  });

  it('holder Midlertidig EET-bilagets sammentælling identisk med TAF-fradraget', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };
    const source = {
      eetValues,
      skadedato: stamdata.skadedato,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-pdf-parity',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: source,
    });
    const pdfGroups = buildMidlertidigtEetPdfGroupsForTafRanges(
      snapshot.data?.midlertidigtEetGroups ?? [],
      snapshot.data?.canonicalOutput.periodiseringer.tafPerioder ?? []
    );
    const pdfTotalKroner = pdfGroups.flatMap((group) => group.perioder).reduce((sum, row) => sum + row.beregnetEet, 0);
    const tafEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    expect(tafEntry).toBeDefined();
    expect(pdfTotalKroner * 100).toBe(tafEntry?.amountOre);
  });

  it('bevarer 2-decimal-afrunding af manuelle midlertidigt_eet-rækker når togglen er slået fra', () => {
    const eoValues = {
      ...createValidEoBase(),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-05'), loseFeriedage: 0 },
      ],
      midlertidigtEetFraEetSiden: 'Nej' as const,
      offentligeYdelserRows: [{
        id: 'midlertidigt-eet-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-10'),
        ydelsestype: 'midlertidigt_eet' as const,
        ydelse: asAmountValue(101),
        tillaeg: undefined,
      }],
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-two-decimal-when-toggle-off',
      stamdataValues: stamdata,
      eoValues,
    });
    const tafEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    // 50,50 kr = 5050 øre (2-decimal-afrunding bevares for manuelle rækker)
    expect(tafEntry?.amountOre).toBe(5050);
  });

  it('afrunder Midlertidigt EET under Indtægter i hele kroner når togglen er slået til', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-whole-kroner-when-toggle-on',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues,
        skadedato: stamdata.skadedato,
      },
    });
    const tafEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    expect(tafEntry).toBeDefined();
    // amountOre delt med 100 giver kroner; ved hele-kroner-afrunding er modulo 100 = 0.
    expect((tafEntry?.amountOre ?? 0) % 100).toBe(0);
  });

  it('ignorerer endelige EET-afgørelser når togglen er slået til', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-endelig-ignored',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          aslAfgoerelser: eetValues.aslAfgoerelser.map((row) => ({
            ...row,
            afgoerelseType: 'Endelig' as const,
          })),
        },
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.some((entry) => entry.label === 'Midlertidigt EET')).toBe(false);
    expect(snapshot.debugSnapshot?.eoValues.offentligeYdelserRows.some((row) => row.ydelsestype === 'midlertidigt_eet')).toBe(false);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual([]);
  });

  it('lader EO-beregningen fortsætte uden EET-issues når EET-siden er tom', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-empty-source',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
          aslAfgoerelser: [],
          aslAarsloen: undefined,
          skadelidteFodselsdato: undefined,
        },
        skadedato: undefined,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('midlertidigt_eet_source:'))).toBe(false);
    expect(snapshot.data?.midlertidigtEetGroups).toEqual([]);
  });

  it('ignorerer EET-kildefejl når der kun findes endelige afgørelser, som ikke kan importeres', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-final-only-source',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          aslAarsloen: undefined,
          aslAfgoerelser: eetValues.aslAfgoerelser.map((row) => ({
            ...row,
            afgoerelseType: 'Endelig' as const,
          })),
        },
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('midlertidigt_eet_source:'))).toBe(false);
    expect(snapshot.data?.midlertidigtEetGroups).toEqual([]);
  });

  it('blokerer autoritativ EO-beregning når den aktive EET-kilde har blokerende fejl', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-source-error',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues: {
          ...eetValues,
          aslAarsloen: undefined,
        },
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:aarsloen-missing',
      severity: 'error',
      blocksAuthoritativeComputation: true,
    }));
  });

  it('undertrykker de beregningsdato-relative advarsler i EO-importen, men beholder øvrige EET-advarsler', () => {
    const result = buildMidlertidigtEetSourceResult(
      {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
          aslAfgoerelser: [
            {
              id: 'asl-1',
              afgoerelsesDato: iso('2024-02-01'),
              // Virkningsdato efter den effektive beregningsdato (TAF-slutdato) → udløser
              // warn-virkningsdato-after-beregningsdato, som skal undertrykkes i EO-konteksten.
              virkningsDato: iso('2024-05-01'),
              // EET under 15 % → udløser warn-asl-eet-under-15, som er kontekst-uafhængig og bevares.
              eetPct: 10,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
              fsTilbageholdtEet: 'Nej',
            },
          ],
        },
        skadedato: iso('2024-01-01'),
      },
      { loebendeYdelserSlutdatoOverride: iso('2024-04-30') }
    );

    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-kap-dato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-asl-eet-under-15')).toBe(true);
  });

  it('blokerer autoritativ EO-beregning når EET-kilden ikke matcher schema', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-source-schema-invalid',
      stamdataValues: stamdata,
      eoValues,
      midlertidigtEetInsertSource: {
        eetValues,
        skadedato: stamdata.skadedato,
        issues: [{
          id: 'midlertidigt-eet-source-schema-invalid',
          severity: 'error',
          message: 'Der mangler en afgørelse med EET-procent.',
        }],
      },
    });

    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: 'Der mangler en afgørelse med EET-procent.',
      blocksAuthoritativeComputation: true,
    }));
  });
});
