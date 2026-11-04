import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
import {
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import type { EetAfgoerelseDatoer } from '../../erhvervsevnetab/eetImportPort';
import { EET_AFGOERELSE_DATO_UOVERENSSTEMMELSE_IDS } from '../../erhvervsevnetab/eetIssueNavigation';

// Datoerne for den midlertidige og den endelige EET-afgørelse står to steder, mens midlertidigt EET hentes fra
// Erhvervsevnetab-siden: på EO oplysninger, hvor de afskærer TAF (endelig altid, midlertidig ved skader før
// 16-06-2011) og står i dokumentets tekst, og i Erhvervsevnetab-sidens afgørelsestabel, hvor de bestemmer, hvornår
// det hentede fradrag løber. Intet sammenholdt dem, så dokumentet kunne nævne én dato, mens fradraget byggede på en
// anden. Advarslen er gul og ændrer intet i beregningen (udviklerafgørelse 2026-11-04).
//
// Den gælder kun, når Erhvervsevnetab-siden HAR afgørelser af den pågældende slags: uden en midlertidig afgørelse
// siger «ingen ydelser»-advarslen det allerede, og en endelig afgørelse behøver ikke stå på Erhvervsevnetab-siden,
// for at midlertidigt EET kan hentes.

type Slags = keyof typeof EET_AFGOERELSE_DATO_UOVERENSSTEMMELSE_IDS;

const SLAGS: Readonly<Record<Slags, Readonly<{
  eetTyper: readonly EetAfgoerelseDatoer['afgoerelseType'][];
  /** «den midlertidige EET-afgørelse» / «nogen midlertidig afgørelse». */
  bestemt: string;
  ubestemt: string;
  afgoerelsesdatoField: FieldRef<ISODateString | undefined>;
  virkningsdatoField: FieldRef<ISODateString | undefined>;
}>>> = {
  // En delvist endelig afgørelse hentes som løbende ydelse ligesom en midlertidig og tæller derfor med her.
  midlertidig: {
    eetTyper: ['Midlertidig', 'Delvist endelig'],
    bestemt: 'midlertidige',
    ubestemt: 'midlertidig',
    afgoerelsesdatoField: eoMidlertidigEETAfgoerelseDatoField.bind(),
    virkningsdatoField: eoMidlertidigEETVirkningsdatoField.bind(),
  },
  endelig: {
    eetTyper: ['Endelig'],
    bestemt: 'endelige',
    ubestemt: 'endelig',
    afgoerelsesdatoField: eoEndeligEETAfgoerelseDatoField.bind(),
    virkningsdatoField: eoEndeligEETVirkningsdatoField.bind(),
  },
};

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

const resolveUoverensstemmelse = (
  slags: Slags,
  eo: Readonly<{ afgjort: boolean; afgoerelsesdato: ISODateString | undefined; virkningsdato: ISODateString | undefined }>,
  eetAfgoerelser: readonly EetAfgoerelseDatoer[]
): EetIssue | undefined => {
  if (!eo.afgjort) return undefined;
  const spec = SLAGS[slags];
  const kandidater = eetAfgoerelser.filter((afgoerelse) => spec.eetTyper.includes(afgoerelse.afgoerelseType));
  if (kandidater.length === 0) return undefined;

  // Hver udfyldt dato på EO oplysninger skal genfindes på SAMME afgørelse på Erhvervsevnetab-siden.
  const virkningMatch = eo.virkningsdato === undefined
    ? kandidater
    : kandidater.filter((afgoerelse) => afgoerelse.virkningsdato === eo.virkningsdato);
  const afvigelse = virkningMatch.length === 0 && eo.virkningsdato !== undefined
    ? { label: 'Virkningsdatoen', dato: eo.virkningsdato, field: spec.virkningsdatoField }
    : eo.afgoerelsesdato !== undefined
      && !virkningMatch.some((afgoerelse) => afgoerelse.afgoerelsesdato === eo.afgoerelsesdato)
      ? { label: 'Afgørelsesdatoen', dato: eo.afgoerelsesdato, field: spec.afgoerelsesdatoField }
      : undefined;
  if (afvigelse === undefined) return undefined;

  return Object.freeze({
    id: EET_AFGOERELSE_DATO_UOVERENSSTEMMELSE_IDS[slags],
    severity: 'warning' as const,
    message: `${afvigelse.label} for den ${spec.bestemt} EET-afgørelse på EO oplysninger (${danish(afvigelse.dato)}) `
      + `svarer ikke til nogen ${spec.ubestemt} afgørelse på Erhvervsevnetab-siden`,
    focusTarget: { kind: 'fieldAddress' as const, address: afvigelse.field.address },
  });
};

/** De gule linjer om datoer på EO oplysninger, der ikke genfindes på Erhvervsevnetab-siden – kun mens togglen er «Ja». */
export const resolveEetAfgoerelseDatoAdvarsler = (
  values: Pick<
    ErstatningsopgoerelseValues,
    | 'midlertidigtEetFraEetSiden'
    | 'midlertidigtEETAfgorelse' | 'midlertidigEETAfgoerelseDato' | 'midlertidigEETVirkningsdato'
    | 'endeligtEETAfgorelse' | 'endeligEETAfgoerelseDato' | 'endeligEETVirkningsdato'
  >,
  eetAfgoerelser: readonly EetAfgoerelseDatoer[]
): readonly EetIssue[] => {
  if (values.midlertidigtEetFraEetSiden !== 'Ja') return [];
  const issues = [
    resolveUoverensstemmelse('midlertidig', {
      afgjort: values.midlertidigtEETAfgorelse === 'Ja',
      afgoerelsesdato: values.midlertidigEETAfgoerelseDato,
      virkningsdato: values.midlertidigEETVirkningsdato,
    }, eetAfgoerelser),
    resolveUoverensstemmelse('endelig', {
      afgjort: values.endeligtEETAfgorelse === 'Ja',
      afgoerelsesdato: values.endeligEETAfgoerelseDato,
      virkningsdato: values.endeligEETVirkningsdato,
    }, eetAfgoerelser),
  ];
  return Object.freeze(issues.filter((issue): issue is EetIssue => issue !== undefined));
};
