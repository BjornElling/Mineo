import { generateRentePdf } from '../../../pdf/domains/renteberegning/rentePdf';

describe('generateRentePdf', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRentePdf(1000, '01-01-2024', '31-01-2024', []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });
});
