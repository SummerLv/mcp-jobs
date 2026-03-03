# 爬虫开发指南

本文档介绍 mcp-jobs 的爬虫工作原理，以及如何添加新的招聘网站支持。

## Playwright 基础

mcp-jobs 使用 [Playwright](https://playwright.dev/) 驱动 Chromium 浏览器进行页面抓取。相比 HTTP 请求 + HTML 解析的方式，Playwright 的优势是能处理 JavaScript 渲染的动态页面。

### 核心 API（项目中使用到的）

```typescript
import { chromium, Browser, BrowserContext, Page, ElementHandle } from 'playwright';

// 启动浏览器
const browser = await chromium.launch({ headless: true });

// 创建上下文（隔离的浏览器环境）
const context = await browser.newContext({
  userAgent: '...',
  viewport: { width: 1280, height: 800 },
});

// 创建页面
const page = await context.newPage();

// 导航
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

// CSS 选择器查询
const elements = await page.$$('.job-card');           // 多个元素
const element = await page.$('.job-title');            // 单个元素

// 从元素中提取数据
const text = await element.textContent();              // 文本内容
const html = await element.innerHTML();                // HTML
const href = await element.getAttribute('href');       // 属性

// 在元素内部查询子元素
const title = await element.$eval('.title', el => el.textContent?.trim() || '');
const tags = await element.$$eval('span', els => els.map(el => el.textContent));

// 在元素的上下文中执行 JavaScript
const data = await element.evaluate(el => {
  // 这里的代码在浏览器中运行，不是 Node.js
  return el.querySelector('.price')?.textContent || '';
});

// 清理
await page.close();
await context.close();
await browser.close();
```

### $eval vs evaluate

这是初学者常困惑的地方：

```typescript
// $eval: 先用 CSS 选择器找到子元素，再对该元素执行函数
await element.$eval('.title', el => el.textContent);
// 等价于: element.querySelector('.title') 然后 .textContent

// evaluate: 直接对当前元素执行函数
await element.evaluate(el => el.querySelector('.title')?.textContent);
// 等价但更灵活，可以执行任意 DOM 操作

// $$eval: 对所有匹配元素执行函数
await element.$$eval('span', els => els.map(el => el.textContent));
// 等价于: element.querySelectorAll('span').map(...)
```

## WebCrawler 类

`src/crawler/webCrawler.ts` 是爬虫引擎，提供两个公开方法：

```typescript
class WebCrawler {
  // 爬取单个 URL，使用指定配置提取数据
  async crawl(url: string, config: SiteConfig): Promise<CrawlerResult>;

  // 关闭浏览器，释放资源
  async close(): Promise<void>;
}
```

### crawl() 的内部流程

```
1. ensureBrowser()  → 启动 Chromium（如果尚未启动）
2. browser.newContext()  → 创建隔离的浏览器上下文（设置 UA、viewport）
3. context.newPage()  → 新建页面
4. page.goto(url)  → 导航到目标 URL，等待 networkidle
5. page.waitForTimeout(3000)  → 额外等待 JS 渲染
6. extractData(page, rules)  → 根据 CrawlerRule 提取数据
7. 返回 CrawlerResult
8. finally: 关闭 page 和 context
```

### extractData() 逻辑

```typescript
for (const [key, rule] of Object.entries(rules)) {
  const elements = await page.$$(rule.selector);  // 找到所有匹配元素

  if (rule.handler) {
    // 有自定义 handler：对每个元素调用 handler
    result[key] = await Promise.all(elements.map(el => rule.handler(el)));
  } else {
    // 无 handler：按 type 提取（text / attribute / html）
    result[key] = await Promise.all(elements.map(el => ...));
  }
}
```

## 如何添加新的招聘网站

以添加 "智联招聘" 为例：

### 步骤 1：分析目标页面

1. 用浏览器打开智联招聘搜索页面
2. 打开开发者工具 (F12)
3. 找到职位列表的 CSS 选择器
4. 确定每个职位卡片中各字段的选择器

### 步骤 2：编写 SiteConfig

在 `src/config/crawlerConfig.ts` 中添加：

```typescript
const zhaopin SearchConfig: SiteConfig = {
  name: 'zhaopin',

  // URL 正则匹配
  urlPattern: /^https:\/\/www\.zhaopin\.com\/sou/,

  // 根据搜索参数构建 URL
  urlBuilder: (params) => {
    const { keyword = '', page = 1 } = params;
    return `https://www.zhaopin.com/sou/?kw=${encodeURIComponent(keyword)}&p=${page}`;
  },

  // 数据提取规则
  rules: {
    jobInfo: {
      selector: '.joblist-box__item',  // 职位卡片选择器
      type: 'html',
      handler: async (element) => {
        const title = await element.$eval('.iteminfo__line1__jobname', el =>
          el.textContent?.trim() || ''
        ).catch(() => '');

        const salary = await element.$eval('.iteminfo__line1__salary', el =>
          el.textContent?.trim() || ''
        ).catch(() => '');

        // ... 其他字段

        return { title, salary, company, address, tags, jobDetail };
      },
    },
  },

  timeout: 30000,
};
```

### 步骤 3：注册到搜索列表

```typescript
export const searchConfigs: SiteConfig[] = [
  liepinSearchConfig,
  zhaopinSearchConfig,  // 添加到这里
];
```

如果还需要支持详情页，额外创建一个 detail config 并加入 `allConfigs`。

### 步骤 4：处理反爬

招聘网站常见的反爬手段和应对：

| 反爬手段 | 应对方式 |
|----------|----------|
| User-Agent 检测 | 在 BrowserConfig 中设置真实 UA |
| headless 检测 | 设置 `headless: false` 调试，确认页面正常后再切回 |
| IP 限频 | 控制请求频率，必要时加 `waitForTimeout` |
| 登录墙 | 目前无法处理，跳过该平台 |
| CSS 类名混淆 | 使用 `data-*` 属性、结构选择器代替类名选择器 |

### 关于 .catch(() => '')

项目中大量使用了这个模式：

```typescript
const title = await element.$eval('.title', el => el.textContent?.trim() || '').catch(() => '');
```

这是因为 `$eval` 在找不到匹配元素时会抛出异常。`.catch(() => '')` 确保单个字段提取失败不会导致整条记录失败。这是爬虫开发中的防御性编程实践。

## 调试技巧

### 1. 非 headless 模式查看浏览器

在对应的 SiteConfig 中设置：

```typescript
browserConfig: {
  headless: false,
}
```

### 2. 用 Node.js 脚本快速测试选择器

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.liepin.com/zhaopin/?key=前端开发');
  await page.waitForTimeout(5000);

  // 在这里测试选择器
  const items = await page.$$('.job-card-pc-container');
  console.log('Found:', items.length);

  // 不关闭浏览器，方便手动检查
  // await browser.close();
})();
```

### 3. 查看页面实际 HTML

```javascript
const html = await page.content();
require('fs').writeFileSync('debug.html', html);
```
