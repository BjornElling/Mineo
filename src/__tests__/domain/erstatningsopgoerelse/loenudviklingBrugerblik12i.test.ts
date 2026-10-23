// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { eoAngivetLoenFields, eoAngivetLoenManual } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { loenudviklingOgSatserSchema } from '../../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';
import {
  collectManualRegulationIssues,
  resolveManualRegulationWarnings,
} from '../../../domain/erstatningsopgoerelse/manualRegulationIssues';
import {
  collectAnciennitetstillaegDatoIssues,
  erAnciennitetstillaegEfterTafPerioden,
  resolveAnciennitetstillaegMangel,
} from '../../../domain/erstatningsopgoerelse/anciennitetstillaegRules';
import { resolveLoenudviklingKilde } from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveLoenudviklingFieldWarnings } from '../../../domain/erstatningsopgoerelse/loenudviklingFieldWarnings';
import {
  calculateLoentrinFinderResults,
  formatLoentrinFinderResultLabel,
} from '../../../components/pages/erstatningsopgoerelse/shared/loentrinFinderCore';
import { toISODateString, type ISODateString } from '../../../types/branded';
import type {
  ErstatningsopgoerelseValues,
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
  StamdataValues,
} from '../../../schemas/formSchemas';

// Brugerblik 12i (Lønudvikling og regulering af tabet). Testene går gennem den rigtige reader og projektion, hvor
// adfærden afhænger af feltrelevans, og gennem de rene domæneregler ellers.

const catalog = getProductionInputCatalog();
const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'Advokat A',
  sagsbehandler: 'Sagsbehandler S',
  skadelidte: 'Test Testesen',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2018-06-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

type AngivetLoen = ErstatningsopgoerelseValues['eoAngivetLoenLoenudvikling'];

/** Angivet månedsløn 30.000 kr. og TAF hele 2024 – grundsagen fra gennemgangen. */
const sag = (loen: Partial<AngivetLoen> = {}, patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => {
  const initial = createErstatningsopgoerelseInitialValues();
  return {
    ...initial,
    eoNummer: '1',
    kravPaaSvieSmerteGodtgoerelse: 'Nej',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    tafArbejdsstatus: 'Uarbejdsdygtig',
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    opgørelseLavetDen: iso('2025-02-01'),
    beregnesUdFra: 'Angivet månedsløn',
    maanedsloenenUdgoer: amount(30000),
    eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, feriePct: 12.5, ...loen },
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
    loenindkomstAnsaettelsesforhold: [],
    sfggAnsaettelsesforhold: [],
    ...patch,
  };
};

const project = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
  const { errors, warnings } = collectAllEoRows(
    projection.stamdataValues,
    projection.stamdataErrors,
    projection.eoValues,
    projection.eoErrors,
    {},
    undefined,
    projection.snapshot.data?.canonicalOutput,
    projection.snapshot.data?.pdfModel,
  );
  const lines = (rows: typeof errors) => rows.map((row) => row.summaryText ?? row.message ?? row.label);
  return { projection, evaluation, errorLines: lines(errors), warningLines: lines(warnings) };
};

const manualRow = (id: string, patch: Partial<LoenudviklingManuelRow> = {}): LoenudviklingManuelRow => ({
  id, dato: undefined, grundloen: undefined, feriepenge: 12.5, shSoSats: undefined, fritvalg: undefined, agPension: undefined,
  ...patch,
});
const percentRow = (id: string, patch: Partial<LoenudviklingManuelProcentsatsRow> = {}): LoenudviklingManuelProcentsatsRow => ({
  id, dato: undefined, procent: undefined, ...patch,
});

