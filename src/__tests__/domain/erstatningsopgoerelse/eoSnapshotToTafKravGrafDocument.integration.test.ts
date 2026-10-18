import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToTafKravGrafDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { buildMidlertidigtEetImportContext } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetTransientInjection';

const iso = toISODateString;
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const createInput = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  return withSfggIngenForEmployments({
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: amount(30_000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    vedroererPeriodeFra: iso('2024-02-01'),
    vedroererPeriodeTil: iso('2024-02-29'),
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-02-29'), loseFeriedage: 0 }],
    eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' as const },
    loenindkomstAnsaettelsesforhold: [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      navnPaaArbejdssted: 'Arbejdsgiver A',
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
      feriePct: 0,
      fritvalgPct: 0,
      shSoPct: 0,
      storeBededagPct: 0,
      pensionPct: 0,
      beregnStoreBededagstillaeg: false,
      indtaegtsoplysningerTableData: [{
        id: 'loen-1', col0_maaned: '02', col1_maaned: '2024',
        col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
        col2: amount(1_000), col3: undefined, col4: undefined, col5: undefined,
      }],
    }],
    offentligeYdelserRows: [
      { id: 'dagpenge-1', fraDato: iso('2024-02-01'), tilDato: iso('2024-02-29'), ydelsestype: 'dagpenge', ydelse: amount(2_000), tillaeg: undefined },
      { id: 'eet-1', fraDato: iso('2024-02-01'), tilDato: iso('2024-02-29'), ydelsestype: 'midlertidigt_eet', ydelse: amount(3_000), tillaeg: undefined },
    ],
  });
};

