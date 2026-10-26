// Sign-in and first-login password messages (spread into `en`, ADR 0005).
const enAuth = {
  "auth.login.title": "Sign in",
  "auth.login.intro": "Sign in with the email and password your owner or admin gave you.",
  "auth.email": "Email",
  "auth.email.invalid": "Enter a valid email address.",
  "auth.password": "Password",
  "auth.password.required": "Enter your password.",
  "auth.login.submit": "Sign in",
  "auth.busy": "Please wait…",
  "auth.error.invalid": "Email or password is incorrect.",
  "auth.error.rateLimited": "Too many attempts. Wait a minute and try again.",
  "auth.set.title": "Choose your password",
  "auth.set.intro": "You signed in with a temporary password. Choose your own to continue.",
  "auth.set.current": "Temporary password",
  "auth.set.new": "New password",
  "auth.set.hint": "{min} to {max} characters. Common passwords are refused.",
  "auth.set.confirm": "Repeat the new password",
  "auth.set.mismatch": "The passwords do not match.",
  "auth.set.submit": "Save password",
  "auth.set.currentWrong": "The temporary password is incorrect.",
  "auth.set.PASSWORD_TOO_SHORT": "Use at least {min} characters.",
  "auth.set.PASSWORD_TOO_LONG": "Use at most {max} characters.",
  "auth.set.PASSWORD_TOO_COMMON": "This password is too common. Choose another one.",
  "auth.set.PASSWORD_UNCHANGED": "Choose a password different from the temporary one.",
} as const;

export default enAuth;
