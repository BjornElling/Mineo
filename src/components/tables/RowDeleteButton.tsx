import * as React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Delete } from '@mui/icons-material';

const ROW_DELETE_ICON_COLOR = '#a86b6b';
const ROW_DELETE_ICON_HOVER_COLOR = '#c25555';
const ROW_DELETE_HOVER_HALO_COLOR = 'rgba(194, 85, 85, 0.10)';

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
 * tabel-familier. Knappen placeres i rækkens sidste celle, der skal være `position: relative`;
 * den svæver ved cellens højre kant og fanger kun klik på selve ikonet — wrapperen har
 * `pointer-events: none`, indtil rækken er hovered, så resten af cellen forbliver interaktiv,
 * og et klik i højre kant af en ikke-hovered række kan ikke ramme et usynligt ikon.
 *
 * Knappen er bevidst uden for grid-tastaturnavigationen: `tabIndex={-1}`, `onMouseDown` afviser
 * fokus-tyveri (så den fokuserede celle bevares), og `data-mineo-row-delete` får tabellens
 * capture-handlers til at ignorere den (samme mønster som `data-mineo-table-dropdown`).
 *
 * Forbrugeren renderer kun knappen for rækker med faktiske bruger-indtastninger (gated af
 * tabellens egen `isRowEmpty`), så den aldrig vises på tomme rækker eller rækker, der kun
 * indeholder placeholders/default-dropdownværdier.
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

export default RowDeleteButton;