describe('eoSnapshotToTafKravGrafDocument – fælles indkomstgrundlag', () => {
  it('holder to ansættelsesforhold adskilt, selv om de har samme navn, og bevarer identiteten ved omdøbning', () => {
    const eoValues = createInput();
    const first = eoValues.loenindkomstAnsaettelsesforhold[0];
    eoValues.loenindkomstAnsaettelsesforhold = [first, {
      ...structuredClone(first), id: 'af-2',
      indtaegtsoplysningerTableData: [{ ...first.indtaegtsoplysningerTableData[0], id: 'loen-2', col2: amount(2_000) }],
    }];
    const project = () => eoSnapshotToTafKravGrafDocument(computeEoSnapshot({
      revision: 'graf-samme-navn', dagsDatoISO: iso('2024-12-31'), eoValues: withSfggIngenForEmployments(eoValues),
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01'), skadelidteFodselsdato: iso('1980-01-01') },
    }));
    const graf = project();
    if (graf.kind !== 'ok') throw new Error(graf.message);
    const employers = graf.document.series.filter((serie) => serie.label === 'Løn (Arbejdsgiver A)');
    expect(employers.map(({ color, segments }) => ({ color, segments }))).toEqual([
      { color: '#2F6B9A', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 100_000 }] },
      { color: '#4F8A5B', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 200_000 }] },
    ]);
    expect(new Set(employers.map((serie) => serie.id)).size).toBe(2);
    eoValues.loenindkomstAnsaettelsesforhold[1].navnPaaArbejdssted = 'Arbejdsgiver B';
    const renamed = project();
    if (renamed.kind !== 'ok') throw new Error(renamed.message);
    expect(renamed.document.series.slice(0, 2).map((serie) => serie.id)).toEqual(employers.map((serie) => serie.id));
  });

  it('viser alle indtægter under en hel måneds ferie fordelt over hverdage uden at ændre TAF-kravet', () => {
    const eoValues = {
      ...createInput(), beregnesUdFra: 'Angivet dagsløn' as const, dagsloenenUdgoer: amount(1_000),
      vedroererPeriodeFra: iso('2024-01-01'), vedroererPeriodeTil: iso('2024-03-31'),
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-03-31'), loseFeriedage: 0 }],
      ferieperioder: [{ id: 'ferie-februar', fra: iso('2024-02-01'), til: iso('2024-02-29') }],
    };
    const before = structuredClone(eoValues);
    const snapshot = computeEoSnapshot({
      revision: 'graf-betalt-ferie', dagsDatoISO: iso('2024-12-31'), eoValues,
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01'), skadelidteFodselsdato: iso('1980-01-01') },
    });
    expect(snapshot.status).toBe('ok');
    expect(snapshot.data?.engines.tafPerYear?.years[0]?.yearDeductionsOre).toBe(600_000);
    expect(snapshot.data?.totals.tabtArbejdsfortjenesteOre).toBe(3_500_000);
    const graf = eoSnapshotToTafKravGrafDocument(snapshot);
    if (graf.kind !== 'ok') throw new Error(graf.message);
    expect(graf.document.unit).toBe('arbejdsdag');
    expect(graf.document.series.map(({ label, segments }) => ({ label, segments }))).toEqual([
      { label: 'Løn (Arbejdsgiver A)', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 4762 }] },
      { label: 'Dagpenge', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 9524 }] },
      { label: 'Midlertidigt EET', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 14286 }] },
    ]);
    expect(graf.document.ferieAbsenceMarkers).toEqual([]);
    expect(eoValues).toEqual(before);
    expect(snapshot.data?.totals.tabtArbejdsfortjenesteOre).toBe(3_500_000);
  });

  it('bevarer samtidig løn, dagpenge og manuelt EET gennem snapshot, årsfordeling og graf', () => {
    const eoValues = createInput();
    const original = structuredClone(eoValues);
    const snapshot = computeEoSnapshot({
      revision: 'graf-samtidige-indkomster',
      dagsDatoISO: iso('2024-12-31'),
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01'), skadelidteFodselsdato: iso('1980-01-01') },
      eoValues,
    });
    const graf = eoSnapshotToTafKravGrafDocument(snapshot);
    expect(graf.kind).toBe('ok');
    if (graf.kind !== 'ok') throw new Error(graf.message);

    expect(graf.document.series.map(({ label, segments }) => ({ label, segments }))).toEqual([
      { label: 'Løn (Arbejdsgiver A)', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 100_000 }] },
      { label: 'Dagpenge', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 200_000 }] },
      { label: 'Midlertidigt EET', segments: [{ fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 300_000 }] },
    ]);
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.map(({ label, amountOre }) => ({ label, amountOre }))).toEqual([
      { label: 'Arbejdsgiver A', amountOre: 100_000 },
      { label: 'Dagpenge', amountOre: 200_000 },
      { label: 'Midlertidigt EET', amountOre: 300_000 },
    ]);
    expect(snapshot.data?.engines.tafPerYear?.years[0]?.yearDeductionsOre).toBe(600_000);
    expect(eoValues).toEqual(original);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual(original.offentligeYdelserRows);
  });

  it('viser importeret EET sammen med løn og dagpenge uden at indsætte det i brugerens gemte rækker', () => {
    const eoValues = createInput();
    eoValues.midlertidigtEetFraEetSiden = 'Ja';
    eoValues.offentligeYdelserRows = eoValues.offentligeYdelserRows.filter((row) => row.ydelsestype !== 'midlertidigt_eet');
    const original = structuredClone(eoValues);
    const stamdataValues = { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke' as const, skadedato: iso('2024-01-01'), skadelidteFodselsdato: iso('1980-01-01') };
    const midlertidigtEetImportContext = buildMidlertidigtEetImportContext({
      revision: 'graf-import',
      skadedato: stamdataValues.skadedato,
      eetValues: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        ...FAELLES_AARSLOEN_INITIAL_VALUES,
        beregningsdato: iso('2024-12-31'),
        skadelidteFodselsdato: stamdataValues.skadelidteFodselsdato,
        aslAarsloen: amount(300_000),
        aslAfgoerelser: [{
          id: 'asl-1', afgoerelsesDato: iso('2024-02-01'), virkningsDato: iso('2024-01-01'),
          eetPct: 20, kapDato: undefined, kapPct: undefined, afgoerelseType: 'Midlertidig',
          tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
        }],
      },
    }, [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }]);
    const snapshot = computeEoSnapshot({ revision: 'graf-import', dagsDatoISO: iso('2024-12-31'), eoValues, stamdataValues, midlertidigtEetImportContext });
    const graf = eoSnapshotToTafKravGrafDocument(snapshot);
    expect(graf.kind).toBe('ok');
    if (graf.kind !== 'ok') throw new Error(graf.message);
    expect(graf.document.series.map(({ label }) => label)).toEqual(['Løn (Arbejdsgiver A)', 'Midlertidigt EET', 'Dagpenge']);
    expect(graf.document.series[1].segments).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-31'), amountOre: 381_900 },
      { fra: iso('2024-02-01'), til: iso('2024-02-29'), amountOre: 381_900 },
    ]);
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.map(({ label, amountOre }) => ({ label, amountOre }))).toEqual([
      { label: 'Arbejdsgiver A', amountOre: 100_000 },
      { label: 'Dagpenge', amountOre: 200_000 },
      { label: 'Midlertidigt EET', amountOre: 381_900 },
    ]);
    expect(snapshot.data?.engines.tafPerYear?.years[0]?.yearDeductionsOre).toBe(681_900);
    expect(eoValues).toEqual(original);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual(original.offentligeYdelserRows);
  });
});
