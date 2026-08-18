import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';

test.describe('Brøkfeltet', () => {
  test('normaliserer indledende nuller og viser konkret fejl ved nævner nul', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');

    const input = page.locator("input[name='forligAnsvarsgradBroek']");
    await expect(input).toBeVisible();

    await setFieldValueAndSettle(input, '02/04');
    await expect(input).toHaveValue('2/4');
    await expect(input).toHaveAttribute('aria-invalid', 'false');

    await setFieldValueAndSettle(input, '1/0');
    await expect(input).toHaveValue('1/0');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.focus();
    await input.hover();
    await expect(page.getByText('Nævneren må ikke være 0', { exact: true })).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });
});
