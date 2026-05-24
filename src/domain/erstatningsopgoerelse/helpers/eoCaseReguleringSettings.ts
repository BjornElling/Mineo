import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AppSettings } from '../../../settings/appSettingsSchema';

export type EoCaseReguleringSettings = Pick<
  ErstatningsopgoerelseValues,
  'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden' | 'allowReguleringMedUdloebMedMaaneder'
>;

export const resolveEoCaseReguleringSettings = (
  settings: AppSettings,
  eoValues: Partial<EoCaseReguleringSettings> | null | undefined
): AppSettings & EoCaseReguleringSettings => ({
  ...settings,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden:
    eoValues?.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden ?? false,
  allowReguleringMedUdloebMedMaaneder:
    eoValues?.allowReguleringMedUdloebMedMaaneder ?? 6,
});
