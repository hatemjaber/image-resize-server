import 'hono';
import { ConnInfo } from 'hono/conninfo';

declare module 'hono' {
    interface HonoRequest {
        conninfo: ConnInfo;
    }
} 