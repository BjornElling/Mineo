// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import ExternalLink from '../../../components/ui/ExternalLink';
import InternalLink from '../../../components/ui/InternalLink';

describe('web-link-primitiver', () => {
  it('åbner eksterne links i ny fane og holder dem ude af Tab-rækkefølgen', () => {
    render(<ExternalLink href="https://example.test">Ekstern side</ExternalLink>);

    const link = screen.getByRole('link', { name: 'Ekstern side' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('tabindex', '-1');
  });

  it('holder interne links i samme fane', () => {
    render(<InternalLink href="/indstillinger">Indstillinger</InternalLink>);

    const link = screen.getByRole('link', { name: 'Indstillinger' });
    expect(link).toHaveAttribute('href', '/indstillinger');
    expect(link).not.toHaveAttribute('target');
  });
});
