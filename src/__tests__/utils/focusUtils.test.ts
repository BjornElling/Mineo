// @vitest-environment jsdom

import {
  focusElementWithoutScroll,
  restoreFocusIfPossible,
  waitForAnimationFrame,
} from '../../utils/focusUtils';

describe('focusUtils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('venter på requestAnimationFrame', async () => {
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);

    await expect(waitForAnimationFrame()).resolves.toBeUndefined();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('fokuserer med preventScroll i normaltilstanden', () => {
    const element = document.createElement('button');
    const focus = vi.spyOn(element, 'focus');

    focusElementWithoutScroll(element);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('falder tilbage til almindelig focus når browseren afviser preventScroll', () => {
    const element = document.createElement('button');
    const focus = vi.spyOn(element, 'focus')
      .mockImplementationOnce(() => {
        throw new Error('preventScroll understøttes ikke');
      })
      .mockImplementationOnce(() => undefined);

    focusElementWithoutScroll(element);

    expect(focus).toHaveBeenNthCalledWith(1, { preventScroll: true });
    expect(focus).toHaveBeenNthCalledWith(2);
  });

  it('springer over null, frakoblede og disabled elementer', () => {
    const disabled = document.createElement('button');
    disabled.disabled = true;
    const detached = document.createElement('button');
    const disabledFocus = vi.spyOn(disabled, 'focus');
    const detachedFocus = vi.spyOn(detached, 'focus');

    restoreFocusIfPossible(null);
    restoreFocusIfPossible(disabled);
    restoreFocusIfPossible(detached);

    expect(disabledFocus).not.toHaveBeenCalled();
    expect(detachedFocus).not.toHaveBeenCalled();
  });

  it('gendanner fokus på et forbundet enabled element', () => {
    const element = document.createElement('button');
    document.body.append(element);
    const focus = vi.spyOn(element, 'focus');

    restoreFocusIfPossible(element);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
