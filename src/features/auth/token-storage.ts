// El refresh token se persiste para sobrevivir un reload. El access token NUNCA se persiste:
// vive en memoria (ver auth-context) para mitigar XSS.
const KEY = "lcagro.refresh";

export const tokenStorage = {
  getRefresh: () => localStorage.getItem(KEY),
  setRefresh: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};