describe('Lønudvikling og regulering (brugerblik 12i)', () => {
  describe('BB-300 – «Ansættelse» kan ikke være tom', () => {
    it('en tom eller manglende værdi indlæses som Månedsløn, som feltet altid har vist', () => {
      const felt = loenudviklingOgSatserSchema.shape.offentligLoenType;
      expect(felt.parse(undefined)).toBe('Månedsløn');
      expect(felt.parse('')).toBe('Månedsløn');
      expect(felt.parse('Timeløn')).toBe('Timeløn');
    });

    it('en offentlig overenskomst med Månedsløn spærrer ikke med «Ansættelse er ikke valgt»', () => {
      const { errorLines } = project(sag({
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: 'kl-overenskomst',
        offentligLoenTrin: 30,
        offentligLoenGruppe: 2,
      }));
      expect(errorLines.join('\n')).not.toMatch(/Ansættelse/);
    });
  });

  describe('BB-301 – skjulte felter i lønudviklingen spærrer ikke', () => {
    it('en rød anciennitetsdato forsvinder fra fejlene, når formen skiftes til Statistik, og kommer tilbage ved Overenskomst', () => {
      const anciennitet = {
        overenskomstId: 'kl-overenskomst',
        offentligLoenTrin: 30,
        offentligLoenGruppe: 2,
        harAnciennitetstillaegEfterSkadedatoen: true,
        anciennitetstillaegDato: iso('2030-01-01'),
        anciennitetstillaegSats: amount(1000),
      } as const;
      const datoKey = serializeFieldAddress(eoAngivetLoenFields.anciennitetstillaegDato.bind().address);

      const statistik = project(sag({ ...anciennitet, loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)' }));
      expect(statistik.evaluation.issues.get(datoKey)).toBeUndefined();
      expect(statistik.projection.eoValues.eoAngivetLoenLoenudvikling.anciennitetstillaegDato).toBeUndefined();

      const overenskomst = project(sag({ ...anciennitet, loenudviklingBeregningsgrundlag: 'Overenskomst' }));
      expect(overenskomst.evaluation.issues.get(datoKey)).toBeDefined();
    });

    it('en rød celle i den fravalgte manuelle tabel spærrer ikke', () => {
      const { evaluation } = project(sag({
        loenudviklingBeregningsgrundlag: 'Ingen',
        loenudviklingManuelTableData: [manualRow('base', { grundloen: amount(30000) }), manualRow('r1', { dato: iso('2019-04-01'), grundloen: amount(-1) })],
      }));
      const grundloenKey = serializeFieldAddress(eoAngivetLoenManual.manualFields.grundloen.bind('r1').address);
      expect(evaluation.issues.get(grundloenKey)).toBeUndefined();
    });
  });

  describe('de manuelle tabeller (BB-302, BB-303, BB-308, BB-311, BB-313)', () => {
    const manuelSag = (rows: readonly LoenudviklingManuelRow[]) => sag({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [...rows],
    });

    it('BB-302: en tabel uden ændringer i over et år giver en gul advarsel, ikke en fejl', () => {
      const values = manuelSag([
        manualRow('base', { grundloen: amount(30000) }),
        manualRow('r1', { dato: iso('2019-04-01'), grundloen: amount(31000) }),
        manualRow('r2', { dato: iso('2023-04-01'), grundloen: amount(36000) }),
      ]);
      const warnings = resolveManualRegulationWarnings(values, stamdata, iso('2024-12-31'), 6);
      expect(warnings.map((warning) => warning.summaryMessage)).toEqual([
        'Den manuelle lønudvikling har ingen ændringer efter 01-04-2023 – lønnen er regnet uændret frem til 31-12-2024',
      ]);
      const { errorLines, warningLines } = project(values);
      expect(errorLines).toEqual([]);
      expect(warningLines).toContain(warnings[0]?.summaryMessage);
    });

    it('BB-302: inden for tolerancen advares der ikke', () => {
      const values = manuelSag([
        manualRow('base', { grundloen: amount(30000) }),
        manualRow('r1', { dato: iso('2023-09-01'), grundloen: amount(36000) }),
      ]);
      expect(resolveManualRegulationWarnings(values, stamdata, iso('2024-12-31'), 6)).toEqual([]);
    });

    it('BB-308: en grundløn på 0 eller derunder er en rød celle med sin egen linje', () => {
      const { evaluation, errorLines } = project(manuelSag([
        manualRow('base', { grundloen: amount(30000) }),
        manualRow('r1', { dato: iso('2019-04-01'), grundloen: amount(0) }),
        manualRow('r2', { dato: iso('2024-04-01'), grundloen: amount(-31000) }),
      ]));
      for (const id of ['r1', 'r2']) {
        const issue = evaluation.issues.get(serializeFieldAddress(eoAngivetLoenManual.manualFields.grundloen.bind(id).address));
        expect(issue?.message).toBe('Grundløn skal være større end 0 kr.');
      }
      expect(errorLines).toEqual(expect.arrayContaining([
        'Manuel regulering, række 01-04-2019: Grundløn skal være større end 0 kr.',
        'Manuel regulering, række 01-04-2024: Grundløn skal være større end 0 kr.',
      ]));
    });

    it.each(['Manuelt angivet', 'Manuel procentsats'] as const)('BB-311: %s – to rækker med samme dato er en rød fejl på den seneste', (basis) => {
      const values = basis === 'Manuelt angivet'
        ? manuelSag([
          manualRow('base', { grundloen: amount(30000) }),
          manualRow('r1', { dato: iso('2019-04-01'), grundloen: amount(31000) }),
          manualRow('r2', { dato: iso('2019-04-01'), grundloen: amount(40000) }),
        ])
        : sag({
          loenudviklingBeregningsgrundlag: 'Manuel procentsats',
          loenudviklingManuelProcentsatsTableData: [
            percentRow('base', { procent: 0 }),
            percentRow('r1', { dato: iso('2019-04-01'), procent: 2 }),
            percentRow('r2', { dato: iso('2019-04-01'), procent: 2 }),
          ],
        });
      const issues = collectManualRegulationIssues(values, stamdata);
      expect(issues.map((issue) => issue.message)).toEqual(['Der er allerede en række pr. 01-04-2019']);
      expect(issues[0]?.field.address.path.at(-1)).toMatchObject({ entityId: 'r2' });
    });

    it('BB-313: en sats over 10 % og en grundløn over ti gange rækken før giver gule advarsler', () => {
      const procent = resolveManualRegulationWarnings(sag({
        loenudviklingBeregningsgrundlag: 'Manuel procentsats',
        loenudviklingManuelProcentsatsTableData: [percentRow('base', { procent: 0 }), percentRow('r1', { dato: iso('2024-04-01'), procent: 100 })],
      }), stamdata, iso('2024-12-31'), 6);
      expect(procent.map((warning) => warning.kind)).toEqual(['storProcentsats']);

      const grundloen = resolveManualRegulationWarnings(manuelSag([
        manualRow('base', { grundloen: amount(30000) }),
        manualRow('r1', { dato: iso('2024-04-01'), grundloen: amount(310000) }),
      ]), stamdata, iso('2024-12-31'), 6);
      expect(grundloen.map((warning) => warning.kind)).toEqual(['grundloenSpring']);
    });
  });

  describe('anciennitetstillægget (BB-304, BB-305)', () => {
    const anciennitetSag = (patch: Partial<AngivetLoen>) => sag({
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId: 'kl-overenskomst',
      offentligLoenTrin: 30,
      offentligLoenGruppe: 2,
      harAnciennitetstillaegEfterSkadedatoen: true,
      ...patch,
    });

    it('BB-304: slået til uden dato og sats spærrer med én linje', () => {
      const values = anciennitetSag({ anciennitetstillaegDato: undefined, anciennitetstillaegSats: undefined });
      const kilde = resolveLoenudviklingKilde(values)[0]!;
      expect(resolveAnciennitetstillaegMangel(values, kilde)?.message).toBe('Anciennitetstillæg er slået til, men dato og sats mangler');
      expect(project(values).errorLines).toContain('Anciennitetstillæg er slået til, men dato og sats mangler');
    });

    it('BB-305: en dato på eller før reguleringsdatoen er en rød feltfejl på datoen', () => {
      const issues = collectAnciennitetstillaegDatoIssues(
        anciennitetSag({ anciennitetstillaegDato: iso('2010-01-01'), anciennitetstillaegSats: amount(1000) }),
        stamdata,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]?.field.descriptor.id).toBe(eoAngivetLoenFields.anciennitetstillaegDato.id);
      expect(issues[0]?.message).toMatch(/^Datoen skal være efter /);
    });

    it('BB-305: en dato efter erstatningsperioden er gul', () => {
      const values = anciennitetSag({ anciennitetstillaegDato: iso('2026-01-01'), anciennitetstillaegSats: amount(1000) });
      expect(erAnciennitetstillaegEfterTafPerioden(resolveLoenudviklingKilde(values)[0]!, iso('2024-12-31'))).toBe(true);
    });
  });

  it('BB-306: reguleringsdatoen før kildens første sats giver én linje, ved «Lønudvikling beregnes ud fra»', () => {
    const { errorLines } = project(sag(
      { loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)' },
      { angivetMaanedsloenOpreguleresFraDato: iso('2014-05-31') },
    ));
    const daekning = errorLines.filter((line) => line.includes('første sats'));
    expect(daekning).toHaveLength(1);
    expect(daekning[0]).toMatch(/Reguleringsdatoen \(31-05-2014\) ligger før den første sats i SBLON2/);
    expect(errorLines.join('\n')).not.toMatch(/Reguleringsværdi/);
  });

  it('BB-313: en forhøjet grundløn over løntrinnets løn er gul og spærrer ikke', () => {
    const offentlig = (beloeb: number, per: 'Måned' | 'Time') => sag({
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId: 'kl-overenskomst',
      offentligLoenTrin: 30,
      offentligLoenGruppe: 2,
      offentligLoenEkstraGrundloen: amount(beloeb),
      offentligLoenEkstraGrundloenAngivesPer: per,
    });
    const besked = 'Den forhøjede grundløn er større end løntrinnets løn – kontrollér beløb og enhed';

    const forHoej = project(offentlig(500, 'Time'));
    expect(forHoej.warningLines).toContain(besked);
    expect(forHoej.errorLines.join('\n')).not.toMatch(/forhøjede grundløn/);
    const advarsler = resolveLoenudviklingFieldWarnings(offentlig(500, 'Time'), stamdata, 6);
    expect(advarsler.get(serializeFieldAddress(eoAngivetLoenFields.offentligLoenEkstraGrundloen.bind().address))?.message)
      .toBe(besked);

    expect(project(offentlig(500, 'Måned')).warningLines).not.toContain(besked);
  });

  it('BB-315: «Løn på helligdage» under angivet løn læses kun ved Overenskomst og Manuelt angivet', () => {
    const statistik = project(sag({ loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)', loenPaaHelligdage: 'SH-udbetaling' }));
    expect(statistik.projection.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage).toBe('Almindelig løn');
    const manuel = project(sag({ loenudviklingBeregningsgrundlag: 'Manuelt angivet', loenPaaHelligdage: 'SH-udbetaling' }));
    expect(manuel.projection.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage).toBe('SH-udbetaling');
  });

  it('BB-316: manglende løntrin og gruppe meldes på én gang med feltets navn', () => {
    const { errorLines } = project(sag({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'kl-overenskomst' }));
    expect(errorLines).toContain('Løntrin og gruppe er ikke angivet');
  });

  describe('BB-310 – løntrin-finderen', () => {
    it('samler grupper med samme beløb og fortæller, hvilken satstabel svaret kommer fra', () => {
      const outcome = calculateLoentrinFinderResults({
        overenskomstId: 'kl-overenskomst',
        ansaettelse: 'Månedsløn',
        beloeb: amount(52000),
        dato: iso('2024-06-01'),
        amountFieldError: undefined,
        dateFieldError: undefined,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.satsDato <= iso('2024-06-01')).toBe(true);
      const keys = outcome.results.map((result) => `${String(result.loentrin)}:${result.beloeb}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('navngiver samlede grupper', () => {
      expect(formatLoentrinFinderResultLabel({ loentrin: 50, grupper: [0, 1, 2, 3, 4] })).toBe('Løntrin 50, alle grupper');
      expect(formatLoentrinFinderResultLabel({ loentrin: 38, grupper: [4] })).toBe('Løntrin 38, gruppe 4');
      expect(formatLoentrinFinderResultLabel({ loentrin: 12, grupper: [1, 2] })).toBe('Løntrin 12, gruppe 1 og 2');
    });
  });
});
