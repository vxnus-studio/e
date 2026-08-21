export class ConstraintError extends Error {
  constructor(message: string, public cause?: unknown, public code?: string) {
    super(message);
    this.name = "ConstraintError";
  }
  toJSON() { return { name: this.name, message: this.message, code: this.code, cause: this.cause }; }
}

export class QueryError extends Error {
  constructor(message: string, public cause?: unknown, public code?: string) {
    super(message);
    this.name = "QueryError";
  }
  toJSON() { return { name: this.name, message: this.message, code: this.code, cause: this.cause }; }
}

export class UnsupportedOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedOperationError";
  }
  toJSON() { return { name: this.name, message: this.message }; }
}
