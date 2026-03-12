export function validateRequest(schema) {
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req.body);
            req.validatedBody = parsed;
            next();
        } catch (err) {
            return res.status(400).json({ error: "Validation failed", details: err.errors });
        }
    };
}