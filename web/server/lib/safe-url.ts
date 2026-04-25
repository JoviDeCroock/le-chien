const MAX_URL_LENGTH = 2_048;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1_000_000;

const BLOCKED_HOSTS = new Set(["localhost", "local", "metadata.google.internal"]);

export type SafeFetchResult = {
  response: Response;
  finalUrl: string;
};

export function assertSafeHttpUrl(raw: string | URL): URL {
  const value = String(raw);
  if (value.length > MAX_URL_LENGTH) throw new Error("URL is too long");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  const host = normalizeHost(url.hostname);
  if (!host) throw new Error("URL must include a hostname");
  if (isBlockedHostname(host) || isBlockedIpLiteral(host)) {
    throw new Error("Private, local, and reserved hosts are not allowed");
  }

  return url;
}

export async function safeFetchHttpUrl(
  raw: string,
  init: RequestInit = {},
  maxRedirects = MAX_REDIRECTS,
): Promise<SafeFetchResult> {
  let current = assertSafeHttpUrl(raw);

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const response = await fetch(current.toString(), {
      ...init,
      redirect: "manual",
    });

    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: current.toString() };
    }

    const location = response.headers.get("location");
    if (!location) return { response, finalUrl: current.toString() };

    current = assertSafeHttpUrl(new URL(location, current));
  }

  throw new Error("Too many redirects");
}

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes = MAX_RESPONSE_BYTES,
): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds ${maxBytes} byte limit`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function normalizeHost(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function isBlockedHostname(host: string) {
  if (BLOCKED_HOSTS.has(host)) return true;
  return (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid")
  );
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isBlockedIpLiteral(host: string) {
  const ipv4 = parseIpv4(host);
  if (ipv4 !== null) return isBlockedIpv4(ipv4);

  const ipv6 = parseIpv6(host);
  if (!ipv6) return false;
  return isBlockedIpv6(ipv6);
}

function parseIpv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

function inIpv4Range(ip: number, cidrBase: string, bits: number) {
  const base = parseIpv4(cidrBase);
  if (base === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

function isBlockedIpv4(ip: number) {
  return (
    inIpv4Range(ip, "0.0.0.0", 8) ||
    inIpv4Range(ip, "10.0.0.0", 8) ||
    inIpv4Range(ip, "100.64.0.0", 10) ||
    inIpv4Range(ip, "127.0.0.0", 8) ||
    inIpv4Range(ip, "169.254.0.0", 16) ||
    inIpv4Range(ip, "172.16.0.0", 12) ||
    inIpv4Range(ip, "192.0.0.0", 24) ||
    inIpv4Range(ip, "192.0.2.0", 24) ||
    inIpv4Range(ip, "192.168.0.0", 16) ||
    inIpv4Range(ip, "198.18.0.0", 15) ||
    inIpv4Range(ip, "198.51.100.0", 24) ||
    inIpv4Range(ip, "203.0.113.0", 24) ||
    inIpv4Range(ip, "224.0.0.0", 4) ||
    inIpv4Range(ip, "240.0.0.0", 4) ||
    ip === 0xffffffff
  );
}

function parseIpv6(host: string): Uint16Array | null {
  if (!host.includes(":")) return null;
  const ipv4Match = host.match(/(.+):(\d+\.\d+\.\d+\.\d+)$/);
  let normalized = host;
  let ipv4Tail: number[] = [];

  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[2]);
    if (ipv4 === null) return null;
    normalized = ipv4Match[1];
    ipv4Tail = [(ipv4 >>> 16) & 0xffff, ipv4 & 0xffff];
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const neededZeros = 8 - ipv4Tail.length - head.length - tail.length;
  if (neededZeros < 0 || (halves.length === 1 && neededZeros !== 0)) return null;

  const words = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? neededZeros : 0 }, () => "0"),
    ...tail,
  ];

  const parsed: number[] = [];
  for (const word of words) {
    if (!/^[0-9a-f]{1,4}$/i.test(word)) return null;
    parsed.push(Number.parseInt(word, 16));
  }

  const full = new Uint16Array([...parsed, ...ipv4Tail]);
  return full.length === 8 ? full : null;
}

function isBlockedIpv6(words: Uint16Array) {
  const isAllZero = words.every((word) => word === 0);
  const isLoopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const isUniqueLocal = (words[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (words[0] & 0xffc0) === 0xfe80;
  const isMulticast = (words[0] & 0xff00) === 0xff00;
  const isIpv4Mapped =
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0xffff;

  if (isIpv4Mapped) {
    const ipv4 = ((words[6] << 16) + words[7]) >>> 0;
    return isBlockedIpv4(ipv4);
  }

  return isAllZero || isLoopback || isUniqueLocal || isLinkLocal || isMulticast;
}
