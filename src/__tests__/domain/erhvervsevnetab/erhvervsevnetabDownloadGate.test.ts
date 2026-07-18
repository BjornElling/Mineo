// @vitest-environment jsdom
import {
  evaluateEetFaneDownloadGate,
  evaluateErhvervsevnetabDownloadGates,
  type EetDocumentFane,
} from '../../../domain/erhvervsevnetab/erhvervsevnetabDownloadGate';
import { isEetFieldErrorIssueId } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { buildErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import type { EetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

// Greenfield Erhvervsevnetab download-gate (§3.4/§5.4/§1.10, Fase 3-slice). Beviser at gaten:
//   (a) pr. fane oversætter snapshottets `hasBlockingErrors`/`computation` til den korrekte reason-kode
//       (field-error vs missing-fields vs no-result vs tilladt), som den tidligere `!hasBlockingErrors && computation`,
//   (b) bevarer den DEPENDENCY-SPECIFIKKE per-fane-blokering (§1.10): et EAL-felt-fejl blokerer KUN EAL-downloaden,
//   (c) prioriterer en rød feltfejl over en manglende-felt-fejl,
//   (d) bygger på den ENE reader-projektion, så gaten og sidevisningen ikke kan drifte fra hinanden.

const catalog = getProductionInputCatalog();
const asAmount = (value: number) => ({ kind: 'number' as const, value });

const validErhvervsevnetab: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  koen: 'Kvinde',
  ealEetPct: 25,
  aslAfgoerelser: [
    {
      id: 'eet_asl_row1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: toISODateString('2026-02-01'),
      eetPct: 25,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
};
const validFaellesAarsloen: FaellesAarsloenValues = {
  aslAarsloen: asAmount(600000),
  ealAarsloen: asAmount(600000),
};
const validStamdata: StamdataValues = {
  journalnr: 'J',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2024-07-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (
  erhvervsevnetab: ErhvervsevnetabValues,
  faellesAarsloen: FaellesAarsloenValues,
  stamdata: StamdataValues | null,
  erstatningsopgoerelse: ReturnType<typeof createErstatningsopgoerelseInitialValues> | null = null
) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab: null,
      erstatningsopgoerelse,
      erhvervsevnetab,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken, settings: DEFAULT_APP_SETTINGS }).reader;
};

// ─── Den rene per-fane sandhedstabel (syntetiske fane-projektioner) ───────────────────────────────

const faneProjection = (
  issues: readonly EetIssue[],
  computation: unknown
): EetSnapshot[EetDocumentFane] =>
  ({
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === 'error'),
    computation,
  }) as EetSnapshot[EetDocumentFane];

const fieldIssue = (id: string): EetIssue => ({ id, severity: 'error', message: 'fejl' });
const missingIssue = (id: string): EetIssue => ({ id, severity: 'error', message: 'mangler' });
const warningIssue = (id: string): EetIssue => ({ id, severity: 'warning', message: 'advarsel' });

describe('evaluateEetFaneDownloadGate (ren sandhedstabel)', () => {
  it('tillader download, når fanen er ready med et beregningsresultat', () => {
    const gate = evaluateEetFaneDownloadGate('loebendeYdelser', faneProjection([], { ok: true }));
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('tillader download trods en warning (warnings blokerer aldrig, §1.7)', () => {
    const gate = evaluateEetFaneDownloadGate(
      'kapitalisering',
      faneProjection([warningIssue('warn-asl-eet-under-15')], { ok: true })
    );
    expect(gate.canDownload).toBe(true);
  });

  it('blokerer med field-error ved en rød feltfejl', () => {
    const gate = evaluateEetFaneDownloadGate('efterEal', faneProjection([fieldIssue('field-eal-eet-pct')], null));
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]).toEqual({ code: 'eet-efter-eal:field-error', message: 'Fejl i indtastning' });
  });

  it('blokerer med missing-fields, når fanen KUN er blokeret af manglende/afledte consumer-fejl', () => {
    const gate = evaluateEetFaneDownloadGate('efterEal', faneProjection([missingIssue('eet-pct-missing')], null));
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]).toEqual({ code: 'eet-efter-eal:missing-fields', message: 'Indtastning mangler' });
  });

  it('prioriterer en rød feltfejl over en manglende-felt-fejl', () => {
    const gate = evaluateEetFaneDownloadGate(
      'differencekrav',
      faneProjection([missingIssue('eet-pct-missing'), fieldIssue('field-beregningsdato')], null)
    );
    expect(gate.reasons[0]?.code).toBe('eet-differencekrav:field-error');
  });

  it('blokerer med no-result, når fanen er ready men uden beregningsresultat', () => {
    const gate = evaluateEetFaneDownloadGate('loebendeYdelser', faneProjection([], null));
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]).toEqual({
      code: 'eet-loebende-ydelser:no-result',
      message: 'Beregning kan ikke dannes',
    });
  });
});

