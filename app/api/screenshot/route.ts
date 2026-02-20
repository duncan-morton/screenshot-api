import { access } from "node:fs/promises";

import chromium from "@sparticuz/chromium";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

import { checkRateLimit } from "./rate-limit";

export const runtime = "nodejs";

type ScreenshotFormat = "png" | "jpeg";

type ScreenshotRequestBody = {
  url?: string;
  width?: number;
  format?: ScreenshotFormat;
};

const DEFAULT_VIEWPORT_WIDTH = 1920;
const DEFAULT_VIEWPORT_HEIGHT = 1080;
const NAVIGATION_TIMEOUT_MS = 30_000;

const LOCAL_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    return firstIp.trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function parseFormat(value: unknown): ScreenshotFormat {
  if (value === "jpeg") {
    return "jpeg";
  }
  return "png";
}

function parseWidth(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_VIEWPORT_WIDTH;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  if (rounded < 320 || rounded > 3840) {
    return null;
  }

  return rounded;
}

function parseAndValidateUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

type ExecutableInfo = {
  executablePath: string;
  useChromiumArgs: boolean;
};

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutablePath(): Promise<ExecutableInfo> {
  if (process.env.CHROMIUM_PATH) {
    return {
      executablePath: process.env.CHROMIUM_PATH,
      useChromiumArgs: false,
    };
  }

  try {
    // On non-Linux local development machines, prefer installed browsers.
    const isLikelyServerlessLinux = process.platform === "linux";
    if (isLikelyServerlessLinux) {
      const sparticuzPath = await chromium.executablePath();
      if (await canAccess(sparticuzPath)) {
        return {
          executablePath: sparticuzPath,
          useChromiumArgs: true,
        };
      }
    }
  } catch {
    // Fall through to local browser path lookup.
  }

  for (const localPath of LOCAL_CHROME_PATHS) {
    if (await canAccess(localPath)) {
      return {
        executablePath: localPath,
        useChromiumArgs: false,
      };
    }
  }

  throw new Error(
    "Could not resolve a Chromium executable. Set CHROMIUM_PATH for local runs.",
  );
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  let body: ScreenshotRequestBody;
  try {
    body = (await request.json()) as ScreenshotRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const url = parseAndValidateUrl(body.url);
  if (!url) {
    return NextResponse.json(
      { error: "Invalid URL. Provide a valid http(s) URL." },
      { status: 400 },
    );
  }

  const width = parseWidth(body.width);
  if (!width) {
    return NextResponse.json(
      { error: "Invalid width. Must be a number between 320 and 3840." },
      { status: 400 },
    );
  }

  const format = parseFormat(body.format);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { executablePath, useChromiumArgs } = await resolveExecutablePath();

    browser = await puppeteer.launch({
      args: useChromiumArgs ? chromium.args : [],
      defaultViewport: {
        width,
        height: DEFAULT_VIEWPORT_HEIGHT,
      },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

    await page.goto(url.toString(), {
      waitUntil: "networkidle0",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    const screenshot = await page.screenshot({
      type: format,
      fullPage: true,
    });
    const imageBuffer = Buffer.from(screenshot);

    const contentType = format === "jpeg" ? "image/jpeg" : "image/png";
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected screenshot generation error.";
    return NextResponse.json(
      { error: "Screenshot failed", details: message },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
