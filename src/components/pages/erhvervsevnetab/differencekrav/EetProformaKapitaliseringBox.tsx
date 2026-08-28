import { Box, Typography } from '@mui/material';
import ContentBox from '../../../layout/ContentBox';
import type { ErhvervsevnetabValues } from '../../../../schemas/formSchemas';
import type { EetDifferencekravProformaKapitalisering } from '../../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { formatIsoDateLong, formatISOToDanish } from '../../../../utils/dateFormatting';
import { formatAsAmountTrimmed, formatKr } from '../../../../utils/formatUtils';
import { toKroner } from '../../../../domain/money/money';
import {
  formatFaktor,
  formatJaNej,
  formatPct as formatKapPct,
} from '../../../../domain/erhvervsevnetab/eetFormatUtils';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from '../../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';

/**
 * Proformakapitaliseringen af rest-EET. Ren visning: den tager sin færdigberegnede
 * projektion som props og har ingen VM-, felt- eller dokumentkobling. Lå tidligere
 * fil-lokalt i `EetDifferencekravTab.tsx`.
 */
type ProformaBoxProps = Readonly<{
  pk: EetDifferencekravProformaKapitalisering;
  koen: ErhvervsevnetabValues['koen'];
}>;

export const EetProformaKapitaliseringBox = ({ pk, koen }: ProformaBoxProps) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Proformakapitalisering af rest-EET</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsdato</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatISOToDanish(pk.kapitaliseringsdato)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading">Grundydelse og regulering</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Proformakapitalisering</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKapPct(pk.loebendeEetPct)}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringGrundydelseLabel(
          formatKapPct(pk.loebendeEetPct),
          pk.amBidragPct
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">
          {buildKapitaliseringGrundydelseExpression(
            formatKr(toKroner(pk.grundloenOre), 0),
            formatKapPct(pk.loebendeEetPct),
            pk.erstatningsniveauPct,
            pk.amBidragPct,
            formatKr(toKroner(pk.grundydelseOre), 2)
          )}
        </Typography>
      </Box>
    </Box>

    {pk.grundydelse2024Ore !== null && pk.opreguleringTil2024PctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildKapitaliseringOpreguleringTil2024Expression(
            formatKr(toKroner(pk.grundydelseOre), 2),
            formatAsAmountTrimmed(1 + pk.opreguleringTil2024PctRounded4 / 100, 4),
            `${formatAsAmountTrimmed(pk.opreguleringTil2024PctRounded4, 4)} %`
          )}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(pk.grundydelse2024Ore), 2)}</Typography>
        </Box>
      </Box>
    )}

    {pk.aarsydelseReguleringsPctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {`Reguleringsprocent (${formatIsoDateLong(pk.kapitaliseringsdato)})`}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{`${formatAsAmountTrimmed(pk.aarsydelseReguleringsPctRounded4, 4)} %`}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringAarsydelseExpression(
          formatKr(toKroner(pk.aarsydelseGrundlagOre), 2),
          pk.aarsydelseReguleringsPctRounded4 === null
            ? null
            : `${formatAsAmountTrimmed(100 + pk.aarsydelseReguleringsPctRounded4, 4)} %`
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(pk.aarsydelseOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsbekendtgørelse og tabel</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{pk.kapitaliseringsbekendtgoerelseLabel}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Alder ved proformakapitalisering</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{`${pk.alderAar} år, ${pk.alderMaaneder} måneder`}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Folkepensionsalder</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{pk.folkepensionsalderLabel}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseret pga. &lt; 2 år til folkepension?</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatJaNej(pk.kapitaliseretPgaUnderToAarTilFp)}</Typography>
      </Box>
    </Box>

    {pk.kapitaliseretPgaUnderToAarTilFp && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">Særfaktor (&lt; 2 år til folkepension)</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{pk.saerfaktor === null ? '-' : formatFaktor(pk.saerfaktor)}</Typography>
        </Box>
      </Box>
    )}

    {!pk.kapitaliseretPgaUnderToAarTilFp && (
      <>
        <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsfaktor</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Faktor måneds-afhængig?</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{formatJaNej(pk.faktorMaanedsAfhaengig)}</Typography>
          </Box>
        </Box>

        {pk.koenOpdelt && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              {/* koenOpdelt forudsætter at køn er sat; ?? '' undgår at vise teksten "undefined" hvis typen er løs. */}
              <Typography className="row--text">{koen ?? ''}</Typography>
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Kapitaliseringsfaktor</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{formatFaktor(pk.kapitaliseringsfaktor)}</Typography>
          </Box>
        </Box>
      </>
    )}

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalbeløb</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Beregnet proformakapitalisering (${formatKr(toKroner(pk.aarsydelseOre), 2)} x ${formatFaktor(pk.kapitaliseringsfaktor)}) =`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text text-bold">{formatKr(toKroner(pk.proformaBeloebOre))}</Typography>
      </Box>
    </Box>
  </ContentBox>
);
