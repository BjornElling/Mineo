import React from 'react';
import { Box, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import StandardLooseTable from '../../tables/StandardLooseTable';
import { isoToDanish } from '../../../types/branded';
import { formatAsAmount, formatAsAmountTrimmed, formatCountWithUnit, formatKr } from '../../../utils/formatUtils';
import { useForsoergertabVm } from './forsoergertabContext';

/**
 * ASL-ydelserne: de løbende ydelser pr. periode og proformakapitaliseringen af resten.
 *
 * To grene bærer et bevidst NUL frem for at skjule rækken: uden løbende ydelser vises "Ingen" plus en total på
 * 0 kr., og har efterladte nået folkepensionsalderen, er værdien af de løbende ydelser derefter 0 kr. Begge er
 * beregningsresultater brugeren skal kunne se, ikke tomme felter.
 */
const ForsoergertabAslSection = React.memo(() => {
  const { canShowAsl, aslComputation } = useForsoergertabVm();
  if (!canShowAsl || !aslComputation) return null;

  return (
    <ContentBox className="content-box" data-section-id="forsoergertab-asl">
      <Typography className="section-header">ASL-ydelser</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Årsløn efter ASL</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(aslComputation.aslAarsloen)}</Typography>
        </Box>
      </Box>

      <Typography className="row--subheading">Løbende ydelse</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Ydelsen udgør 30 % af afdødes årsløn, jf. ASL § 30, opreguleret til udbetalingsåret.</Typography>
        <Box className="row--label-right-hover__content" />
      </Box>

      {aslComputation.lobendeYdelser.length > 0 ? (
        <>
          <StandardLooseTable
            sx={{
              mt: 1,
              mb: 1,
              tableLayout: 'fixed',
              '& .MuiTableCell-root': { verticalAlign: 'middle' },
              '& thead th': { textAlign: 'right' },
              '& thead th:first-of-type': { textAlign: 'left' },
              '& tbody td': { textAlign: 'right' },
              '& tbody td:first-of-type': { textAlign: 'left' },
            }}
          >
            <colgroup>
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '120px' }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell>Fra-dato</TableCell>
                <TableCell>Til-dato</TableCell>
                <TableCell>Måneder</TableCell>
                <TableCell>Månedlig ydelse</TableCell>
                <TableCell>Ydelser i perioden</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aslComputation.lobendeYdelser.map((raekke) => (
                <TableRow key={raekke.fraDato}>
                  <TableCell>{isoToDanish(raekke.fraDato)}</TableCell>
                  <TableCell>{isoToDanish(raekke.tilDato)}</TableCell>
                  <TableCell>{formatAsAmount(raekke.maaneder, 4)}</TableCell>
                  <TableCell>{formatKr(raekke.maanedligYdelse, 0)}</TableCell>
                  <TableCell>{formatKr(raekke.ydelseIAlt, 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </StandardLooseTable>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Løbende ydelser i alt</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(aslComputation.aslLobendeYdelserTotal)}</Typography>
            </Box>
          </Box>
        </>
      ) : (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Løbende ydelser</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">Ingen</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Løbende ydelser i alt</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(0)}</Typography>
            </Box>
          </Box>
        </>
      )}

      <Typography className="row--subheading">Beregnet kapitalbeløb</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Der foretages proformakapitalisering af resterende løbende ydelser</Typography>
        <Box className="row--label-right-hover__content" />
      </Box>

      {aslComputation.resterendeMaanederTotal === 0 ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Resterende periode</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">Ingen</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Kapitalbeløb</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(0)}</Typography>
            </Box>
          </Box>
        </>
      ) : (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {/* Ét gangetegn i hele linjen (BB-132); den brugte før både `x` og `×` i samme sætning. */}
              {`Årlig ydelse i ${aslComputation.beregningsaar}-værdi: 30 % x ${formatKr(aslComputation.benyttetAarsloen)} x (${formatAsAmountTrimmed(aslComputation.aarsloenMaxBeregningsaar, 0)} / ${formatAsAmountTrimmed(aslComputation.aarsloenMaxSkadesaar, 0)}) =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(aslComputation.opreguleretAarligYdelse, 2)}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Resterende periode</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">
                {`${formatCountWithUnit(aslComputation.resterendeAar, 'år', 'år')} og ${formatCountWithUnit(aslComputation.resterendeMaaneder, 'måned', 'måneder')}`}
              </Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Efterladtes alder på beregningsdatoen</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatCountWithUnit(aslComputation.alderHeleAar, 'år', 'år')}</Typography>
            </Box>
          </Box>

          {aslComputation.harNaaetFolkepensionsalder ? (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Folkepensionsalder</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{aslComputation.folkepensionsalderLabel}</Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Værdien af løbende ydelser efter folkepensionsalderen udgør</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text text-bold">{formatKr(0)}</Typography>
                </Box>
              </Box>
            </>
          ) : (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">
                    {aslComputation.kapitaliseringsTabel
                      ? `Vejl. ${aslComputation.kapitaliseringsbekendtgoerelseId}, tabel ${aslComputation.kapitaliseringsTabel}`
                      : `Vejl. ${aslComputation.kapitaliseringsbekendtgoerelseId}`}
                  </Typography>
                </Box>
              </Box>

              {aslComputation.kapitaliseringsTabelKoensopdelt && aslComputation.koen && (
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Køn</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{aslComputation.koen}</Typography>
                  </Box>
                </Box>
              )}

              {aslComputation.kapitalfaktor !== null && (
                <>
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Kapitalfaktor</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{formatAsAmountTrimmed(aslComputation.kapitalfaktor, 3)}</Typography>
                    </Box>
                  </Box>

                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {/* Afsluttende `=` som alle andre formellinjer med et resultat i højre kolonne (BB-132). */}
                      {`Beregnet kapitalbeløb (${formatKr(aslComputation.opreguleretAarligYdelse, 2)} x ${formatAsAmountTrimmed(aslComputation.kapitalfaktor, 3)}) =`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text text-bold">{formatKr(aslComputation.kapitalbelob)}</Typography>
                    </Box>
                  </Box>
                </>
              )}
            </>
          )}
        </>
      )}
    </ContentBox>
  );
});

ForsoergertabAslSection.displayName = 'ForsoergertabAslSection';

export default ForsoergertabAslSection;
