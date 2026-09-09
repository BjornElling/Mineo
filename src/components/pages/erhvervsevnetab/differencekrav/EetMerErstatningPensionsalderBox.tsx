import { Box, Typography } from '@mui/material';
import ContentBox from '../../../layout/ContentBox';
import HoverRow from '../HoverRow';
import type { ErhvervsevnetabValues } from '../../../../schemas/formSchemas';
import type {
  MerErstatningPensionsalderComputation,
  MerErstatningPensionsalderEvent,
} from '../../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import { formatIsoDateLong, formatISOToDanish } from '../../../../utils/dateFormatting';
import { formatAsAmountTrimmed, formatKr } from '../../../../utils/formatUtils';
import { toKroner } from '../../../../domain/money/money';
import {
  formatFaktor,
  formatJaNej,
  formatPct as formatKapPct,
} from '../../../../domain/erhvervsevnetab/eetFormatUtils';
import { FORHOEJET_PENSIONSALDER_LABEL } from '../../../../domain/erhvervsevnetab/eetLabels';
import {
  buildMerErstatningForhoejelseOverskrift,
  SAMLET_MER_ERSTATNING_LABEL,
} from '../../../../domain/erhvervsevnetab/eetDifferencekravPresentation';
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
    {/* Overskriften bærer den kapitalisering, forhøjelsen regulerer (BB-193). */}
    <HoverRow underlined
      text={buildMerErstatningForhoejelseOverskrift({
        forhoejelsesdatoFormatted: formatIsoDateLong(event.forhoejelsesdato),
        gammelAlderLabel: event.gammelAlderLabel,
        nyAlderLabel: event.nyAlderLabel,
        kapitaliseringspctFormatted: formatKapPct(event.kapitaliseringspct),
        kapitaliseringsdatoFormatted: formatISOToDanish(event.kapitaliseringsdato),
      })}
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

    {/*
      Parentesen bærer SATSÅRET og ikke en dato: forhøjelsen sker altid lige før et årsskifte, og
      afgørelserne om den træffes i løbet af det følgende kalenderår, som satsen slås op i
      (`satsAar` = året 1 måned efter forhøjelsesdatoen). Formen er efterprøvet og fastholdt af
      udvikleren 2026-09-09 (BB-198) – naboboksens dato-form skal derfor ikke overføres hertil.
    */}
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

    {/*
      Faktoropslagets forudsætninger navngives som i naboboksen «Proformakapitalisering af rest-EET»
      (BB-194): alderen på forhøjelsesdatoen er den ENESTE nøgle ind i de to faktortabeller, og uden
      den kan hverken brugeren eller modparten slå 10,157 og 10,689 op og kontrollere fradraget – som
      ER hele mer-erstatningen. Folkepensionsalderen står i de to underoverskrifter nedenfor og
      gentages derfor ikke som egen række.
    */}
    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsfaktorer</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Alder ved forhøjelsen</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{`${event.alderAar} år, ${event.alderMaaneder} måneder`}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Faktor måneds-afhængig?</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatJaNej(event.faktorMaanedsAfhaengig)}</Typography>
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

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalværdi til hidtidig folkepensionsalder ({event.gammelAlderLabel})</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{event.gammel.kapitaliseringsbekendtgoerelseLabel}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsfaktor</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatFaktor(event.gammel.kapitaliseringsfaktor)}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} x ${formatFaktor(event.gammel.kapitaliseringsfaktor)}) =`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalværdi til forhøjet folkepensionsalder ({event.nyAlderLabel})</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{event.ny.kapitaliseringsbekendtgoerelseLabel}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsfaktor</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatFaktor(event.ny.kapitaliseringsfaktor)}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} x ${formatFaktor(event.ny.kapitaliseringsfaktor)}) =`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.ny.kapitalvaerdiOre), 2)}</Typography>
      </Box>
    </Box>

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
    <Typography className="section-header">{FORHOEJET_PENSIONSALDER_LABEL}</Typography>

    {computation.events.map((event, index) => (
      <Box key={`${event.rowId}-${event.forhoejelsesdato}`} sx={{ mt: index === 0 ? 0 : 2 }}>
        <EetMerErstatningEventRows event={event} koen={koen} />
      </Box>
    ))}

    {/*
      Summen læses fra beregningen selv frem for at genadderes her: `samletMerErstatningOre` ER det
      beløb, differencekravet fratrækker, og hvert event-beløb er allerede afrundet til hele kroner,
      så «vist = beregnet» holder. Samme række står i specifikationen og i dokumentets bilag (BB-201).
    */}
    {computation.events.length > 1 && (
      <Box className="row--label-right-hover" sx={{ mt: 2 }}>
        <Typography className="row--text">{SAMLET_MER_ERSTATNING_LABEL}</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text text-bold">
            {formatKr(toKroner(computation.samletMerErstatningOre))}
          </Typography>
        </Box>
      </Box>
    )}
  </ContentBox>
);
