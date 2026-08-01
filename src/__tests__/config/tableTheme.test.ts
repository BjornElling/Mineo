import { getHtmlTableStyles, getMuiTableStyles } from '../../config/tableTheme';

describe('tableTheme typografisignaturer', () => {
  it('giver 13 px- og 14 px-tabeller forskellige, komplette debug-signaturer', () => {
    const regular = getMuiTableStyles(false) as Record<string, unknown>;
    const small = getMuiTableStyles(true) as Record<string, unknown>;

    expect(regular.fontSize).toBe('var(--font-size-text)');
    expect(small.fontSize).toBe('var(--font-size-text-table)');
    expect(regular['--mineo-color-active-grid-text']).toBe('var(--mineo-color-grid-table-text-regular)');
    expect(small['--mineo-color-active-grid-text']).toBe('var(--mineo-color-grid-table-text-small)');
    expect(regular['--mineo-color-active-grid-header']).toBe('var(--mineo-color-grid-header-regular)');
    expect(small['--mineo-color-active-grid-header']).toBe('var(--mineo-color-grid-header-small)');
    expect(regular['--mineo-color-active-grid-placeholder'])
      .not.toBe(small['--mineo-color-active-grid-placeholder']);
    expect(regular['--mineo-color-active-grid-derived'])
      .not.toBe(small['--mineo-color-active-grid-derived']);
  });

  it('bruger den valgte signatur på HTML-tabellens tekst', () => {
    const styles = getHtmlTableStyles(true) as Record<string, unknown>;

    expect(styles.color).toBe('var(--mineo-color-active-grid-text)');
    expect(styles.fontFamily).toBe("'Montserrat', sans-serif");
    expect(styles.fontVariantNumeric).toBe('tabular-nums');
    expect(styles.fontWeight).toBe(400);
    expect(styles.lineHeight).toBe('normal');
  });
});
