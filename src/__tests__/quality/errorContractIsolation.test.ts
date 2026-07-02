import { eoFileDataSchema } from '../../schemas/eoFileSchema';

describe('error-kontrakt isolation', () => {
  it('afviser runtime fejl/diagnostik-felter i strict .eo save-schema', () => {
    const parsed = eoFileDataSchema.safeParse({
      fieldErrors: {
        stamdata: {
          skadedato: {
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
