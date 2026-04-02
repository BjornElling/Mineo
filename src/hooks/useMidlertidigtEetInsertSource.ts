import React from 'react';
import {
  erhvervsevnetabSchema,
  faellesAarsloenSchema,
  faellesPersondataSchema,
  stamdataSchema,
  type ErhvervsevnetabComposedValues,
  type StamdataValues,
} from '../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { FAELLES_PERSONDATA_INITIAL_VALUES } from '../domain/faellesPersondata/faellesPersondataInitialValues';
import { formPersistenceStore } from '../stores/formPersistenceStore';

type MidlertidigtEetInsertSource = Readonly<{
  eetValues: ErhvervsevnetabComposedValues;
  skadesdato: StamdataValues['skadesdato'];
}>;

const subscribeToFormPersistenceStore = formPersistenceStore.subscribe;

let cachedSnapshot:
  | {
      stamdata: ReturnType<typeof formPersistenceStore.getState>['sections']['stamdata'];
      erhvervsevnetab: ReturnType<typeof formPersistenceStore.getState>['sections']['erhvervsevnetab'];
      faellesAarsloen: ReturnType<typeof formPersistenceStore.getState>['sections']['faellesAarsloen'];
      faellesPersondata: ReturnType<typeof formPersistenceStore.getState>['sections']['faellesPersondata'];
      value: MidlertidigtEetInsertSource;
    }
  | null = null;

const getMidlertidigtEetInsertSourceSnapshot = (): MidlertidigtEetInsertSource => {
  const sections = formPersistenceStore.getState().sections;
  const stamdata = sections.stamdata;
  const erhvervsevnetab = sections.erhvervsevnetab;
  const faellesAarsloen = sections.faellesAarsloen;
  const faellesPersondata = sections.faellesPersondata;

  if (
    cachedSnapshot &&
    cachedSnapshot.stamdata === stamdata &&
    cachedSnapshot.erhvervsevnetab === erhvervsevnetab &&
    cachedSnapshot.faellesAarsloen === faellesAarsloen &&
    cachedSnapshot.faellesPersondata === faellesPersondata
  ) {
    return cachedSnapshot.value;
  }

  const parsedErhvervsevnetab = erhvervsevnetabSchema.safeParse(erhvervsevnetab);
  const parsedFaellesAarsloen = faellesAarsloenSchema.safeParse(faellesAarsloen);
  const parsedFaellesPersondata = faellesPersondataSchema.safeParse(faellesPersondata);
  const parsedStamdata = stamdataSchema.safeParse(stamdata);

  const value: MidlertidigtEetInsertSource = {
    // Midlertidigt EET import er read-only og bygger på samme committed, schema-sikrede
    // tværsektion-data som EET-siden. Snapshot'et caches på sektionsreferencer, så
    // urelaterede store-opdateringer ikke udløser nye safeParse-kørsler eller rerenders.
    eetValues: {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      ...(parsedErhvervsevnetab.success ? parsedErhvervsevnetab.data : {}),
      ...FAELLES_AARSLOEN_INITIAL_VALUES,
      ...(parsedFaellesAarsloen.success ? parsedFaellesAarsloen.data : {}),
      ...FAELLES_PERSONDATA_INITIAL_VALUES,
      ...(parsedFaellesPersondata.success ? parsedFaellesPersondata.data : {}),
    },
    skadesdato: parsedStamdata.success ? parsedStamdata.data.skadesdato : undefined,
  };

  cachedSnapshot = {
    stamdata,
    erhvervsevnetab,
    faellesAarsloen,
    faellesPersondata,
    value,
  };

  return value;
};

export const useMidlertidigtEetInsertSource = (): MidlertidigtEetInsertSource => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    getMidlertidigtEetInsertSourceSnapshot,
    getMidlertidigtEetInsertSourceSnapshot
  );
};
