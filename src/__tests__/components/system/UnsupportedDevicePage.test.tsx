// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import UnsupportedDevicePage from '../../../components/system/UnsupportedDevicePage';
import { SIBLING_SITES } from '../../../components/layout/siblingSites';

describe('UnsupportedDevicePage', () => {
  it('viser Mineo-mobilens brandtitel som minEO.dk med nedtonet prefix og suffix', () => {
    render(<UnsupportedDevicePage />);

    const heading = screen.getByRole('heading', { name: 'minEO.dk' });

    expect(heading).toHaveTextContent('minEO.dk');
    expect(within(heading).getByText('min')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.42)' });
    expect(within(heading).getByText('EO')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.87)' });
    expect(within(heading).getByText('.dk')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.42)' });
  });

  describe('søskendesider', () => {
    it('viser hver søskendeside – den aktuelle side som ikke-link, resten som eksterne links', () => {
      render(<UnsupportedDevicePage />);

      const nav = screen.getByRole('navigation', { name: 'Søskendesider' });

      // minEO ER hard-stop-siden; den skal ikke kunne linke til sig selv. Teksten ligger – som i
      // den delte footer – i et indre span, så understregningen kan sidde tæt under skriften i
      // stedet for langs hele den 28 px høje række; markeringen hører derfor på forælderen.
      const currentText = within(nav).getByText('minEO.dk');
      const current = currentText.closest('[aria-current]');
      expect(current).toHaveAttribute('aria-current', 'page');
      expect(current?.tagName).toBe('SPAN');
      expect(within(nav).queryByRole('link', { name: 'minEO.dk' })).toBeNull();

      const others = SIBLING_SITES.filter((site) => site.key !== 'mineo');
      expect(within(nav).getAllByRole('link')).toHaveLength(others.length);

      for (const site of others) {
        const link = within(nav).getByRole('link', { name: site.label });
        expect(link).toHaveAttribute('href', site.href);
        // Sikkerhedskravet gælder også her, hvor linket er sammensat i hånden for at
        // holde MUI ude af hard-stop-sidens bundle.
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });

    it('holder søskendelinkene i tastaturrækkefølgen – de er brugerens eneste vej videre', () => {
      render(<UnsupportedDevicePage />);

      const nav = screen.getByRole('navigation', { name: 'Søskendesider' });

      // Modsat `ExternalLink` (tabIndex=-1, som findes for ikke at forurene PROGRAMMETS
      // tastaturrækkefølge) er der intet program at forurene på hard-stop-siden.
      for (const link of within(nav).getAllByRole('link')) {
        expect(link).not.toHaveAttribute('tabindex');
      }
    });

    it('viser kontaktadressen sammen med søskendesiderne', () => {
      render(<UnsupportedDevicePage />);

      const contact = screen.getByRole('link', { name: 'Kontakt bel@fho.dk' });

      expect(contact).toHaveAttribute('href', 'mailto:bel@fho.dk');
    });
  });
});
