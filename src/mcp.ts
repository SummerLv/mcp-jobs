#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  Tool,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchJobList, crawlJobDetail, SearchParams } from './index';

// ============================================================
// Tool definitions
// ============================================================

const SEARCH_JOB_TOOL: Tool = {
  name: 'mcp_search_job',
  description:
    '搜索招聘网站上的职位信息，返回职位名称、公司、薪资、地点、标签等。目前支持 Boss直聘 和 猎聘。',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词，如"前端开发"、"Java"等',
      },
      city: {
        type: 'string',
        description: '城市名称，如"北京"、"上海"（可选）',
      },
      salary: {
        type: 'string',
        description: '薪资范围，如"10-15万"、"21-30万"（可选）',
      },
      workYear: {
        type: 'string',
        description: '工作经验要求，如"1-3年"、"3-5年"（可选）',
      },
      page: {
        type: 'number',
        description: '页码，默认1',
      },
    },
    required: ['keyword'],
  },
};

const JOB_DETAIL_TOOL: Tool = {
  name: 'mcp_job_detail',
  description:
    '获取单个职位的详情信息，包括职位描述和公司介绍。需要提供职位详情页 URL（来自搜索结果的 jobDetail 字段）。',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '职位详情页 URL',
      },
    },
    required: ['url'],
  },
};

// ============================================================
// Server setup
// ============================================================

const server = new Server(
  { name: 'mcp-jobs', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SEARCH_JOB_TOOL, JOB_DETAIL_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [{ type: 'text', text: '错误: 未提供调用参数' }],
      isError: true,
    };
  }

  try {
    switch (name) {
      case 'mcp_search_job': {
        const keyword = args.keyword as string;
        if (!keyword) {
          return {
            content: [{ type: 'text', text: '错误: keyword 参数是必须的' }],
            isError: true,
          };
        }

        const params: SearchParams = {
          keyword,
          city: args.city as string | undefined,
          salary: args.salary as string | undefined,
          workYear: args.workYear as string | undefined,
          page: args.page as number | undefined,
        };

        const jobs = await searchJobList(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                jobs,
                metadata: {
                  totalResults: jobs.length,
                  searchParams: params,
                },
              }),
            },
          ],
          isError: false,
        };
      }

      case 'mcp_job_detail': {
        const url = args.url as string;
        if (!url) {
          return {
            content: [{ type: 'text', text: '错误: url 参数是必须的' }],
            isError: true,
          };
        }

        const detail = await crawlJobDetail(url);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                jobDetail: detail,
                metadata: { url },
              }),
            },
          ],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `未知工具: ${name}` }],
          isError: true,
        };
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text',
          text: `错误: ${err.message || String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// Start
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[mcp-jobs] Server started\n');
}

main().catch((err) => {
  process.stderr.write(`[mcp-jobs] Fatal: ${err.message}\n`);
  process.exit(1);
});
