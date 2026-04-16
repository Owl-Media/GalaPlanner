import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { registerRoutes } from './routes/index.js';
import { getConfig, trimTrailingSlash } from './config.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = path.resolve(currentDir, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');

function buildRuntimeIndexHtml(indexHtml: string, publicBasePath: string): string {
  return indexHtml
    .replaceAll('href="/vite.svg"', `href="${publicBasePath}vite.svg"`)
    .replaceAll('src="/assets/', `src="${publicBasePath}assets/`)
    .replaceAll('href="/assets/', `href="${publicBasePath}assets/`)
    .replace(
      '</head>',
      `    <script>window.__APP_BASE_PATH__ = ${JSON.stringify(publicBasePath)};</script>\n  </head>`
    );
}

function stripQueryAndHash(url: string): string {
  return url.split('?')[0].split('#')[0];
}

function isRequestWithinBasePath(requestPath: string, basePath: string): boolean {
  const normalizedBasePath = trimTrailingSlash(basePath);

  if (normalizedBasePath === '/') {
    return requestPath.startsWith('/');
  }

  return requestPath === normalizedBasePath || requestPath.startsWith(`${normalizedBasePath}/`);
}

function sendIndexHtml(reply: FastifyReply, indexHtml: string) {
  return reply
    .type('text/html; charset=utf-8')
    .header('Cache-Control', 'no-store')
    .send(indexHtml);
}

export async function buildApp() {
  const config = getConfig();
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: config.corsOrigin,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxFileSize,
    },
  });

  // Register routes
  if (config.routePrefix) {
    await app.register(async (scopedApp) => {
      registerRoutes(scopedApp);
    }, { prefix: config.routePrefix });
  } else {
    registerRoutes(app);
  }

  // Serve built frontend when available (container/production runtime).
  if (existsSync(frontendDistDir) && existsSync(frontendIndexPath)) {
    const indexHtml = buildRuntimeIndexHtml(readFileSync(frontendIndexPath, 'utf8'), config.publicBasePath);

    await app.register(fastifyStatic, {
      root: frontendDistDir,
      prefix: config.publicBasePath,
      index: false,
    });

    const appEntryPath = config.routePrefix || '/';

    app.get(appEntryPath, async (_request, reply) => sendIndexHtml(reply, indexHtml));

    if (config.publicBasePath !== '/') {
      app.get(config.publicBasePath, async (_request, reply) => sendIndexHtml(reply, indexHtml));
    }

    app.setNotFoundHandler((request, reply) => {
      const requestPath = stripQueryAndHash(request.url);
      const isSpaRoute =
        request.method === 'GET' &&
        isRequestWithinBasePath(requestPath, config.publicBasePath) &&
        !isRequestWithinBasePath(requestPath, config.apiBasePath) &&
        !path.posix.basename(requestPath).includes('.');

      if (isSpaRoute) {
        return sendIndexHtml(reply, indexHtml);
      }

      return reply.status(404).send({
        success: false,
        error: 'Not Found',
      });
    });
  }

  return app;
}
