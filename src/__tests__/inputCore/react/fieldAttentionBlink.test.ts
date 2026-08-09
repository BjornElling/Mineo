// @vitest-environment jsdom
import {
  blinkFieldAttention,
  blinkFieldAttentionByAddress,
  FIELD_ATTENTION_BLINK_CLASS,
  FIELD_ATTENTION_BLINK_DURATION_MS,
} from '../../../inputCore/react/fieldAttentionBlink';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { FIELD_ADDRESS_ATTR } from '../../../inputCore/react/historyRestoreTarget';
import { eoTafPeriodeFraField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';

/**
 * Den delte blinkmarkering (BF-020/BF-021).
 *
 * Markeringen er den ENE visuelle «peg på dette felt»-mekanisme. Testene her måler de tre ting, der gør
 * den generelt tilgængelig: at den kan lægges på et vilkårligt element, at den kan findes gennem den
 * kanoniske feltadresse (så enhver flade arver den uden at opte ind), og at den rydder op efter sig.
 */
describe('fieldAttentionBlink — den delte «peg på dette felt»-markering', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sætter blink-klassen på elementet og fjerner den igen, når animationen er slut', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    blinkFieldAttention(element);
    expect(element.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);

    // Stadig markeret lige før løbetiden er omme — ellers ville animationen blive klippet af.
    vi.advanceTimersByTime(FIELD_ATTENTION_BLINK_DURATION_MS - 1);
    expect(element.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(element.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(false);
  });

  it('genstarter markeringen ved et nyt blink, så et gentaget klik giver en synlig reaktion', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    blinkFieldAttention(element);
    vi.advanceTimersByTime(FIELD_ATTENTION_BLINK_DURATION_MS - 100);

    // Nyt blink kort før det første ville udløbe: den gamle oprydning må ikke rydde det NYE blink.
    blinkFieldAttention(element);
    vi.advanceTimersByTime(200);
    expect(element.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);

    vi.advanceTimersByTime(FIELD_ATTENTION_BLINK_DURATION_MS);
    expect(element.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(false);
  });

  it('finder feltet gennem den kanoniske feltadresse og markerer dets synlige MUI-skal', () => {
    const address = serializeFieldAddress(eoTafPeriodeFraField.bind('taf-1').address);
    const element = document.createElement('input');
    element.setAttribute(FIELD_ADDRESS_ATTR, address);
    const surface = document.createElement('div');
    surface.className = 'MuiInputBase-root';
    surface.appendChild(element);
    document.body.appendChild(surface);

    expect(blinkFieldAttentionByAddress(address)).toBe(true);
    expect(surface.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
    expect(element.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(false);
  });

  it('er en no-op uden mål — hverken for en ukendt adresse eller et manglende element', () => {
    const unknownAddress = serializeFieldAddress(eoTafPeriodeFraField.bind('findes-ikke').address);
    expect(blinkFieldAttentionByAddress(unknownAddress)).toBe(false);
    expect(() => blinkFieldAttention(null)).not.toThrow();
    expect(() => blinkFieldAttention(undefined)).not.toThrow();
  });
});
