export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string;
  maxFileSize: number;
  publicBasePath: string;
  routePrefix: string;
  apiBasePath: string;
}

export function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') {
    return '/';
  }

  const segments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return '/';
  }

  return `/${segments.join('/')}/`;
}

export function trimTrailingSlash(value: string): string {
  if (value === '/' || !value.endsWith('/')) {
    return value;
  }

  return value.slice(0, -1);
}

export function withBasePath(basePath: string, route: string): string {
  const cleanedRoute = route.replace(/^\/+/, '');

  if (!cleanedRoute) {
    return basePath;
  }

  if (basePath === '/') {
    return `/${cleanedRoute}`;
  }

  return `${trimTrailingSlash(basePath)}/${cleanedRoute}`;
}

export function getConfig(): AppConfig {
  const publicBasePath = normalizeBasePath(process.env.APP_BASE_PATH);
  const routePrefix = publicBasePath === '/' ? '' : trimTrailingSlash(publicBasePath);

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
    publicBasePath,
    routePrefix,
    apiBasePath: withBasePath(publicBasePath, 'api'),
  };
}
