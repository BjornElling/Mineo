// @vitest-environment jsdom
import {
  findFirstVisibleEditorForTemplate,
  lookupEditorLocation,
} from '../../inputCore/react/editorLocationDestination';
import { eoTafPeriodeFraField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { blinkFieldAttention } from '../../inputCore/react/fieldAttentionBlink';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import {
  findVisibleFieldEditor,
  scrollToCollectionFieldTemplate,
  scrollToFieldAddress,
} from '../../utils/scrollToFieldAddress';

vi.mock('../../inputCore/react/editorLocationDestination', () => ({
  findFirstVisibleEditorForTemplate: vi.fn(),
  lookupEditorLocation: vi.fn(),
}));

vi.mock('../../inputCore/react/fieldAttentionBlink', () => ({
  blinkFieldAttention: vi.fn(),
}));

describe('scrollToFieldAddress', () => {
  const originalMatchMedia = window.matchMedia;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const lookupEditorLocationMock = vi.mocked(lookupEditorLocation);
  const findFirstVisibleEditorForTemplateMock = vi.mocked(findFirstVisibleEditorForTemplate);
  const blinkFieldAttentionMock = vi.mocked(blinkFieldAttention);
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    lookupEditorLocationMock.mockReset();
    findFirstVisibleEditorForTemplateMock.mockReset();
    blinkFieldAttentionMock.mockReset();

    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it('finder en synlig editor gennem den serialiserede descriptor-adresse', () => {
    const address = eoTafPeriodeFraField.bind('taf-1').address;
    const serializedAddress = serializeFieldAddress(address);
    const editor = document.createElement('input');
    lookupEditorLocationMock.mockReturnValue({ kind: 'visible', element: editor });

    expect(findVisibleFieldEditor(address)).toBe(editor);
    expect(lookupEditorLocationMock).toHaveBeenCalledWith(serializedAddress);
  });

  it('scroller til et felt, bruger den delte blinkmarkering og kalder success-callbacken', () => {
    const address = eoTafPeriodeFraField.bind('taf-1').address;
    const editor = document.createElement('input');
    const onSuccess = vi.fn();
    lookupEditorLocationMock.mockReturnValue({ kind: 'visible', element: editor });

    scrollToFieldAddress(address, { maxRetries: 4, onSuccess });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    expect(blinkFieldAttentionMock).toHaveBeenCalledTimes(1);
    expect(blinkFieldAttentionMock).toHaveBeenCalledWith(editor);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('scroller til første synlige collection-editor med samme blink- og callback-kontrakt', () => {
    const template = eoTafPeriodeFraField.template;
    const editor = document.createElement('input');
    const onSuccess = vi.fn();
    findFirstVisibleEditorForTemplateMock.mockReturnValue(editor);

    scrollToCollectionFieldTemplate(template, { maxRetries: 4, onSuccess });

    expect(findFirstVisibleEditorForTemplateMock).toHaveBeenCalledWith(template);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    expect(blinkFieldAttentionMock).toHaveBeenCalledTimes(1);
    expect(blinkFieldAttentionMock).toHaveBeenCalledWith(editor);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('rapporterer feltets danske failure message efter præcis maxRetries forsøg', () => {
    const address = eoTafPeriodeFraField.bind('findes-ikke').address;
    const serializedAddress = serializeFieldAddress(address);
    const onFailure = vi.fn();
    lookupEditorLocationMock.mockReturnValue({ kind: 'unmounted' });

    scrollToFieldAddress(address, { maxRetries: 3, onFailure });

    expect(lookupEditorLocationMock).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledWith(
      `Feltet ${serializedAddress} blev ikke synligt inden for 3 forsøg`
    );
    expect(blinkFieldAttentionMock).not.toHaveBeenCalled();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('rapporterer collection-feltets danske failure message efter præcis maxRetries forsøg', () => {
    const template = eoTafPeriodeFraField.template;
    const onFailure = vi.fn();
    findFirstVisibleEditorForTemplateMock.mockReturnValue(null);

    scrollToCollectionFieldTemplate(template, { maxRetries: 2, onFailure });

    expect(findFirstVisibleEditorForTemplateMock).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledWith(
      `Første række-felt for ${template.section}.${template.field} blev ikke synligt inden for 2 forsøg`
    );
    expect(blinkFieldAttentionMock).not.toHaveBeenCalled();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
