import * as React from 'react';
import { act, render, screen, within } from '@testing-library/react';
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

  const waitForAnimationFrame = async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
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

  it('lader Tab gaa fra sygedagpenge til-dato til Indsaet-knappen og videre til naeste Indsaet-knap', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <Container>
            <OffentligeYdelserTab
              rows={[
                { ...initialOffentligYdelseRow, id: 'row-1' },
                { ...initialOffentligYdelseRow, id: 'row-2' },
              ]}
              onRowsChange={vi.fn()}
              midlertidigtEetInsertSource={{
                eetValues: ERHVERVSEVNETAB_INITIAL_VALUES,
                skadesdato: undefined,
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

    const tilDatoInput = dateInputs[1];
    const insertButton = within(sygedagpengeRow as HTMLElement).getByRole('button', { name: 'Indsæt' });
    const allInsertButtons = screen.getAllByRole('button', { name: 'Indsæt' });
    const nextInsertButton = allInsertButtons[1];

    expect(insertButton).toHaveAttribute('aria-disabled', 'true');
    expect(nextInsertButton).not.toHaveAttribute('aria-disabled');

    await act(async () => {
      tilDatoInput.focus();
    });
    expect(document.activeElement).toBe(tilDatoInput);

    await user.keyboard('{Tab}');
    await waitForAnimationFrame();

    expect(document.activeElement).toBe(insertButton);

    await user.keyboard('{Tab}');
    await waitForAnimationFrame();

    expect(document.activeElement).toBe(nextInsertButton);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForAnimationFrame();

    expect(document.activeElement).toBe(insertButton);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForAnimationFrame();

    expect(document.activeElement).toBe(tilDatoInput);
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

    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <Container>
            <OffentligeYdelserTab
              rows={[
                { ...initialOffentligYdelseRow, id: 'row-1' },
                { ...initialOffentligYdelseRow, id: 'row-2' },
              ]}
              onRowsChange={handleRowsChange}
              midlertidigtEetInsertSource={{
                eetValues: ERHVERVSEVNETAB_INITIAL_VALUES,
                skadesdato: undefined,
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

    const fraDatoInput = dateInputs[0];
    const tilDatoInput = dateInputs[1];
    const insertButton = within(sygedagpengeRow as HTMLElement).getByRole('button', { name: 'Indsæt' });

    expect(fraDatoInput).toHaveValue('01-01-2024');
    expect(tilDatoInput).toHaveValue('31-01-2024');

    await act(async () => {
      fraDatoInput.focus();
    });
    expect(document.activeElement).toBe(fraDatoInput);

    await user.click(insertButton);
    await waitForAnimationFrame();

    expect(handleRowsChange).toHaveBeenCalledTimes(1);
    expect(fraDatoInput).toHaveValue('');
    expect(tilDatoInput).toHaveValue('');
  });
});
