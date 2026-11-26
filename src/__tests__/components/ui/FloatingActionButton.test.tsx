// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import FloatingActionButton from '../../../components/ui/FloatingActionButton';

// Kortenes flydende handlinger flytter sig, når de virker, så andet klik i et dobbeltklik ville
// ramme en anden knap eller et andet kort. Andet klik i samme dobbeltklik (`detail >= 2`) er derfor tavst.

const renderButton = () => {
  const onClick = vi.fn();
  render(<FloatingActionButton icon={<ArrowUpwardIcon />} tooltip="Flyt ansættelsesforhold op" onClick={onClick} />);
  return { onClick, button: screen.getByRole('button', { name: 'Flyt ansættelsesforhold op' }) };
};

describe('FloatingActionButton: dobbeltklik', () => {
  it('udløser handlingen ved et enkeltklik', () => {
    const { onClick, button } = renderButton();
    fireEvent.click(button, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignorerer andet og tredje klik i samme dobbeltklik', () => {
    const { onClick, button } = renderButton();
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    fireEvent.click(button, { detail: 3 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('udløser handlingen ved et nyt, særskilt klik', () => {
    const { onClick, button } = renderButton();
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('udløser handlingen ved tastaturaktivering (detail 0)', async () => {
    const user = userEvent.setup();
    const { onClick, button } = renderButton();
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
