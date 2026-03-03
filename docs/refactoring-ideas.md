# 后续重构方向

本文档记录当前项目的已知不足和潜在改进方向，供后续重构参考。

## 当前已知问题

### 1. Boss 直聘 (zhipin) 无法使用

Boss 直聘对 headless 浏览器有严格的反爬检测，当前在 headless 模式下页面内容为空。zhipin 的配置代码已保留但未启用。

**可能的解决方向：**
- 研究 Playwright stealth 插件（如 `playwright-extra` + `puppeteer-extra-plugin-stealth`）
- 使用代理 IP 轮换
- 改为通过 Boss 直聘的移动端 API 直接请求

### 2. 无类型安全的返回值

`searchJobList` 和 `crawlJobDetail` 返回 `any[]` 和 `any`，丢失了类型信息。

**改进：**

```typescript
interface JobListItem {
  title: string;
  salary: string;
  company: string;
  address: string;
  tags: string[];
  jobDetail: string;
}

interface JobDetail {
  jobDescription: string;
  companyDescription: string;
}

function searchJobList(params: SearchParams): Promise<JobListItem[]>;
function crawlJobDetail(url: string): Promise<JobDetail | null>;
```

### 3. 没有错误重试机制

网络请求可能因为超时或临时错误失败。目前单次失败直接返回空结果。

**改进：** 增加简单的重试逻辑。

### 4. 搜索只支持逐个平台串行

当前 `searchJobList` 用 `for...of` 串行爬取每个平台。当支持多个平台时，应该并行爬取。

**改进：**

```typescript
const results = await Promise.allSettled(
  searchConfigs.map(async (config) => {
    const crawler = new WebCrawler();
    try {
      const url = config.urlBuilder(params);
      return await crawler.crawl(url, config);
    } finally {
      await crawler.close();
    }
  })
);
```

### 5. 无单元测试

项目缺少测试覆盖。

**改进方向：**
- 用 vitest 或 jest 作为测试框架
- 对 `urlBuilder` 函数编写纯函数测试
- 对 `extractData` 用 mock page 做单元测试
- 对完整流程做集成测试（可以缓存 HTML 快照）

### 6. 选择器维护成本高

招聘网站频繁改版，CSS 选择器容易失效。

**改进方向：**
- 添加选择器健康检查：定时验证每个平台的选择器是否仍然有效
- 使用更稳定的选择器策略（`data-*` 属性 > 语义化类名 > 结构选择器 > 随机类名）
- 将选择器配置外部化为 JSON/YAML，无需改代码即可更新

## 架构级重构

### 引入缓存层

避免短时间内重复爬取相同内容：

```
请求 → 检查缓存 → 命中: 返回缓存
                 → 未命中: 爬取 → 写入缓存 → 返回
```

### 支持更多 MCP 能力

当前只使用了 `tools` 能力。MCP 还支持：
- `resources`：将搜索历史暴露为可读资源
- `prompts`：预定义提示词模板，如 "帮我找北京的前端开发岗位"

### 配置外部化

将站点配置从代码中抽离到 JSON/YAML 文件：

```yaml
# sites/liepin.yaml
name: liepin
urlPattern: "^https://www\\.liepin\\.com/zhaopin/"
urlTemplate: "https://www.liepin.com/zhaopin/?key={keyword}&currentPage={page}"
selectors:
  container: ".job-card-pc-container"
  title: "a[data-nick='job-detail-job-info'] .ellipsis-1[title]"
  salary: "..."
```

好处是更新选择器不需要重新编译 TypeScript。

### 插件化平台接入

设计一个 Platform 接口，让每个招聘平台成为独立插件：

```typescript
interface Platform {
  name: string;
  search(params: SearchParams): Promise<JobListItem[]>;
  detail(url: string): Promise<JobDetail | null>;
  healthCheck(): Promise<boolean>;
}
```
