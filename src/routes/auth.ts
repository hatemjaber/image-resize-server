import { Context } from "hono";
import { env } from "../utils/env.js";
import { sign } from "hono/jwt";

export async function auth(c: Context) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const { sub } = await c.req.json();

    if (!sub) {
        return c.json({ error: "Invalid subscriber" }, 401);
    }

    const base64Credentials = authHeader.slice("Basic ".length);
    const decoded = Buffer.from(base64Credentials, "base64").toString("utf-8"); // 'key:secret'
    const [key, secret] = decoded.split(":");

    if (!key || !secret) {
        return c.json({ error: "Invalid credentials format" }, 400);
    }

    // ✅ Validate credentials (replace this with your own logic)
    if (key !== env.X_API_KEY || secret !== env.X_API_SECRET) {
        return c.json({ error: "Invalid credentials" }, 401);
    }

    // 900 seconds = 15 minutes
    const expires_in = 60 * 15;
    // ✅ Issue a JWT
    const token = await sign(
        {
            sub,
            iss: "image-resize-server",
            exp: Math.floor(Date.now() / 1000) + expires_in, // 15-minute expiry
            alg: "HS256",
        },
        env.X_API_TOKEN_SIGN_KEY
    );

    return c.json({ access_token: token, expires_in });
};