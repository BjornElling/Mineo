import { expect, login, openPage, test } from './support/mineoTest';

const MISSING_BEREGNINGSDATO_MESSAGE = 'Beregningsdato er ikke udfyldt';

test.describe('EET-fejloversigt', () => {
  test('viser manglende beregningsdato præcis én gang på Differencekrav', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');
    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    const issueRows = page.locator('.row--label-right-hover').filter({
      has: page.getByText(MISSING_BEREGNINGSDATO_MESSAGE, { exact: true }),
    });
    await expect(issueRows).toHaveCount(1);
    const issueLink = issueRows.getByRole('button', { name: 'Grundlæggende oplysninger', exact: true });
    await expect(issueLink).toHaveCount(1);
    await issueLink.click();
    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('input[name="beregningsdato"]')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
