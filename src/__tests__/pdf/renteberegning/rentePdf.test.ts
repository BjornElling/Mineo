// @vitest-environment jsdom
import { generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';

describe('generateRenteDocument', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRenteDocument(1000, '01-01-2024', '31-01-2024', []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });
});
