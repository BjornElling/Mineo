// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddIcon from '@mui/icons-material/Add';
import InlineActionButton from '../../../components/inputs/InlineActionButton';
import FloatingActionButton from '../../../components/ui/FloatingActionButton';
import { resolveActionGate } from '../../../components/inputs/actionGate';

// Den universelle regel for GRÅ KNAPPER (`page-component-contract.md` §11.1, generaliseret fra de
// deaktiverede downloadknapper ved brugerbeslutning 2026-08-15):
//
//   1. knappen bliver stående som nedtonet og inaktiv – den forsvinder ikke,
//   2. årsagen har ÉN visningskanal: tooltippet, og kun ved hover,
//   3. et klik er TAVST – ingen besked, ingen tekstknude.
//
// Fundet, dette dækker: en grå knap uden nogen forklaring overhovedet, som samtidig kunne Tab'es til
// og Enter-aktiveres, uden at der skete noget.

describe('InlineActionButton: deaktiveret', () => {
  it('kalder ikke onClick ved museklik', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InlineActionButton onClick={onClick} disabled disabledReason="Indtastning mangler">
        Indsæt
      </InlineActionButton>
    );

    await user.click(screen.getByRole('button', { name: 'Indsæt' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('kalder ikke onClick ved Enter – tastaturvejen er lukket på samme måde som musen', async () => {
    // Præcis hullet i fundet: knappen kunne Tab'es til og Enter-aktiveres, og «der sker bare
    // ingenting, uden forklaring».
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InlineActionButton onClick={onClick} disabled disabledReason="Indtastning mangler">
        Indsæt
      </InlineActionButton>
    );

    screen.getByRole('button', { name: 'Indsæt' }).focus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('svarer TAVST på et klik – årsagen bliver ikke til en tekstknude', async () => {
    // §11.1: årsagen må ikke renderes som tekst nogen steder. Kun tooltippet bærer den.
    const user = userEvent.setup();
    render(
      <InlineActionButton onClick={vi.fn()} disabled disabledReason="Indtastning mangler">
        Indsæt
      </InlineActionButton>
    );

    await user.click(screen.getByRole('button', { name: 'Indsæt' }));
    expect(screen.queryByText('Indtastning mangler')).not.toBeInTheDocument();
  });

  it('viser årsagen i tooltippet ved hover', async () => {
    const user = userEvent.setup();
    render(
      <InlineActionButton onClick={vi.fn()} disabled disabledReason="Indtastning mangler">
        Indsæt
      </InlineActionButton>
    );

    await user.hover(screen.getByRole('button', { name: 'Indsæt' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Indtastning mangler');
  });

  it('oplyses som utilgængelig, men forbliver fokusérbar', async () => {
    // `aria-disabled` frem for `disabled`: en `disabled` knap kan ikke fokuseres, og en bruger uden
    // hover (tastatur, berøring) ville da aldrig kunne nå årsagen.
    render(
      <InlineActionButton onClick={vi.fn()} disabled disabledReason="Indtastning mangler">
        Indsæt
      </InlineActionButton>
    );

    const button = screen.getByRole('button', { name: 'Indsæt' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('knytter årsagen til knappen med aria-describedby, så en skærmlæser får den', async () => {
    render(
      <InlineActionButton onClick={vi.fn()} disabled disabledReason="Indtastning mangler">
        Indsæt
      </InlineActionButton>
    );

    expect(screen.getByRole('button', { name: 'Indsæt' })).toHaveAttribute('aria-describedby');
  });

  it('aktiverer knappen normalt, når intet blokerer', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const gate = resolveActionGate([]);
    render(
      <InlineActionButton onClick={onClick} disabled={gate.disabled} disabledReason={gate.disabledReason}>
        Indsæt
      </InlineActionButton>
    );

    await user.click(screen.getByRole('button', { name: 'Indsæt' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('FloatingActionButton: deaktiveret ved en maksimumgrænse', () => {
  it('er reelt slået fra – ikke blot visuelt dæmpet', async () => {
    // Fundet: knappen ryster og fremstod stadig som en AKTIV knap. En skærmlæser oplyste den som
    // almindelig og brugbar. Nu er den ægte `disabled`.
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FloatingActionButton
        icon={<AddIcon />}
        disabled
        tooltip="Tilføj nyt ansættelsesforhold"
        disabledReason="Maksimalt 10 ansættelsesforhold"
        onClick={onClick}
      />
    );

    const button = screen.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('har et STABILT navn, der ikke skifter med blokeringstilstanden', () => {
    // De fire runde knapper hentede tidligere deres navn udelukkende fra tooltippen, og tooltippen
    // skiftede tekst ved blokering – så knappens identitet skiftede med den. Navnet følger nu
    // handlingen; kun tooltippen bærer årsagen.
    const { rerender } = render(
      <FloatingActionButton
        icon={<AddIcon />}
        tooltip="Tilføj nyt ansættelsesforhold"
        onClick={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' })).toBeInTheDocument();

    rerender(
      <FloatingActionButton
        icon={<AddIcon />}
        disabled
        tooltip="Tilføj nyt ansættelsesforhold"
        disabledReason="Maksimalt 10 ansættelsesforhold"
        onClick={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' })).toBeInTheDocument();
  });

  it('har et tilgængeligt navn, selv om barnet kun er et ikon', () => {
    // En `<Tooltip>` udenom TÆLLER IKKE som navn: MUI sætter `aria-labelledby` på popper-elementet,
    // som kun findes mens tooltippen er åben (se `accessibilityRules.ts`).
    render(
      <FloatingActionButton icon={<AddIcon />} tooltip="Slet ansættelsesforhold" onClick={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Slet ansættelsesforhold' })).toBeInTheDocument();
  });

  it('ryster ikke – der findes ingen shake-affordance tilbage', async () => {
    // Rystelsen er fjernet i hele programmet. Testen måler fraværet på DOM'en, så en genindført
    // animation gør den rød.
    const user = userEvent.setup();
    render(
      <FloatingActionButton
        icon={<AddIcon />}
        disabled
        tooltip="Tilføj nyt ansættelsesforhold"
        disabledReason="Maksimalt 10 ansættelsesforhold"
        onClick={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' });
    await user.click(button);
    expect(button.className).not.toMatch(/shake/i);
    expect(window.getComputedStyle(button).animation).not.toMatch(/shake/i);
  });
});
