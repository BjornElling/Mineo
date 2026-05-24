import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AppSettings } from '../../../settings/appSettingsSchema';

type EoCaseReguleringSettings = Pick<
  ErstatningsopgoerelseValues,
  'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden' | 'allowReguleringMedUdloebMedMaaneder'
>;

export const resolveEoCaseReguleringSettings = (
  settings: AppSettings,
  eoValues: Partial<EoCaseReguleringSettings> | null | undefined
): AppSettings => ({
  ...settings,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden:
    eoValues?.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden
    ?? settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
  allowReguleringMedUdloebMedMaaneder:
    eoValues?.allowReguleringMedUdloebMedMaaneder
    ?? settings.allowReguleringMedUdloebMedMaaneder,
});
