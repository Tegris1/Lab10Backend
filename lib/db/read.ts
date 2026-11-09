import "server-only";
import { logServerError } from "../logging";

export async function databaseRead<T>(operation: string, read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    logServerError(operation, error);
    // Preserve the driver's message, stack and cause for Next.js/Vercel runtime logs.
    throw error;
  }
}
