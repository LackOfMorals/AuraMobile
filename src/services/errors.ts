/** A problem the person can act on. Its message is shown to them, so it never contains a secret. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
