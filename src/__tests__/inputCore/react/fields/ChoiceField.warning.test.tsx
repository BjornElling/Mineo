// @vitest-environment jsdom
import { MenuItem } from '@mui/material';
import { render, screen } from '@testing-library/react';
import ChoiceField from '../../../../inputCore/react/fields/ChoiceField';
import { InputRuntimeProvider } from '../../../../inputCore/react';
import { createFieldWarning } from '../../../../inputCore/fieldWarning';
import { skadestypeEnum } from '../../../../schemas/formSchemas/enumSchemas';
import { createTestInputRuntime } from '../../testInputRuntime';
import { skadestypeField, testLocation } from '../../testCatalog';

// Valgfeltet bærer samme ikke-blokerende advarsel som tekstfelterne – gul ring, tooltip og en
// skjult beskrivelse, der når skærmlæseren. Advarslen gør hverken feltet rødt eller ugyldigt.
describe('ChoiceField – ikke-blokerende advarsel', () => {
  it('beskriver advarslen for skærmlæseren uden at markere feltet som fejl', () => {
    const runtime = createTestInputRuntime();
    const view = (warningText: string | undefined) => {
      const warning = warningText === undefined ? undefined : createFieldWarning(warningText);
      return (
        <InputRuntimeProvider binding={runtime.binding}>
          <ChoiceField
            field={skadestypeField.bind()}
            location={testLocation('choice-warning')}
            {...(warning === undefined ? {} : { warning })}
          >
            {skadestypeEnum.options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </ChoiceField>
        </InputRuntimeProvider>
      );
    };
    const mounted = render(view('Statusdatoen ligger efter opgørelsens dato (04-01-2024)'));
    const combobox = screen.getByRole('combobox');

    expect(combobox).toHaveAccessibleDescription('Statusdatoen ligger efter opgørelsens dato (04-01-2024)');
    expect(combobox).not.toHaveAttribute('aria-invalid', 'true');

    mounted.rerender(view(undefined));
    expect(combobox).not.toHaveAttribute('aria-describedby');
    mounted.unmount();
  });
});
