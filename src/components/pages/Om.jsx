import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../common/ContentBox';
import { VERSION, BUILD_DATE } from '../../config/version';

// 🔥 IMPORT AF MUI IKONER TIL KONTAKT-SEKTIONEN
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LanguageIcon from '@mui/icons-material/Language';
import GitHubIcon from '@mui/icons-material/GitHub';

// Section Header-komponent
const SectionHeader = ({ children }) => (
  <Typography className="section-header" component="div">
    {children}
  </Typography>
);

// Label til datafelter
const FieldLabel = ({ children }) => (
  <Typography className="field-label">
    {children}
  </Typography>
);

// Række med label og værdi
const DataRow = ({ label, value }) => {
  if (!value) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}
    >
      <FieldLabel>{label}:</FieldLabel>
      <Typography className="field-label" sx={{ textAlign: 'right', marginLeft: '16px' }}>
        {value}
      </Typography>
    </Box>
  );
};

/**
 * Om-komponent
 */
const Om = React.memo(() => {
  const buildDate = new Date(BUILD_DATE);
  const formattertDato = buildDate.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Box>

      {/* Side-header */}
      <Typography variant="h4" className="page-title">
        Om MINEO
      </Typography>

      {/* ------------------------------------------------------ */}
      {/* Beskrivelse */}
      {/* ------------------------------------------------------ */}
      <ContentBox>
        <SectionHeader>Beskrivelse</SectionHeader>

        {/* Hovedintroduktion */}
        <Typography className="field-label" sx={{ marginBottom: '16px' }}>
          MINEO er et specialiseret regneprogram til advokater,
          sagsbehandlere og andre professionelle, der arbejder med
          erstatningsopgørelser.
        </Typography>

        {/* Licensforklaring */}
        <Typography className="field-label" sx={{ marginBottom: '16px' }}>
          Programmet er gratis at bruge og udgives under MIT-licensen,
          hvilket indebærer:
        </Typography>

        {/* Punktopstilling */}
        <Box sx={{ marginLeft: '10px', marginBottom: '24px' }}>

          <Box sx={{ display: 'grid', gridTemplateColumns: '30px 1fr', marginBottom: '8px' }}>
            <Typography className="field-label">1)</Typography>
            <Typography className="field-label">
              Du kan bruge programmet frit – også til kommercielle formål.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '30px 1fr', marginBottom: '8px' }}>
            <Typography className="field-label">2)</Typography>
            <Typography className="field-label">
              Kildekoden er frit tilgængelig og må ændres, forbedres og videreudvikles.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '30px 1fr' }}>
            <Typography className="field-label">3)</Typography>
            <Typography className="field-label">
              Programmet leveres “som det er” uden nogen form for garanti.
            </Typography>
          </Box>

        </Box>

        {/* Ansvarsfraskrivelse */}
        <Typography className="field-label">
          Programmet forudsætter kendskab til erstatningsberegning. Du er
          selv ansvarlig for, at de beregninger du laver med MINEO, er korrekte
          og i overensstemmelse med gældende retspraksis.
        </Typography>
      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Kontakt */}
      {/* ------------------------------------------------------ */}
      <ContentBox>
        <SectionHeader>Kontakt</SectionHeader>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Udvikler (ikke link) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PersonIcon fontSize="small" sx={{ flexShrink: 0 }} />
            <Typography className="field-label" sx={{ transform: 'translateY(-4px)' }}>
              Bjørn Elling
            </Typography>
          </Box>

          {/* Email (link) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <EmailIcon fontSize="small" sx={{ flexShrink: 0 }} />
            <Typography
              className="field-label"
              component="a"
              href="mailto:bj.elling@gmail.com"
              sx={{ textDecoration: 'none', color: 'inherit', transform: 'translateY(-4px)' }}
            >
              bj.elling@gmail.com
            </Typography>
          </Box>

          {/* Hjemmeside (link) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LanguageIcon fontSize="small" sx={{ flexShrink: 0 }} />
            <Typography
              className="field-label"
              component="a"
              href="https://mineo.dk"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textDecoration: 'none', color: 'inherit', transform: 'translateY(-4px)' }}
            >
              mineo.dk
            </Typography>
          </Box>

          {/* GitHub (link) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GitHubIcon fontSize="small" sx={{ flexShrink: 0 }} />
            <Typography
              className="field-label"
              component="a"
              href="https://github.com/BjornElling/Mineo"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textDecoration: 'none', color: 'inherit', transform: 'translateY(-4px)' }}
            >
              github.com/BjornElling/Mineo
            </Typography>
          </Box>

        </Box>
      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Versionsinformation */}
      {/* ------------------------------------------------------ */}
      <ContentBox>
        <SectionHeader>Teknisk</SectionHeader>

        <Typography className="field-label" sx={{ marginBottom: '16px' }}>
          MINEO er udviklet af en jurist, der ved mere om paragraffer end om koder. 
          Programmet er grundigt testet, men fejl kan forekomme. Sørg derfor altid 
          for at kontrollere beregningerne.
        </Typography>

        <Typography className="field-label">
          <strong>Aktuel version:</strong> {VERSION}
        </Typography>
      </ContentBox>

    </Box>
  );
});

Om.displayName = 'Om';

export default Om;
