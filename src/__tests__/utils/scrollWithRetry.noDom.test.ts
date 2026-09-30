// @vitest-environment node
import { scrollWithRetry } from '../../utils/scrollWithRetry';

describe('scrollWithRetry uden DOM', () => {
  it('kalder failure-callback med no-DOM-fejlen og returnerer en ufarlig cancel-funktion', () => {
    const onFailure = vi.fn();

    const cancel = scrollWithRetry({
      maxRetries: 3,
      findTarget: vi.fn(),
      onFailure,
      failureMessage: 'mål mangler',
    });

    expect(onFailure).toHaveBeenCalledWith('No DOM environment available for scroll');
    expect(cancel).toEqual(expect.any(Function));
    expect(() => cancel()).not.toThrow();
  });
});
