import { redactPII } from "../services/governanceService.js";

export function maskPII(req, res, next) {
    const maskString = (str) => {
        if (typeof str !== 'string') return str;
        const { redacted } = redactPII(str);
        return redacted;
    };

    const maskObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = maskString(obj[key]);
            } else if (typeof obj[key] === 'object') {
                maskObject(obj[key]);
            }
        }
    };

    if (req.body) {
        maskObject(req.body);
    }
    if (req.query) {
        maskObject(req.query);
    }
    next();
}