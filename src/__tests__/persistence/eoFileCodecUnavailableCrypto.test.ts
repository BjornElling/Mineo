// @vitest-environment jsdom
import { decodeEoFile } from '../../utils/eoFileCodec';
import { resetKeyCache } from '../../utils/encryption';
import { logError } from '../../utils/logger';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
}));

describe('eoFileCodec – manglende kryptografikapabilitet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetKeyCache();
    vi.clearAllMocks();
  });

  it('fejler lukket og logger, når browserens crypto-kapabilitet mangler', async () => {
    // Envelope-formatet er gyldigt nok til at nå codecens dekrypteringsgrænse. Den manglende
    // browserkapabilitet skal derfor ikke forveksles med en korrupt .eo-fil eller give et falsk load.
    const encryptedEnvelope = JSON.stringify({
      version: 1,
      alg: 'A256GCM',
      ivB64: 'MDEyMzQ1Njc4OTAx',
      ctB64: 'Y2lwaGVydGV4dA==',
    });
    vi.stubGlobal('crypto', undefined);

    await expect(decodeEoFile(encryptedEnvelope)).rejects.toMatchObject({
      message: 'Kunne ikke dekryptere fil: Kryptering understøttes ikke i denne browser',
    });
    expect(logError).toHaveBeenCalledWith('Dekryptering fejlede', expect.objectContaining({
      context: 'eoFileCodec.decode',
    }));
  });
});
