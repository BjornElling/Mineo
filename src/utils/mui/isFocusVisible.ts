// src/utils/mui/isFocusVisible.ts
// Lokal override der dæmper MUI's :focus-visible-support-advarsel uden at ændre adfærd.

const isFocusVisible = (element: Element): boolean => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

export default isFocusVisible;
