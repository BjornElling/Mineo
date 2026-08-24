// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorFallback from '../../../components/errors/ErrorFallback';

describe('ErrorFallback – genindlæsningsbekræftelse', () => {
  it('oplyser at ikke-gemt arbejde ikke kan gendannes efter genindlæsning', async () => {
    const user = userEvent.setup();
    render(<ErrorFallback error={new Error('Testfejl')} errorInfo={null} onReset={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Genindlæs siden' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Handlingen kan ikke fortrydes.');
  });
});
