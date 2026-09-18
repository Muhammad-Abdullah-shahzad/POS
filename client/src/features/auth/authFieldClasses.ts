import classes from './AuthShell.module.css';

/** The outlined field look shared by the sign in and sign up screens. */
export const authFieldClassNames = {
  input: classes.input,
  innerInput: classes.innerInput,
  section: classes.section,
};

/** Brand colour for the primary action. Mirrors `--auth-brand` in the CSS. */
export const AUTH_BRAND = '#2350c9';

/** Shared look for cards that pop up over these screens. */
export const authDialogProps = {
  radius: 2,
  padding: 'lg',
  centered: true,
  overlayProps: { backgroundOpacity: 0.35, blur: 2 },
} as const;

export { classes as authClasses };
