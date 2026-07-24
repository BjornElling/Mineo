// @vitest-environment jsdom
import {
  blockingTargetFromRejectedAddress,
  focusFirstBlockingRejectedField,
} from '../../../inputCore/react/greenfieldSaveBlockedFocus';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';

// Greenfield save-blocking focus-targeter (WI-002 trin 1, §1.6/§3.9): oversætter en rejected greenfield-
// feltadresse til det bevarede `BlockingInputErrorTarget` og genbruger DOM-/fane-routingen i saveBlockedFocus.

const stamdataSkadedato = serializeFieldAddress({
  section: 'stamdata',
  path: [],
  field: 'skadedato',
});

describe('blockingTargetFromRejectedAddress', () => {
  it('mapper en velformet rejected adresse til {pageKey=section, fieldName=field, message=""}', () => {
    const target = blockingTargetFromRejectedAddress(stamdataSkadedato);
    expect(target).toEqual({
      kind: 'field',
      pageKey: 'stamdata',
      fieldName: 'skadedato',
      message: '',
    });
  });

  it('returnerer null for en ikke-kanonisk/ugyldig adresse (fail-soft: falder tilbage til synlig fejl)', () => {
    expect(blockingTargetFromRejectedAddress('ikke-en-adresse')).toBeNull();
    expect(blockingTargetFromRejectedAddress('{"section":"stamdata"}')).toBeNull();
  });
});

describe('focusFirstBlockingRejectedField', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
      [{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList
    );
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('router til den blokerende sektions side ud fra den FØRSTE rejected adresse', async () => {
    const navigate = vi.fn();
    const erhvervsevnetabAdresse = serializeFieldAddress({
      section: 'erhvervsevnetab',
      path: [],
      field: 'noget-felt',
    });

    await focusFirstBlockingRejectedField([erhvervsevnetabAdresse], '/stamdata', navigate as never);

    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
  });

  it('fokuserer det første synlige .Mui-error-felt på nuværende fane uden navigation (greenfield-felt uden field-path)', async () => {
    // Greenfield-felter bærer ikke data-mineo-field-path; targeteren læner sig på .Mui-error-fallbacket.
    document.body.innerHTML = `
      <div class="Mui-error"><input aria-describedby="e1" readonly /></div>
      <span id="e1">Ugyldig værdi</span>
    `;
    const input = document.querySelector('input')!;
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField([stamdataSkadedato], '/stamdata', navigate as never);

    // Fejlen er synlig på den aktuelle fane → bliv, fokusér den (ingen navigation væk).
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it('er et no-op uden navigation når der ingen rejected adresser er', async () => {
    const navigate = vi.fn();
    await focusFirstBlockingRejectedField([], '/stamdata', navigate as never);
    expect(navigate).not.toHaveBeenCalled();
  });
});
