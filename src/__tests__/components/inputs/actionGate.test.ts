import {
  ACTION_BLOCKED_INVALID_INPUT_MESSAGE,
  ACTION_BLOCKED_MISSING_INPUT_MESSAGE,
  resolveActionBlockedReason,
  resolveActionBlockedTooltip,
  resolveActionGate,
} from '../../../components/inputs/actionGate';
import {
  DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
} from '../../../document/layout/documentGateTypes';

// Den delte grammatik for en DEAKTIVERET HANDLING. Reglen fandtes i forvejen for de deaktiverede
// downloadknapper (`page-component-contract.md` §11.1); brugerbeslutningen 2026-08-15 gjorde den
// universel for enhver grå knap — herunder at en generisk årsag er god nok.

describe('actionGate: teksterne er DELT med downloadgaten, ikke kopieret', () => {
  it('bruger nøjagtig samme strenge som downloadknappernes to universelle klasser', () => {
    // Kernen i beslutningen: en grå «Indsæt»-knap og en grå downloadknap ved siden af hinanden skal
    // sige det SAMME. En parallel konstant med samme betydning ville være to sandheder om ét begreb,
    // og de kunne drifte fra hinanden uden at nogen test blev rød.
    expect(ACTION_BLOCKED_MISSING_INPUT_MESSAGE).toBe(DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE);
    expect(ACTION_BLOCKED_INVALID_INPUT_MESSAGE).toBe(DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  it('de to klasser er FORSKELLIGE tekster — «mangler» og «forkert» kollapser ikke til én', () => {
    // Skelnen er et brugerkrav (2026-07-30): de sender brugeren to forskellige steder hen.
    expect(ACTION_BLOCKED_MISSING_INPUT_MESSAGE).not.toBe(ACTION_BLOCKED_INVALID_INPUT_MESSAGE);
  });
});

describe('actionGate: oversættelse af årsag til tooltiptekst', () => {
  it('oversætter hver klasse til dens brugerrettede tekst', () => {
    expect(resolveActionBlockedTooltip({ kind: 'missing-input' }))
      .toBe(ACTION_BLOCKED_MISSING_INPUT_MESSAGE);
    expect(resolveActionBlockedTooltip({ kind: 'invalid-input' }))
      .toBe(ACTION_BLOCKED_INVALID_INPUT_MESSAGE);
  });

  it('citerer `limit` ordret — grænsen skal navngives konkret', () => {
    // `limit` er den ene klasse, hvor der IKKE er et felt at rette. En generisk «indtastning mangler»
    // ville sende brugeren efter et felt, der ikke findes.
    expect(resolveActionBlockedTooltip({ kind: 'limit', message: 'Maksimalt 10 ansættelsesforhold' }))
      .toBe('Maksimalt 10 ansættelsesforhold');
  });
});

describe('actionGate: forrang ved flere samtidige årsager', () => {
  it('lader `invalid-input` slå `missing-input`', () => {
    // Samme forrang som dokumentgaten: noget FORKERT er mere akut end noget uudfyldt.
    const reason = resolveActionBlockedReason([{ kind: 'missing-input' }, { kind: 'invalid-input' }]);
    expect(reason).toEqual({ kind: 'invalid-input' });
  });

  it('er uafhængig af den rækkefølge, kalderen tilfældigvis pusher årsagerne i', () => {
    // Ville forrangen afhænge af rækkefølgen, var den ikke en egenskab ved klassifikationen, men ved
    // kaldsstedet — og så kunne to flader vise hver sin tekst for samme tilstand.
    expect(resolveActionBlockedReason([{ kind: 'invalid-input' }, { kind: 'missing-input' }]))
      .toEqual(resolveActionBlockedReason([{ kind: 'missing-input' }, { kind: 'invalid-input' }]));
  });

  it('lader `limit` vinde over begge input-klasser', () => {
    const reason = resolveActionBlockedReason([
      { kind: 'missing-input' },
      { kind: 'invalid-input' },
      { kind: 'limit', message: 'Maksimalt 10 ansættelsesforhold' },
    ]);
    expect(reason).toEqual({ kind: 'limit', message: 'Maksimalt 10 ansættelsesforhold' });
  });

  it('giver ingen årsag, når intet blokerer', () => {
    expect(resolveActionBlockedReason([])).toBeUndefined();
  });
});

describe('actionGate: knappens samlede tilstand', () => {
  it('er aktiv UDEN årsag, når intet blokerer', () => {
    // `disabled` og `disabledReason` udledes ét sted netop for at udelukke den uparrede tilstand:
    // en grå knap uden årsag, eller en årsag der bliver hængende efter blokeringen er væk.
    expect(resolveActionGate([])).toEqual({ disabled: false, disabledReason: undefined });
  });

  it('er grå MED årsag, så snart noget blokerer', () => {
    expect(resolveActionGate([{ kind: 'missing-input' }])).toEqual({
      disabled: true,
      disabledReason: ACTION_BLOCKED_MISSING_INPUT_MESSAGE,
    });
  });

  it('parrer aldrig `disabled` med en tom årsag', () => {
    // Værnet mod den tavse grå knap — præcis den tilstand, fundet beskrev.
    for (const reasons of [
      [{ kind: 'missing-input' } as const],
      [{ kind: 'invalid-input' } as const],
      [{ kind: 'limit', message: 'Maksimalt 10 ansættelsesforhold' } as const],
    ]) {
      const gate = resolveActionGate(reasons);
      expect(gate.disabled).toBe(true);
      expect(gate.disabledReason).toBeTruthy();
    }
  });
});
