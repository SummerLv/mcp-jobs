# 项目架构

## 总体概览

mcp-jobs 是一个基于 Model Context Protocol (MCP) 的招聘信息聚合搜索工具。它通过 Playwright 驱动无头浏览器爬取招聘网站，将结构化数据通过 MCP 协议暴露给 AI 客户端（如 Claude Desktop、Cursor 等）。

## 目录结构

```
mcp-jobs/
├── src/
│   ├── config/
│   │   └── crawlerConfig.ts   # 站点配置：URL 模式、选择器规则、参数映射
│   ├── crawler/
│   │   └── webCrawler.ts      # 爬虫引擎：浏览器管理、页面抓取、数据提取
│   ├── index.ts               # 业务入口：searchJobList / crawlJobDetail
│   └── mcp.ts                 # MCP Server：工具定义、请求路由、stdio 通信
├── dist/                      # TypeScript 编译产物
├── package.json
└── tsconfig.json
```

## 分层设计

```
┌─────────────────────────────────────────────┐
│  AI 客户端 (Claude Desktop / Cursor / etc)  │
└──────────────────┬──────────────────────────┘
                   │ JSON-RPC over stdio
┌──────────────────▼──────────────────────────┐
│  mcp.ts — MCP Server 层                     │
│  - 定义 Tool (mcp_search_job / mcp_job_detail) │
│  - 参数验证                                  │
│  - 请求路由                                  │
│  - 响应格式化                                │
└──────────────────┬──────────────────────────┘
                   │ 函数调用
┌──────────────────▼──────────────────────────┐
│  index.ts — 业务逻辑层                       │
│  - searchJobList(): 遍历平台，汇总结果       │
│  - crawlJobDetail(): URL 匹配配置，获取详情  │
└──────────────────┬──────────────────────────┘
                   │ 实例化 WebCrawler
┌──────────────────▼──────────────────────────┐
│  webCrawler.ts — 爬虫引擎层                  │
│  - 管理 Chromium 浏览器生命周期              │
│  - 页面导航、等待渲染                        │
│  - 根据 CrawlerRule 提取数据                 │
└──────────────────┬──────────────────────────┘
                   │ 读取规则
┌──────────────────▼──────────────────────────┐
│  crawlerConfig.ts — 配置层                   │
│  - 每个站点的 SiteConfig                     │
│  - URL 构建器 (urlBuilder)                   │
│  - CSS 选择器 + handler 函数                 │
│  - 参数映射表 (薪资/经验 → 站点编码)          │
└─────────────────────────────────────────────┘
```

## 数据流

### 搜索流程

```
1. MCP Client → mcp_search_job { keyword: "前端开发", city: "北京" }
2. mcp.ts 解析参数，调用 searchJobList(params)
3. index.ts 遍历 searchConfigs（当前仅 liepin）
4. 对每个平台：
   a. config.urlBuilder(params) 生成搜索 URL
   b. new WebCrawler() → crawler.crawl(url, config)
   c. Playwright 启动浏览器 → 导航 → 等待渲染
   d. extractData() 用 config.rules 中的 selector 定位元素
   e. handler 函数从每个元素中提取字段
   f. 返回 CrawlerResult { data: { jobInfo: [...] } }
5. 汇总所有平台结果为扁平数组
6. mcp.ts 包装为 JSON 响应返回客户端
```

### 详情流程

```
1. MCP Client → mcp_job_detail { url: "https://www.liepin.com/a/xxx.shtml" }
2. mcp.ts 调用 crawlJobDetail(url)
3. index.ts 用 findConfigForUrl(url) 匹配到 liepin-detail 配置
4. WebCrawler 导航到详情页，用 rules 提取 jobDescription / companyDescription
5. 返回详情对象
```

## 关键设计决策

### 为什么用 Playwright 而不是 HTTP 请求

招聘网站普遍使用 JavaScript 渲染内容，简单的 HTTP 请求拿不到实际数据。Playwright 驱动真实浏览器可以：
- 执行页面 JavaScript
- 等待异步数据加载
- 模拟真实用户的浏览器环境

### 为什么日志写 stderr 而不是 stdout

MCP 使用 stdio 传输协议，stdout 专门用于 JSON-RPC 消息通信。任何非协议内容写入 stdout 都会破坏通信。因此所有日志统一通过 `process.stderr.write()` 输出。

### 为什么每次搜索都创建新的 WebCrawler 实例

每个 WebCrawler 管理独立的浏览器生命周期。搜索完成后立即 `close()` 释放资源，避免浏览器进程泄漏。对于 MCP Server 这种长时间运行的场景，资源及时释放比复用更重要。
