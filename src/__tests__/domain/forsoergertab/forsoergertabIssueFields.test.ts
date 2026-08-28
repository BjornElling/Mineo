import {
  FORSOERGERTAB_FIELD_BOUND_ISSUE_IDS,
  buildForsoergertabFieldIssues,
} from '../../../domain/forsoergertab/forsoergertabIssueFields';
import { readFileSync } from 'node:fs';

import { FORSOERGERTAB_MISSING_INPUT_ISSUE_IDS } from '../../../domain/forsoergertab/forsoergertabAslYdelser';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';

/**
 * BB-117: en efterladt under 18 år lod hele ASL-halvdelen forsvinde tavst, mens downloadknappen forblev
 * aktiv. Beskeden fandtes ordret i motoren, men var strukturelt ude af stand til at nå brugeren: den var et
 * feltløst `EetIssue` uden adresse, så der var ingen celle at male rød og intet at blokere på.
 *
 * Testene måler DEN egenskab – at issuet har en feltadresse – frem for beskedteksten. Et nyt
 * beregningsafvisende issue uden en post i kataloget er præcis den regression, fundet var.
 */
describe('forsoergertabIssueFields', () => {
  const errorIssue = (id: string, message = 'besked'): EetIssue => ({ id, severity: 'error', message });
  /**
   * Testens stand-in for `InputReader.labelOf`. Descriptorens kontekstfrie label er nok her: testene måler
   * ADRESSEN og reason, ikke navnet – og et felt med en kontekstuel label ville i produktionen få sit navn
   * gennem readeren, som holder den canonical view.
   */
  const labelOf = <T,>(field: FieldRef<T>): string => field.descriptor.label;

  it('giver BB-117s aldersissue en feltadresse på efterladtes fødselsdato', () => {
    const issues = buildForsoergertabFieldIssues([
      errorIssue('forsoergertab-alder-missing', 'Der findes ingen aldersrække for 17 år i tabel H.'),
    ], labelOf);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.field.address).toMatchObject({ section: 'forsoergertab', field: 'efterladteFodselsdato' });
    // Beskeden bæres uændret videre: motoren ejer ordlyden, kataloget kun adressen.
    expect(issues[0]?.message).toBe('Der findes ingen aldersrække for 17 år i tabel H.');
  });

  /**
   * `reason` er ikke kosmetisk: den styrer både tooltip-forkortelsen og issue-prioriteten (§1.8).
   * `'rule'` er det rigtige, fordi værdien ER repræsenterbar og gembar – en fødselsdato i 2008 er en
   * gyldig dato – men bryder en domæneregel, der først kendes efter opslaget i kapitaliseringstabellen.
   */
  it('markerer issues som domæneregler, ikke som bounds- eller formatfejl', () => {
    const issues = buildForsoergertabFieldIssues([errorIssue('forsoergertab-alder-missing')], labelOf);
    expect(issues[0]?.reason).toBe('rule');
    expect(issues[0]?.severity).toBe('error');
  });

  /**
   * `forsoergertab-faktor-unresolved` opstår, når den resterende periode er længere end aldersrækkens
   * faktorliste – fx en 64-årig efterladt med 10 års tilkendt periode. Rettelsen ligger i «Tilkendt for
   * periode», ikke i alderen, så feltet vælges efter hvad brugeren kan gøre ved det.
   */
  it('peger faktor-issuet på det felt, brugeren kan rette', () => {
    const issues = buildForsoergertabFieldIssues([errorIssue('forsoergertab-faktor-unresolved')], labelOf);
    expect(issues[0]?.field.address).toMatchObject({ field: 'tilkendtForPeriodeAar' });
  });

  it('bærer ikke advarsler videre som røde feltfejl', () => {
    const warning: EetIssue = { id: 'warn-asl-aarsloen-is-max', severity: 'warning', message: 'oplysning' };
    expect(buildForsoergertabFieldIssues([warning], labelOf)).toHaveLength(0);
  });

  /**
   * **Værnet mod et NYT tavst issue.**
   *
   * Testen aflæser motorens FAKTISKE issue-ID'er ud af kildefilen frem for at gentage dem i en literal
   * liste. Forskellen er hele pointen: en håndskrevet liste ville aldrig kende et issue, nogen tilføjer
   * i morgen – og et beregningsafvisende issue uden feltadresse er præcis den fejl, BB-117 var.
   *
   * Kun de issues, der AFVISER beregningen, kræver en adresse. «Feltet er ikke udfyldt endnu» håndteres
   * af download-gatens missing-input-grene og har derfor sin egen liste i motoren.
   */
  it('dækker alle ASL-motorens beregningsafvisende issues', () => {
    const kilde = readFileSync(
      new URL('../../../domain/forsoergertab/forsoergertabAslYdelser.ts', import.meta.url),
      'utf8'
    );
    const motorensIssueIds = [...kilde.matchAll(/toIssue\(\s*'([a-z0-9-]+)'/g)].map((m) => m[1]!);
    expect(motorensIssueIds.length).toBeGreaterThan(10);

    const beregningsafvisende = motorensIssueIds
      .filter((id) => !FORSOERGERTAB_MISSING_INPUT_ISSUE_IDS.has(id));
    expect(beregningsafvisende.length).toBeGreaterThan(0);

    for (const id of new Set(beregningsafvisende)) {
      expect(
        FORSOERGERTAB_FIELD_BOUND_ISSUE_IDS,
        `Issuet '${id}' afviser beregningen uden en feltadresse – det ville forsvinde tavst (BB-117). `
        + 'Tilføj en post i ISSUE_FIELDS, eller marker det som et rent manglende-input-issue.'
      ).toContain(id);
      expect(buildForsoergertabFieldIssues([errorIssue(id)], labelOf)).toHaveLength(1);
    }
  });

  it('ignorerer ukendte issue-id-er frem for at gætte en feltadresse', () => {
    expect(buildForsoergertabFieldIssues([errorIssue('et-issue-uden-felt')], labelOf)).toHaveLength(0);
  });
});
