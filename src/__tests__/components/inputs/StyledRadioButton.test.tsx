// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledRadioButton from '../../../components/inputs/StyledRadioButton';

// VÆRN: en radiogruppe har et navn, og et valg committer.
//
// Fundet: `label` var valgfri, og INTET kaldssted brugte den. Samtlige otte radiogrupper i programmet
// stod derfor som en navnløs `role="radiogroup"`; den synlige tekst lå som en søskende-`<Typography>`
// uden binding. Står tre Ja/Nej/Skjul-grupper på samme side, hører en skærmlæserbruger «Ja radioknap»
// tre gange uden at kunne skelne dem. Navnet er nu en strukturel forudsætning — samme løsning som for
// toggles (`accessibleName.ts`) — og `RadioField` henter det automatisk fra feltets egen label.
//
// Komponenten havde ingen egen testfil overhovedet før dette værn.

type Svar = 'ja' | 'nej';

const OPTIONS = [
  { value: 'ja' as Svar, label: 'Ja' },
  { value: 'nej' as Svar, label: 'Nej' },
];

describe('StyledRadioButton', () => {
  it('gruppen bærer sit tilgængelige navn', () => {
    render(
      <StyledRadioButton<Svar>
        ariaLabel="Krav på svie- og smertegodtgørelse"
        options={OPTIONS}
        value="nej"
        onCommit={() => true}
      />
    );
    expect(screen.getByRole('radiogroup', { name: 'Krav på svie- og smertegodtgørelse' }))
      .toBeInTheDocument();
  });

  it('afviser et tomt navn i udvikling/test (værnet er ikke vakuøst)', () => {
    expect(() => render(
      <StyledRadioButton<Svar> ariaLabel="   " options={OPTIONS} value="nej" onCommit={() => true} />
    )).toThrow(/tomt tilgængeligt navn/);
  });

  it('mellemrum på en fokuseret option committer valget', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn(() => true);
    render(
      <StyledRadioButton<Svar>
        ariaLabel="Svar"
        options={OPTIONS}
        value="nej"
        onCommit={onCommit}
      />
    );

    screen.getByRole('radio', { name: 'Ja' }).focus();
    await user.keyboard(' ');

    expect(onCommit).toHaveBeenCalledTimes(1);
    const firstCall = onCommit.mock.calls.at(0) as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({ target: { value: 'ja' } });
  });

  it('et klik på den ALLEREDE valgte option committer ikke igen', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn(() => true);
    render(
      <StyledRadioButton<Svar>
        ariaLabel="Svar"
        options={OPTIONS}
        value="nej"
        onCommit={onCommit}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Nej' }));

    expect(onCommit).not.toHaveBeenCalled();
  });
});
