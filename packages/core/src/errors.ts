export class ConstraintError extends Error {
  constructor(message: string, public cause?: unknown, public code?: string) {
    super(message);
    this.name = "ConstraintError";
  }
}

export class QueryError extends Error {
  constructor(message: string, public cause?: unknown, public code?: string) {
    super(message);
    this.name = "QueryError";
  }
}

export class UnsupportedOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedOperationError";
  }
}
