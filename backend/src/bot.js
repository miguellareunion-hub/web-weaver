import { chromium } from "playwright";
import { log } from "./logger.js";
import { updateTask, persistResult } from "./store.js";

const abortControllers = new Map();

export function stopTask(id) {
  const ctl = abortControllers.get(id);
  if (ctl) ctl.abort();
}

export async function runTask(task) {
  const { id, config } = task;
  const ctl = new AbortController();
  abortControllers.set(id, ctl);
  const start = Date.now();

  updateTask(id, { status: "running", progress: 0.05, currentUrl: config.url });
  log("info", `Launching browser (headless=${config.headless ?? true})`, id);

  let browser;
  try {
    browser = await chromium.launch({ headless: config.headless ?? true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; ScrapeBot/0.1; +https://example.com)",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    page.on("console", (msg) => log("debug", `page: ${msg.text()}`, id));

    log("info", `Navigating to ${config.url}`, id);
    updateTask(id, { progress: 0.15 });
    await page.goto(config.url, {
      waitUntil: "domcontentloaded",
      timeout: config.timeout ?? 30000,
    });

    if (config.waitFor) {
      log("info", `Waiting for selector: ${config.waitFor}`, id);
      await page.waitForSelector(config.waitFor, {
        timeout: config.timeout ?? 30000,
      });
    }
    updateTask(id, { progress: 0.4 });

    if (Array.isArray(config.clicks)) {
      for (const sel of config.clicks) {
        if (ctl.signal.aborted) throw new Error("aborted");
        log("info", `Click: ${sel}`, id);
        await page.click(sel, { timeout: 5000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      }
    }

    if (config.scroll) {
      log("info", "Auto-scrolling", id);
      await autoScroll(page);
    }
    updateTask(id, { progress: 0.6 });

    log("info", "Extracting data", id);
    const data = await extract(page, config.rules);
    updateTask(id, { progress: 0.8 });

    let screenshot;
    if (config.screenshot !== false) {
      const buf = await page.screenshot({ fullPage: false, type: "png" });
      screenshot = buf.toString("base64");
    }

    const html = await page.content();
    const result = {
      taskId: id,
      url: page.url(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      html,
      screenshot,
      data,
    };

    const updated = updateTask(id, {
      status: "success",
      progress: 1,
      result,
    });
    await persistResult(updated);
    log("success", `Done in ${result.durationMs}ms`, id);
  } catch (err) {
    const aborted = ctl.signal.aborted || /aborted/i.test(String(err?.message));
    const updated = updateTask(id, {
      status: aborted ? "stopped" : "error",
      error: err?.message ?? String(err),
    });
    if (updated) await persistResult(updated).catch(() => {});
    log(aborted ? "warn" : "error", `Task ended: ${err?.message ?? err}`, id);
  } finally {
    abortControllers.delete(id);
    if (browser) await browser.close().catch(() => {});
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const dist = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, dist);
        total += dist;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function extract(page, rules) {
  // Default extraction: title, meta, headings, links, images, tables.
  const base = await page.evaluate(() => {
    const text = (el) => (el?.textContent || "").trim();
    const headings = ["h1", "h2", "h3"].flatMap((t) =>
      Array.from(document.querySelectorAll(t)).map((el) => ({
        tag: t,
        text: text(el),
      })),
    );
    const links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 200)
      .map((a) => ({ text: text(a), href: a.href }));
    const images = Array.from(document.querySelectorAll("img[src]"))
      .slice(0, 100)
      .map((i) => i.src);
    const tables = Array.from(document.querySelectorAll("table"))
      .slice(0, 10)
      .map((table) =>
        Array.from(table.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.querySelectorAll("th,td")).map((c) =>
            (c.textContent || "").trim(),
          ),
        ),
      );
    return {
      title: document.title,
      description:
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || null,
      headings,
      links,
      images,
      tables,
      stats: {
        headings: headings.length,
        links: links.length,
        images: images.length,
        tables: tables.length,
      },
    };
  });

  if (Array.isArray(rules) && rules.length) {
    base.custom = {};
    for (const rule of rules) {
      try {
        if (rule.type === "list") {
          base.custom[rule.name] = await page.$$eval(rule.selector, (els) =>
            els.map((e) => (e.textContent || "").trim()),
          );
        } else if (rule.type === "attr" && rule.attr) {
          base.custom[rule.name] = await page.$eval(
            rule.selector,
            (e, a) => e.getAttribute(a),
            rule.attr,
          );
        } else if (rule.type === "html") {
          base.custom[rule.name] = await page.$eval(
            rule.selector,
            (e) => e.innerHTML,
          );
        } else {
          base.custom[rule.name] = await page.$eval(rule.selector, (e) =>
            (e.textContent || "").trim(),
          );
        }
      } catch (e) {
        base.custom[rule.name] = { error: String(e.message ?? e) };
      }
    }
  }

  return base;
}