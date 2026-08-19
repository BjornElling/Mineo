// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  accessibleNameAttributes,
  normalizeAccessibleName,
  resolveAccessibleName,
  selectAccessibleNameProps,
} from '../../../components/inputs/accessibleName';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import LabeledControlRow from '../../../components/layout/LabeledControlRow';
import InfoTooltipIcon from '../../../components/common/InfoTooltipIcon';
import type { CommitEvent } from '../../../types/fieldEvents';

/**
 * Navnekravet for interaktive kontroller.
 *
 * Testene hævder den brugerobserverbare invariant – «kontrollen kan findes på det, brugeren ser» –
 * og ikke hvilken ARIA-attribut der tilfældigvis bærer navnet. Det er netop skiftet fra `aria-label`
 * til `aria-labelledby`, der ellers ville have brudt en implementeringsnær test uden at ændre noget
 * for brugeren.
 */
describe('accessibleName', () => {
  describe('normalizeAccessibleName', () => {
    it('fjerner det afsluttende kolon, rækkelayoutet bruger som visuel adskiller', () => {
      expect(normalizeAccessibleName('Omregning til fuldt år:')).toBe('Omregning til fuldt år');
    });

    it('bevarer kolon inde i teksten', () => {
      expect(normalizeAccessibleName('Note: se bilag')).toBe('Note: se bilag');
    });

    it('samler whitespace fra flerlinjet JSX til én linje', () => {
      expect(normalizeAccessibleName('\n  Tillad regulering\n  med overenskomst\n')).toBe(
        'Tillad regulering med overenskomst'
      );
    });
  });

  describe('resolveAccessibleName', () => {
    it('udleder navnet af en simpel tekstlabel', () => {
      expect(resolveAccessibleName({ visibleLabel: 'Fuld løn under ferie' }, 'test')).toBe(
        'Fuld løn under ferie'
      );
    });

    it('udleder navnet af sammensat markup uden at tage info-ikonets tooltip med', () => {
      // Tooltippen er en uddybning, ikke kontrollens navn. Ville den blive læst med, fik brugeren
      // en lang forklaring hver gang fokus ramte kontrollen.
      const label = (
        <>
          Endelig EET-afgørelse
          <InfoTooltipIcon title="Opstår ved endelig afgørelse med tilbagevirkende kraft" />
        </>
      );
      expect(resolveAccessibleName({ visibleLabel: label }, 'test')).toBe('Endelig EET-afgørelse');
    });

    it('bruger ariaLabel direkte, når der ikke er synlig tekst', () => {
      expect(resolveAccessibleName({ ariaLabel: 'Fold menuen ud' }, 'test')).toBe('Fold menuen ud');
    });

    it('overlader navnet til det refererede element ved labelledBy', () => {
      expect(resolveAccessibleName({ labelledBy: 'row-7-label' }, 'test')).toBeUndefined();
    });

    it('kaster i test/udvikling, når en label er angivet men uden tekstindhold', () => {
      // Typesystemet garanterer, at et navnefelt ER sat – ikke at det bærer tekst. En label, der kun
      // rummer et ikon, ville ellers give en tavst navnløs kontrol i brugerfladen.
      expect(() => resolveAccessibleName({ visibleLabel: <InfoTooltipIcon title="kun ikon" /> }, 'Toggle(x)'))
        .toThrow(/tomt tilgængeligt navn/);
    });
  });

  describe('accessibleNameAttributes', () => {
    it('sætter aria-label for ariaLabel-varianten', () => {
      expect(accessibleNameAttributes({ ariaLabel: 'Vælg mappe' }, 'test')).toEqual({
        'aria-label': 'Vælg mappe',
      });
    });

    it('sætter aria-labelledby for labelledBy-varianten', () => {
      expect(accessibleNameAttributes({ labelledBy: 'r1-label' }, 'test')).toEqual({
        'aria-labelledby': 'r1-label',
      });
    });

    it('sætter INGEN attribut for visibleLabel – navnet kommer fra label-bindingen', () => {
      // Et aria-label oveni ville overskrive den synlige tekst og genindføre dobbeltheden.
      expect(accessibleNameAttributes({ visibleLabel: 'Fuld løn under ferie' }, 'test')).toEqual({});
    });
  });

  describe('selectAccessibleNameProps', () => {
    it('videresender præcis den variant, callsitet valgte', () => {
      expect(selectAccessibleNameProps({ visibleLabel: 'A' })).toEqual({ visibleLabel: 'A' });
      expect(selectAccessibleNameProps({ ariaLabel: 'B' })).toEqual({ ariaLabel: 'B' });
      expect(selectAccessibleNameProps({ labelledBy: 'C' })).toEqual({ labelledBy: 'C' });
    });
  });
});

