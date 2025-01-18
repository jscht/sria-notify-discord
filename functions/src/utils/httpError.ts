export class HttpError extends Error {
  private static readonly badRequestCode = 400;
  private static readonly unauthorizedCode = 401;
  private static readonly forbiddenCode = 403;
  private static readonly notFoundCode = 404;
  private static readonly methodNotAllowedCode = 405;
  private static readonly requestTimeoutCode = 408;
  private static readonly conflictCode = 409;
  private static readonly unprocessableContent = 422;
  private static readonly internalServerErrorCode = 500;
  private static readonly serviceUnavailable = 503;

  private readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  static BadRequest(message?: string) {
    return new this(this.badRequestCode, message || "Bad Request");
  }

  static Unauthorized(message?: string) {
    return new this(this.unauthorizedCode, message || "Unauthorized");
  }

  static Forbidden(message?: string) {
    return new this(this.forbiddenCode, message || "Forbidden");
  }

  static NotFound(message?: string) {
    return new this(this.notFoundCode, message || "Not Found");
  }

  static MethodNotAllowed(message?: string) {
    return new this(this.methodNotAllowedCode, message || "Method Not Allowed");
  }

  static RequestTimeout(message?: string) {
    return new this(this.requestTimeoutCode, message || "Request Timeout");
  }

  static Conflict(message?: string) {
    return new this(this.conflictCode, message || "Conflict");
  }

  static UnprocessableContent(message?: string) {
    return new this(this.unprocessableContent, message || "Unprocessable Content");
  }

  static InternalServerError(message?: string) {
    return new this(this.internalServerErrorCode, message || "Internal Server Error");
  }

  static ServiceUnavailable(message?: string) {
    return new this(this.serviceUnavailable, message || "Service Unavailable");
  }
}
