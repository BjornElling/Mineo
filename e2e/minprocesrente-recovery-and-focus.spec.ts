import { expect, test } from '@playwright/test';

import { setFieldValueAndSettle } from './support/mineoTest';

test.describe('MinProcesrente — recovery og fokus', () => {
  test('rydder en afvist beregningsdato og bevarer fokus på Indsæt dags dato', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/minprocesrente.html');

    const dateInput = page.locator('input[name="beregningsdato"]');
    const clearAllButton = page.getByRole('button', { name: 'Slet alle indtastninger' });
    const insertTodayButton = page.getByRole('button', { name: 'Indsæt dags dato' });
    await expect(dateInput).toBeVisible();
    await expect(clearAllButton).toBeDisabled();

    await setFieldValueAndSettle(dateInput, '99-99-9999');
    await expect(dateInput).toHaveAttribute('aria-invalid', 'true');

    // BF-055: afvist tekst er stadig brugerdata, som skal kunne ryddes centralt.
    await expect(clearAllButton).toBeEnabled();
    await clearAllButton.click();
    await page.getByRole('button', { name: 'Ja, slet' }).click();
    await expect(dateInput).toHaveValue('');
    await expect(clearAllButton).toBeDisabled();

    // BF-056: native knapfokus bevares efter commit; næste Tab fortsætter derfor forudsigeligt.
    await insertTodayButton.focus();
    await insertTodayButton.press('Enter');
    await expect(insertTodayButton).toBeFocused();

    expect(runtimeErrors).toEqual([]);
  });
});
