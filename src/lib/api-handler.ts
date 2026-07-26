import { NextResponse } from 'next/server'

/** Throw to return a 400 with a message instead of a 500. */
export class BadRequest extends Error {}

/**
 * Wraps a route handler so thrown errors become JSON `{ error }` instead of
 * Next's HTML error page. The client shows this text to the user, so a real
 * message ("OPENROUTER_API_KEY is not set") has to survive in production —
 * an unhandled throw would otherwise surface as a page of markup in a toast.
 */
export function apiHandler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse> | NextResponse
) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!(err instanceof BadRequest)) console.error('[api]', message)
      return NextResponse.json({ error: message }, { status: err instanceof BadRequest ? 400 : 500 })
    }
  }
}

/** Parse a JSON body, turning malformed input into a 400 rather than a 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new BadRequest('Request body is not valid JSON')
  }
}
