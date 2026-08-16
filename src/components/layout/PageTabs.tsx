import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useCriticalInputActions } from '../../inputCore/react/useInputEvaluation';
import { TAB_NAVIGATION_ATTRIBUTE } from './containerNavigation/navigationControlSemantics';

export type PageTabItem<T extends string> = {
  readonly key: T;
  readonly label: string;
};

export type PageTabsProps<T extends string> = {
  readonly items: readonly PageTabItem<T>[];
  /**
   * Aktiv fane. `false` markerer ingen fane (fx når en side-fane er aktiv i
   * stedet, jf. Erstatningsopgørelses kontrolfaner).
   */
  readonly value: T | false;
  readonly onChange: (value: T) => void;
  /**
   * Min-bredde pr. fane (`.MuiTab-root`). Default 140; Erhvervsevnetab bruger
   * 130 for at få fem faner til at passe.
   */
  readonly minTabWidth?: number;
};

/**
 * Fælles fane-navigation for fagsiderne. Indkapsler den absolut-positionerede
 * `<Tabs>`-header (placering + sx + fane-guard), så stylingen har ét
 * abstraktionspunkt frem for at være kopieret pr. side (jf.
 * `page-component-contract.md` §10.2).
 *
 * Selve fane-tilstanden ejes fortsat af siden via `usePersistedActiveTab`;
 * denne komponent er ren præsentation.
 */
function PageTabs<T extends string>({
  items,
  value,
  onChange,
  minTabWidth = 140,
}: PageTabsProps<T>): React.ReactElement {
  const criticalActions = useCriticalInputActions();
  const allowedKeys = React.useMemo(() => new Set(items.map((item) => item.key)), [items]);

  /**
   * Faneskift settler selv den åbne editor.
   *
   * Før byggede skiftet på en bivirkning: klikker man på en fane med MUSEN, forlader musen først
   * feltet, og blur'en committede det indtastede. Skiftet gjorde altså intet selv — det var
   * heldigt stillet. Da fanerne bevidst ikke kan nås med tastaturet, kunne det ikke fremprovokeres,
   * men sikringen manglede: bliver fanerne en dag tastaturtilgængelige, eller udløser programmet
   * selv et skift, ville en igangværende indtastning gå tabt uden varsel.
   *
   * `'navigate'` er den rigtige handlingsklasse og ikke en ny: et faneskift har præcis samme policy
   * som sidenavigation — settle og fortsæt, også ved et fejlende settle (`critical-action-contract.md`
   * §3). Et sideskift og et faneskift må ikke kunne drifte fra hinanden.
   *
   * Ved et fail-closed `blocked` fokuseres det aktive felt, og skiftet stopper — samme svar som
   * sidemenuens navigation giver.
   */
  const handleChange = React.useCallback(
    (_event: React.SyntheticEvent, next: unknown) => {
      if (typeof next !== 'string' || !allowedKeys.has(next as T)) return;
      const target = next as T;
      void (async () => {
        try {
          const preparation = await criticalActions.prepare('navigate');
          if (preparation.status === 'blocked') {
            preparation.target?.focus();
            return;
          }
        } catch {
          // Fail-closed som sidemenuen: et uventet settle-nedbrud stopper skiftet, så en indtastning
          // ikke går tabt på vej væk fra fanen. Sidemenuen viser desuden en advarsel; det gør denne
          // flade ikke, fordi fanen bliver stående og selv er det synlige svar.
          return;
        }
        onChange(target);
      })();
    },
    [allowedKeys, criticalActions, onChange]
  );

  return (
    <Box
      sx={{
        position: 'relative',
        width: '1200px',
        height: 0,
        mb: '40px',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '-48px',
          right: '20px',
          zIndex: 10,
        }}
      >
        <Tabs
          value={value}
          onChange={handleChange}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': {
              minWidth: minTabWidth,
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--color-primary)',
              height: '2px',
            },
          }}
        >
          {items.map((item) => (
            <Tab
              key={item.key}
              className="tab-item"
              label={item.label}
              value={item.key}
              {...{ [TAB_NAVIGATION_ATTRIBUTE]: 'true' }}
            />
          ))}
        </Tabs>
      </Box>
    </Box>
  );
}

export default PageTabs;
