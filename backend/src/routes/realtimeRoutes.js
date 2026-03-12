import express from 'express';
import polygonService from '../services/polygonService.js';
import whisperService from '../services/whisperService.js';

const router = express.Router();

router.post('/polygon/connect', (req, res) => {
    try {
        polygonService.connect();
        res.json({ message: 'Connected to Polygon.io WebSocket' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/polygon/disconnect', (req, res) => {
    try {
        polygonService.disconnect();
        res.json({ message: 'Disconnected from Polygon.io WebSocket' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/polygon/subscribe', (req, res) => {
    const { ticker } = req.body;
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        const result = polygonService.subscribe(ticker);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/polygon/subscriptions', (req, res) => {
    res.json({ subscriptions: polygonService.getActiveSubscriptions() });
});

router.post('/whisper/transcribe', async (req, res) => {

    const { audioUrl } = req.body || {};

    try {
        const result = await whisperService.transcribe(audioUrl || 'dummy_audio_data');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export function registerRealtimeRoutes(app) {
    app.use("/api/v1/realtime", router);
}