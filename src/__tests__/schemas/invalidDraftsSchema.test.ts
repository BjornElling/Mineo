import { invalidDraftsCacheSchema } from '../../schemas/invalidDraftsSchema';

describe('invalidDraftsSchema', () => {
  it('accepterer en gyldig pr.-sektion map med ikke-tomme fieldPaths og rå-strenge', () => {
    const result = invalidDraftsCacheSchema.safeParse({
      stamdata: { skadedato: '12.x.2020' },
    });
    expect(result.success).toBe(true);
  });

  it('accepterer et tomt objekt (partial pr. sektion — ingen nøgler påkrævet)', () => {
    expect(invalidDraftsCacheSchema.safeParse({}).success).toBe(true);
  });

  it('afviser en tom rå-streng-værdi (et tomt draft må aldrig persisteres)', () => {
    const result = invalidDraftsCacheSchema.safeParse({
      stamdata: { skadedato: '' },
    });
    expect(result.success).toBe(false);
  });

  it('afviser en tom fieldPath-nøgle', () => {
    const result = invalidDraftsCacheSchema.safeParse({
      stamdata: { '': 'noget' },
    });
    expect(result.success).toBe(false);
  });

  it('stripper en ukendt sektions-nøgle (tolerant recovery-cache)', () => {
    const result = invalidDraftsCacheSchema.safeParse({
      ukendtSektion: { felt: 'værdi' },
      stamdata: { skadedato: '12.x.2020' },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty('ukendtSektion');
    expect(result.data.stamdata).toEqual({ skadedato: '12.x.2020' });
  });

  it('afviser ikke-streng-værdier', () => {
    const result = invalidDraftsCacheSchema.safeParse({
      stamdata: { skadedato: 42 },
    });
    expect(result.success).toBe(false);
  });
});
