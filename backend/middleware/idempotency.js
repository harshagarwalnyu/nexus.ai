const idempotencyCache = new Map();

export function enforceIdempotency(req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') {
        return next();
    }

    const key = req.headers['idempotency-key'];
    if (!key) {
        return res.status(400).json({ error: 'Idempotency-Key header is required for this operation' });
    }

    if (idempotencyCache.has(key)) {
        const cached = idempotencyCache.get(key);
        if (cached.status === 'processing') {
            return res.status(409).json({ error: 'Request is already processing' });
        }
        return res.status(200).json(cached.body);
    }

    idempotencyCache.set(key, { status: 'processing' });

    const originalJson = res.json;
    res.json = function(body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            idempotencyCache.set(key, { status: 'completed', body });
            setTimeout(() => idempotencyCache.delete(key), 3600000);
        } else {
            idempotencyCache.delete(key);
        }
        return originalJson.call(this, body);
    };

    next();
}