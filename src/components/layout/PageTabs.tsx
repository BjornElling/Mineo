import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';

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
  const allowedKeys = React.useMemo(() => new Set(items.map((item) => item.key)), [items]);
  const handleChange = React.useCallback(
    (_event: React.SyntheticEvent, next: unknown) => {
      if (typeof next === 'string' && allowedKeys.has(next as T)) {
        onChange(next as T);
      }
    },
    [allowedKeys, onChange]
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
            <Tab key={item.key} className="tab-item" label={item.label} value={item.key} />
          ))}
        </Tabs>
      </Box>
    </Box>
  );
}

export default PageTabs;
