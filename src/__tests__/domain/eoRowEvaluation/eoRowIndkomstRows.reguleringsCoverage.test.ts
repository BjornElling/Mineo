import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  DEFAULT_EO_ROW_POLICY,
  __createTestEoRowPolicy,
} from '../../../settings/sourceSettings';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
});

describe('buildEoIndkomstRows regulering details', () => {
  it('opretter reguleringsdetaljer for statistik og markerer manglende reguleringsværdi på reguleringsdato', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const rows = buildEoIndkomstRows(values, iso('1900-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const reguleringsvaerdiRow = rows.find((row) => row.id === `${prefix}.reguleringsvaerdi`);
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(reguleringsvaerdiRow).toBeDefined();
    expect(startRow).toBeDefined();
    expect(slutRow).toBeDefined();
    expect(reguleringsvaerdiRow?.status).toBe('error');
    expect(reguleringsvaerdiRow?.message).toMatch(/^er ikke angivet/);
  });

  it('markerer manglende slutdækning for manuel regulering med konkret slutdato', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2025-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: toISODateString('2024-01-01'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, iso('2023-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('error');
    expect(slutRow?.displayValue).toMatch(/^Nej \(kun indtil /);
    expect(slutRow?.message).toMatch(/^er ikke angivet \(kun indtil /);
  });

  it('behandler præcis udløbsgrænse som ikke-ok (< grænse er tilladt, = grænse er ikke)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2025-07-01');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-07-01'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: toISODateString('2024-01-02'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('error');
    expect(slutRow?.displayValue).toMatch(/^Nej \(kun indtil /);
    expect(slutRow?.displayValue).not.toBe('(< 6 måneder)');
  });

  it('klassificerer manglende overenskomstdækning som warning når allow=true', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const rowPolicy = __createTestEoRowPolicy({ allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true });
    const rows = buildEoIndkomstRows(values, iso('2009-01-01'), {}, rowPolicy);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);

    expect(startRow).toBeDefined();
    expect(startRow?.status).toBe('warning');
    expect(startRow?.displayValue).toMatch(/^Nej \(først fra /);
  });

  it('klassificerer manglende overenskomstdækning som error når allow=false', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const rows = buildEoIndkomstRows(values, iso('2009-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);

    expect(startRow).toBeDefined();
    expect(startRow?.status).toBe('error');
  });

  it('behandler udløb under grænsen som ok med visning af månedersregel', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2025-04-30');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-04-30'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: toISODateString('2024-01-01'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(slutRow).toBeDefined();
    expect(slutRow?.status).toBe('ok');
    expect(slutRow?.displayValue).toBe('(< 6 måneder)');
  });

  it('opretter ikke start/slut-dækningsrows når der ikke findes TAF-boundaries', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');
    values.tafPerioder = [];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const startRow = rows.find((row) => row.id === `${prefix}.startvaerdi`);
    const slutRow = rows.find((row) => row.id === `${prefix}.slutvaerdi`);

    expect(startRow).toBeUndefined();
    expect(slutRow).toBeUndefined();
  });

  it('viser samlet ikke-blokerende dæknings-advarsel ved start-hul (allow=true)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const rowPolicy = __createTestEoRowPolicy({ allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true });
    const rows = buildEoIndkomstRows(values, iso('2009-01-01'), {}, rowPolicy);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeDefined();
    expect(daekningRow?.status).toBe('warning');
    expect(daekningRow?.displayValue).toMatch(/Der er ikke reguleringsværdier for hele TAF-perioden — først fra /);
    expect(daekningRow?.displayValue).not.toMatch(/kun til og med/);
  });

  it('viser IKKE samlet dæknings-advarsel når hullet er blokerende (allow=false)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;

    const rows = buildEoIndkomstRows(values, iso('2009-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeUndefined();
  });

  it('viser samlet dæknings-advarsel ved slut-hul (KRL, allow=true)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2020-01-01');
    values.vedroererPeriodeTil = iso('2030-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2020-01-01'), til: iso('2030-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const rowPolicy = __createTestEoRowPolicy({ allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true });
    const rows = buildEoIndkomstRows(values, iso('2020-01-01'), {}, rowPolicy);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeDefined();
    expect(daekningRow?.status).toBe('warning');
    expect(daekningRow?.displayValue).toMatch(/Der er ikke reguleringsværdier for hele TAF-perioden — kun til og med /);
    expect(daekningRow?.displayValue).not.toMatch(/først fra/);
  });

  it('viser samlet dæknings-advarsel ved hul i både start og slut (KRL regioner, allow=true)', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2010-01-01');
    values.vedroererPeriodeTil = iso('2030-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2010-01-01'), til: iso('2030-12-31'), loseFeriedage: undefined }];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (regioner)';

    const rowPolicy = __createTestEoRowPolicy({ allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true });
    const rows = buildEoIndkomstRows(values, iso('2010-01-01'), {}, rowPolicy);
    const prefix = `loenindkomst.${af.id}.regulering`;
    const daekningRow = rows.find((row) => row.id === `${prefix}.daekningAdvarsel`);

    expect(daekningRow).toBeDefined();
    expect(daekningRow?.status).toBe('warning');
    // KTO (regioner) starter reelt 01-10-2018 og slutter (nyeste + 6 mdr − 1 dag) længe før 2030.
    expect(daekningRow?.displayValue).toMatch(/først fra 01-10-2018 og kun til og med /);
  });
});

