import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useCriticalInputActions } from '../../inputCore/react/useInputEvaluation';
import { measureNearestContentUiScale } from '../../utils/uiScale';
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
  const tabsRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const syncIndicator = () => {
      const tabsRoot = tabsRef.current;
      const selectedTab = tabsRoot?.querySelector<HTMLElement>('.MuiTab-root.Mui-selected');
      const indicator = tabsRoot?.querySelector<HTMLElement>('.MuiTabs-indicator');
      const indicatorParent = indicator?.offsetParent;
      if (tabsRoot === null || selectedTab == null || indicator == null || !(indicatorParent instanceof HTMLElement)) return;

      const scale = measureNearestContentUiScale(tabsRoot);
      const tabRect = selectedTab.getBoundingClientRect();
      const parentRect = indicatorParent.getBoundingClientRect();
      if (scale <= 0 || tabRect.width <= 0) return;

      // MUI måler allerede den zoomede tab-rect, men skriver resultatet som uzoomede layout-px.
      // Dividering her forhindrer, at indikatoren zoomes en ekstra gang og ender for kort.
      const expectedLeft = (tabRect.left - parentRect.left) / scale;
      const expectedWidth = tabRect.width / scale;
      if (Math.abs(Number.parseFloat(indicator.style.left) - expectedLeft) > 0.01) {
        indicator.style.setProperty('left', `${expectedLeft}px`, 'important');
      }
      if (Math.abs(Number.parseFloat(indicator.style.width) - expectedWidth) > 0.01) {
        indicator.style.setProperty('width', `${expectedWidth}px`, 'important');
      }
    };

    let frame: number | null = null;
    const scheduleSync = () => {
      syncIndicator();
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        syncIndicator();
      });
    };

    scheduleSync();
    window.addEventListener('resize', scheduleSync);
    const tabsRoot = tabsRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleSync);
    if (tabsRoot !== null) observer?.observe(tabsRoot);
    // Tabs kan selv skrive indikatorens inline-style efter forælderens layout-effect (fx fra sin
    // egen ResizeObserver). MutationObserveren korrigerer netop den sene skrivning, uden polling.
    //
    // Observeren sidder på fane-RODEN — vores egen stabile `<Box>` — og ikke på indikator-elementet.
    // Det er ikke en detalje: React udskifter indikator-noden, når Tabs gentegnes, og en observer
    // bundet direkte til noden endte derfor på et løsrevet element og tav for al fremtid. Symptomet
    // var, at den blå streg blev stående i MUI's egen (forkert skalerede) bredde efter en
    // vinduesændring, mens den var korrekt efter et faneklik.
    const indicatorObserver = tabsRoot === null || typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(scheduleSync);
    if (tabsRoot !== null) {
      indicatorObserver?.observe(tabsRoot, { subtree: true, attributes: true, attributeFilter: ['style'] });
    }
    return () => {
      window.removeEventListener('resize', scheduleSync);
      observer?.disconnect();
      indicatorObserver?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [items, value]);

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
        ref={tabsRef}
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
