// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { getNavigationTargetFromRowId } from '../../../domain/eoRowEvaluation/eoRowNavigationMap';
import { resolveOverenskomstSatsBindings } from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { eoEmploymentFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

// Brugerblik 12g (ansættelsesforholdets ramme, lønforhold og satser), udviklerafgørelser 2026-10-06. Testene går
// gennem den rigtige reader, så feltets issue, «Fejl og advarsler» og blokeringen læser samme tilstand som skærmen.

type Ansaettelse = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const catalog = getProductionInputCatalog();
const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'T',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2018-06-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

/** Tolv lønrækker à 30.000 kr. fra den angivne måned, som fundets sag. */
const loenRaekker = (fra = { maaned: 6, aar: 2017 }, antal = 12) => Array.from({ length: antal }, (_, index) => {
  const maaned0 = fra.maaned - 1 + index;
  return {
    id: `l${index}`,
    col0_maaned: String((maaned0 % 12) + 1),
    col1_maaned: String(fra.aar + Math.floor(maaned0 / 12)),
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: amount(30000),
    col3: undefined,
    col4: undefined,
    col5: undefined,
  };
});

const ansaettelse = (patch: Partial<Ansaettelse> = {}): Ansaettelse => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  navnPaaArbejdssted: 'Firma A',
  feriePct: 12.5,
  loenperiode: 'maaned' as const,
  loenPaaHelligdage: 'Almindelig løn' as const,
  fuldLoenUnderFerie: 'Ja',
  loenudviklingBeregningsgrundlag: 'Ingen' as const,
  indtaegtsoplysningerTableData: loenRaekker(),
  ...patch,
});

const sag = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => withSfggIngenForEmployments({
  ...createErstatningsopgoerelseInitialValues(),
  tafArbejdsstatus: 'Uarbejdsdygtig',
  eoNummer: '1',
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  kravPaaOevrigeErstatningskrav: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-12-31'),
  opgørelseLavetDen: iso('2025-02-01'),
  tafPerioder: [{ id: 't1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: iso('2017-06-01'),
  tafBeregningsperiodeTil: iso('2018-05-31'),
  loenindkomstAnsaettelsesforhold: [ansaettelse()],
  ...patch,
  eoAngivetLoenLoenudvikling: {
    ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'Ingen',
    ...patch.eoAngivetLoenLoenudvikling,
  },
});

const project = (eo: ErstatningsopgoerelseValues, stamdataPatch: Partial<StamdataValues> = {}) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: { ...stamdata, ...stamdataPatch }, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
  const rows = collectAllEoRows(
    projection.stamdataValues,
    projection.stamdataErrors,
    projection.eoValues,
    projection.eoErrors,
    {},
    undefined,
    projection.snapshot.data?.canonicalOutput,
    projection.snapshot.data?.pdfModel,
  );
  const linjer = (list: typeof rows.errors) => list.map((row) => row.summaryText ?? row.message ?? row.displayValue);
  return { projection, evaluation, rows, errorLinjer: linjer(rows.errors), warningLinjer: linjer(rows.warnings) };
};

const issueOf = <T,>(result: ReturnType<typeof project>, field: FieldRef<T>) =>
  result.evaluation.issues.get(serializeFieldAddress(field.address));

describe('BB-274 – en tom feriesats regnes ikke stille som 0 %', () => {
  it.each(['Ingen', 'Statistik', 'Manuel procentsats'] as const)(
    'blokerer med en navngiven linje ved lønudvikling «%s», men uden rød ring',
    (grundlag) => {
      const result = project(sag({
        loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: undefined, loenudviklingBeregningsgrundlag: grundlag })],
      }));

      expect(result.errorLinjer).toContain(
        'Satser ved beregningsperiodens udløb (31-05-2018): Feriegodtgørelse/-tillæg er ikke udfyldt'
      );
      expect(issueOf(result, eoEmploymentFields.feriePct.bind('af-1'))).toBeUndefined();
      expect(result.projection.snapshot.data).toBeNull();
    }
  );

  it('blokerer også ved angivet månedsløn, hvor kortets rækker indgår i fradraget efter skaden', () => {
    const result = project(sag({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: amount(30000),
      loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: undefined, indtaegtsoplysningerTableData: loenRaekker({ maaned: 1, aar: 2024 }) })],
    }));

    expect(result.errorLinjer.some((linje) => linje.endsWith('Feriegodtgørelse/-tillæg er ikke udfyldt'))).toBe(true);
  });

  it('kræver ikke satsen uden lønoplysninger eller i beløb-tilstand', () => {
    const udenRaekker = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: undefined, indtaegtsoplysningerTableData: [] })],
    }));
    const beloeb = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: undefined, tillaegAngivesSom: 'beloeb' })],
    }));

    for (const result of [udenRaekker, beloeb]) {
      expect(result.errorLinjer.some((linje) => linje.includes('Feriegodtgørelse/-tillæg er ikke udfyldt'))).toBe(false);
    }
  });
});

