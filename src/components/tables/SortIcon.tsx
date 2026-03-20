import * as React from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { tableColors } from '../../config/tableTheme';
import type { GridSortDirection, GridSortRole } from './gridCore/gridModel';

/**
 * Intern sorterings-ikon brugt af StandardGridHeaderCell og StandardLooseHeaderCell.
 * Vises kun når sortRole !== 'none'.
 */
export const SortIcon = React.memo(
  ({ sortRole, sortDirection }: { sortRole: GridSortRole; sortDirection: GridSortDirection }) => {
    const Icon = sortDirection === 'desc' ? KeyboardArrowDownIcon : KeyboardArrowUpIcon;
    const color = sortRole === 'primary' ? tableColors.sortPrimaryColor : tableColors.sortSecondaryColor;
    return (
      <Icon
        sx={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          fontSize: '14px',
          color,
        }}
      />
    );
  }
);

SortIcon.displayName = 'SortIcon';
