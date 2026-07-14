import {
  formatInputBlockerMessage,
  globalScope,
  rowScope,
  sectionScope,
  type InputBlocker,
} from '../../../domain/inputIntegrity/inputBlocker';
import {
  blockersForScope,
  documentGateFromBlockers,
} from '../../../domain/inputIntegrity/inputBlockerGate';

const invalidBlocker = (fieldId: string, fieldLabel: string, scope = sectionScope()): InputBlocker => ({
  fieldId,
  fieldLabel,
  reason: 'invalid',
  scope,
});

describe('formatInputBlockerMessage — central skabelon (error-contract §3A.2)', () => {
  it('ugyldig værdi er ensartet på tværs af kontroltyper og navngiver feltet', () => {
    expect(formatInputBlockerMessage(invalidBlocker('aargang', 'Satsår'))).toBe(
      'Der er udfyldt en ugyldig værdi i feltet Satsår'
    );
  });

  it('manglende tekst-/talfelt: "Feltet <navn> er ikke udfyldt"', () => {
    expect(
      formatInputBlockerMessage({
        fieldId: 'maanedsloen',
        fieldLabel: 'Månedsløn',
        reason: 'missing',
        scope: sectionScope(),
        controlKind: 'text',
      })
    ).toBe('Feltet Månedsløn er ikke udfyldt');
  });

  it('manglende dropdown/valg: "<navn> er ikke valgt"', () => {
    expect(
      formatInputBlockerMessage({
        fieldId: 'grundlag',
        fieldLabel: 'Beregningsgrundlag',
        reason: 'missing',
        scope: sectionScope(),
        controlKind: 'choice',
      })
    ).toBe('Beregningsgrundlag er ikke valgt');
  });

  it('manglende toggle/radio: "<navn> er ikke angivet"', () => {
    expect(
      formatInputBlockerMessage({
        fieldId: 'beregnes',
        fieldLabel: 'Beregnes tabt arbejdsfortjeneste',
        reason: 'missing',
        scope: sectionScope(),
        controlKind: 'toggle',
      })
    ).toBe('Beregnes tabt arbejdsfortjeneste er ikke angivet');
  });

  it('intervalfejl bruger den konkrete domæneforklaring', () => {
    expect(formatInputBlockerMessage({
      fieldId: 'aargang',
      fieldLabel: 'Satsår',
      reason: 'range',
      scope: sectionScope(),
      detail: 'Årstallet skal være mellem 2000 og 2026',
    })).toBe('Årstallet skal være mellem 2000 og 2026');
  });

  it('ingen brugervendt tekst må ende på " mangler" (error-contract §8.1-værn)', () => {
    const cases: InputBlocker[] = [
      { fieldId: 'a', fieldLabel: 'Feltet', reason: 'missing', scope: sectionScope(), controlKind: 'text' },
      { fieldId: 'a', fieldLabel: 'Feltet', reason: 'missing', scope: sectionScope(), controlKind: 'choice' },
      { fieldId: 'a', fieldLabel: 'Feltet', reason: 'missing', scope: sectionScope(), controlKind: 'toggle' },
      invalidBlocker('a', 'Feltet'),
    ];
    for (const c of cases) {
      expect(formatInputBlockerMessage(c).endsWith(' mangler')).toBe(false);
    }
  });
});

describe('blockersForScope — scope-opdeling (design §5.2)', () => {
  const b = [
    invalidBlocker('g', 'Global', globalScope()),
    invalidBlocker('r1:c', 'Række 1', rowScope('r1')),
    invalidBlocker('r2:c', 'Række 2', rowScope('r2')),
  ];

  it('aggregat (intet rowId) ser alle blockers', () => {
    expect(blockersForScope(b)).toHaveLength(3);
  });

  it('per-række-output ser kun global/section + sin egen rækkes blockers', () => {
    const forR1 = blockersForScope(b, 'r1');
    expect(forR1.map((x) => x.fieldId)).toEqual(['g', 'r1:c']);
    expect(forR1.some((x) => x.fieldId === 'r2:c')).toBe(false);
  });
});

describe('documentGateFromBlockers', () => {
  it('ingen relevante blockers → download tilladt', () => {
    expect(documentGateFromBlockers([], 'satser').canDownload).toBe(true);
  });

  it('en relevant blocker → blokeret med navngivet besked + auditerbar code', () => {
    const gate = documentGateFromBlockers([invalidBlocker('aargang', 'Satsår')], 'satser');
    expect(gate.canDownload).toBe(false);
    expect(gate.reasons[0]?.code).toBe('satser:invalid-input');
    expect(gate.reasons[0]?.message).toBe('Der er udfyldt en ugyldig værdi i feltet Satsår');
  });

  it('retningstest (a): gyldig række 1 + ugyldig række 2 → række 1 per-række-download forbliver aktiv', () => {
    const blockers = [invalidBlocker('r2:c', 'Renter fra', rowScope('r2'))];
    expect(documentGateFromBlockers(blockers, 'renteberegning', 'r1').canDownload).toBe(true);
  });

  it('retningstest (b): samme tilstand → aggregat-download er blokeret af den ugyldige række', () => {
    const blockers = [invalidBlocker('r2:c', 'Renter fra', rowScope('r2'))];
    expect(documentGateFromBlockers(blockers, 'renteberegning').canDownload).toBe(false);
  });
});
