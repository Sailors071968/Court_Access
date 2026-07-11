// Build identification — populated at build time via Vite `define`
// (see vite.config.ts). Lets the running application report exactly which
// commit/branch/build is deployed (Settings → About).

export interface BuildInfo {
  commit: string;
  branch: string;
  builtAt: string;
  version: string;
  mode: string;
}

declare const __APP_BUILD__: BuildInfo | undefined;

export const buildInfo: BuildInfo =
  typeof __APP_BUILD__ !== 'undefined'
    ? __APP_BUILD__
    : { commit: 'unknown', branch: 'unknown', builtAt: '', version: '1.0.0', mode: 'development' };
