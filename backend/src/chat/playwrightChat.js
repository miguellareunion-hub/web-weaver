import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { log } from "../logger.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
const SHOT_DIR = path.join(DATA_DIR, "screenshots");
const PROFILE_DIR = path.join(DATA_DIR, "browser-profile");
const DOWNLOAD_DIR = path.join(DATA_DIR, "downloads");
await fs.mkdir(SHOT_DIR, { recursive: true });
await fs.mkdir(PROFILE_DIR, { recursive: true });
await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

let context = null;
let page = null;
let currentUrl = "";
let lastConnectedAt = null;
let settings = {
  headless: false,
  timeout: 60000,
  retries: 2,
  screenshot: true,
  autoReconnect: false,
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
  if (context && page && !page.isClosed()) return;
  log(
    "info",
    `Launching persistent browser (headless=${settings.headless}, profile=${PROFILE_DIR})`,
    convId,
  );
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: settings.headless,
    viewport: { width: 1280, height: 800 },
    args: ["--disable-blink-features=AutomationControlled"],
    acceptDownloads: true,
  });
  const pages = context.pages();
  page = pages.length ? pages[0] : await context.newPage();
  context.on("close", () => {
    context = null;
    page = null;
  });
}

export async function connect(url, convId) {
  await ensureBrowser(convId);
  // If already on the same host, don't re-navigate (keeps user session/state)
  try {
    const current = page.url();
    const sameHost =
      current && url && new URL(current).host === new URL(url).host;
    if (sameHost) {
      currentUrl = url;
      lastConnectedAt = new Date().toISOString();
      log("info", `Already on ${new URL(url).host}, skip navigation`, convId);
      return getStatus();
    }
  } catch {}
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
    '#prompt-textarea',
    'div#prompt-textarea[contenteditable="true"]',
    'textarea[data-id="root"]',
    'textarea[placeholder*="Message" i]',
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="Send" i]',
    'textarea[placeholder*="Saisis" i]',
    'textarea[placeholder*="Pose" i]',
    'textarea[placeholder*="Demande" i]',
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
  // Focus first
  await target.handle.click().catch(() => {});
  // Try fill (textarea/input), fallback to keyboard type for contenteditable
  try {
    await target.handle.fill(prompt);
  } catch {
    await page.keyboard.type(prompt, { delay: 5 });
  }
  await page.waitForTimeout(150);
  // Try clicking a send button first
  const sendSelectors = [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-send-button"]',
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
 * Attach files to the prompt before sending.
 * ChatGPT/most AI sites expose a hidden <input type="file">.
 */
async function attachFiles(filePaths, convId) {
  if (!filePaths || filePaths.length === 0) return;
  log("info", `Attaching ${filePaths.length} file(s)`, convId);
  // Find a file input. Prefer one inside the composer/form.
  const inputs = await page.$$('input[type="file"]');
  if (inputs.length === 0) {
    throw new Error("No file input found on page (cannot attach files)");
  }
  const input = inputs[inputs.length - 1];
  await input.setInputFiles(filePaths);
  // Wait for upload UI / thumbnail to appear and stabilize
  await page.waitForTimeout(1500);
  // Wait until send button enabled again (best-effort)
  const sendSel =
    'button[data-testid="send-button"], button[data-testid="composer-send-button"], button[aria-label*="Send" i], button[aria-label*="Envoyer" i]';
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const btn = await page.$(sendSel);
    if (btn && (await btn.isEnabled().catch(() => false))) break;
    await page.waitForTimeout(500);
  }
  log("success", `Files attached`, convId);
}

/**
 * Scan the assistant node for downloadable links, click them to trigger
 * Playwright downloads, save them locally, return attachments metadata.
 */
