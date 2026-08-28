// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MirroredStamdataRow from '../../../components/layout/MirroredStamdataRow';

const renderRow = ({ value, errorMessage }: Readonly<{
  value: string | undefined;
  errorMessage: string | undefined;
}>) => {
  const onNavigate = vi.fn();
  render(
    <MirroredStamdataRow
      label="Skadelidtes fødselsdato"
      value={value}
      errorMessage={errorMessage}
      onNavigate={onNavigate}
    />
  );
  return { onNavigate, row: screen.getByText('Skadelidtes fødselsdato').closest('.row--label-right-hover') };
};

describe('MirroredStamdataRow', () => {
  it('viser den brugbare værdi uden Stamdata-genvej', () => {
    const { row } = renderRow({ value: '15-03-1975', errorMessage: undefined });

    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('15-03-1975');
    expect(within(row as HTMLElement).queryByText('Stamdata')).toBeNull();
  });

  it.each([
    { state: 'manglende', value: undefined, errorMessage: undefined, text: 'Mangler (angiv i Stamdata)' },
    { state: 'ugyldig', value: undefined, errorMessage: 'Datoen skal være en gyldig dato', text: 'Ugyldig værdi (ret i Stamdata)' },
  ])('viser den fælles Stamdata-genvej ved $state', async ({ value, errorMessage, text }) => {
    const user = userEvent.setup();
    const { onNavigate, row } = renderRow({ value, errorMessage });

    expect(row).not.toBeNull();
    const rowElement = row as HTMLElement;
    expect(rowElement).toHaveTextContent(text);
    await user.click(within(rowElement).getByText('Stamdata'));
    expect(onNavigate).toHaveBeenCalledTimes(1);

    if (errorMessage !== undefined) {
      expect(rowElement.querySelector('[title="Datoen skal være en gyldig dato"]')).not.toBeNull();
    }
  });
});
