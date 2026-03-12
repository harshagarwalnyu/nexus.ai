import * as jose from 'jose';

export async function requireAuth(req, res, next) {

    if (process.env.NODE_ENV === "development" && !process.env.BETTER_AUTH_SECRET) {
        req.user = { id: "dev-user" };
        req.tenant_id = "dev-tenant";
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {

        const xApiKey = req.headers['x-api-key'];
        if (xApiKey && xApiKey === process.env.BETTER_AUTH_SECRET) {
            req.user = { id: "system" };
            req.tenant_id = "default-tenant";
            return next();
        }
        return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    try {
        const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET);

        const { payload } = await jose.jwtVerify(token, secret);
        req.user = payload;
        req.tenant_id = payload.tenant_id || "default-tenant";
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
    }
}