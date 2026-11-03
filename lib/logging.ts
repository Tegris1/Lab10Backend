// Log an operation and a diagnostic category, never raw errors, SQL, request data or credentials.
export function logServerError(operation: string, error: unknown): void {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const knownTypes = ["Error", "TypeError", "RangeError", "PrismaClientKnownRequestError",
    "PrismaClientUnknownRequestError", "PrismaClientValidationError", "PrismaClientInitializationError", "APIError"];
  const type = typeof record.name === "string" && knownTypes.includes(record.name) ? record.name : "Error";
  const knownCodes = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "EPERM"];
  const code = typeof record.code === "string" &&
    (/^P[0-9]{4}$/.test(record.code) || /^[0-9][0-9A-Z]{4}$/.test(record.code) || knownCodes.includes(record.code))
    ? record.code : "UNCLASSIFIED";
  console.error(JSON.stringify({ operation, type, code }));
}
