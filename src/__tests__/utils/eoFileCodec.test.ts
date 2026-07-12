// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { buildEoFileContainer, encodeEoFile, decodeEoFile } from '../../utils/eoFileCodec';
import { encryptToString } from '../../utils/encryption';
import { CalculationError } from '../../utils/errorMessages';
import { FILE_FORMAT_VERSION } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { VERSION } from '../../config/buildInfo';
import { toISODateString } from '../../types/branded';
import type { CanonicalEoData } from '../../utils/fileSaveTypes';

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

const canonicalData = {
  stamdata: {
    journalnr: 'J-CODEC',
    advokat: '',
    sagsbehandler: '',
    skadelidte: 'Codec Test',
    skadestype: 'Arbejdsulykke',
    skadedato: toISODateString('2024-02-02'),
  },
} as unknown as CanonicalEoData;

describe('eoFileCodec', () => {
  describe('buildEoFileContainer', () => {
    it('stempler container-version + metadata omkring sagsdata', () => {
      const container = buildEoFileContainer(canonicalData, 6);
      expect(container.version).toBe(FILE_FORMAT_VERSION);
      expect(container._metadata.appVersion).toBe(VERSION);
      expect(container._metadata.persistedDataVersion).toBe(PERSISTED_DATA_VERSION);
      expect(container._metadata.fieldCount).toBe(6);
      expect(typeof container._metadata.exportDate).toBe('string');
      expect(container.data).toBe(canonicalData);
    });
  });

  describe('encode → decode round-trip', () => {
    it('afkoder præcis det encode byggede', async () => {
      const container = buildEoFileContainer(canonicalData, 6);
      const content = await encodeEoFile(container);
      const decoded = await decodeEoFile(content);
      expect(decoded.version).toBe(FILE_FORMAT_VERSION);
      expect(decoded._metadata.persistedDataVersion).toBe(PERSISTED_DATA_VERSION);
      expect(decoded.data).toEqual(container.data);
    });
  });

  describe('decodeEoFile — fejl-semantik', () => {
    it('mapper dekrypteringsfejl (ikke-.eo-indhold) til CalculationError FILE_LOAD_FAILED', async () => {
      await expect(decodeEoFile('ikke en gyldig krypteret streng')).rejects.toBeInstanceOf(CalculationError);
      await expect(decodeEoFile('ikke en gyldig krypteret streng')).rejects.toMatchObject({
        code: 'FILE_LOAD_FAILED',
      });
    });

    it('afviser forkert filversion med en eksplicit dansk versionsfejl', async () => {
      const content = await encryptToString({
        version: 'v0-forkert',
        _metadata: {
          exportDate: '2026-01-01T00:00:00.000Z',
          appVersion: VERSION,
          persistedDataVersion: PERSISTED_DATA_VERSION,
          fieldCount: 1,
        },
        data: canonicalData,
      });
      await expect(decodeEoFile(content)).rejects.toThrow(/filversion/i);
    });

    it('afviser ugyldig container-struktur med dansk struktur-fejl', async () => {
      const content = await encryptToString({
        version: FILE_FORMAT_VERSION,
        // _metadata mangler helt → strict container-schema fejler
        data: canonicalData,
      });
      await expect(decodeEoFile(content)).rejects.toThrow(/ugyldig \.eo-struktur/i);
    });

    it('accepterer en manglende persistedDataVersion (load-tolerant legacy-baseline)', async () => {
      const content = await encryptToString({
        version: FILE_FORMAT_VERSION,
        _metadata: {
          exportDate: '2026-01-01T00:00:00.000Z',
          appVersion: VERSION,
          fieldCount: 1,
        },
        data: canonicalData,
      });
      const decoded = await decodeEoFile(content);
      expect(decoded._metadata.persistedDataVersion).toBeUndefined();
    });
  });
});