// ─── Klassifikationens ét-sande-sted (isEetFieldErrorIssueId) ─────────────────────────────────────

describe('isEetFieldErrorIssueId', () => {
  it('klassificerer format-/bounds-/rule-issues som røde feltfejl', () => {
    for (const id of [
      'field-beregningsdato',
      'field-eal-eet-pct',
      'field-aarsloen-asl',
      'field-asl-afgoerelser',
      'stamdata-date-order:skadedato',
      'forlig-ansvarsgrad-invalid',
      'runtime-exception',
      'beregningsdato-invalid',
      'eal-eet-pct-invalid',
      'asl-selected-eet-pct-invalid',
    ]) {
      expect(isEetFieldErrorIssueId(id)).toBe(true);
    }
  });

  it('klassificerer manglende-/afledte consumer-issues som IKKE-feltfejl', () => {
    for (const id of [
      'beregningsdato-missing',
      'eet-pct-missing',
      'eal-aarsloen-missing',
      'asl-afgoerelser-empty',
      'no-endelig-afgoerelser',
      'kapitaliseringstabel-missing',
    ]) {
      expect(isEetFieldErrorIssueId(id)).toBe(false);
    }
  });
});

// ─── Fuld projektion → gates (den ægte reader-sti, §1.10-isolation) ───────────────────────────────

describe('evaluateErhvervsevnetabDownloadGates (fra reader-projektionen)', () => {
  it('tillader alle fire faner for en gyldig sag', () => {
    const projection = buildErhvervsevnetabReaderProjection(
      buildReader(validErhvervsevnetab, validFaellesAarsloen, validStamdata)
    );
    const gates = evaluateErhvervsevnetabDownloadGates(projection);
    expect(gates.efterEal.canDownload).toBe(true);
    expect(gates.differencekrav.canDownload).toBe(true);
  });

  it('§1.10: en ealEetPct-bounds-feltfejl blokerer KUN EET efter EAL-downloaden med field-error', () => {
    // ealEetPct=150 er uden for 0..100 → rød reader-feltfejl. Kun EAL-fanen aftager ealEetPct, så KUN dens
    // download må blokeres — løbende ydelser/kapitalisering/differencekrav er upåvirkede (dependency-specifikt).
    const projection = buildErhvervsevnetabReaderProjection(
      buildReader({ ...validErhvervsevnetab, ealEetPct: 150 }, validFaellesAarsloen, validStamdata)
    );
    const gates = evaluateErhvervsevnetabDownloadGates(projection);
    expect(gates.efterEal.canDownload).toBe(false);
    expect(gates.efterEal.reasons[0]?.code).toBe('eet-efter-eal:field-error');
    // Ikke-EAL-faner må ikke overblokeres af et EAL-felt.
    expect(gates.loebendeYdelser.reasons.some((r) => r.code === 'eet-efter-eal:field-error')).toBe(false);
    expect(gates.kapitalisering.reasons.some((r) => r.code === 'eet-efter-eal:field-error')).toBe(false);
  });

  it('§1.10: en beregningsdato-bounds-feltfejl blokerer de afhængige faner med field-error', () => {
    // Beregningsdato før skadedato → rød bounds-feltfejl på løbende ydelser, EET efter EAL og differencekrav.
    const projection = buildErhvervsevnetabReaderProjection(
      buildReader({ ...validErhvervsevnetab, beregningsdato: toISODateString('2020-01-01') }, validFaellesAarsloen, validStamdata)
    );
    const gates = evaluateErhvervsevnetabDownloadGates(projection);
    expect(gates.loebendeYdelser.reasons[0]?.code).toBe('eet-loebende-ydelser:field-error');
    expect(gates.efterEal.reasons[0]?.code).toBe('eet-efter-eal:field-error');
    expect(gates.differencekrav.reasons[0]?.code).toBe('eet-differencekrav:field-error');
  });

  it('blokerer differencekrav-downloaden ved et ugyldigt forlig (begge felter udfyldt)', () => {
    const projection = buildErhvervsevnetabReaderProjection(
      buildReader(validErhvervsevnetab, validFaellesAarsloen, validStamdata, {
        ...createErstatningsopgoerelseInitialValues(),
        forligAnsvarsgradProcent: 50,
        forligAnsvarsgradBroek: '1/2',
      })
    );
    const gates = evaluateErhvervsevnetabDownloadGates(projection);
    expect(gates.differencekrav.canDownload).toBe(false);
    expect(gates.differencekrav.reasons[0]?.code).toBe('eet-differencekrav:field-error');
  });
});
