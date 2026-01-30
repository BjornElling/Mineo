/// <reference types="vitest/globals" />
import { sanitizeFilenameForLog } from '../../utils/logger';

describe('sanitizeFilenameForLog', () => {
  it('removes personal data while keeping technical details', () => {
    const input = 'Testi Testesen - Arbejdsulykke - 2024-01-26.eo';
    const output = sanitizeFilenameForLog(input);

    expect(output).toContain('.eo');
    expect(output.toLowerCase()).toContain('hash');
    expect(output).not.toContain('Testi');
    expect(output).not.toContain('Testesen');
  });
});
