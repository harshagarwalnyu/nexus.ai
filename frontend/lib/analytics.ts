import posthog from "posthog-js";

export const initPostHog = () => {
    if (typeof window !== "undefined") {

        if ((posthog as any).__loaded) return;

        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

        if (key) {
            posthog.init(key, {
                api_host: host,
                person_profiles: "identified_only",
                capture_pageview: false,
            });
        }
    }
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== "undefined" && (posthog as any).__loaded) {
        posthog.capture(eventName, properties);
    }
};

export const ANALYTICS_EVENTS = {
    RESEARCH_STARTED: "research_started",
    RESEARCH_COMPLETED: "research_completed",
    REPORT_DOWNLOADED: "report_downloaded",
    CANVAS_VIEWED: "canvas_viewed",
    SIDEBAR_TOGGLED: "sidebar_toggled",
    COMPONENT_ERROR: "component_error",
};