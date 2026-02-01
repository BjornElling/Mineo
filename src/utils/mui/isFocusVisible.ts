// src/utils/mui/isFocusVisible.ts
// Local override to silence MUI's :focus-visible support warning without changing behavior.

const isFocusVisible = (element: Element): boolean => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

export default isFocusVisible;
