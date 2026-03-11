import WebSocket from 'ws';
import { z } from 'zod';

const PolygonMessageSchema = z.array(z.object({
  ev: z.string(),
  sym: z.string().optional(),
  v: z.number().optional(),
  av: z.number().optional(),
  op: z.number().optional(),
  vw: z.number().optional(),
  o: z.number().optional(),
  c: z.number().optional(),
  h: z.number().optional(),
  l: z.number().optional(),
  a: z.number().optional(),
  z: z.number().optional(),
  s: z.number().optional(),
  e: z.number().optional(),
  message: z.string().optional(),
  status: z.string().optional()
}).passthrough());

class PolygonService {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.POLYGON_API_KEY;
        this.isConnected = false;
        this.subscriptions = new Set();
        this.ws = null;
    }

    connect() {
        if (this.isConnected) {
            console.log('[PolygonService] Already connected.');
            return;
        }

        console.log('[PolygonService] Connecting to WebSocket (wss://delayed.polygon.io/stocks)...');
        this.ws = new WebSocket('wss://delayed.polygon.io/stocks');

        this.ws.on('open', () => {
            console.log('[PolygonService] Connected.');
            this.isConnected = true;

            if (this.apiKey) {
                this.ws.send(JSON.stringify({
                    action: 'auth',
                    params: this.apiKey
                }));
            } else {
                console.warn('[PolygonService] Warning: No POLYGON_API_KEY provided.');
            }
        });

        this.ws.on('message', (data) => {
            try {
                const parsedData = JSON.parse(data.toString());
                const validatedData = PolygonMessageSchema.parse(parsedData);

                for (const msg of validatedData) {
                    if (msg.ev === 'status') {
                        console.log(`[PolygonService] Status: ${msg.message}`);

                        if (msg.status === 'auth_success' && this.subscriptions.size > 0) {
                            const tickers = Array.from(this.subscriptions).map(t => `T.${t}`).join(',');
                            this.ws.send(JSON.stringify({
                                action: 'subscribe',
                                params: tickers
                            }));
                            console.log(`[PolygonService] Resubscribed to: ${tickers}`);
                        }
                    } else if (msg.ev === 'T') {

                    }
                }
            } catch (error) {
                console.error('[PolygonService] Error parsing or validating message:', error);
            }
        });

        this.ws.on('close', () => {
            console.log('[PolygonService] WebSocket closed.');
            this.isConnected = false;
        });

        this.ws.on('error', (error) => {
            console.error('[PolygonService] WebSocket error:', error);
        });
    }

    disconnect() {
        console.log('[PolygonService] Disconnecting from WebSocket...');
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.subscriptions.clear();
        console.log('[PolygonService] Disconnected.');
    }

    subscribe(ticker) {
        if (!this.isConnected) {
            throw new Error('Must connect before subscribing.');
        }
        console.log(`[PolygonService] Subscribing to ${ticker}...`);
        this.subscriptions.add(ticker);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'subscribe',
                params: `T.${ticker}`
            }));
        }
        return { status: 'subscribed', ticker };
    }

    unsubscribe(ticker) {
        console.log(`[PolygonService] Unsubscribing from ${ticker}...`);
        this.subscriptions.delete(ticker);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'unsubscribe',
                params: `T.${ticker}`
            }));
        }
        return { status: 'unsubscribed', ticker };
    }

    getActiveSubscriptions() {
        return Array.from(this.subscriptions);
    }
}

export default new PolygonService();