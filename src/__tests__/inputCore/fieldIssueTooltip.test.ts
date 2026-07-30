import {
  FIELD_ISSUE_GENERIC_TOOLTIP,
  buildFieldIssueMessage,
  quoteFieldLabel,
  resolveFieldIssueTooltip,
  type FieldIssue,
  type FieldIssueReason,
} from '../../inputCore/inputIssue';
import { resolveFieldIssueText } from '../../inputCore/react/fieldIssueText';
import type { AnyFieldRef } from '../../inputCore/fieldDescriptor';

// Brugerkravet 2026-07-30: tooltippet og "Fejl og advarsler" viser ikke længere samme tekst. Testene her pinner
// SELVE reason→tekst-tabellen, så en ny reason eller en ændret ordlyd ikke kan glide igennem. Fladerne
// (skallerne + de tolv feltkomponenter) testes i fieldShells.test.tsx; her måles beslutningen isoleret.

const fieldRef = (label: string): AnyFieldRef => ({
  descriptor: { label },
  address: {},
} as unknown as AnyFieldRef);

const issue = (reason: FieldIssueReason, message: string): FieldIssue => ({
  kind: 'field',
  code: `test.${reason}`,
  severity: 'error',
  field: fieldRef('Beløb'),
  reason,
  message,
});

describe('resolveFieldIssueTooltip — reason afgør tooltipteksten', () => {
  it('forkorter `format` til den generiske tekst', () => {
    expect(resolveFieldIssueTooltip(issue('format', 'Der er udfyldt en ugyldig værdi i feltet \'Beløb\'')))
      .toBe(FIELD_ISSUE_GENERIC_TOOLTIP);
  });

  it('forkorter `schema` til den generiske tekst', () => {
    expect(resolveFieldIssueTooltip(issue('schema', 'Der er gemt en ugyldig værdi i feltet \'Beløb\'')))
      .toBe(FIELD_ISSUE_GENERIC_TOOLTIP);
  });

  /**
   * Kernen i beslutningen: `bounds`/`rule`-beskeden fortæller HVAD der skal rettes, og det er den eneste
   * brugbare del i et tooltip. Forkortes de, skjules rettelsen præcis dér, hvor brugeren kigger efter den.
   */
  it('citerer `bounds` ordret — grænserne er hele informationen', () => {
    const message = 'Procenten skal være mellem 0 og 100';
    expect(resolveFieldIssueTooltip(issue('bounds', message))).toBe(message);
  });

  it('citerer `rule` ordret', () => {
    const message = 'Datoen skal ligge efter skadedatoen';
    expect(resolveFieldIssueTooltip(issue('rule', message))).toBe(message);
  });

  /**
   * Dækningsværn: rammer tabellen ALLE reasons? En ny `FieldIssueReason` uden en bevidst placering ville
   * ellers arve `bounds`/`rule`-grenen i tavshed (default-udfaldet er "citér ordret").
   */
  it('har et bevidst udfald for hver reason i typen', () => {
    const allReasons: readonly FieldIssueReason[] = ['format', 'bounds', 'rule', 'schema'];
    const generic = allReasons.filter((r) => resolveFieldIssueTooltip(issue(r, 'konkret besked')) === FIELD_ISSUE_GENERIC_TOOLTIP);
    const verbatim = allReasons.filter((r) => resolveFieldIssueTooltip(issue(r, 'konkret besked')) === 'konkret besked');
    expect([...generic].sort()).toEqual(['format', 'schema']);
    expect([...verbatim].sort()).toEqual(['bounds', 'rule']);
    // Ingen reason må falde uden for de to grene.
    expect(generic.length + verbatim.length).toBe(allReasons.length);
  });
});

describe('feltnavn i anførselstegn', () => {
  it('citerer labelen i format-beskeden', () => {
    expect(buildFieldIssueMessage(fieldRef('Hvis genopt. - tidl. kap.dato')))
      .toBe('Der er udfyldt en ugyldig værdi i feltet \'Hvis genopt. - tidl. kap.dato\'');
  });

  it('quoteFieldLabel er den ene form', () => {
    expect(quoteFieldLabel('Beløb')).toBe('\'Beløb\'');
  });
});

describe('resolveFieldIssueText — de to tekster ved siden af hinanden', () => {
  it('giver fuld besked + generisk tooltip for et format-issue', () => {
    const full = 'Der er udfyldt en ugyldig værdi i feltet \'Beløb\'';
    expect(resolveFieldIssueText(issue('format', full))).toEqual({
      message: full,
      tooltip: FIELD_ISSUE_GENERIC_TOOLTIP,
    });
  });

  it('giver samme tekst begge steder for et bounds-issue', () => {
    const full = 'Procenten skal være mellem 0 og 100';
    expect(resolveFieldIssueText(issue('bounds', full))).toEqual({ message: full, tooltip: full });
  });

  it('er tom, når feltet ikke har noget issue', () => {
    expect(resolveFieldIssueText(undefined)).toEqual({ message: undefined, tooltip: undefined });
  });

  /** §1.8: descriptorens eget issue har forrang over et eksternt collection-/tværfelt-issue. */
  it('lader descriptorens eget issue vinde over det eksterne', () => {
    const own = issue('format', 'egen besked');
    const external = issue('rule', 'ekstern besked');
    expect(resolveFieldIssueText(own, external).message).toBe('egen besked');
  });

  it('bruger det eksterne issue, når feltet ikke selv har et — MED dets egen tooltipklasse', () => {
    const external = issue('rule', 'Datoen er en dublet');
    expect(resolveFieldIssueText(undefined, external)).toEqual({
      message: 'Datoen er en dublet',
      tooltip: 'Datoen er en dublet',
    });
  });
});