/**
 * Multi-af-maskering (udskudt fund U2 / review-punkt 13, led 2).
 *
 * I `Beregningsperiode`-grenen beregner både compute-motoren OG row-laget hvert
 * ansættelsesforhold uafhængigt: row-laget itererer `resolveLoenudviklingKilde` (= alle
 * ansættelsesforhold) og emitterer et SELVSTÆNDIGT sæt regulerings-rækker pr. af med
 * prefixet `loenindkomst.<af.id>.regulering`. Der findes derfor INGEN aggregeret status,
 * der kunne lade ét ansættelsesforholds fulde dækning skjule et andets hul: hvert af's
 * `reguleringsvaerdi`-row står for sig selv, og den samlede fejl-/advarselsboks viser dem
 * alle. Denne test beviser, at af A (fuld dækning → ok) ikke maskerer af B's hul (→ error).
 */
describe('buildEoIndkomstRows multi-ansættelse — af A maskerer ikke af B (U2)', () => {
  const buildTwoAfValues = () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [
        createDefaultLoenindkomstAnsaettelsesforhold(),
        createDefaultLoenindkomstAnsaettelsesforhold(),
      ],
    };
    values.beregnesUdFra = 'Beregningsperiode';
    // af A's reguleringsdato = beregningsperiodeTil (ingen saerligFraDato) = inden for KRL-dækning.
    values.tafBeregningsperiodeTil = iso('2020-01-01');
    values.vedroererPeriodeFra = iso('2020-01-01');
    values.vedroererPeriodeTil = iso('2020-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2020-01-01'), til: iso('2020-12-31'), loseFeriedage: undefined }];

    const [afA, afB] = values.loenindkomstAnsaettelsesforhold;
    afA.id = 'af-a';
    afB.id = 'af-b';
    afA.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    afA.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    afB.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    afB.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    // af B's egen saerligFraDato ligger FØR KRL-dækningen (min 01-04-2001) → hul kun for af B.
    afB.saerligFraDatoRegulering = iso('1900-01-01');
    return values;
  };

  it('af A (dækket) → reguleringsvaerdi ok; af B (hul) → reguleringsvaerdi error, ikke maskeret', () => {
    const values = buildTwoAfValues();
    const rows = buildEoIndkomstRows(values, iso('2020-01-01'));
    const afARow = rows.find((row) => row.id === 'loenindkomst.af-a.regulering.reguleringsvaerdi');
    const afBRow = rows.find((row) => row.id === 'loenindkomst.af-b.regulering.reguleringsvaerdi');

    expect(afARow?.status).toBe('ok');
    expect(afBRow?.status).toBe('error');
    // Trust-invariant: der er mindst én blokerende error i det samlede rækkesæt (af B skjules ikke).
    expect(rows.some((row) => row.status === 'error')).toBe(true);
  });
});

/**
 * Escape-hatch (`allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden`) — G3:
 * må KUN sænke strenghed (error → warning), aldrig ændre den viste (beregnede) værdi.
 * Beregningsmotoren (`buildLoenudviklingModel`) modtager slet ikke app-settings, så tallene
 * kan strukturelt ikke afhænge af flaget; her bindes row-lagets kontrakt: samme `displayValue`,
 * kun `status` flipper.
 */