describe('BB-284/BB-286 – satslinjen bruger skærmens overskrift og feltets egen tekst', () => {
  it('en for lav sats er rød, og linjen gentager feltets regel ordret', () => {
    const result = project(sag({ loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: 5 })] }));

    expect(result.errorLinjer).toContain(
      'Satser ved beregningsperiodens udløb (31-05-2018): Ved løn under ferie opgøres ferietillægget beregningsteknisk som feriegodtgørelse (12,5 %, eller 15 % ved ret til 6. ferieuge)'
    );
  });

  it('12 % er lovligt og giver hverken fejl eller advarsel', () => {
    const result = project(sag({ loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: 12 })] }));

    expect([...result.errorLinjer, ...result.warningLinjer].some((linje) => linje.includes('Feriegodtgørelse'))).toBe(false);
    expect(result.projection.snapshot.status).toBe('ok');
  });

  it('over 20 % er en gul advarsel, der ikke spærrer', () => {
    const result = project(sag({ loenindkomstAnsaettelsesforhold: [ansaettelse({ feriePct: 25 })] }));

    expect(result.warningLinjer).toContain(
      'Satser ved beregningsperiodens udløb (31-05-2018): Feriegodtgørelse/-tillæg over 20 % er usædvanligt – kontrollér satsen'
    );
    expect(result.rows.errors).toEqual([]);
    expect(result.projection.snapshot.status).toBe('ok');
  });
});

describe('BB-275 – en privat overenskomst dikterer tillæggene, og manglende satser er ikke 0 %', () => {
  const byggeAnlaeg = { harOverenskomst: true, overenskomstId: 'bygge-anlaeg' } as const;

  it('et tillæg, overenskomsten ikke giver, er 0 % og låst – også Faglærte-overenskomstens fritvalg', () => {
    const bindings = resolveOverenskomstSatsBindings(
      { harOverenskomst: true, overenskomstId: 'faglaerte-overenskomsten', loenPaaHelligdage: 'Almindelig løn' },
      iso('2024-06-01'),
    );

    expect(bindings.fritvalgPct).toEqual({ kind: 'overenskomst', value: 0 });
    expect(bindings.shSoPct.kind).toBe('overenskomst');
  });

  it('låser aldrig op for egen indtastning, når satserne mangler på datoen', () => {
    const bindings = resolveOverenskomstSatsBindings(
      { ...byggeAnlaeg, loenPaaHelligdage: 'Almindelig løn' },
      iso('2010-01-01'),
    );

    expect(Object.values(bindings).map((binding) => binding.kind)).toEqual(['utilgaengelig', 'utilgaengelig', 'utilgaengelig']);
  });

  it('en særlig fra-dato før overenskomstens satser er rød og blokerer med overenskomstens navn', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({ ...byggeAnlaeg, saerligFraDatoRegulering: iso('2010-01-01') })],
    }));

    const besked = 'Bygge-/anlægsoverenskomsten (3F / Dansk Industri) har ingen satser før 01-03-2011 – vælg en senere reguleringsdato';
    expect(issueOf(result, eoEmploymentFields.saerligFraDatoRegulering.bind('af-1'))?.message).toBe(besked);
    expect(result.errorLinjer).toContain(`Evt. særlig fra-dato for regulering: ${besked}`);
    expect(result.projection.snapshot.data).toBeNull();
  });

  it('en beregningsperiode, der slutter før overenskomstens satser, blokerer på satslinjen', () => {
    const result = project(sag({
      tafBeregningsperiodeFra: iso('2009-06-01'),
      tafBeregningsperiodeTil: iso('2010-05-31'),
      loenindkomstAnsaettelsesforhold: [ansaettelse({ ...byggeAnlaeg, indtaegtsoplysningerTableData: loenRaekker({ maaned: 6, aar: 2009 }) })],
    }), { skadedato: iso('2010-06-01') });

    expect(result.errorLinjer).toContain(
      'Satser ved beregningsperiodens udløb (31-05-2010): Bygge-/anlægsoverenskomsten (3F / Dansk Industri) har ingen satser før 01-03-2011 – vælg en senere reguleringsdato'
    );
  });

  it('lønrækker før overenskomstens satser giver en gul advarsel og spærrer ikke', () => {
    const result = project(sag({
      tafBeregningsperiodeFra: iso('2010-06-01'),
      tafBeregningsperiodeTil: iso('2011-05-31'),
      loenindkomstAnsaettelsesforhold: [ansaettelse({ ...byggeAnlaeg, indtaegtsoplysningerTableData: loenRaekker({ maaned: 6, aar: 2010 }) })],
    }), { skadedato: iso('2011-06-01') });

    expect(result.warningLinjer).toContain(
      'Bygge-/anlægsoverenskomsten (3F / Dansk Industri) har ingen satser før 01-03-2011 – lønrækker før denne dato er regnet uden overenskomstens tillæg'
    );
    expect(result.errorLinjer.some((linje) => linje.includes('har ingen satser'))).toBe(false);
  });
});

