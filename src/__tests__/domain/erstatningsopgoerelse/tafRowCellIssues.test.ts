import { collectTafRowCellIssues, isPeriodOverlapIssue } from '../../../domain/erstatningsopgoerelse/tafRowCellIssues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString, type ISODateString } from '../../../types/branded';

describe('collectTafRowCellIssues', () => {
  it('bruger systemets nedre datogrænse når skade-/anmeldelsesdato mangler', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      ferieperioder: [{
        id: 'f1',
        fra: toISODateString('2004-12-31'),
        til: toISODateString('2005-01-02'),
      }],
    };

    const issues = collectTafRowCellIssues(values, {
      skadedato: undefined,
      skadestype: 'Arbejdsulykke',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.field.descriptor.id).toBe('eo.ferieperioder.fra');
    expect(issues[0]?.message).toBe('Ferien ligger før 01-01-2005');
  });

  it('giver ingen celleissues når TAF-kravet ikke er Ja', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
    };

    expect(collectTafRowCellIssues(values, { skadedato: undefined, skadestype: 'Arbejdsulykke' })).toEqual([]);
  });

  it('marker begge fremtidige feriedatoer med dags dato-beskeden', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      ferieperioder: [{
        id: 'f1',
        fra: toISODateString('2100-01-01'),
        til: toISODateString('2100-01-02'),
      }],
    };

    const issues = collectTafRowCellIssues(values, {
      skadedato: undefined,
      skadestype: 'Arbejdsulykke',
    });

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringMatching(/^Ferien ligger efter dags dato \(/),
      expect.stringMatching(/^Ferien ligger efter dags dato \(/),
    ]);
  });

  it('bruger rå skadedato som defensiv fallback ved ugyldig runtime-dato', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      ferieperioder: [{
        id: 'f1',
        fra: toISODateString('2004-12-31'),
        til: toISODateString('2005-01-02'),
      }],
    };

    const issues = collectTafRowCellIssues(values, {
      skadedato: 'ugyldig-dato' as unknown as ISODateString,
      skadestype: 'Arbejdsulykke',
    });

    expect(issues[0]?.message).toBe('Ferien ligger før skadedatoen (ugyldig-dato)');
  });

  it('genkender overlap-issues på deres kode', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      ferieperioder: [],
      tafPerioder: [
        { id: 't1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-10'), loseFeriedage: 0 },
        { id: 't2', fra: toISODateString('2024-01-05'), til: toISODateString('2024-01-15'), loseFeriedage: 0 },
      ],
    };
    const [issue] = collectTafRowCellIssues(values, { skadedato: toISODateString('2018-06-01'), skadestype: 'Arbejdsulykke' });

    expect(issue).toBeDefined();
    if (!issue) return;
    expect(isPeriodOverlapIssue(issue)).toBe(true);
    expect(isPeriodOverlapIssue({ ...issue, code: 'eo.tafPerioder.fra.maksimum' })).toBe(false);
  });
});
