import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { log } from "../logger.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
const SHOT_DIR = path.join(DATA_DIR, "screenshots");
await fs.mkdir(SHOT_DIR, { recursive: true });

let browser = null;
let context = null;
let page = null;
let currentUrl = "";
let lastConnectedAt = null;
let settings = {
  headless: false,
  timeout: 60000,
  retries: 2,
  screenshot: true,
  autoReconnect: true,
};

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  return settings;
}

export function getStatus() {
  return {
    connected: !!page && !page.isClosed(),
    url: currentUrl,
    lastConnectedAt,
    settings,
  };
}

async function ensureBrowser(convId) {
  if (browser && page && !page.isClosed()) return;
  log("info", `Launching browser (headless=${settings.headless})`, convId);
  browser = await chromium.launch({ headless: settings.headless });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  page = await context.newPage();
}

export async function connect(url, convId) {
  await ensureBrowser(convId);
  log("info", `Navigating to AI site: ${url}`, convId);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: settings.timeout });
  currentUrl = url;
  lastConnectedAt = new Date().toISOString();
  log("success", `Connected to ${url}`, convId);
  return getStatus();
}

async function takeScreenshot(label, convId) {
  if (!settings.screenshot || !page || page.isClosed()) return null;
  const filename = `${convId}-${Date.now()}-${label}.png`;
  const filepath = path.join(SHOT_DIR, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: false });
    log("debug", `Screenshot saved: ${filename}`, convId);
    return `/api/chat/screenshots/${filename}`;
  } catch (e) {
    log("warn", `Screenshot failed: ${e.message}`, convId);
    return null;
  }
}

/**
 * Detect an input/textarea/contenteditable used as prompt box.
 */
async function findPromptInput() {
  const candidates = [
    'textarea[data-id="root"]',
    'textarea[placeholder*="Message" i]',
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="Send" i]',
    'textarea[placeholder*="Saisis" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
    'input[type="text"]',
  ];
  for (const sel of candidates) {
    const el = await page.$(sel);
    if (el) {
      const visible = await el.isVisible().catch(() => false);
      if (visible) return { selector: sel, handle: el };
    }
  }
  return null;
}

async function submitPrompt(target, prompt) {
  // Try fill (textarea/input), fallback to keyboard type for contenteditable
  try {
    await target.handle.fill(prompt);
  } catch {
    await target.handle.click();
    await page.keyboard.type(prompt, { delay: 5 });
  }
  // Try clicking a send button first
  const sendSelectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Envoyer" i]',
    'button[type="submit"]',
  ];
  for (const sel of sendSelectors) {
    const btn = await page.$(sel);
    if (btn && (await btn.isEnabled().catch(() => false))) {
      await btn.click().catch(() => {});
      return;
    }
  }
  // Fallback: press Enter
  await page.keyboard.press("Enter");
}

/**
 * Wait until the assistant response text stops growing (streaming finished).
 */
async function waitForResponse(convId, beforeText) {
  const start = Date.now();
  const maxWait = settings.timeout;
  let last = "";
  let stable = 0;
  const targets = [
    '[data-message-author-role="assistant"]',
    '.markdown',
    'div.prose',
    'article',
    'main',
  ];

  while (Date.now() - start < maxWait) {
    let text = "";
    for (const sel of targets) {
      const els = await page.$$(sel);
      if (els.length) {
        // Take last element text
        const t = await els[els.length - 1].innerText().catch(() => "");
        if (t && t.length > text.length) text = t;
      }
    }
    // Strip the user prompt + prior conversation from text
    const clean = text.trim();
    if (clean && clean !== beforeText && clean.length > 0) {
      if (clean === last) {
        stable++;
        if (stable >= 4) {
          log("success", `Response stable after ${Date.now() - start}ms`, convId);
          return clean;
        }
      } else {
        stable = 0;
        last = clean;
      }
    }
    await page.waitForTimeout(500);
  }
  if (last) {
    log("warn", `Response timed out, returning partial`, convId);
    return last;
  }
  throw new Error("No response detected from AI site");
}

/**
 * Send a prompt and return the AI's response text.
 * Emits progress via the onLog callback.
 */
export async function sendPrompt({ url, prompt, convId, onScreenshot }) {
  let attempt = 0;
  let lastErr;
  while (attempt <= settings.retries) {
    attempt++;
    try {
      await ensureBrowser(convId);
      if (url && url !== currentUrl) {
        await connect(url, convId);
      } else if (!currentUrl && url) {
        await connect(url, convId);
      }

      log("info", `Locating prompt input (attempt ${attempt})`, convId);
      const target = await findPromptInput();
      if (!target) throw new Error("No prompt input found on page");

      const before = await page
        .innerText("body")
        .catch(() => "");

      const beforeShot = await takeScreenshot("before", convId);
      if (beforeShot && onScreenshot) onScreenshot(beforeShot);

      log("info", `Typing prompt into ${target.selector}`, convId);
      await submitPrompt(target, prompt);
      log("info", `Prompt sent, waiting for response…`, convId);

      const response = await waitForResponse(convId, before);

      const afterShot = await takeScreenshot("after", convId);
      if (afterShot && onScreenshot) onScreenshot(afterShot);

      return { response, screenshot: afterShot };
    } catch (err) {
      lastErr = err;
      log("error", `Attempt ${attempt} failed: ${err.message}`, convId);
      await takeScreenshot("error", convId).then((s) => {
        if (s && onScreenshot) onScreenshot(s);
      });
      if (settings.autoReconnect && attempt <= settings.retries) {
        log("warn", `Reconnecting before retry…`, convId);
        await closeBrowser().catch(() => {});
      }
    }
  }
  throw lastErr || new Error("Unknown error sending prompt");
}

export async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
  }
  browser = null;
  context = null;
  page = null;
}

export async function readScreenshot(filename) {
  const safe = path.basename(filename);
  return fs.readFile(path.join(SHOT_DIR, safe));
}