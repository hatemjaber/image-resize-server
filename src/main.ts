import { type Context } from "hono";
import { app } from "./utils/server.js";
import { HTTPException } from "hono/http-exception";
import { ensureHealthCheckImage, performHealthCheck, s3 } from "./utils/helpers.js";
import { handlers } from "./utils/exceptions.js";
import { uploadImages } from "./routes/upload.js";
import { getImageWithResize } from "./routes/image.js";
import { testPage } from "./routes/test.js";

// Create health check image on server start
try {
    await ensureHealthCheckImage(s3);
} catch (error) {
    if (error instanceof HTTPException) {
        console.error("Failed to create health check image:", error.message);
    } else {
        console.error("Failed to create health check image:", error);
    }
    process.exit(1);
}

// Health check endpoint that verifies image processing and S3 connectivity
app.get("/health-check", async (c: Context) => {
    const result = await performHealthCheck(s3);
    return c.json(result, result.status === "error" ? 500 : 200);
});

// Test page for image uploads
app.get("/test", testPage);

// Upload endpoint for single or multiple files
app.post("/image/*", uploadImages);

// Get image endpoint with optional resizing
app.get("/image/*", getImageWithResize);

// Block unsupported HTTP methods
app.use("*", async (c, next) => {
    const allowedMethods = ["GET", "POST"];
    if (!allowedMethods.includes(c.req.method)) {
        throw new handlers.MethodNotAllowed(c, {
            message: `Method ${ c.req.method } not allowed. Only ${ allowedMethods.join(", ") } are supported.`
        });
    }
    await next();
});

// Catchall handler for undefined routes
app.all("*", (c) => {
    if (c.req.path === "/favicon.ico") {
        return new Response(null, { status: 204 });
    }
    // TODO: LOG THIS WITH OPENTELEMETRY
    console.log("trying to access", c.req.path, c.req.conninfo);
    return new Response(null, { status: 204 });
});