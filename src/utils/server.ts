import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { requestId } from 'hono/request-id';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { env } from './env.js';
import { handlers } from './exceptions.js';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// need to add this to get BigInt to work with JSON.stringify
// @ts-ignore
BigInt.prototype["toJSON"] = function () {
    return this.toString();
};

export const app = new Hono();

// Generic middlewares
app.use(cors());
app.use(compress());
app.use(trimTrailingSlash());
app.use(requestId());
app.use(async (c, next) => {
    c.req.conninfo = getConnInfo(c);
    await next();
});
app.use(logger());
app.use(prettyJSON());

app.onError((err, c) => {
    // TODO: WRITE TO FILE OR USE OPENTELEMETRY
    console.error({ ...err, stack: err.stack, ...c.req.conninfo, requestId: c.get('requestId') });

    if (err instanceof HTTPException) {
        return err.getResponse();
    }

    // in case of unknown error
    return c.json({ message: 'Internal Server Error', cause: "Unknown Error", error: { ...err, stack: err.stack, message: err.message } }, StatusCodes.INTERNAL_SERVER_ERROR);
});

app.notFound((c) => {
    throw new handlers.PathNotFound(c, { url: c.req.url, path: c.req.path, ...c.req.conninfo });
});

if (env.NODE_ENV === "development") {
    showRoutes(app);
}

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST });

const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    // wait for a second before closing the server
    await new Promise(resolve => setTimeout(resolve, 1000));
    server.close(() => {
        // TODO: WRITE TO FILE OR USE OPENTELEMETRY
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// TODO: WRITE TO FILE OR USE OPENTELEMETRY
console.log(`Server is running on port: ${ env.PORT }, env: ${ env.NODE_ENV }, host: ${ env.HOST }`);