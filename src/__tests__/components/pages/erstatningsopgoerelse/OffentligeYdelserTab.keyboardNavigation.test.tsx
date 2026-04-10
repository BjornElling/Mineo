import * as React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Container from '../../../../components/layout/Container';
import OffentligeYdelserTab from '../../../../components/pages/erstatningsopgoerelse/OffentligeYdelserTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { initialOffentligYdelseRow } from '../../../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';

describe('OffentligeYdelserTab keyboard navigation', () => {
  const getRectsSpy = vi.spyOn(HTMLElement.prototype, 'getClientRects');

  const mockVisibleRects = () => {
    getRectsSpy.mockImplementation(() => {
      const rects = [
        {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          top: 0,
          left: 0,
          right: 10,
          bottom: 10,
          toJSON: () => ({}),
        } as DOMRect,
      ];
      const rectList = Object.assign(rects, {
        item: (index: number) => rects[index] ?? null,
      });
      return rectList as DOMRectList;
    });
  };

  beforeAll(() => {
    mockVisibleRects();
  });

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterAll(() => {
    getRectsSpy.mockRestore();
  });

  const renderTab = (onRowsChange: ReturnType<typeof vi.fn> = vi.fn()) => {
    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <Container>
            <OffentligeYdelserTab
              rows={[
                { ...initialOffentligYdelseRow, id: 'row-1' },
                { ...initialOffentligYdelseRow, id: 'row-2' },
              ]}
              onRowsChange={onRowsChange}
              midlertidigtEetInsertSource={{
                eetValues: ERHVERVSEVNETAB_INITIAL_VALUES,
                skadedato: undefined,
              }}
            />
          </Container>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    const sygedagpengeRow = screen
      .getByText('Indsæt maksimal sygedagpengesats for perioden')
      .closest('.row--label-right-hover');

    expect(sygedagpengeRow).not.toBeNull();

    const dateInputs = sygedagpengeRow
      ? Array.from(sygedagpengeRow.querySelectorAll<HTMLInputElement>('input'))
      : [];
    expect(dateInputs).toHaveLength(2);

    const insertButton = within(sygedagpengeRow as HTMLElement).getByRole('button', { name: 'Indsæt' });
    const allInsertButtons = screen.getAllByRole('button', { name: 'Indsæt' });
    const nextInsertButton = allInsertButtons[1];

    return {
      fraDatoInput: dateInputs[0],
      tilDatoInput: dateInputs[1],
      insertButton,
      nextInsertButton,
    };
  };

  it('lader Tab gaa fra sygedagpenge til-dato til Indsaet-knappen og videre til naeste Indsaet-knap', async () => {
    const user = userEvent.setup();
    const { tilDatoInput, insertButton, nextInsertButton } = renderTab();

    expect(insertButton).toHaveAttribute('aria-disabled', 'true');
    expect(nextInsertButton).not.toHaveAttribute('aria-disabled');

    await act(async () => {
      tilDatoInput.focus();
    });
    expect(document.activeElement).toBe(tilDatoInput);

    await user.tab();
    await waitFor(() => {
      expect(document.activeElement).toBe(insertButton);
    });

    await user.tab();
    await waitFor(() => {
      expect(document.activeElement).toBe(nextInsertButton);
    });
  }, 10000);

  it('lader Shift+Tab gaa tilbage fra naeste Indsaet-knap til sygedagpenge til-dato', async () => {
    const user = userEvent.setup();
    const { tilDatoInput, insertButton, nextInsertButton } = renderTab();

    await act(async () => {
      nextInsertButton.focus();
    });
    expect(document.activeElement).toBe(nextInsertButton);

    await user.tab({ shift: true });
    await waitFor(() => {
      expect(document.activeElement).toBe(insertButton);
    });

    await user.tab({ shift: true });
    await waitFor(() => {
      expect(document.activeElement).toBe(tilDatoInput);
    });
  });

  it('rydder baade fra-dato og til-dato ved klik paa Indsaet fra et fokuseret sygedagpengefelt', async () => {
    const user = userEvent.setup();
    const handleRowsChange = vi.fn();

    sessionStorage.setItem(
      'mineo_ui_eoOffentligeYdelserHelpers',
      JSON.stringify({
        sygedagpengeFraDato: '2024-01-01',
        sygedagpengeTilDato: '2024-01-31',
      })
    );

    const { fraDatoInput, tilDatoInput, insertButton } = renderTab(handleRowsChange);

    expect(fraDatoInput).toHaveValue('01-01-2024');
    expect(tilDatoInput).toHaveValue('31-01-2024');

    await act(async () => {
      fraDatoInput.focus();
    });
    expect(document.activeElement).toBe(fraDatoInput);

    await user.click(insertButton);
    await waitFor(() => {
      expect(handleRowsChange).toHaveBeenCalledTimes(1);
      expect(fraDatoInput).toHaveValue('');
      expect(tilDatoInput).toHaveValue('');
    });
  });
});
