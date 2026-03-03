# MCP 协议详解

本文档介绍 Model Context Protocol 的核心概念，以及 mcp-jobs 如何实现该协议。适合作为 MCP 学习材料。

## 什么是 MCP

Model Context Protocol (MCP) 是 Anthropic 提出的开放协议，用于让 AI 模型与外部工具/数据源进行标准化通信。可以类比为 "AI 时代的 USB 接口"：

- **AI 客户端**（Claude Desktop、Cursor 等）是主机
- **MCP Server**（如本项目）是外设
- **MCP 协议**是连接标准

## 传输层：stdio

mcp-jobs 使用 stdio 传输方式：

```
AI 客户端                      MCP Server
    │                              │
    │──── stdin (JSON-RPC) ──────→│   请求
    │                              │
    │←─── stdout (JSON-RPC) ──────│   响应
    │                              │
    │     stderr (日志，不解析)     │
```

这就是为什么代码中所有日志都使用 `process.stderr.write()` 而不是 `console.log()`。`console.log` 会写入 stdout，污染 JSON-RPC 通信。

## 协议流程

### 1. 初始化握手

客户端发起连接：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "claude-desktop", "version": "1.0.0" }
  }
}
```

Server 响应：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "mcp-jobs", "version": "2.0.0" }
  }
}
```

### 2. 工具发现

客户端查询可用工具：

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }
```

Server 返回工具定义（包含 JSON Schema）：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "mcp_search_job",
        "description": "搜索招聘网站上的职位信息...",
        "inputSchema": {
          "type": "object",
          "properties": {
            "keyword": { "type": "string", "description": "搜索关键词" }
          },
          "required": ["keyword"]
        }
      }
    ]
  }
}
```

### 3. 工具调用

客户端（由 AI 模型决定）调用工具：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "mcp_search_job",
    "arguments": { "keyword": "前端开发", "city": "北京" }
  }
}
```

Server 执行爬虫并返回结果：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "{\"jobs\": [...], \"metadata\": {...}}" }],
    "isError": false
  }
}
```

## mcp-jobs 中的实现

### Server 创建

```typescript
// src/mcp.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'mcp-jobs', version: '2.0.0' },       // Server 信息
  { capabilities: { tools: {} } },                // 声明支持 tools 能力
);
```

### 注册工具列表

```typescript
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SEARCH_JOB_TOOL, JOB_DETAIL_TOOL],  // 返回 Tool 对象数组
}));
```

### 注册工具调用处理器

```typescript
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // 根据 name 路由到不同的处理逻辑
  // 返回 { content: [{ type: 'text', text: '...' }], isError: boolean }
});
```

### 启动

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool 定义的 JSON Schema

MCP 使用 JSON Schema 描述工具的输入参数。AI 模型根据这个 Schema 来理解如何调用工具。

```typescript
const SEARCH_JOB_TOOL: Tool = {
  name: 'mcp_search_job',
  description: '搜索招聘网站上的职位信息...',  // AI 模型根据此描述决定何时调用
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词',              // 帮助 AI 理解参数含义
      },
      // ...
    },
    required: ['keyword'],                       // 必填参数
  },
};
```

良好的 `description` 直接影响 AI 模型调用工具的准确性。

## 核心依赖

| 包名 | 用途 |
|------|------|
| `@modelcontextprotocol/sdk` | MCP 协议的官方 TypeScript SDK |

SDK 中关键的导入路径：

```typescript
// Server 类
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// stdio 传输
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 类型和 Schema
import { Tool, CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
```

## 进一步学习

- MCP 官方文档：https://modelcontextprotocol.io
- MCP TypeScript SDK：https://github.com/modelcontextprotocol/typescript-sdk
- MCP 规范：https://spec.modelcontextprotocol.io
