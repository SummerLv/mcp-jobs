# API 参考

## MCP 工具

mcp-jobs 通过 MCP 协议暴露以下两个工具，供 AI 客户端调用。

### mcp_search_job

搜索招聘网站上的职位信息。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词，如 "前端开发"、"Java" |
| city | string | 否 | 城市名称，如 "北京"、"上海" |
| salary | string | 否 | 薪资范围，见下方枚举值 |
| workYear | string | 否 | 工作经验要求，见下方枚举值 |
| page | number | 否 | 页码，默认 1 |

**salary 可选值：**
`10万以下` / `10-15万` / `16-20万` / `21-30万` / `31-50万` / `51-100万` / `100万以上`

**workYear 可选值：**
`应届生` / `实习生` / `1年以下` / `1-3年` / `3-5年` / `5-10年` / `10年以上`

**返回格式：**

```json
{
  "jobs": [
    {
      "title": "前端开发工程师",
      "salary": "20-30k·15薪",
      "company": "某公司",
      "address": "北京-海淀区",
      "tags": ["3-5年", "本科", "互联网", "已上市"],
      "jobDetail": "https://www.liepin.com/a/xxxxx.shtml?..."
    }
  ],
  "metadata": {
    "totalResults": 42,
    "searchParams": {
      "keyword": "前端开发",
      "city": "北京",
      "page": 1
    }
  }
}
```

### mcp_job_detail

获取单个职位的详情信息。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 职位详情页 URL（来自搜索结果的 jobDetail 字段） |

**返回格式：**

```json
{
  "jobDetail": {
    "jobDescription": "岗位职责：...\n任职要求：...",
    "companyDescription": "公司简介..."
  },
  "metadata": {
    "url": "https://www.liepin.com/a/xxxxx.shtml"
  }
}
```

---

## TypeScript 函数

如果你将 mcp-jobs 作为 npm 包在代码中使用，可以直接调用以下函数。

### searchJobList(params)

```typescript
import { searchJobList } from 'mcp-jobs';

const jobs = await searchJobList({
  keyword: '前端开发',
  city: '北京',
  page: 1,
  salary: '21-30万',
  workYear: '3-5年',
});
```

**参数类型：**

```typescript
interface SearchParams {
  keyword?: string;   // 搜索关键词（实际调用时必填）
  city?: string;      // 城市
  page?: number;      // 页码
  salary?: string;    // 薪资范围
  workYear?: string;  // 工作年限
}
```

**返回值：** `Promise<any[]>` — 职位对象数组，每个对象包含 `title`、`salary`、`company`、`address`、`tags`、`jobDetail` 字段。

### crawlJobDetail(url)

```typescript
import { crawlJobDetail } from 'mcp-jobs';

const detail = await crawlJobDetail('https://www.liepin.com/a/xxxxx.shtml');
```

**参数：** `url: string` — 职位详情页 URL

**返回值：** `Promise<{ jobDescription: string, companyDescription: string } | null>`

### findConfigForUrl(url)

```typescript
import { findConfigForUrl } from 'mcp-jobs/config/crawlerConfig';

const config = findConfigForUrl('https://www.liepin.com/a/12345.shtml');
// => liepinDetailConfig
```

**参数：** `url: string` — 任意 URL

**返回值：** `SiteConfig | undefined` — 匹配的站点配置，无匹配则返回 undefined
