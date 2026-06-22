/**
 * Client-safe error with an explicit HTTP status. Lives in its own runtime-free
 * leaf module (no next/* or DB imports) so service-layer code and its unit tests
 * can throw and assert against the real class without dragging in the Next
 * runtime or the JWT fail-fast in session.ts. The route error boundary in
 * api-auth maps a thrown HttpError to its status; anything else becomes a 500.
 */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}
