import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const MISSING_BEREGNINGSDATO_MESSAGE = 'Beregningsdato er ikke udfyldt';
const MISSING_KOEN_MESSAGE = 'Køn skal angives, når kapitaliseringen sker før 1. marts 2015';

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

  test('samler køn-fejlen og fører til Grundlæggende oplysninger', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), '01-01-1970');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-06-2010');

    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-06-2014');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');
    await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Afgørelsesdato' }).first(), '01-06-2012');
    await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Virkningsdato' }).first(), '01-01-2012');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'EET %' }).first(), '25');
    const afgoerelsestype = page.getByRole('combobox', { name: 'Afgørelsestype' }).first();
    await afgoerelsestype.click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();
    await expect(afgoerelsestype).toHaveValue('Endelig');
    await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Kap.dato' }).first(), '01-06-2012');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Kap. %' }).first(), '25');

    await page.getByRole('tab', { name: 'Differencekrav' }).click();
    const issueRows = page.locator('.row--label-right-hover').filter({
      has: page.getByText(MISSING_KOEN_MESSAGE, { exact: true }),
    });
    await expect(issueRows).toHaveCount(1);

    await issueRows.getByRole('button', { name: 'Grundlæggende oplysninger', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('combobox', { name: 'Køn' })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('viser alle røde celler i afgørelsestabellen og fører til hver celle', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), '01-01-1970');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-06-2018');

    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-06-2022');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');
    await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Afgørelsesdato' }).first(), '01-06-2020');
    await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Virkningsdato' }).first(), '01-01-2020');
    const afgoerelsestype = page.getByRole('combobox', { name: 'Afgørelsestype' }).first();
    await afgoerelsestype.click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();
    await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Kap.dato' }).first(), '01-06-2020');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'EET %' }).first(), '101');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Kap. %' }).first(), '105');

    for (const fane of ['Løbende ydelser', 'Kapitalisering', 'Differencekrav']) {
      await page.getByRole('tab', { name: fane }).click();
      await expect(page.getByText('Afgørelsen af 01-06-2020, EET %: Erhvervsevnetabet skal være mellem 5 og 100', { exact: true }))
        .toBeVisible();
      await expect(page.getByText(/^Afgørelsen af 01-06-2020, Kap\. %: /)).toBeVisible();
    }

    // Linjen fører til netop sin celle, ikke kun til tabellens første række/kolonne: blinkmarkeringen lander på
    // den editor, hvis feltadresse er Kap. %-cellens.
    await page.evaluate(() => {
      const blinked: string[] = [];
      (window as unknown as { __blinkedFields: string[] }).__blinkedFields = blinked;
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const target = mutation.target as HTMLElement;
          if (!target.classList.contains('mineo-field-attention-blink')) continue;
          const host = target.closest('[data-mineo-field-address]') ?? target.querySelector('[data-mineo-field-address]');
          blinked.push(host?.getAttribute('data-mineo-field-address') ?? '');
        }
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    const kapRow = page.locator('.row--label-right-hover').filter({ has: page.getByText(/^Afgørelsen af 01-06-2020, Kap\. %: /) });
    await kapRow.getByRole('button', { name: 'Arbejdsskadesikringsloven', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __blinkedFields: string[] }).__blinkedFields))
      .toContainEqual(expect.stringContaining('"field":"kapPct"'));
    expect(runtimeErrors).toEqual([]);
  });
});
