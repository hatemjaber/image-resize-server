import { Context, Next } from "hono";
import { decode, verify } from "hono/jwt";
import { env } from "./env.js";
import { JwtTokenExpired } from "hono/utils/jwt/types";

export const jwtValidation = async (c: Context, next: Next) => {
    const token = c.req.header("Authorization")?.split(" ")[1];
    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    try {
        const decoded = await verify(token, env.X_API_TOKEN_SIGN_KEY);
        c.set("decoded", decoded);
        await next();
    } catch (error) {
        // TODO: WRITE TO FILE OR USE OPENTELEMETRY
        console.log("error", error, decode(token));
        if (error instanceof JwtTokenExpired) {
            return c.json({ error: "Token expired" }, 401);
        }
        return c.json({ error: "Unauthorized" }, 401);
    }
};