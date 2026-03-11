import { connect, JSONCodec } from "nats";

let natsConn = null;
let jsClient = null;
const jc = JSONCodec();

export async function initNATS() {
    if (natsConn) return { natsConn, jsClient };

    try {
        const server = process.env.NATS_SERVER || "localhost:4222";
        natsConn = await connect({ servers: [server] });
        jsClient = natsConn.jetstream();
        console.log(`[NATS] Connected to ${server}`);
        return { natsConn, jsClient };
    } catch (err) {
        console.error("[NATS] Connection failed:", err.message);
        throw err;
    }
}

export async function publishEvent(subject, data) {
    if (!jsClient) await initNATS();
    try {
        const pa = await jsClient.publish(subject, jc.encode(data));
        return pa;
    } catch (err) {
        console.error(`[NATS] Publish failed to ${subject}:`, err.message);
        throw err;
    }
}

export async function subscribeToEvents(subject, handler) {
    if (!natsConn) await initNATS();
    const sub = natsConn.subscribe(subject);
    console.log(`[NATS] Subscribed to ${subject}`);

    (async () => {
        for await (const m of sub) {
            try {
                const data = jc.decode(m.data);
                await handler(data, m);
            } catch (err) {
                console.error(`[NATS] Handler error for ${subject}:`, err.message);
            }
        }
    })();
    return sub;
}