import * as React from 'react';
import { Box, IconButton, TableCell, Tooltip, type TableCellProps } from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';

const ROW_DELETE_ICON_COLOR = '#b88a8a';
const ROW_DELETE_ICON_HOVER_COLOR = '#c25555';
const ROW_DELETE_HOVER_HALO_COLOR = 'rgba(194, 85, 85, 0.16)';

export type RowDeleteButtonProps = Readonly<{
  /** Rydder præcis denne ene række i én undo-handling. Kaldes ved klik på ikonet. */
  onDelete: () => void;
  /** Tooltip + aria-label. Default "Slet rækken". */
  title?: string;
}>;

/**
 * Delt slet-række-affordance for grid- og løse tabeller: et nedtonet rødt skraldespand-ikon,
 * der kun vises ved hover på rækken og først får fuld slet-rød farve ved hover på selve knappen.
 *
 * Synligheds-reglen ligger bevidst i `StandardGridTable`/`StandardLooseTable` (selektoren
 * `tbody tr:hover .mineo-row-delete-slot`), så hover-reveal er ét fælles sted for begge
 * tabel-familier. Knappen placeres i rækkens sidste celle, som SKAL bære lane-kontrakten —
 * brug `RowDeleteLaneCell` (løs tabel) eller `rowDeleteLaneStyle` (`<td>`), aldrig en håndskrevet
 * `position: relative` + `paddingRight` (håndhævet af `form/row-delete-lane-cell-single-source`).
 * Den svæver ved cellens højre kant og fanger kun klik på selve ikonet — wrapperen har
 * `pointer-events: none`, indtil rækken er hovered, så resten af cellen forbliver interaktiv,
 * og et klik i højre kant af en ikke-hovered række kan ikke ramme et usynligt ikon.
 *
 * Knappen er bevidst uden for grid-tastaturnavigationen: `tabIndex={-1}`, `onMouseDown` afviser
 * fokus-tyveri (så den fokuserede celle bevares), og `data-mineo-row-delete` får tabellens
 * capture-handlers til at ignorere den (samme mønster som `data-mineo-table-dropdown`).
 *
 * Forbrugeren renderer kun knappen for en faktisk persisteret række, aldrig for en visuel placeholder. En række,
 * som kun indeholder rejected råtekst, skal stadig kunne slettes, selv om dens canonical projektion ser tom ud.
 */
export const RowDeleteButton = React.memo(({ onDelete, title = 'Slet rækken' }: RowDeleteButtonProps) => {
  return (
    <Box
      className="mineo-row-delete-slot"
      sx={{
        position: 'absolute',
        // Ligger i en reserveret bane til HØJRE for kolonnens indhold (celler med slet-ikon har
        // ekstra paddingRight), så ikonet aldrig dækker tekst/værdier. Kun synligt ved hover.
        right: '5px',
        top: '50%',
        transform: 'translateY(-50%)',
        opacity: 0,
        // pointer-events drives af hover-reglen i base-tabellen: knappen arver dette, så et usynligt
        // ikon ikke kan klikkes, før rækken faktisk er hovered.
        pointerEvents: 'none',
        transition: 'opacity 120ms ease-in-out',
        zIndex: 2,
      }}
    >
      <Tooltip title={title} disableInteractive>
        <IconButton
          data-mineo-row-delete="true"
          tabIndex={-1}
          aria-label={title}
          size="small"
          // Bevar den fokuserede celle: undgå at klikket flytter DOM-fokus til knappen.
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{
            pointerEvents: 'inherit',
            // Bevidst lille, så hover-overlayet dækker færrest mulige cifre i den højre kolonne
            // (jf. brugervalg "overlay på kanten, mindre ikon").
            width: '20px',
            height: '20px',
            padding: 0,
            // Svævende "chip" oven på rækkens højre kant, så ikonet er læsbart over celleindhold
            // i både lyst og mørkt tema.
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': { bgcolor: ROW_DELETE_HOVER_HALO_COLOR },
            '& .MuiSvgIcon-root': {
              color: ROW_DELETE_ICON_COLOR,
              transition: 'color 120ms ease-in-out',
            },
            '&:hover .MuiSvgIcon-root': {
              color: ROW_DELETE_ICON_HOVER_COLOR,
            },
          }}
        >
          <Delete sx={{ fontSize: '15px' }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
});

RowDeleteButton.displayName = 'RowDeleteButton';

/**
 * Bredden på den reserverede bane til højre for celleindholdet. Ikonet svæver i banen
 * (`right: 5px`, bredde 20px), så indholdet aldrig ligger under skraldespanden.
 */
export const ROW_DELETE_LANE_WIDTH_PX = 28;

/**
 * Cellekontrakten `RowDeleteButton` afhænger af: knappen er `position: absolute`, så dens
 * celle SKAL være `position: relative` (ellers finder den nærmeste positionerede forfader —
 * typisk tabellens container — og ikonet lander i tabellens hjørne i stedet for i rækken),
 * og cellen skal reservere banen med `paddingRight`.
 *
 * Kontrakten var tidligere skrevet i hånden på hvert kaldsted i fire forskellige stavemåder
 * (`sx` med `'28px'`, `sx` med tal, spredt `style` med `28`, spredt `style` med `'28px'`) uden
 * noget værn. Den bor nu ét sted og forbruges via `RowDeleteLaneCell`/`rowDeleteLaneStyle`,
 * så en celle ikke kan glemme halvdelen af den.
 */
const ROW_DELETE_LANE_CONTRACT = {
  position: 'relative',
  paddingRight: `${ROW_DELETE_LANE_WIDTH_PX}px`,
} as const;

/**
 * Slet-banen for grid-tabellernes rå `<td style={...}>`-celler.
 *
 * Lægges SIDST i cellens style, så en spredt basisstil ikke kan overskrive kontrakten væk.
 */
export const rowDeleteLaneStyle = (base?: React.CSSProperties): React.CSSProperties => {
  return { ...base, ...ROW_DELETE_LANE_CONTRACT };
};

export type RowDeleteLaneCellProps = Omit<TableCellProps, 'sx'> & Readonly<{
  sx?: SxProps<Theme>;
}>;

/**
 * Slet-banen for de løse tabellers MUI-`TableCell`. Samme kontrakt som `rowDeleteLaneStyle`,
 * lagt sidst via `mergeSx` så kaldstedets egen `sx` ikke kan fjerne den.
 */
export const RowDeleteLaneCell = React.memo(({ sx, children, ...props }: RowDeleteLaneCellProps) => {
  return (
    <TableCell {...props} sx={mergeSx(sx ?? {}, ROW_DELETE_LANE_CONTRACT)}>
      {children}
    </TableCell>
  );
});

RowDeleteLaneCell.displayName = 'RowDeleteLaneCell';

export default RowDeleteButton;
