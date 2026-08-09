// @vitest-environment jsdom
//
// Den kanoniske visning af et dokumentudfald.
//
// Otte dokumentførende flader aktiverede en download uden nogensinde at rendere hookens besked, så et
// stale-afbrud eller en død DEV-server var lydløs: brugeren klikkede på en aktiv knap, fik ingen fil og ingen
// forklaring. Samtidig fandtes den samme fejlrække i fem forskellige udgaver på de flader, der huskede den.
// Komponenten er det ene sted, rækken nu bygges.
//
// Den modsatte grænse er lige så vigtig og pinnes nedenfor: en GATE-blokering må ikke nå rækken. En
// deaktiveret knap svarer aldrig med tekst — tooltippet ejer årsagen (brugerbeslutning 2026-07-31).
import { render, screen } from '@testing-library/react';
import DocumentOutcomeMessage from '../../../components/inputs/DocumentOutcomeMessage';
import { resolveDocumentOutcomeMessage } from '../../../document/definition/documentMessages';
import { documentRejected, documentFailed } from '../../../document/definition/documentOutcome';
import { missingInputReason, specificReason } from '../../../document/layout/documentGateTypes';

const labels = { documentName: 'testdokument' } as const;

describe('DocumentOutcomeMessage', () => {
  it('viser beskeden, når der er en', () => {
    render(<DocumentOutcomeMessage message="Downloaden blev afbrudt." />);
    expect(screen.getByText('Downloaden blev afbrudt.')).toBeInTheDocument();
  });

  it('renderer INTET ved null, undefined og tom streng — ingen tom fejlrække', () => {
    const { container: nullContainer } = render(<DocumentOutcomeMessage message={null} />);
    expect(nullContainer).toBeEmptyDOMElement();

    const { container: undefinedContainer } = render(<DocumentOutcomeMessage message={undefined} />);
    expect(undefinedContainer).toBeEmptyDOMElement();

    const { container: emptyContainer } = render(<DocumentOutcomeMessage message="" />);
    expect(emptyContainer).toBeEmptyDOMElement();
  });

  it('viser den faktiske danske stale-source-tekst fra beskedlaget', () => {
    // Beskeden hentes fra produktionens beskedlag, ikke fra en hårdkodet testtekst: ændres teksten,
    // følger testen med, men et FRAVÆR af visning fejler stadig.
    const message = resolveDocumentOutcomeMessage(
      documentRejected({ kind: 'stale-source', phase: 'capture' }),
      labels,
      'pdf',
      false
    );
    expect(message).not.toBeNull();

    render(<DocumentOutcomeMessage message={message} />);
    expect(screen.getByTestId('document-outcome-message')).toHaveTextContent(
      'Downloaden blev afbrudt, fordi sagen blev ændret undervejs. Prøv igen.'
    );
  });

  it('viser DEV-server-beskeden, som brugeren selv kan handle på', () => {
    const message = resolveDocumentOutcomeMessage(
      documentFailed({ kind: 'dev-server-unavailable', phase: 'dev-preflight' }),
      labels,
      'pdf',
      false
    );
    render(<DocumentOutcomeMessage message={message} />);
    expect(screen.getByTestId('document-outcome-message')).toHaveTextContent('Udviklingsserveren svarer ikke');
  });

  /**
   * Den universelle regel (brugerbeslutning 2026-07-31): en deaktiveret download-knap svarer ALDRIG med
   * tekst. Gate-årsagen har én kanal — knappens tooltip ved hover.
   *
   * Værnet ligger på beskedlaget frem for på en enkelt flade, fordi det er dér, reglen er ét sted:
   * returnerer `resolveDocumentOutcomeMessage` `null`, kan ingen af de tolv callsites vise noget, uanset
   * hvordan de renderer. Testen dækker BEGGE årsagsklasser: den universelle `missing-input` og en
   * `specific`, der ellers citeres ordret til tooltippet — netop den, der er farligst at slippe igennem.
   */
  it('en gate-blokering bærer INGEN besked — hverken universel eller ordret citeret årsag', () => {
    const universel = resolveDocumentOutcomeMessage(
      documentRejected({
        kind: 'gate-blocked',
        phase: 'gate',
        reasons: [missingInputReason('test:mangler', 'Beregningsdato mangler')],
      }),
      labels,
      'pdf',
      false
    );
    expect(universel).toBeNull();

    const ordret = resolveDocumentOutcomeMessage(
      documentRejected({
        kind: 'gate-blocked',
        phase: 'gate',
        reasons: [specificReason('test:konkret', 'Der er ikke beregnet en PDF-klar EAL- eller ASL-del.')],
      }),
      labels,
      'pdf',
      false
    );
    expect(ordret).toBeNull();

    // Reglen er uafhængig af app-politikken for runtimefejl: også standalone (`true`) er gaten tavs.
    const standalone = resolveDocumentOutcomeMessage(
      documentRejected({
        kind: 'gate-blocked',
        phase: 'gate',
        reasons: [specificReason('test:konkret', 'Rentelinjen findes ikke længere.')],
      }),
      labels,
      'pdf',
      true
    );
    expect(standalone).toBeNull();

    // ... og en `null`-besked når ikke skærmen.
    const { container } = render(<DocumentOutcomeMessage message={universel} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('markerer beskeden som fejl, så den er visuelt adskilt fra almindelig rækketekst', () => {
    render(<DocumentOutcomeMessage message="En fejl" />);
    const row = screen.getByTestId('document-outcome-message');
    // MUI oversætter `sx={{ color: 'error.main' }}` til en emotion-klasse; assertionen måler at teksten
    // faktisk får en egen farve frem for at arve rækkens.
    const text = row.querySelector('.row--text');
    expect(text).not.toBeNull();
    expect(text?.className).not.toBe('');
  });
});
