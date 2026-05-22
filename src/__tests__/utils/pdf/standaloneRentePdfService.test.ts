const { mockGenerateRentePdf } = vi.hoisted(() => ({
  mockGenerateRentePdf: vi.fn(),
}));

vi.mock('../../../pdf/domains/renteberegning/rentePdf', () => ({
  generateRentePdf: mockGenerateRentePdf,
}));

import { downloadStandaloneRentePdf } from '../../../pdf/infrastructure/standaloneRentePdfService';

describe('downloadStandaloneRentePdf', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGenerateRentePdf.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('genererer neutral rente-PDF uden brevhoved, stamdata eller settings', async () => {
    const result = await downloadStandaloneRentePdf({
      beloeb: 5000,
      actualInterestDate: '01-06-2024',
      beregningsdato: '01-07-2024',
      periods: [],
      latestReferenceRateDate: null,
      kommentarer: 'Standalone',
    });

    expect(result.success).toBe(true);
    expect(mockGenerateRentePdf).toHaveBeenCalledWith(
      5000,
      '01-06-2024',
      '01-07-2024',
      [],
      {
        visBrevhoved: false,
        stamdata: null,
        kommentarer: 'Standalone',
        latestReferenceRateDate: null,
      }
    );
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateRentePdf.mockImplementationOnce(() => { throw new Error('Fejl'); });

    const result = await downloadStandaloneRentePdf({
      beloeb: 0,
      actualInterestDate: '01-01-2024',
      beregningsdato: '01-01-2024',
      periods: [],
      latestReferenceRateDate: null,
    });

    expect(result).toEqual({ success: false, error: 'Kunne ikke generere rente-PDF' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kunne ikke generere rente-PDF', expect.any(Error));
  });
});
