import { Tooltip, Typography } from '@mui/material';

/** Den fulde betegnelse bag de korte filteretiketter «L:» og «A:». */
export const OVERENSKOMST_FILTER_TOOLTIP = Object.freeze({
  loenmodtager: 'Lønmodtagerorganisation',
  arbejdsgiver: 'Arbejdsgiverorganisation',
} as const);

const KORT_ETIKET = Object.freeze({ loenmodtager: 'L:', arbejdsgiver: 'A:' } as const);

/**
 * Etiketten foran et overenskomstfilter. Den korte form «L:»/«A:» står bevidst for at spare plads, men
 * forklarede ikke sig selv – brugeren skulle gætte, hvad bogstaverne stod for (BB-287). Tooltippen giver den
 * fulde betegnelse samme sted, alle tre filterpar står: ansættelsesforholdet, angivet løn og Indstillinger.
 */
const OverenskomstFilterLabel = ({
  part,
  size = 'compact',
}: Readonly<{
  part: keyof typeof OVERENSKOMST_FILTER_TOOLTIP;
  /** `compact`: de små filtre ved «Vælg overenskomst». `row`: Indstillingers almindelige rækketekst. */
  size?: 'compact' | 'row';
}>) => (
  <Tooltip title={OVERENSKOMST_FILTER_TOOLTIP[part]} arrow placement="top">
    {size === 'row'
      ? <Typography className="row--text">{KORT_ETIKET[part]}</Typography>
      : <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>{KORT_ETIKET[part]}</Typography>}
  </Tooltip>
);

export default OverenskomstFilterLabel;