describe('StyledToggleSwitch – tilgængeligt navn', () => {
  const noop = (): boolean => true;

  it('kan findes på sin synlige tekst, når den gives som visibleLabel', () => {
    render(<StyledToggleSwitch visibleLabel="Fuld løn under ferie" checked={false} onCommit={noop} />);
    expect(screen.getByRole('checkbox', { name: 'Fuld løn under ferie' })).toBeInTheDocument();
  });

  it('kan findes på sit ariaLabel, når der ikke er synlig tekst', () => {
    render(<StyledToggleSwitch ariaLabel="Midlertidigt EET" checked={false} onCommit={noop} />);
    expect(screen.getByRole('checkbox', { name: 'Midlertidigt EET' })).toBeInTheDocument();
  });

  it('kan findes på teksten i det element, labelledBy peger på', () => {
    render(
      <>
        <span id="ekstern-label">Vis kontrolfaner</span>
        <StyledToggleSwitch labelledBy="ekstern-label" checked={false} onCommit={noop} />
      </>
    );
    expect(screen.getByRole('checkbox', { name: 'Vis kontrolfaner' })).toBeInTheDocument();
  });
});

describe('LabeledControlRow', () => {
  const noop = (): boolean => true;

  const renderRow = (label: React.ReactNode) =>
    render(
      <LabeledControlRow label={label}>
        {({ labelledBy, controlId }) => (
          <StyledToggleSwitch
            id={controlId}
            labelledBy={labelledBy}
            checked={false}
            onCommit={noop}
          />
        )}
      </LabeledControlRow>
    );

  it('navngiver kontrollen med rækkens synlige tekst', () => {
    renderRow('Bilagsnumre i erstatningsopgørelser');
    expect(
      screen.getByRole('checkbox', { name: 'Bilagsnumre i erstatningsopgørelser' })
    ).toBeInTheDocument();
  });

  it('aktiverer kontrollen når brugeren klikker på teksten', async () => {
    // Klikbar label er standardadfærd for et afkrydsningsfelt og gør hele rækken til ét klikmål.
    const user = userEvent.setup();
    const commit = vi.fn<(event: CommitEvent<boolean>) => boolean>(() => true);

    render(
      <LabeledControlRow label="Udkast-stempel på nye dokumenter">
        {({ labelledBy, controlId }) => (
          <StyledToggleSwitch
            id={controlId}
            labelledBy={labelledBy}
            checked={false}
            onCommit={commit}
          />
        )}
      </LabeledControlRow>
    );

    await user.click(screen.getByText('Udkast-stempel på nye dokumenter'));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]?.[0].target.value).toBe(true);
  });

  it('giver hver række sin egen binding, så to rækker ikke navngiver hinandens kontrol', () => {
    render(
      <>
        <LabeledControlRow label="Første indstilling">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch id={controlId} labelledBy={labelledBy} checked={false} onCommit={noop} />
          )}
        </LabeledControlRow>
        <LabeledControlRow label="Anden indstilling">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch id={controlId} labelledBy={labelledBy} checked={false} onCommit={noop} />
          )}
        </LabeledControlRow>
      </>
    );

    expect(screen.getByRole('checkbox', { name: 'Første indstilling' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Anden indstilling' })).toBeInTheDocument();
  });
});

describe('InfoTooltipIcon', () => {
  it('kan fokuseres med tastatur og har tooltipteksten som navn', () => {
    render(<InfoTooltipIcon title="Forklaring til feltet" />);

    const icon = screen.getByRole('img', { name: 'Forklaring til feltet' });
    expect(icon).toHaveAttribute('tabindex', '0');
    icon.focus();
    expect(icon).toHaveFocus();
  });
});
