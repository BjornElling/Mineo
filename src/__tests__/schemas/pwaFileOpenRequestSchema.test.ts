// @vitest-environment jsdom

import { pwaFileOpenRequestSchema } from '../../schemas/pwaFileOpenRequestSchema';

const buildFileHandle = (name = 'test.eo'): FileSystemFileHandle => ({
  kind: 'file',
  name,
  getFile: vi.fn(),
} as unknown as FileSystemFileHandle);

describe('pwaFileOpenRequestSchema', () => {
  it.each([
    'pwa-open-1',
    'pwa-open-550e8400-e29b-41d4-a716-446655440000-1',
  ])('accepterer request-id med numerisk tæller: %s', (id) => {
    expect(pwaFileOpenRequestSchema.shape.id.safeParse(id).success).toBe(true);
  });

  it('accepterer en gyldig request og fjerner ukendte legacyfelter', () => {
    const parsed = pwaFileOpenRequestSchema.parse({
      id: 'pwa-open-1',
      createdAtEpochMs: 123,
      fileHandle: buildFileHandle(),
      fileName: 'test.eo',
      ignoredFileCount: 0,
      targetUrl: '/open',
    });

    expect(parsed).toEqual(expect.objectContaining({ id: 'pwa-open-1', fileName: 'test.eo' }));
    expect(parsed).not.toHaveProperty('targetUrl');
  });

  it.each([
    { id: 'pwa-open-x' },
    { id: 'pwa-open-1', createdAtEpochMs: -1 },
    { id: 'pwa-open-1', fileName: ' ' },
    { id: 'pwa-open-1', ignoredFileCount: -1 },
    { id: 'pwa-open-1', fileHandle: { kind: 'file' } },
  ])('afviser ugyldig persisted request: %o', (partial) => {
    const value: Record<string, unknown> = {
      id: 'pwa-open-1',
      createdAtEpochMs: 123,
      fileHandle: buildFileHandle(),
      fileName: 'test.eo',
      ignoredFileCount: 0,
    };
    Object.assign(value, partial);
    const result = pwaFileOpenRequestSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
