import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { SiteConfig, CrawlerRule } from '../config/crawlerConfig';

export interface CrawlerResult {
  url: string;
  data: Record<string, any>;
  succeeded: boolean;
  error?: string;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class WebCrawler {
  private browser: Browser | null = null;

  /** Launch browser if not already running */
  private async ensureBrowser(config?: SiteConfig): Promise<Browser> {
    if (!this.browser) {
      const headless = config?.browserConfig?.headless ?? true;
      this.browser = await chromium.launch({
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /** Crawl a single URL using the provided site config and return extracted data */
  async crawl(url: string, config: SiteConfig): Promise<CrawlerResult> {
    let page: Page | null = null;
    let context: BrowserContext | null = null;

    try {
      const browser = await this.ensureBrowser(config);
      const timeout = config.timeout || 30000;

      const userAgent = config.browserConfig?.userAgent || DEFAULT_USER_AGENT;
      const viewport = config.browserConfig?.viewport || { width: 1280, height: 800 };

      context = await browser.newContext({ userAgent, viewport });
      page = await context.newPage();

      await page.goto(url, { waitUntil: 'networkidle', timeout }).catch(() => {
        // networkidle can sometimes fail on heavy pages; fall back gracefully
      });
      // Extra wait for JS-rendered content
      await page.waitForTimeout(3000);

      const data = await this.extractData(page, config.rules);

      return { url, data, succeeded: true };
    } catch (err: any) {
      return {
        url,
        data: {},
        succeeded: false,
        error: err.message || String(err),
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  /** Extract data from the page using the rules defined in config */
  private async extractData(
    page: Page,
    rules: Record<string, CrawlerRule>,
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [key, rule] of Object.entries(rules)) {
      try {
        const elements = await page.$$(rule.selector);

        if (rule.handler) {
          // Use custom handler for each element
          const items = await Promise.all(
            elements.map((el) => rule.handler!(el)),
          );
          result[key] = items;
        } else {
          // Default extraction based on type
          const values = await Promise.all(
            elements.map(async (el) => {
              switch (rule.type) {
                case 'text':
                  return el.textContent();
                case 'attribute':
                  return el.getAttribute(rule.attribute || '');
                case 'html':
                  return el.innerHTML();
                default:
                  return null;
              }
            }),
          );
          result[key] = values;
        }
      } catch {
        result[key] = null;
      }
    }

    return result;
  }

  /** Close browser and clean up */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
