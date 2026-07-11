import { NextResponse } from "next/server";
import { UnauthorizedError } from "./context.js";
import { ZodError } from "zod";
import { captureError } from "./sentry.js";

/**
 * Wraps a route handler so tenant/validation errors become clean JSON responses
 * instead of 500s. Keeps every route's happy path readable.
 */
export function apiHandler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid request", details: err.flatten() },
          { status: 400 }
        );
      }
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error("[api] unhandled error", err);
      void captureError(err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}
export function forbidden(message = "Forbidden"): never {
  throw new HttpError(403, message);
}
export function notFound(message = "Not found"): never {
  throw new HttpError(404, message);
}
