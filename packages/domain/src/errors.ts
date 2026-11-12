/** "A" or "An" for a lowercase English word, for human-readable error messages. */
export const article = (word: string) => (/^[aeiou]/i.test(word) ? "An" : "A");

/** Domain errors carry a stable machine-readable code that the API maps to HTTP responses. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
