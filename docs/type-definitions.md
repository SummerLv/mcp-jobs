# 类型定义

本文档列出项目中所有 TypeScript 接口和类型，帮助理解数据结构。

## 配置层类型 (crawlerConfig.ts)

### SearchParams

搜索参数，用户通过 MCP 工具或函数调用传入。

```typescript
interface SearchParams {
  keyword?: string;   // 搜索关键词
  city?: string;      // 城市名称
  page?: number;      // 页码
  salary?: string;    // 薪资范围
  workYear?: string;  // 工作年限要求
}
```

### SiteConfig

站点爬取配置。每个支持的招聘网站（或页面类型）对应一个 SiteConfig。

```typescript
interface SiteConfig {
  name: string;                          // 站点标识，如 "liepin"、"zhipin-detail"
  urlPattern: RegExp;                    // URL 匹配正则，用于 findConfigForUrl
  urlBuilder: (params: SearchParams) => string;  // 根据搜索参数构建完整 URL
  rules: Record<string, CrawlerRule>;    // 数据提取规则（key 是字段名）
  browserConfig?: BrowserConfig;         // 该站点特有的浏览器配置
  timeout?: number;                      // 页面加载超时时间（毫秒）
}
```

### CrawlerRule

单条数据提取规则，定义如何从页面中取出特定数据。

```typescript
interface CrawlerRule {
  selector: string;      // CSS 选择器，用于定位页面元素
  type: 'text' | 'attribute' | 'html';  // 默认提取方式（无 handler 时生效）
  attribute?: string;    // type 为 'attribute' 时指定属性名
  handler?: (element: ElementHandle<Element>) => Promise<any>;
  // 自定义提取函数，接收 Playwright ElementHandle，返回结构化数据
}
```

**提取方式说明：**

| type | 行为 | 适用场景 |
|------|------|----------|
| `text` | `element.textContent()` | 纯文本内容 |
| `attribute` | `element.getAttribute(attribute)` | 链接 href、图片 src 等 |
| `html` | `element.innerHTML()` | 需要保留 HTML 结构 |
| handler | 自定义逻辑 | 复杂数据提取（多字段、嵌套元素） |

当同时定义了 `handler` 和 `type` 时，`handler` 优先。

### BrowserConfig

浏览器配置，可在站点级别覆盖默认值。

```typescript
interface BrowserConfig {
  headless?: boolean;                    // 是否无头模式（默认 true）
  timeout?: number;                      // 超时时间
  viewport?: { width: number; height: number };  // 视窗大小
  userAgent?: string;                    // User-Agent 字符串
}
```

## 爬虫层类型 (webCrawler.ts)

### CrawlerResult

单次爬取的返回结果。

```typescript
interface CrawlerResult {
  url: string;                    // 爬取的 URL
  data: Record<string, any>;     // 提取的数据（key 对应 CrawlerRule 的 key）
  succeeded: boolean;            // 是否成功
  error?: string;                // 失败时的错误信息
}
```

**data 结构示例（搜索页）：**

```typescript
{
  jobInfo: [
    { title: "前端开发", salary: "20-30k", company: "xxx", ... },
    { title: "Java工程师", salary: "25-40k", company: "yyy", ... },
  ]
}
```

**data 结构示例（详情页）：**

```typescript
{
  job: [
    { jobDescription: "岗位职责...", companyDescription: "公司介绍..." }
  ]
}
```

注意 `data` 中的值始终是数组（因为选择器可能匹配到多个元素）。业务层在使用时需要处理这一点。

## 类型关系图

```
SearchParams ──→ SiteConfig.urlBuilder() ──→ URL string
                     │
                     ├── SiteConfig.rules ──→ CrawlerRule[]
                     │                           │
                     │                           └── handler(ElementHandle) ──→ any
                     │
                     └── SiteConfig.browserConfig ──→ BrowserConfig
                                                         │
                                                         └── WebCrawler.ensureBrowser()

WebCrawler.crawl(url, config) ──→ CrawlerResult { data, succeeded, error }
```
