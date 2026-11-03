import "server-only";
import { logServerError } from "../logging";

export async function databaseRead<T>(operation: string, read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    logServerError(operation, error);
    // Next.js may log an uncaught server-rendering error; do not pass driver errors into that path.
    throw new Error("Could not load the requested data. Please try again.");
  }
}
