import { isProduction } from "./isProduction";

function parseOrigin(value: string, variableName: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`Invalid ${variableName}. Expected a full URL, got "${value}".`);
  }
}

export function getAppOrigin(env: Cloudflare.Env): string {
  if (!isProduction(env)) {
    return "http://localhost:5173";
  }

  return parseOrigin(env.APP_URL, "APP_URL");
}
