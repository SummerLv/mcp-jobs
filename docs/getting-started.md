# 快速上手

## 环境要求

- Node.js >= 16.0.0
- pnpm（推荐）或 npm

## 安装与构建

```bash
# 克隆项目
git clone https://github.com/summerlv/mcp-jobs.git
cd mcp-jobs

# 安装依赖
pnpm install

# 安装 Playwright 浏览器（首次使用需要）
npx playwright install chromium

# 编译 TypeScript
pnpm run build
```

## 使用方式

### 1. 直接运行测试搜索

```bash
node dist/index.js
```

默认搜索 "前端开发 + 北京"，输出 JSON 格式的职位列表到 stdout。

### 2. 作为 MCP Server 启动

```bash
node dist/mcp.js
```

或通过 npx：

```bash
npx -y mcp-jobs
```

Server 通过 stdio 与 MCP 客户端通信，不会在终端产生可见输出（日志写到 stderr）。

### 3. 配置到 Claude Desktop

在 Claude Desktop 的 MCP 设置文件中添加：

```json
{
  "mcpServers": {
    "mcp-jobs": {
      "command": "node",
      "args": ["/你的路径/mcp-jobs/dist/mcp.js"]
    }
  }
}
```

配置文件位置：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

重启 Claude Desktop 后，即可在对话中使用职位搜索功能。

### 4. 配置到 Cursor

在 Cursor 的 MCP 设置中添加：

```json
{
  "mcpServers": {
    "mcp-jobs": {
      "command": "node",
      "args": ["/你的路径/mcp-jobs/dist/mcp.js"]
    }
  }
}
```

## npm scripts

| 命令 | 说明 |
|------|------|
| `pnpm run build` | 编译 TypeScript 到 dist/ |
| `pnpm run start` | 启动 MCP Server (dist/mcp.js) |
| `pnpm run dev` | 用 ts-node 直接运行 src/index.ts |

## 作为 npm 包使用

```typescript
import { searchJobList, crawlJobDetail } from 'mcp-jobs';

// 搜索职位
const jobs = await searchJobList({
  keyword: 'Java',
  city: '上海',
  salary: '21-30万',
  workYear: '3-5年',
  page: 1,
});

console.log(jobs);
// [{ title, salary, company, address, tags, jobDetail }, ...]

// 获取职位详情
const detail = await crawlJobDetail(jobs[0].jobDetail);
console.log(detail);
// { jobDescription: "...", companyDescription: "..." }
```
