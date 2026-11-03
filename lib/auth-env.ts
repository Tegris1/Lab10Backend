import "server-only";
import { parseAuthEnvironment } from "./auth/environment";

export function getAuthEnvironment() {
  return parseAuthEnvironment(process.env);
}
