import { WebCrawler, CrawlerResult } from './crawler/webCrawler';
import {
  SearchParams,
  SiteConfig,
  searchConfigs,
  findConfigForUrl,
} from './config/crawlerConfig';

export type { SearchParams } from './config/crawlerConfig';

/** Use stderr for logging so stdout stays clean for MCP stdio transport */
function log(message: string): void {
  process.stderr.write(`[mcp-jobs] ${message}\n`);
}

/**
 * Search job listings across all configured platforms.
 * Returns a flat array of job objects.
 */
export async function searchJobList(params: SearchParams): Promise<any[]> {
  const { keyword } = params;
  if (!keyword) {
    throw new Error('keyword is required');
  }

  log(`Searching jobs: keyword="${keyword}", city="${params.city || '全国'}"`);

  const results: any[] = [];

  for (const config of searchConfigs) {
    const crawler = new WebCrawler();
    try {
      const url = config.urlBuilder(params);
      log(`Crawling ${config.name}: ${url}`);

      const result = await crawler.crawl(url, config);

      if (result.succeeded && result.data.jobInfo) {
        const jobs = result.data.jobInfo.filter(Boolean);
        results.push(...jobs);
        log(`Got ${jobs.length} jobs from ${config.name}`);
      } else if (!result.succeeded) {
        log(`Failed to crawl ${config.name}: ${result.error}`);
      }
    } catch (err: any) {
      log(`Error crawling ${config.name}: ${err.message}`);
    } finally {
      await crawler.close();
    }
  }

  log(`Search complete: ${results.length} total jobs found`);
  return results;
}

/**
 * Crawl a single job detail page by URL.
 * Automatically matches the URL to the correct site config.
 */
export async function crawlJobDetail(url: string): Promise<any | null> {
  const config = findConfigForUrl(url);
  if (!config) {
    log(`No config found for URL: ${url}`);
    return null;
  }

  const crawler = new WebCrawler();
  try {
    log(`Crawling job detail: ${url}`);
    const result = await crawler.crawl(url, config);

    if (!result.succeeded) {
      log(`Failed to crawl detail: ${result.error}`);
      return null;
    }

    // result.data.job is an array from extractData; take the first element
    const jobData = result.data.job;
    if (Array.isArray(jobData)) {
      return jobData[0] || null;
    }
    return jobData || null;
  } catch (err: any) {
    log(`Error crawling detail: ${err.message}`);
    return null;
  } finally {
    await crawler.close();
  }
}

// CLI entry point for quick testing
if (require.main === module) {
  searchJobList({ keyword: '前端开发', city: '北京', page: 1 })
    .then((result) => {
      process.stderr.write(`Found ${result.length} jobs\n`);
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    });
}
