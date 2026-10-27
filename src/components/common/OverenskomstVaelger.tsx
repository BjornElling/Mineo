import { Box, MenuItem, Typography } from '@mui/material';
import ChoiceField from '../../inputCore/react/fields/ChoiceField';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EditorLocation } from '../../inputCore/editor/fieldEditorState';
import type { FieldIssue } from '../../inputCore/inputIssue';
import {
  formatOverenskomstMetaDisplay,
  getAlleArbejdsgiverOrg,
  getAlleLoenmodtagerOrg,
  getOverenskomsterByOrg,
  resolveOverenskomstDisplay,
  withGemtOrganisation,
} from '../../data/overenskomstRates';
import OverenskomstFilterLabel from './OverenskomstFilterLabel';

type ChoiceBinding = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;
}>;

type FilterBinding = ChoiceBinding & Readonly<{ value: string | undefined }>;

type Props = Readonly<{
  namePrefix: string;
  overenskomst: ChoiceBinding;
  loenmodtager: FilterBinding;
  arbejdsgiver: FilterBinding;
  overenskomstIssue?: FieldIssue;
}>;

const FILTER_SX = {
  '& .MuiInputBase-root': {
    height: '24px !important',
    minHeight: '24px !important',
    paddingRight: '20px !important',
  },
  '& .MuiInputBase-input': {
    fontSize: '11px !important',
    padding: '0 4px 0 8px !important',
    lineHeight: '24px',
  },
  '& .MuiSvgIcon-root': { fontSize: '12px !important' },
} as const;

/** Fælles overenskomstvalg med samme organisationsfiltre, tooltips og feltmotor på begge lønflader. */
export default function OverenskomstVaelger({
  namePrefix, overenskomst, loenmodtager, arbejdsgiver, overenskomstIssue,
}: Props) {
  const filters = [
    { part: 'loenmodtager', binding: loenmodtager, organisations: getAlleLoenmodtagerOrg() },
    { part: 'arbejdsgiver', binding: arbejdsgiver, organisations: getAlleArbejdsgiverOrg() },
  ] as const;

  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text">Vælg overenskomst</Typography>
      <Box className="row--label-right-hover__content">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {filters.map(({ part, binding, organisations }) => (
            <Box key={part} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <OverenskomstFilterLabel part={part} />
              <ChoiceField
                field={binding.field}
                location={binding.location}
                name={`${namePrefix}:overenskomstFilter.${part}`}
                emptyUiValue="ALLE"
                width={120}
                allowEmpty={false}
                sx={FILTER_SX}
                iconSx={{ fontSize: '16px', right: 2 }}
                optionSx={{ fontSize: '11px', minHeight: '24px', padding: '3px 8px' }}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {withGemtOrganisation(organisations, binding.value, 'ALLE').map((org) => (
                  <MenuItem key={org} value={org}>{org}</MenuItem>
                ))}
              </ChoiceField>
            </Box>
          ))}
          <ChoiceField
            field={overenskomst.field}
            location={overenskomst.location}
            name={`${namePrefix}:overenskomstId`}
            width={460}
            placeholder="Vælg overenskomst..."
            allowEmpty={true}
            getOptionLabel={(id) => resolveOverenskomstDisplay(typeof id === 'string' ? id : String(id))}
            {...(overenskomstIssue === undefined ? {} : { crossFieldIssue: overenskomstIssue })}
          >
            {getOverenskomsterByOrg(loenmodtager.value, arbejdsgiver.value).map((meta) => (
              <MenuItem key={meta.id} value={meta.id}>{formatOverenskomstMetaDisplay(meta)}</MenuItem>
            ))}
          </ChoiceField>
        </Box>
      </Box>
    </Box>
  );
}
