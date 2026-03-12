import { Effect, Schedule } from "effect";
import { MODELS, callModel } from "./ai.client.js";
import { validateAIResponse } from "./validator.js";

export class AIError extends Error {
    constructor(message, status, context) {
        super(message);
        this._tag = "AIError";
        this.status = status;
        this.context = context;
    }
}

export class ValidationError extends Error {
    constructor(message, raw) {
        super(message);
        this._tag = "ValidationError";
        this.raw = raw;
    }
}

export const callAIEffect = (params) => {
    const { system, messages, contextName = "AI:Call" } = params;

    return Effect.tryPromise({
        try: () => {
            return callModel({
                system,
                messages,
            });
        },
        catch: ( error) => new AIError(error.message, error.status || 500, contextName),
    }).pipe(

        Effect.retry(
            Schedule.exponential("100 millis").pipe(
                Schedule.compose(Schedule.recurs(3)),

                Schedule.whileInput((error) => error instanceof AIError && (error.status === 429 || error.status >= 500))
            )
        ),

        Effect.timeout("30 seconds"),
        Effect.catchTag("TimeoutException", () =>
            Effect.fail(new AIError("Request timed out", 408, contextName))
        )
    );
};

export const validateResponseEffect = (schema, rawText) => {
    return Effect.suspend(() => {
        const validation = validateAIResponse(schema, rawText);
        if (!validation.success) {
            return Effect.fail(new ValidationError(validation.error, validation.raw));
        }
        return Effect.succeed(validation.data);
    });
};

export const performAIRequest = (params, schema) => {
    return callAIEffect(params).pipe(
        Effect.flatMap((response) => validateResponseEffect(schema, response.content)),
        Effect.mapError((error) => {

            if (error instanceof AIError) return { type: "AI_SERVICE_FAILURE", ...error };
            if (error instanceof ValidationError) return { type: "VALIDATION_FAILURE", ...error };
            return { type: "UNKNOWN_FAILURE", message:  (error).message };
        })
    );
};