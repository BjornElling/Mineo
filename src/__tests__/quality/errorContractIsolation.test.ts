import fs from 'node:fs';
import path from 'node:path';
import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { compareFieldIssues, type FieldIssue, type FieldIssueReason } from '../../inputCore/inputIssue';
import { stamdataSkadedatoField } from '../../inputCore/catalog/stamdataDescriptors';

describe('error-kontrakt isolation', () => {
  it('afviser runtime fejl/diagnostik-felter i strict .eo save-schema', () => {
    const parsed = eoFileDataSchema.safeParse({
      fieldErrors: {
        stamdata: {
          skadedato: {
            source: 'input',
            severity: 'error',
            message: 'Ugyldig dato',
          },
        },
      },
      lastNotice: {
        message: 'advarsel',
        type: 'warning',
      },
      lastNoticeEpoch: 1,
      manuelReguleringInputErrors: { id: true },
    });

    expect(parsed.success).toBe(false);
  });
});

/**
 * R1-F07: kontraktens §4 hævdede prioritet "efter severity og reason/source". Koden prioriterer
 * `reason` → `code` → `message`; der findes ingen `source`-dimension (§11 forbyder source-registre), og
 * `severity` er en enkelt-værdi-literal (`'error'`), som ikke kan sortere noget.
 *
 * Teksten er rettet — men en ren tekstrettelse kan drifte igen. Suiten binder derfor kontraktens
 * NUMMEREREDE prioritetsliste til den faktiske komparator: rækkefølgen læses ud af `error-contract.md`
 * og bruges som testens forventning. Ændres den ene uden den anden, bliver dette rødt.
 */
describe('error-kontraktens feltprioritet er bundet til compareFieldIssues (§4)', () => {
  const CONTRACT_PATH = 'src/contracts/error-contract.md';

  /**
   * Udtrækker `reason`-rangordenen ud af kontraktens §4-punkt 1, som skriver den som en pilekæde:
   * `` `format` → `bounds` → `rule` → `schema` ``. Parseren er bevidst snæver: findes kæden ikke i den
   * form, fejler testen med sin egen forklaring frem for at falde tilbage på en hardkodet liste — en
   * fallback ville netop gøre bindingen til kontrakten illusorisk.
   */
  const contractReasonOrder = (): readonly string[] => {
    const contract = fs.readFileSync(path.resolve(process.cwd(), CONTRACT_PATH), 'utf8');
    const match = contract.match(/rangorden\s+((?:`[a-z]+`(?:\s*→\s*)?)+)/);
    expect(
      match,
      `${CONTRACT_PATH} §4 mangler reason-rangordenen som en \`a\` → \`b\`-kæde efter ordet "rangorden"`
    ).not.toBeNull();
    return (match?.[1] ?? '').split('→').map((part) => part.trim().replace(/`/g, ''));
  };

  const issueWith = (reason: FieldIssueReason, code: string, message: string): FieldIssue => ({
    kind: 'field',
    code,
    severity: 'error',
    field: stamdataSkadedatoField.bind(),
    reason,
    message,
  });

  it('kontraktens rangorden er præcis kernens fire reasons i kernens rækkefølge', () => {
    const order = contractReasonOrder();

    // Sorteres ÉT issue pr. reason med identisk code+message, kan kun `reason`-leddet afgøre
    // rækkefølgen. Resultatet er derfor komparatorens egen rangorden, læst ud af koden.
    const codeOrder = [...order]
      .map((reason) => issueWith(reason as FieldIssueReason, 'same', 'samme besked'))
      .sort(compareFieldIssues)
      .map((issue) => issue.reason);

    expect(codeOrder, 'compareFieldIssues rangerer reasons anderledes end kontrakten beskriver')
      .toEqual(order);
  });

  it('code er tie-break FØR message, og begge er leksikografiske', () => {
    const sorted = [
      issueWith('bounds', 'b-code', 'aaa besked'),
      issueWith('bounds', 'a-code', 'zzz besked'),
    ].sort(compareFieldIssues);

    // `a-code` vinder, SELV om dens besked sorterer sidst — altså er `code` det stærkere led.
    expect(sorted.map((issue) => issue.code)).toEqual(['a-code', 'b-code']);

    const byMessage = [
      issueWith('bounds', 'same', 'zzz besked'),
      issueWith('bounds', 'same', 'aaa besked'),
    ].sort(compareFieldIssues);
    expect(byMessage.map((issue) => issue.message)).toEqual(['aaa besked', 'zzz besked']);
  });

  it('rækkefølgen af INPUT påvirker ikke resultatet (deterministisk, jf. §4)', () => {
    const issues = [
      issueWith('schema', 'c', 'c'),
      issueWith('format', 'a', 'a'),
      issueWith('rule', 'b', 'b'),
      issueWith('bounds', 'd', 'd'),
    ];
    const forward = [...issues].sort(compareFieldIssues).map((issue) => issue.reason);
    const reversed = [...issues].reverse().sort(compareFieldIssues).map((issue) => issue.reason);

    expect(reversed, 'komparatoren er ikke rækkefølge-uafhængig').toEqual(forward);
  });
});
