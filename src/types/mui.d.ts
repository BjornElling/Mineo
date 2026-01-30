import type { CSSProperties } from 'react'
import type {} from '@mui/material/Typography'
import type {} from '@mui/material/styles'

declare module '@mui/material/styles' {
  interface TypographyVariants {
    pageTitle: CSSProperties
    sectionTitle: CSSProperties
    subsectionTitle: CSSProperties
    text: CSSProperties
    textTable: CSSProperties
  }

  interface TypographyVariantsOptions {
    pageTitle?: CSSProperties
    sectionTitle?: CSSProperties
    subsectionTitle?: CSSProperties
    text?: CSSProperties
    textTable?: CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true
    sectionTitle: true
    subsectionTitle: true
    text: true
    textTable: true
  }
}

