import { dedupeIssuesByIdentity } from '../../utils/issueUtils';

describe('dedupeIssuesByIdentity', () => {
  it('bevarer den første forklaring, når samme issue kun afviger med et afsluttende punktum', () => {
    const issues = dedupeIssuesByIdentity([
      { id: 'beregningsdato-missing', severity: 'error', message: 'Beregningsdato er ikke udfyldt' },
      { id: 'beregningsdato-missing', severity: 'error', message: 'Beregningsdato er ikke udfyldt.' },
    ]);

    expect(issues).toEqual([
      { id: 'beregningsdato-missing', severity: 'error', message: 'Beregningsdato er ikke udfyldt' },
    ]);
  });

  it('bevarer samme tekst fra forskellige issues, fordi de kan pege på forskellige felter', () => {
    const issues = dedupeIssuesByIdentity([
      { id: 'skadedato-missing', severity: 'error', message: 'Dato mangler' },
      { id: 'beregningsdato-missing', severity: 'error', message: 'Dato mangler' },
    ]);

    expect(issues).toHaveLength(2);
  });

  it('bevarer forskellige forklaringer fra samme issue-id', () => {
    const issues = dedupeIssuesByIdentity([
      { id: 'aarsloen-max-missing', severity: 'error', message: 'ASL-maks-sats mangler for år 2025' },
      { id: 'aarsloen-max-missing', severity: 'error', message: 'ASL-maks-sats mangler for år 2026' },
    ]);

    expect(issues).toHaveLength(2);
  });
});
