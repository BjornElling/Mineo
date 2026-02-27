import { describe, expect, it } from 'vitest';
import { eoFileDataSchema } from '../../schemas/eoFileSchema';

describe('error-debug contract isolation', () => {
  it('afviser runtime fejl/debug-felter i strict .eo save-schema', () => {
    const parsed = eoFileDataSchema.safeParse({
      fieldErrors: {
        stamdata: {
          skadesdato: {
            source: 'input',
            severity: 'error',
            message: 'Ugyldig dato',
          },
        },
      },
      lastNotice: {
        message: 'advarsel',
        type: 'warning',
      },
      lastNoticeEpoch: 1,
      manuelReguleringInputErrors: { id: true },
    });

    expect(parsed.success).toBe(false);
  });
});
