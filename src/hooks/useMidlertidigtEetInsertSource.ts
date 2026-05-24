import React from 'react';
import {
  erhvervsevnetabSchema,
  faellesAarsloenSchema,
  stamdataSchema,
} from '../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import type { MidlertidigtEetInsertSource } from '../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import type { EetIssue } from '../domain/erhvervsevnetab/eetTypes';

const subscribeToFormPersistenceStore = formPersistenceStore.subscribe;

let cachedSnapshot:
  | {
      stamdata: ReturnType<typeof formPersistenceStore.getState>['sections']['stamdata'];
      erhvervsevnetab: ReturnType<typeof formPersistenceStore.getState>['sections']['erhvervsevnetab'];
      faellesAarsloen: ReturnType<typeof formPersistenceStore.getState>['sections']['faellesAarsloen'];
      value: MidlertidigtEetInsertSource;
    }
  | null = null;

const getMidlertidigtEetInsertSourceSnapshot = (): MidlertidigtEetInsertSource => {
  const sections = formPersistenceStore.getState().sections;
  const stamdata = sections.stamdata;
  const erhvervsevnetab = sections.erhvervsevnetab;
  const faellesAarsloen = sections.faellesAarsloen;

  if (
    cachedSnapshot &&
    cachedSnapshot.stamdata === stamdata &&
    cachedSnapshot.erhvervsevnetab === erhvervsevnetab &&
    cachedSnapshot.faellesAarsloen === faellesAarsloen
  ) {
    return cachedSnapshot.value;
  }

  const parsedErhvervsevnetab = erhvervsevnetabSchema.safeParse(erhvervsevnetab);
  const parsedFaellesAarsloen = faellesAarsloenSchema.safeParse(faellesAarsloen);
  const parsedStamdata = stamdataSchema.safeParse(stamdata);
  const sourceIssues: EetIssue[] = [];
  if (!parsedErhvervsevnetab.success) {
    sourceIssues.push({
      id: 'midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: 'Erhvervsevnetab-data kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
    });
  }
  if (!parsedFaellesAarsloen.success) {
    sourceIssues.push({
      id: 'midlertidigt-eet-faelles-aarsloen-schema-invalid',
      severity: 'error',
      message: 'Fælles årsløn-data kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
    });
  }
  if (!parsedStamdata.success) {
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-schema-invalid',
      severity: 'error',
      message: 'Stamdata kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
    });
  }

  const value: MidlertidigtEetInsertSource = {
    // Midlertidigt EET import er read-only og bygger på samme committed, schema-sikrede
    // tværsektion-data som EET-siden. Snapshot'et caches på sektionsreferencer, så
    // urelaterede store-opdateringer ikke udløser nye safeParse-kørsler eller rerenders.
    eetValues: {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      ...(parsedErhvervsevnetab.success ? parsedErhvervsevnetab.data : ERHVERVSEVNETAB_INITIAL_VALUES),
      ...FAELLES_AARSLOEN_INITIAL_VALUES,
      ...(parsedFaellesAarsloen.success ? parsedFaellesAarsloen.data : FAELLES_AARSLOEN_INITIAL_VALUES),
      skadelidteFodselsdato: parsedStamdata.success ? parsedStamdata.data.skadelidteFodselsdato : undefined,
    },
    skadedato: parsedStamdata.success ? parsedStamdata.data.skadedato : undefined,
    ...(sourceIssues.length > 0 ? { issues: sourceIssues } : {}),
  };

  cachedSnapshot = {
    stamdata,
    erhvervsevnetab,
    faellesAarsloen,
    value,
  };

  return value;
};

export const resetMidlertidigtEetInsertSourceCacheForTesting = (): void => {
  cachedSnapshot = null;
};

export const useMidlertidigtEetInsertSource = (): MidlertidigtEetInsertSource => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    getMidlertidigtEetInsertSourceSnapshot,
    getMidlertidigtEetInsertSourceSnapshot
  );
};
