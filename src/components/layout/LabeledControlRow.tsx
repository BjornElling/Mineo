import * as React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Rækken «synlig tekst til venstre, kontrol til højre» – med teksten bundet til kontrollen.
 *
 * **Hvorfor komponenten findes.** Mønsteret blev tidligere håndrullet på hver enkelt flade:
 *
 * ```tsx
 * <Box className="row--label-right-hover">
 *   <Typography className="row--text">Fuld løn under ferie</Typography>
 *   <Box className="row--label-right-hover__content"><ToggleField … /></Box>
 * </Box>
 * ```
 *
 * Visuelt korrekt, men `<Typography>` renderes som `<p>` og var kun et SØSKENDE-element til
 * kontrollen. Der var ingen semantisk forbindelse, så kontrollen stod uden tilgængeligt navn i
 * accessibility-træet – brugeren kunne fokusere og aktivere en switch uden at få at vide, hvad den
 * ændrede. Mønsteret var gentaget på tværs af hele programmet, så en punktvis rettelse pr. flade
 * ville have efterladt langt de fleste kontroller navnløse.
 *
 * Komponenten gør bindingen til rækkens egen egenskab: teksten får et stabilt `id`, som kontrollen
 * refererer via `labelledBy`, og den renderes som `<label htmlFor>`, så et klik på teksten aktiverer
 * kontrollen. Layoutet er uændret – teksten bliver liggende præcis hvor den lå, og de eksisterende
 * `row--*`-klasser bærer stadig al styling.
 *
 * **Hvorfor `labelledBy` og ikke bare en label inde i kontrollen.** MUI's `FormControlLabel` ville
 * flytte teksten ind i kontrollens eget element og dermed bryde rækkens `space-between`-layout på
 * tværs af ~34 flader. Her ligger teksten hvor designet vil have den, og bindingen sker med `id`.
 */
type LabeledControlRowProps = Readonly<{
  /**
   * Den synlige tekst. Rig markup er tilladt (interpolation, `InfoTooltipIcon`) – kontrollens
   * oplæste navn udledes af tekstindholdet, ikke af ikonerne.
   */
  label: React.ReactNode;
  /**
   * Kontrollen, der navngives. Kaldes med den binding, rækken har reserveret: `labelledBy` skal
   * videregives til kontrollen (`ToggleField`, `MappedToggleField`, `StyledToggleSwitch`), og
   * `controlId` skal sættes som kontrollens `id`, så tekstens `htmlFor` rammer den.
   */
  children: (binding: Readonly<{ labelledBy: string; controlId: string }>) => React.ReactNode;
  /** Skjuler rækken uden at unmounte den, så feltidentitet og fokus-restore overlever. */
  hidden?: boolean;
  /** Valgfri styling på selve tekstlinjen. */
  labelSx?: SxProps<Theme>;
  className?: string;
}>;

const LabeledControlRow = ({
  label,
  children,
  hidden = false,
  labelSx,
  className = 'row--label-right-hover',
}: LabeledControlRowProps) => {
  const reactId = React.useId();
  const labelId = `${reactId}-label`;
  const controlId = `${reactId}-control`;

  return (
    <Box className={className} {...(hidden ? { sx: { display: 'none' } } : {})}>
      {/*
        `component="label"` + `htmlFor` giver BÅDE den semantiske navnebinding og et klikbart mål:
        et klik på teksten aktiverer kontrollen, som ved et almindeligt afkrydsningsfelt.
        `id` er samtidig det, kontrollen peger på med aria-labelledby, så navnet er den tekst der står.
      */}
      <Typography
        id={labelId}
        component="label"
        htmlFor={controlId}
        className="row--text"
        sx={{ cursor: 'pointer', ...(labelSx ?? {}) }}
      >
        {label}
      </Typography>
      <Box className="row--label-right-hover__content">{children({ labelledBy: labelId, controlId })}</Box>
    </Box>
  );
};

LabeledControlRow.displayName = 'LabeledControlRow';

export default LabeledControlRow;