async function captureDownloads(node, convId) {
  const attachments = [];
  let links = [];
  try {
    links = await node.$$eval("a", (as) =>
      as.map((a, i) => ({
        i,
        href: a.getAttribute("href") || "",
        text: (a.innerText || a.textContent || "").trim(),
        download: a.hasAttribute("download"),
      })),
    );
  } catch {
    return attachments;
  }
  const downloadable = links.filter(
    (l) =>
      l.download ||
      /^sandbox:/i.test(l.href) ||
      /^blob:/i.test(l.href) ||
      /files\.oaiusercontent|cdn\.openai\.com|chatgpt\.com\/backend/i.test(
        l.href,
      ),
  );
  if (downloadable.length === 0) return attachments;
  log("info", `Found ${downloadable.length} downloadable link(s)`, convId);
  for (const link of downloadable) {
    try {
      const anchors = await node.$$("a");
      const a = anchors[link.i];
      if (!a) continue;
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        a.click({ button: "left" }).catch(() => {}),
      ]);
      const suggested =
        download.suggestedFilename() || link.text || `file-${Date.now()}`;
      const safe = `${Date.now()}-${suggested.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const target = path.join(DOWNLOAD_DIR, safe);
      await download.saveAs(target);
      attachments.push({
        name: suggested,
        url: `/api/chat/downloads/${safe}`,
      });
      log("success", `Downloaded: ${suggested}`, convId);
    } catch (e) {
      log("warn", `Download failed for "${link.text}": ${e.message}`, convId);
    }
  }
  return attachments;
}

/**
 * Wait until the assistant response text stops growing (streaming finished).
 * Strategy:
 *  1. Wait for a NEW assistant message node to appear (count increases).
 *  2. Poll its innerText until it stops changing for ~1.5s OR a "stop"
 *     button reverts to a "send" button (streaming finished).
 */
async function waitForResponse(convId, prevAssistantCount) {
  const start = Date.now();
  const maxWait = settings.timeout;
  const assistantSelectors = [
    '[data-message-author-role="assistant"]',
    'div.markdown',
    'div.prose',
    'article[data-testid^="conversation-turn"]',
  ];

  async function getAssistantNodes() {
    for (const sel of assistantSelectors) {
      const els = await page.$$(sel).catch(() => []);
      if (els.length) return { sel, els };
    }
    return { sel: null, els: [] };
  }

  // 1. Wait for a NEW assistant message to appear
  let nodes = { sel: null, els: [] };
  while (Date.now() - start < maxWait) {
    nodes = await getAssistantNodes();
    if (nodes.els.length > prevAssistantCount) break;
    await page.waitForTimeout(400);
  }
  if (nodes.els.length <= prevAssistantCount) {
    throw new Error("No new assistant message appeared (login required?)");
  }
  log("info", `Assistant message detected, waiting for stream…`, convId);

  // 2. Poll last node until text is stable AND no "stop" button visible
  let last = "";
  let stable = 0;
  while (Date.now() - start < maxWait) {
    const fresh = await getAssistantNodes();
    const node = fresh.els[fresh.els.length - 1];
    if (!node) {
      await page.waitForTimeout(400);
      continue;
    }
    const text = (await node.innerText().catch(() => "")).trim();

    // Detect stop/streaming button
    const stopBtn = await page.$(
      'button[aria-label*="Stop" i], button[data-testid="stop-button"], button[data-testid="composer-stop-button"], button[aria-label*="Arrêter" i], button[aria-label*="Arreter" i]',
    );
    const streaming = !!stopBtn && (await stopBtn.isVisible().catch(() => false));

    if (text && text === last && !streaming) {
      stable++;
      if (stable >= 3) {
        log("success", `Response stable after ${Date.now() - start}ms`, convId);
        return text;
      }
    } else {
      stable = 0;
      last = text || last;
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
export async function sendPrompt({ url, prompt, convId, files, onScreenshot }) {
  let attempt = 0;
  let lastErr;
  while (attempt <= settings.retries) {
    attempt++;
    try {
      await ensureBrowser(convId);
      // Only navigate if we're not already on the right host
      let needsNav = !currentUrl;
      if (url && page && !page.isClosed()) {
        try {
          const current = page.url();
          if (!current || current === "about:blank") needsNav = true;
          else if (new URL(current).host !== new URL(url).host) needsNav = true;
        } catch {
          needsNav = true;
        }
      }
      if (needsNav && url) {
        await connect(url, convId);
      }

      log("info", `Locating prompt input (attempt ${attempt})`, convId);
      const target = await findPromptInput();
      if (!target) throw new Error("No prompt input found on page");

      // Count existing assistant messages so we can detect the NEW one
      const prevCount = await page
        .$$eval(
          '[data-message-author-role="assistant"], div.markdown, div.prose',
          (els) => els.length,
        )
        .catch(() => 0);

      const beforeShot = await takeScreenshot("before", convId);
      if (beforeShot && onScreenshot) onScreenshot(beforeShot);

      log("info", `Typing prompt into ${target.selector}`, convId);
      // Attach files BEFORE typing/submitting so they get uploaded
      if (files && files.length) {
        await attachFiles(files, convId);
      }
      await submitPrompt(target, prompt);
      log("info", `Prompt sent, waiting for response…`, convId);

      const response = await waitForResponse(convId, prevCount);

      const afterShot = await takeScreenshot("after", convId);
      if (afterShot && onScreenshot) onScreenshot(afterShot);

      // Try to capture any downloadable files in the latest assistant node
      let attachments = [];
      try {
        const els = await page.$$(
          '[data-message-author-role="assistant"], div.markdown, div.prose',
        );
        const lastNode = els[els.length - 1];
        if (lastNode) {
          attachments = await captureDownloads(lastNode, convId);
        }
      } catch (e) {
        log("warn", `Download capture failed: ${e.message}`, convId);
      }

      return { response, screenshot: afterShot, attachments };
    } catch (err) {
      lastErr = err;
      log("error", `Attempt ${attempt} failed: ${err.message}`, convId);
      await takeScreenshot("error", convId).then((s) => {
        if (s && onScreenshot) onScreenshot(s);
      });
      // Do NOT close the browser between retries — keeps user's login session alive.
      // Only close if explicitly requested via closeBrowser().
      if (attempt <= settings.retries) {
        log("warn", `Retrying without closing browser…`, convId);
        await page?.waitForTimeout?.(1000).catch(() => {});
      }
    }
  }
  throw lastErr || new Error("Unknown error sending prompt");
}

export async function closeBrowser() {
  if (context) {
    await context.close().catch(() => {});
  }
  context = null;
  page = null;
}

export async function readScreenshot(filename) {
  const safe = path.basename(filename);
  return fs.readFile(path.join(SHOT_DIR, safe));
}

export function downloadPath(filename) {
  return path.join(DOWNLOAD_DIR, path.basename(filename));
}