describe('BB-277 – en rød værdi på kortet får feltets navn i boksen', () => {
  it('en pensionssats på 150 navngiver feltet', () => {
    const result = project(sag({ loenindkomstAnsaettelsesforhold: [ansaettelse({ pensionPct: 150 })] }));

    expect(result.errorLinjer).toContain('Arbejdsgivers pensionsbidrag: Procent skal være mellem 0,00 og 100,00');
  });
});

describe('BB-283 – sidste dag før skadedatoen, når skadelidte var ansat på skadedatoen', () => {
  it('er rød og blokerer, og en rød dato kaldes ikke «ikke indtastet»', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: true,
        sidsteArbejdsdag: iso('2018-05-31'),
      })],
    }));

    const besked = 'Sidste dag i ansættelsesforholdet skal ligge på eller efter skadedatoen (01-06-2018), når skadelidte var ansat på skadestidspunktet';
    expect(issueOf(result, eoEmploymentFields.sidsteArbejdsdag.bind('af-1'))?.message).toBe(besked);
    expect(result.errorLinjer).toContain(`Sidste dag i ansættelsesforholdet: ${besked}`);
    expect(result.warningLinjer.some((linje) => linje.includes('er ikke indtastet'))).toBe(false);
  });

  it('selve skadedatoen er lovlig', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: true,
        sidsteArbejdsdag: iso('2018-06-01'),
      })],
    }));

    expect(issueOf(result, eoEmploymentFields.sidsteArbejdsdag.bind('af-1'))).toBeUndefined();
  });
});

describe('BB-278/BB-279 – flere ansættelsesforhold hedder det samme overalt', () => {
  const toUnavngivne = sag({
    loenindkomstAnsaettelsesforhold: [
      ansaettelse({ id: 'af-1', navnPaaArbejdssted: undefined }),
      ansaettelse({ id: 'af-2', navnPaaArbejdssted: undefined, indtaegtsoplysningerTableData: loenRaekker({ maaned: 1, aar: 2018 }, 1) }),
    ],
  });

  it('beregningsgrundlaget bruger skærmens «Ansættelsesforhold N»', () => {
    const result = project(toUnavngivne);
    const navne = result.projection.snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.arbejdssteder
      .map((arbejdssted) => arbejdssted.navn);

    expect(navne).toEqual(['Ansættelsesforhold 1', 'Ansættelsesforhold 2']);
  });

  it('linket navngiver kortet, når der er flere – ellers fanens afsnit', () => {
    const ids = ['af-1', 'af-2'];

    expect(getNavigationTargetFromRowId('loenindkomst.af-2.arbejdsstedNavn', { ansaettelsesforholdIds: ids }))
      .toMatchObject({ sectionTitle: 'Ansættelsesforhold 2' });
    expect(getNavigationTargetFromRowId('sfgg.beregningskilde.af-1', { ansaettelsesforholdIds: ids }))
      .toMatchObject({ sectionTitle: 'Ansættelsesforhold 1' });
    expect(getNavigationTargetFromRowId('sfgg.beregningskilde.af-1', { ansaettelsesforholdIds: ['af-1'] }))
      .toMatchObject({ sectionTitle: 'Lønindkomst' });
  });
});
