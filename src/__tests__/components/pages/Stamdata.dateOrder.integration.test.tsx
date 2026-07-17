// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Stamdata from '../../../components/pages/Stamdata';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
} from '../../../inputCore/react';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../../inputCore/catalog/stamdataDescriptors';

const renderPage = () => {
  sessionStorage.clear();
  const { binding } = bootstrapProductionInputRuntime();
  return {
    binding,
    ...render(
      <MemoryRouter initialEntries={['/stamdata']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <ProductionInputRuntimeProvider binding={binding}>
              <Stamdata />
            </ProductionInputRuntimeProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    ),
  };
};

const inputForRow = (label: string): HTMLInputElement => {
  const row = screen.getByText(label).closest('.row--label-offset') as HTMLElement;
  return within(row).getByRole('textbox') as HTMLInputElement;
};

describe('Stamdata — canonical datoordensfejl', () => {
  it('bevarer begge datoer canonical og viser samme afledte issue på felterne', async () => {
    const user = userEvent.setup();
    const { binding } = renderPage();
    const fodselsdato = inputForRow('Fødselsdato');
    const skadedato = inputForRow('Skadedato');

    await user.click(fodselsdato);
    await user.type(fodselsdato, '01-01-2010');
    await user.tab();
    await user.click(skadedato);
    await user.type(skadedato, '31-12-2009');
    await user.tab();

    await waitFor(() => {
      const sections = binding.getSettled().input.sections;
      expect(stamdataSkadelidteFodselsdatoField.readCanonical(
        sections,
        stamdataSkadelidteFodselsdatoField.bind().address
      )).toBe('2010-01-01');
      expect(stamdataSkadedatoField.readCanonical(
        sections,
        stamdataSkadedatoField.bind().address
      )).toBe('2009-12-31');
    });

    await waitFor(() => {
      expect(fodselsdato).toHaveAttribute('aria-invalid', 'true');
      expect(skadedato).toHaveAttribute('aria-invalid', 'true');
    });
    expect(binding.getIssues().all.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'Skadedato kan ikke være før fødselsdatoen (01-01-2010)',
      'Fødselsdato kan ikke være efter skadedatoen (31-12-2009)',
    ]));
  });
});
