import { subscribeToEvents } from "./nats_service.js";

export async function initSubscribers() {
    try {
        await subscribeToEvents("telemetry.recorded", async (data, msg) => {
            console.log(`[NATS] Telemetry recorded:`, data);

        });

        await subscribeToEvents("audit.log.created", async (data, msg) => {
            console.log(`[NATS] Audit log created:`, data);

        });

        console.log(`[NATS] Subscribers initialized`);
    } catch (err) {
        console.error(`[NATS] Subscriber init failed:`, err.message);
    }
}