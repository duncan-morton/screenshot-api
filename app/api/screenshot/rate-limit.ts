type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

type Entry = {
  count: number;
  windowStart: number;
};

const requests = new Map<string, Entry>();

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const current = requests.get(ip);

  if (!current || now - current.windowStart >= WINDOW_MS) {
    requests.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (current.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil(
      (WINDOW_MS - (now - current.windowStart)) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;
  requests.set(ip, current);

  return { allowed: true };
}
