import { appendFileSync } from 'node:fs';
import type { FullResult, Reporter, TestCase } from '@playwright/test/reporter';

/**
 * Skriver de flaky tests – dem der først bestod ved et genforsøg – i GitHub-jobbets opsummering.
 *
 * Genforsøgene i CI findes, så et enkelt netværksudfald ikke vælter en deploy. Prisen var, at en test
 * der kun består i andet forsøg, gav et grønt job uden spor; sådan kunne en ægte flakiness leve i ugevis.
 * `github`-reporteren annoterer dem på kørselssiden; denne reporter lægger listen i jobbets opsummering,
 * så den ses uden at åbne loggen. Den gør intet uden for GitHub Actions.
 */
export default class FlakySummaryReporter implements Reporter {
  // `outcome()` er først endelig efter testens sidste forsøg, så det aflæses ved afslutningen.
  private readonly tests = new Set<TestCase>();

  onTestEnd(test: TestCase): void {
    this.tests.add(test);
  }

  onEnd(_result: FullResult): void {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    const flaky = [...this.tests].filter((test) => test.outcome() === 'flaky');
    if (summaryPath === undefined || summaryPath === '' || flaky.length === 0) return;

    const lines = flaky.map((test) => {
      const title = test.titlePath().filter(Boolean).slice(1).join(' › ');
      return `- \`${test.location.file.replace(/^.*?[\\/]e2e[\\/]/, 'e2e/')}:${test.location.line}\` ${title}`;
    });
    appendFileSync(
      summaryPath,
      [
        `### ⚠️ ${flaky.length} flaky E2E-test${flaky.length === 1 ? '' : 's'}`,
        '',
        'Bestod først ved genforsøg. Jobbet er grønt, men testen er ustabil og skal undersøges.',
        '',
        ...lines,
        '',
      ].join('\n'),
    );
  }

  printsToStdio(): boolean {
    return false;
  }
}
