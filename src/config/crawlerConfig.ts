import { ElementHandle } from 'playwright';

export interface CrawlerRule {
  selector: string;
  type: 'text' | 'attribute' | 'html';
  attribute?: string;
  handler?: (element: ElementHandle<Element>) => Promise<any>;
}

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  viewport?: { width: number; height: number };
  userAgent?: string;
}

export interface SiteConfig {
  name: string;
  urlPattern: RegExp;
  urlBuilder: (params: SearchParams) => string;
  rules: Record<string, CrawlerRule>;
  browserConfig?: BrowserConfig;
  timeout?: number;
}

export interface SearchParams {
  keyword?: string;
  city?: string;
  page?: number;
  salary?: string;
  workYear?: string;
}

// ============================================================
// 猎聘 - liepin
// ============================================================

const liepinSalaryMap: Record<string, string> = {
  '10万以下': '1',
  '10-15万': '2',
  '16-20万': '3',
  '21-30万': '4',
  '31-50万': '5',
  '51-100万': '6',
  '100万以上': '7',
};

const liepinWorkYearMap: Record<string, string> = {
  '应届生': '1',
  '实习生': '2',
  '1年以下': '0$1',
  '1-3年': '1$3',
  '3-5年': '3$5',
  '5-10年': '5$10',
  '10年以上': '10$999',
};

const liepinSearchConfig: SiteConfig = {
  name: 'liepin',
  urlPattern: /^https:\/\/www\.liepin\.com\/zhaopin\//,
  urlBuilder: (params) => {
    const { keyword = '', salary = '', workYear = '', page = 1 } = params;
    const salaryCode = liepinSalaryMap[salary] || '';
    const workYearCode = liepinWorkYearMap[workYear] || '';
    return `https://www.liepin.com/zhaopin/?city=000&dq=000&key=${encodeURIComponent(keyword)}&currentPage=${page}&salaryCode=${salaryCode}&workYearCode=${workYearCode}`;
  },
  rules: {
    jobInfo: {
      selector: '.job-card-pc-container',
      type: 'html',
      handler: async (element) => {
        // Liepin uses obfuscated class names, so we rely on structural
        // selectors and data-nick attributes which are more stable.
        const jobLink = await element.$('a[data-nick="job-detail-job-info"]');
        const companyBox = await element.$('div[data-nick="job-detail-company-info"]');

        const title = await jobLink?.$eval('.ellipsis-1[title]', el => el.textContent?.trim() || '').catch(() => '');
        const jobDetail = await jobLink?.getAttribute('href') || '';

        // Salary is the last span in the first div inside the link
        const salary = await jobLink?.evaluate(el => {
          const spans = el.querySelectorAll(':scope > div:first-child > span');
          return spans[spans.length - 1]?.textContent?.trim() || '';
        }).catch(() => '');

        // Address is inside nested spans around the 【】brackets
        const address = await jobLink?.evaluate(el => {
          const addrDiv = el.querySelector(':scope > div:first-child > div > div:nth-child(2)');
          if (addrDiv) {
            return addrDiv.textContent?.replace(/[【】]/g, '').trim() || '';
          }
          return '';
        }).catch(() => '');

        // Tags: experience & education from the second row inside the link
        const tags = await jobLink?.evaluate(el => {
          const tagRow = el.querySelector(':scope > div:nth-child(2)');
          if (!tagRow) return [];
          return Array.from(tagRow.querySelectorAll('span')).map(s => s.textContent?.trim() || '');
        }).catch(() => [] as string[]);

        // Company name and industry from the company-info section
        const company = await companyBox?.evaluate(el => {
          const spans = el.querySelectorAll('span.ellipsis-1');
          return spans[0]?.textContent?.trim() || '';
        }).catch(() => '');

        const companyTags = await companyBox?.evaluate(el => {
          const infoDiv = el.querySelector('.ellipsis-1:not(span)');
          if (!infoDiv) return [];
          return Array.from(infoDiv.querySelectorAll('span')).map(s => s.textContent?.trim() || '');
        }).catch(() => [] as string[]);

        return {
          title: title || '',
          salary: salary || '',
          company: company || '',
          address: address || '',
          tags: [...(tags || []), ...(companyTags || [])],
          jobDetail,
        };
      },
    },
  },
  timeout: 30000,
};

