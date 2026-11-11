export interface Config {
  nodeEnv: string;
  host: string;
  port: number;
  publicUrl: string;
  databaseUrl: string;
  sessionSecret: string;
  /** Folder for user-visible media (audio, images); may be a separate HDD mount. */
  mediaDir: string;
  /** Built web app to serve; empty string disables static serving (dev mode). */
  webDistDir: string;
}

/** Reads configuration from environment variables. Does not validate yet (placeholder). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    publicUrl: env.PUBLIC_URL ?? 'http://localhost:3000',
    databaseUrl: env.DATABASE_URL ?? '',
    sessionSecret: env.SESSION_SECRET ?? '',
    mediaDir: env.MEDIA_DIR ?? './media',
    webDistDir: env.WEB_DIST_DIR ?? '',
  };
}
