// @vitest-environment jsdom
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MappedToggleField from '../../../../inputCore/react/fields/MappedToggleField';
import { InputRuntimeProvider } from '../../../../inputCore/react';
import { createFieldWarning } from '../../../../inputCore/fieldWarning';
import { createTestInputRuntime } from '../../testInputRuntime';
import { omregningField, testLocation } from '../../testCatalog';

// keyboard-navigation.md: en opdatering af feltets advarsel må ikke afbryde tastaturbetjeningen.
describe('MappedToggleField', () => {
  it('bevarer fokus og tastaturbetjening, når advarslen vises og fjernes', async () => {
    const runtime = createTestInputRuntime();
    const field = omregningField.bind();
    const location = testLocation('mapped-toggle');
    const user = userEvent.setup();
    const view = (showWarning: boolean) => (
      <InputRuntimeProvider binding={runtime.binding}>
        <MappedToggleField
          field={field}
          location={location}
          checkedValue={true}
          uncheckedValue={false}
          ariaLabel="Medtag ydelser"
          {...(showWarning ? { warning: createFieldWarning('Ingen ydelser at medtage') } : {})}
        />
      </InputRuntimeProvider>
    );
    const mounted = render(view(false));
    const toggle = screen.getByRole('checkbox', { name: 'Medtag ydelser' });
    act(() => toggle.focus());

    await user.keyboard('{Enter}');
    expect(toggle).toBeChecked();
    mounted.rerender(view(true));
    expect(screen.getByRole('checkbox', { name: 'Medtag ydelser' })).toBe(toggle);
    expect(toggle).toHaveFocus();
    expect(toggle.closest('[data-mineo-field-warning]')).not.toBeNull();

    await user.keyboard(' ');
    expect(toggle).not.toBeChecked();
    mounted.rerender(view(false));
    expect(screen.getByRole('checkbox', { name: 'Medtag ydelser' })).toBe(toggle);
    expect(toggle).toHaveFocus();
    expect(toggle.closest('[data-mineo-field-warning]')).toBeNull();

    // Afmonter synkront i samme tur. MUI's Tooltip- og ripple-timere (fokus, tastetryk) står stadig og
    // venter; mellem testens afslutning og den automatiske cleanup giver runneren event-loopet fri, og på
    // en belastet CI-runner nåede en af dem at fyre en tilstandsopdatering uden for act.
    mounted.unmount();
  });

  it('viser en inaktiv kontakt slået fra med årsagen, og den bevarede værdi igen, når valget bliver muligt (§10.5)', async () => {
    const runtime = createTestInputRuntime();
    const field = omregningField.bind();
    const location = testLocation('mapped-toggle-unavailable');
    const user = userEvent.setup();
    const view = (unavailableReason: string | null) => (
      <InputRuntimeProvider binding={runtime.binding}>
        <MappedToggleField
          field={field}
          location={location}
          checkedValue={true}
          uncheckedValue={false}
          ariaLabel="Medtag ydelser"
          unavailableReason={unavailableReason}
        />
      </InputRuntimeProvider>
    );
    const mounted = render(view(null));
    const toggle = screen.getByRole('checkbox', { name: 'Medtag ydelser' });
    act(() => toggle.focus());
    await user.keyboard('{Enter}');
    expect(toggle).toBeChecked();

    mounted.rerender(view('Der indgår ikke offentlige ydelser i beregningsgrundlaget for TAF'));
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();

    mounted.rerender(view(null));
    expect(toggle).toBeChecked();
    mounted.unmount();
  });
});