const liepinDetailConfig: SiteConfig = {
  name: 'liepin-detail',
  urlPattern: /^https:\/\/www\.liepin\.com\/(job|a)\//,
  urlBuilder: (params) => '', // not used for detail pages
  rules: {
    job: {
      selector: 'body',
      type: 'html',
      handler: async (element) => {
        const jobDescription = await element.$eval('.job-intro-container dd', el => el.textContent?.trim() || '').catch(() => '');
        const companyDescription = await element.$eval('.company-intro-container .ellipsis-3', el => el.textContent?.trim() || '').catch(() => '');
        return { jobDescription, companyDescription };
      },
    },
  },
  timeout: 30000,
};

// ============================================================
// BOSS直聘 - zhipin (mobile)
// ============================================================

const zhipinSalaryMap: Record<string, string> = {
  '10万以下': 'sel-salary-1',
  '10-15万': 'sel-salary-2',
  '16-20万': 'sel-salary-3',
  '21-30万': 'sel-salary-4',
  '31-50万': 'sel-salary-5',
  '51-100万': 'sel-salary-6',
  '100万以上': 'sel-salary-7',
};

const zhipinWorkYearMap: Record<string, string> = {
  '应届生': 'e_102',
  '实习生': 'e_108',
  '1年以下': 'e_103',
  '1-3年': 'e_104',
  '3-5年': 'e_105',
  '5-10年': 'e_106',
  '10年以上': 'e_107',
};

const zhipinSearchConfig: SiteConfig = {
  name: 'zhipin',
  urlPattern: /^https:\/\/m\.zhipin\.com\/c100010000/,
  urlBuilder: (params) => {
    const { keyword = '', salary = '', workYear = '', page = 1 } = params;
    const salaryCode = zhipinSalaryMap[salary] || '';
    const workYearCode = zhipinWorkYearMap[workYear] || '';
    return `https://m.zhipin.com/c100010000/${workYearCode}?ka=${salaryCode}&page=${page}&query=${encodeURIComponent(keyword)}`;
  },
  rules: {
    jobInfo: {
      selector: 'li.item',
      type: 'html',
      handler: async (element) => {
        const title = await element.$eval('.title-text', el => el.textContent?.trim() || '').catch(() => '');
        const salary = await element.$eval('.salary', el => el.textContent?.trim() || '').catch(() => '');
        const company = await element.$eval('.company', el => el.textContent?.trim() || '').catch(() => '');
        const address = await element.$eval('.workplace', el => el.textContent?.trim() || '').catch(() => '');
        const jobDetail = await element.$eval('a', el => {
          const href = el.getAttribute('href') || '';
          return href.startsWith('https://') ? href : `https://m.zhipin.com${href}`;
        }).catch(() => '');
        const tags = await element.$$eval('.labels span', els =>
          els.map(el => el.textContent?.trim() || '')
        ).catch(() => [] as string[]);

        return { title, salary, company, address, jobDetail, tags };
      },
    },
  },
  timeout: 30000,
};

const zhipinDetailConfig: SiteConfig = {
  name: 'zhipin-detail',
  urlPattern: /^https:\/\/m\.zhipin\.com\/job_detail\//,
  urlBuilder: (params) => '', // not used for detail pages
  rules: {
    job: {
      selector: '.job-detail',
      type: 'html',
      handler: async (element) => {
        const jobDescription = await element.$eval('.job-sec > .text', el => el.textContent?.trim() || '').catch(() => '');
        const companyDescription = await element.$eval('.job-sec > .detail-text', el => el.textContent?.trim() || '').catch(() => '');
        return { jobDescription, companyDescription };
      },
    },
  },
  timeout: 30000,
};

// ============================================================
// Exports
// ============================================================

/** All site configs for search pages.
 * NOTE: zhipin (Boss直聘) is excluded because it blocks headless browsers.
 * To re-enable, add zhipinSearchConfig to this array. */
export const searchConfigs: SiteConfig[] = [
  liepinSearchConfig,
];

/** All site configs (search + detail) for URL matching */
export const allConfigs: SiteConfig[] = [
  zhipinSearchConfig,
  zhipinDetailConfig,
  liepinSearchConfig,
  liepinDetailConfig,
];

/** Find matching config for a given URL */
export function findConfigForUrl(url: string): SiteConfig | undefined {
  return allConfigs.find(config => config.urlPattern.test(url));
}
