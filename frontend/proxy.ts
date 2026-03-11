import { NextRequest, NextResponse } from "next/server";

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/_next") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    try {
        const sessionUrl = new URL("/api/auth/get-session", request.url);
        const sessionRes = await fetch(sessionUrl.toString(), {
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
        });

        if (sessionRes.ok) {
            const text = await sessionRes.text();
            try {
                const data = JSON.parse(text);
                if (data?.session) {
                    return NextResponse.next();
                }
            } catch (pErr) {
                console.error("[Proxy] JSON parse error:", pErr instanceof Error ? pErr.message : "Unknown error");
            }
        } else {

        }
    } catch (err) {
        console.error("[Proxy] Fetch error:", err instanceof Error ? err.message : "Unknown error");

        if (process.env.NODE_ENV === "development") {
            return NextResponse.next();
        }
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    ],
};