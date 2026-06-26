import React from 'react';
import { Box, Typography } from '@mui/material';
import { VERSION } from '../../config/buildInfo';
import { requestPwaInstall } from '../../utils/pwaInstallPrompt';
import ContentBox from '../layout/ContentBox';
import SiblingSitesFooter from '../layout/SiblingSitesFooter';
import LicenseModal from '../ui/LicenseModal';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../types/fieldEvents';
import { useAppSettings } from '../../contexts/useAppSettings';

import GitHubIcon from '@mui/icons-material/GitHub';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';

/**
 * Mineo-komponent
 */
const Mineo = React.memo(() => {
  const { settings, updateSettings } = useAppSettings();
  const [licenseOpen, setLicenseOpen] = React.useState(false);

  const handleInstallClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void requestPwaInstall();
  }, []);

  const handleLicenseClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLicenseOpen(true);
  }, []);

  const handleLicenseClose = React.useCallback(() => {
    setLicenseOpen(false);
  }, []);

  return (
    <Box className="mineo-page">
      {/* Side-header */}
      <Typography className="page-title">Mineo</Typography>

      {/* ------------------------------------------------------ */}
      {/* Beskrivelse */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Programmet</Typography>

        <Typography className="row--text">
          Mineo er et specialiseret regneprogram, der er udviklet til brug for advokater 
          og arbejdsskadekonsulenter, som arbejder i eller for fagbevægelsen, og som beskæftiger
          sig med arbejdsskadesager.
        </Typography>

        <Typography className="row--text">
          Programmet forudsætter, at du har et godt kendskab til emnet. Arbejdsskadesager
          er komplekse og beror på en lang række matematiske og juridiske forudsætninger,
          som ikke altid er indlysende.
        </Typography>

        <Typography className="row--text">
          Selvom der er indlagt en vis fejlkontrol i programmet, kan det ikke forhindre dig
          i at lægge forkerte forudsætninger til grund. Sørg for at vide, hvad du laver, og
          kontrollér altid dine beregninger grundigt.
        </Typography>

      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Teknisk */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Teknisk</Typography>

        <Typography className="row--text">
          For at kunne dobbeltklikke på lokale .eo-filer og åbne dem direkte i Mineo, skal du installere et
          hjælpeprogram. Det kan hentes via linket nedenfor eller ved at klikke på installationsikonet yderst
          til højre i browserens adresselinje (Google Chrome {' '}
          <BrowserUpdatedIcon fontSize="small" sx={{ verticalAlign: 'text-bottom' }} />
          {' '} / Microsoft Edge {' '}
          <Box
            component="svg"
            sx={{ width: 20, height: 20, verticalAlign: 'text-bottom' }}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M15 3C15 2.72386 14.7761 2.5 14.5 2.5C14.2239 2.5 14 2.72386 14 3V5H12C11.7239 5 11.5 5.22386 11.5 5.5C11.5 5.77614 11.7239 6 12 6H14V8C14 8.27614 14.2239 8.5 14.5 8.5C14.7761 8.5 15 8.27614 15 8V6H17C17.2761 6 17.5 5.77614 17.5 5.5C17.5 5.22386 17.2761 5 17 5L15 5V3ZM4.5 17C3.67157 17 3 16.3284 3 15.5V4.5C3 3.67157 3.67157 3 4.5 3H9C9.82843 3 10.5 3.67157 10.5 4.5V9.5H15.5C16.3284 9.5 17 10.1716 17 11V15.5C17 16.3284 16.3284 17 15.5 17H4.5ZM10.5 10.5V16H15.5C15.7761 16 16 15.7761 16 15.5V11C16 10.7239 15.7761 10.5 15.5 10.5H10.5ZM9.5 16V10.5H4V15.5C4 15.7589 4.19675 15.9718 4.44888 15.9974C4.46569 15.9991 4.48274 16 4.5 16H9.5ZM9.5 4.5C9.5 4.22386 9.27614 4 9 4H4.5C4.22386 4 4 4.22386 4 4.5V9.5H9.5V4.5Z" fill="currentColor"/>
          </Box>).
        </Typography>

        <Box
          component="ul"
          className="list-container"
          sx={{ marginTop: 0, marginBottom: 0, paddingLeft: '20px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}
        >
          <Box component="li" sx={{ marginBottom: 0 }}>
            <Box
              component="a"
              href="#installer"
              onClick={handleInstallClick}
              className="icon-text-link"
            >
              Download hjælpeprogram
            </Box>
          </Box>
        </Box>

        <Typography className="row--text">
          Bemærk, at hjælpeprogrammet kun kan installeres, hvis du benytter Google Chrome eller Microsoft Edge.
        </Typography>

        {/* Bevidst UX-beslutning: denne toggle er placeret på Mineo-siden — ikke på
            Indstillinger-siden. Mineo-siden er den første side nye brugere møder, og
            det giver kontekst til valget: brugeren ser programbeskrivelsen og kan
            derfra beslutte, om Stamdata skal være standardstart. */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Gør stamdata-siden til startside fremover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={settings.defaultStartsideErStamdata}
              onCommit={(event: CommitEvent<boolean>) => updateSettings({ defaultStartsideErStamdata: event.target.value })}
            />
          </Box>
        </Box>

      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Persondata */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Persondata</Typography>

        <Typography className="row--text">
          Mineo er udviklet som en client-side applikation. Det indebærer, at al
          databehandling finder sted i browseren på brugerens egen computer.
        </Typography>

        <Typography className="row--text">
          Programmet kommunikerer ikke med nogen server under brug, og der indsamles,
          gemmes eller transmitteres ingen data — hverken persondata, brugsstatistik
          eller anden information.
        </Typography>

        <Typography className="row--text">
          Mens programmet kører, bliver de indtastede oplysninger midlertidigt gemt
          i browserens hukommelse, som nulstilles, når browseren lukkes.
        </Typography>
      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Licens */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Licensvilkår</Typography>

        {/* Licensforklaring */}
        <Typography className="row--text">
          Programmet er gratis at bruge og udgives under{' '}
          <Box
            component="a"
            href="#"
            onClick={handleLicenseClick}
            className="icon-text-link"
            sx={{ display: 'inline' }}
          >
            MIT-licensen
          </Box>
          , hvilket indebærer:
        </Typography>

        {/* Punktopstilling */}
        <Box className="list-container">

          <Box className="numbered-list-item">
            <Typography className="row--text">1)</Typography>
            <Typography className="row--text">
              Du kan bruge programmet frit — også til kommercielle formål.
            </Typography>
          </Box>

          <Box className="numbered-list-item">
            <Typography className="row--text">2)</Typography>
            <Typography className="row--text">
              Kildekoden er frit tilgængelig og må ændres, forbedres og videreudvikles.
            </Typography>
          </Box>

          <Box className="numbered-list-item" sx={{ marginBottom: 0 }}>
            <Typography className="row--text">3)</Typography>
            <Typography className="row--text">
              Programmet leveres &quot;som det er&quot; uden nogen form for garanti.
            </Typography>
          </Box>

        </Box>

        <Typography className="row--text">
          Ved brug af programmet skal du være opmærksom på, at det aktuelt er i en åben
          testudgave. Programmet er grundigt testet, men fejl kan forekomme. Sørg derfor
          altid for at kontrollere dine beregninger.
        </Typography>

      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* License Modal */}
      <LicenseModal
        open={licenseOpen}
        onClose={handleLicenseClose}
      />

      {/* ------------------------------------------------------ */}
      {/* Status */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Status</Typography>

        <Typography className="row--text">
          Programmet er fortsat under udvikling og vil løbende få opdateringer og nye funktioner.
        </Typography>

        <Typography className="row--text">
          Udviklingen sker i fritiden og drives udelukkende af personlig interesse. Alle konstaterede fejl rettes straks,
          men nye funktionaliteter udvikles og implementeres kun, når tid og overskud tillader det.
        </Typography>

        <Typography className="row--text">
          Aktuel version: {VERSION}
        </Typography>

        <Box className="icon-text-row" sx={{ padding: '0 12px' }}>
          <GitHubIcon fontSize="small" sx={{ flexShrink: 0 }} />
          <Typography
            className="row--text icon-text-link"
            component="a"
            href="https://github.com/BjornElling/Mineo"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/BjornElling/Mineo
          </Typography>
        </Box>
      </ContentBox>

      <SiblingSitesFooter currentSite="mineo" />

    </Box>
  );
});

Mineo.displayName = 'Mineo';

export default Mineo;
