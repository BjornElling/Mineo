import { Box, Typography } from '@mui/material';
import ContentBox from '../../../layout/ContentBox';
import HoverRow from '../HoverRow';
import type { ErhvervsevnetabValues } from '../../../../schemas/formSchemas';
import type {
  MerErstatningPensionsalderComputation,
  MerErstatningPensionsalderEvent,
} from '../../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import { formatIsoDateLong } from '../../../../utils/dateFormatting';
import { formatAsAmountTrimmed, formatKr } from '../../../../utils/formatUtils';
import { round0, sumRoundedValues } from '../../../../utils/roundingShortcuts';
import { toKroner } from '../../../../domain/money/money';
import { formatFaktor, formatPct as formatKapPct } from '../../../../domain/erhvervsevnetab/eetFormatUtils';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from '../../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';

/**
 * Mer-erstatning ved forhøjet pensionsalder: én blok pr. forhøjelses-event plus den
 * samlede boks. Ren visning uden VM-kobling; lå tidligere fil-lokalt i
 * `EetDifferencekravTab.tsx`.
 */
type MerErstatningBoxProps = Readonly<{
  computation: MerErstatningPensionsalderComputation;
  koen: ErhvervsevnetabValues['koen'];
}>;

const EetMerErstatningEventRows = ({ event, koen }: { event: MerErstatningPensionsalderEvent; koen: ErhvervsevnetabValues['koen'] }) => (
  <>
    <HoverRow underlined
      text={`Forhøjelse pr. ${formatIsoDateLong(event.forhoejelsesdato)} (${event.gammelAlderLabel} → ${event.nyAlderLabel})`}
    />

    <Typography className="row--subheading">Løbende ydelse</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringGrundydelseLabel(formatKapPct(event.kapitaliseringspct), event.amBidragPct)}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">
          {buildKapitaliseringGrundydelseExpression(
            formatKr(toKroner(event.grundloenOre), 0),
            formatKapPct(event.kapitaliseringspct),
            event.erstatningsniveauPct,
            event.amBidragPct,
            formatKr(toKroner(event.grundydelseOre), 2)
          )}
        </Typography>
      </Box>
    </Box>

    {event.grundydelse2024Ore !== null && event.opreguleringTil2024PctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildKapitaliseringOpreguleringTil2024Expression(
            formatKr(toKroner(event.grundydelseOre), 2),
            formatAsAmountTrimmed(1 + event.opreguleringTil2024PctRounded4 / 100, 4),
            `${formatAsAmountTrimmed(event.opreguleringTil2024PctRounded4, 4)} %`
          )}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(event.grundydelse2024Ore), 2)}</Typography>
        </Box>
      </Box>
    )}

    {event.aarsydelseReguleringsPctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">{`Reguleringsprocent (${event.satsAar})`}</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{`${formatAsAmountTrimmed(event.aarsydelseReguleringsPctRounded4, 4)} %`}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringAarsydelseExpression(
          formatKr(toKroner(event.aarsydelseGrundlagOre), 2),
          event.aarsydelseReguleringsPctRounded4 === null
            ? null
            : `${formatAsAmountTrimmed(100 + event.aarsydelseReguleringsPctRounded4, 4)} %`
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.aarsydelseOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalværdi til hidtidig folkepensionsalder ({event.gammelAlderLabel})</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">{event.gammel.kapitaliseringsbekendtgoerelseLabel}</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatFaktor(event.gammel.kapitaliseringsfaktor)}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} × ${formatFaktor(event.gammel.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalværdi til forhøjet folkepensionsalder ({event.nyAlderLabel})</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">{event.ny.kapitaliseringsbekendtgoerelseLabel}</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatFaktor(event.ny.kapitaliseringsfaktor)}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} × ${formatFaktor(event.ny.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.ny.kapitalvaerdiOre), 2)}</Typography>
      </Box>
    </Box>

    {event.koenOpdelt && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">Køn</Typography>
        <Box className="row--label-right-hover__content">
          {/* koenOpdelt forudsætter at køn er sat; ?? '' undgår at vise teksten "undefined" hvis typen er løs. */}
          <Typography className="row--text">{koen ?? ''}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover" sx={{ mt: 1 }}>
      <Typography className="row--text">
        {`Mer-erstatning (${formatKr(toKroner(event.ny.kapitalvaerdiOre), 2)} − ${formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text text-bold">{formatKr(toKroner(event.merErstatningOre))}</Typography>
      </Box>
    </Box>
  </>
);

export const EetMerErstatningPensionsalderBox = ({ computation, koen }: MerErstatningBoxProps) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Mer-erstatning ved forhøjet folkepensionsalder</Typography>

    {computation.events.map((event, index) => (
      <Box key={`${event.rowId}-${event.forhoejelsesdato}`} sx={{ mt: index === 0 ? 0 : 2 }}>
        <EetMerErstatningEventRows event={event} koen={koen} />
      </Box>
    ))}

    {computation.events.length > 1 && (
      <Box className="row--label-right-hover" sx={{ mt: 2 }}>
        <Typography className="row--text">Samlet mer-erstatning</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text text-bold">
            {formatKr(sumRoundedValues(computation.events.map((event) => toKroner(event.merErstatningOre)), round0))}
          </Typography>
        </Box>
      </Box>
    )}
  </ContentBox>
);
