import { evaluateVarigeMenDownloadGate } from '../../../domain/varigemen/varigeMenDownloadGate';
import type { VarigeMenProjectionData, VarigeMenReaderProjection } from '../../../domain/varigemen/varigeMenReaderProjection';
import type { FieldIssue, ConsumerIssue } from '../../../inputCore/inputIssue';
import { createInputRevision, createSettingsRevision, type EvaluationSourceToken } from '../../../inputCore/evaluationSource';
import type { AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import { toISODateString } from '../../../types/branded';
import type { VarigeMenBeregningResult } from '../../../domain/varigemen/varigeMenCalculations';

// Greenfield-gate (§A2/§3.4/§5.4): gaten afledes nu af den ENE reader-projektion. Sandhedstabellen er uændret:
//   - projektion blokeret af en rød feltfejl → varigemen:field-error,
//   - projektion blokeret KUN af missing → varigemen:missing-fields,
//   - projektion ready men beregningsResultat=null → varigemen:no-result,
//   - projektion ready med resultat → tilladt.
// Datoordenen (skadedato < fødselsdato) er nu en rød feltfejl på stamdata-datoerne (jf. stamdataDescriptors), så
// den byttede orden manifesterer sig som `field-error` – ikke længere en separat gate-kode.

const TOKEN: EvaluationSourceToken = {
  inputRevision: createInputRevision(1),
  settingsRevision: createSettingsRevision(0),
};
const FAKE_FIELD = { descriptor: { id: 'x' } } as unknown as AnyFieldRef;

const fieldIssue = (code: string): FieldIssue => ({
  kind: 'field',
  code,
  severity: 'error',
  field: FAKE_FIELD,
  reason: 'bounds',
  message: 'fejl',
});

const missingIssue = (code: string): ConsumerIssue => ({
  kind: 'consumer',
  code,
  severity: 'error',
  consumerId: 'document.varigemen',
  reason: 'missing',
  message: 'mangler',
});

const beregningsResultat: VarigeMenBeregningResult = {
  beregnetGodtgoerelse: 10000,
  grundbeloeb: 100000,
  satsPerMengrad: 1000,
  aldersreduktionPct: 0,
  grundbeloebUdenReduktion: 10000,
  aldersreduktionBeloeb: 0,
  beregningsaar: 2020,
  alderVedSkade: 40,
};

const readyProjection = (
  result: VarigeMenBeregningResult | null
): VarigeMenReaderProjection => {
  const value: VarigeMenProjectionData = {
    mengrad: 10,
    beregningsdato: toISODateString('2020-01-01'),
    fodselsdato: toISODateString('1980-01-01'),
    skadedato: toISODateString('2020-01-01'),
    beregningsResultat: result,
  };
  return { status: 'ready', value, issues: [], sourceToken: TOKEN };
};

const blockedProjection = (
  issues: readonly (FieldIssue | ConsumerIssue)[]
): VarigeMenReaderProjection => ({
  status: 'blocked',
  issues,
  sourceToken: TOKEN,
});

describe('varigeMenDownloadGate', () => {
  it('tillader download når projektionen er ready og har et beregningsresultat', () => {
    const gate = evaluateVarigeMenDownloadGate(readyProjection(beregningsResultat));
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('blokerer ved en rød feltfejl (højeste prioritet)', () => {
    const gate = evaluateVarigeMenDownloadGate(
      blockedProjection([fieldIssue('varigemen.mengrad.bounds')])
    );
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:field-error');
  });

  it('lader en rød feltfejl vinde over en samtidig missing-fejl', () => {
    const gate = evaluateVarigeMenDownloadGate(
      blockedProjection([
        missingIssue('document.varigemen.missing.varigemen.beregningsdato'),
        fieldIssue('varigemen.mengrad.bounds'),
      ])
    );
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:field-error');
    // Flere samtidige årsager må ikke skjules af den konkrete bounds-besked.
    expect(gate.reasons[0]?.kind).toBe('invalid-input');
  });

  /**
   * TO røde felter ⇒ klasseteksten, ikke et citat af det ene.
   *
   * Gaten valgte før ÉT feltissue med `.find()` og citerede det, så to samtidige røde felter fremstod som
   * én fejl – brugeren fik at vide, at méngraden var problemet, mens også datoen var rød. Fejlen blev fanget
   * af browsertesten (`e2e/download-tooltip-classes.spec.ts`), ikke af unit-testene, fordi den kun var
   * synlig i den færdige tooltip.
   */
  it('citerer IKKE, når to felter er røde samtidig', () => {
    const gate = evaluateVarigeMenDownloadGate(
      blockedProjection([
        fieldIssue('varigemen.mengrad.bounds'),
        fieldIssue('stamdata.skadelidteFodselsdato.bounds'),
      ])
    );
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.kind).toBe('invalid-input');
  });

  /**
   * Sondringen ligger nu i `kind`, ikke i to forskellige koder: gaten sender HELE issue-listen til
   * `classifyBlockingCauses` under én kode, og klassen – som afgør brugerteksten – udledes derfra.
   * Tidligere valgte gaten selv mellem `field-error` og `missing-fields`, og kunne derfor kun se ÉT
   * feltissue ad gangen.
   */
  it('blokerer ved manglende felter (kun consumerfejl) med missing-input-klassen', () => {
    const gate = evaluateVarigeMenDownloadGate(
      blockedProjection([missingIssue('document.varigemen.missing.varigemen.mengrad')])
    );
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.kind).toBe('missing-input');
  });

  it('blokerer når beregningen ikke kan dannes (ready uden resultat)', () => {
    const gate = evaluateVarigeMenDownloadGate(readyProjection(null));
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:no-result');
  });

  it('mapper en byttet datoorden (rød feltfejl) til field-error', () => {
    const gate = evaluateVarigeMenDownloadGate(
      blockedProjection([fieldIssue('stamdata.skadedato.bounds')])
    );
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('varigemen:field-error');
  });
});