describe('buildEoIndkomstRows escape-hatch — flipper kun severity, ikke værdi (G3)', () => {
  const buildOverenskomstHulValues = () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.vedroererPeriodeFra = iso('2009-01-01');
    values.vedroererPeriodeTil = iso('2012-12-31');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laerer-overenskomsten';
    af.offentligLoenType = 'Månedsløn';
    af.offentligLoenTrin = 31;
    af.offentligLoenGruppe = 2;
    return values;
  };

  it('start-dæknings-hul: displayValue er identisk for allow=false og allow=true; kun status skifter error↔warning', () => {
    const values = buildOverenskomstHulValues();
    const prefix = `loenindkomst.${values.loenindkomstAnsaettelsesforhold[0].id}.regulering`;

    const rowsError = buildEoIndkomstRows(values, iso('2009-01-01'), {}, DEFAULT_EO_ROW_POLICY);
    const rowsWarn = buildEoIndkomstRows(values, iso('2009-01-01'), {}, __createTestEoRowPolicy({
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
    }));
    const startError = rowsError.find((row) => row.id === `${prefix}.startvaerdi`);
    const startWarn = rowsWarn.find((row) => row.id === `${prefix}.startvaerdi`);

    expect(startError?.status).toBe('error');
    expect(startWarn?.status).toBe('warning');
    // Den viste (beregnede) værdi er uændret — kun severity flytter sig.
    expect(startWarn?.displayValue).toBe(startError?.displayValue);
  });
});

/**
 * U6 — `alleVaerdier`-row-domæneforskel og dobbelt-signalering (review-punkt 13).
 */
describe('buildEoIndkomstRows alleVaerdier — manuel-form-domæneforskel og før-basis-dobbeltsignalering (U6)', () => {
  const buildManualValues = (basis: 'Manuel procentsats' | 'Manuelt angivet') => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2023-01-01');
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2023-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }];
    values.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = basis;
    return values;
  };

  it('nul aktive rækker: procentsats → ok (base = indeks 100), angivet → error (grundløn kræves) — bevidst domæneforskel', () => {
    const procentsatsValues = buildManualValues('Manuel procentsats');
    const afP = procentsatsValues.loenindkomstAnsaettelsesforhold[0];
    afP.loenudviklingManuelProcentsatsTableData = [{ id: 'base', dato: undefined, procent: 0 }];
    const procentsatsRows = buildEoIndkomstRows(procentsatsValues, iso('2023-01-01'));
    const procentsatsGate = procentsatsRows.find((r) => r.id === `loenindkomst.${afP.id}.regulering.alleVaerdier`);
    expect(procentsatsGate?.status).toBe('ok');

    const angivetValues = buildManualValues('Manuelt angivet');
    const afA = angivetValues.loenindkomstAnsaettelsesforhold[0];
    afA.loenudviklingManuelTableData = [
      { id: 'base', dato: undefined, grundloen: undefined, feriepenge: undefined, shSoSats: undefined, fritvalg: undefined, agPension: undefined },
    ];
    const angivetRows = buildEoIndkomstRows(angivetValues, iso('2023-01-01'));
    const angivetGate = angivetRows.find((r) => r.id === `loenindkomst.${afA.id}.regulering.alleVaerdier`);
    expect(angivetGate?.status).toBe('error');
  });

  it('før-basis-række uden procent dobbelt-signalerer (alleVaerdier error + før-basis warning) — fail-closed, ikke under-regulering', () => {
    const values = buildManualValues('Manuel procentsats');
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingManuelProcentsatsTableData = [
      { id: 'base', dato: undefined, procent: 0 },
      // Dateret FØR reguleringsdatoen (2023-01-01) OG uden procent → aktiv men ikke komplet.
      { id: 'foer', dato: iso('2022-06-01'), procent: undefined },
    ];
    const rows = buildEoIndkomstRows(values, iso('2023-01-01'));
    const prefix = `loenindkomst.${af.id}.regulering`;
    const gate = rows.find((r) => r.id === `${prefix}.alleVaerdier`);
    const foerBasis = rows.find((r) => r.id === `${prefix}.raekkerFoerReguleringsdato`);

    expect(gate?.status).toBe('error');
    expect(foerBasis?.status).toBe('warning');
  });
});
