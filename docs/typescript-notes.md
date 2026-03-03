# TypeScript / JavaScript 学习笔记

本文档梳理项目中用到的 TypeScript 和 JavaScript 关键知识点，方便学习参考。

## TypeScript 基础

### 接口 (interface)

项目中大量使用接口定义数据结构：

```typescript
// 定义数据形状
interface CrawlerResult {
  url: string;
  data: Record<string, any>;
  succeeded: boolean;
  error?: string;          // ? 表示可选字段
}

// 函数参数类型约束
function crawl(url: string, config: SiteConfig): Promise<CrawlerResult> { ... }
```

### 泛型工具类型

```typescript
Record<string, any>        // 等价于 { [key: string]: any }，任意键值对象
Record<string, CrawlerRule> // 键为 string，值为 CrawlerRule 的对象
Promise<any[]>             // 异步返回一个 any 数组
Partial<SiteConfig>        // SiteConfig 的所有字段变为可选
```

### 类型断言

```typescript
const keyword = args.keyword as string;         // 告诉编译器这是 string
const detail = args.url as string | undefined;  // 联合类型
```

### 非空断言

```typescript
this.browser!              // ! 断言非 null/undefined，等价于 "我确定它有值"
config?.browserConfig      // ? 可选链：如果 config 是 null/undefined 则短路返回 undefined
config?.headless ?? true   // ?? 空值合并：左侧为 null/undefined 时使用右侧默认值
```

### 区分 `??` 和 `||`

```typescript
false ?? true   // => false  （?? 只对 null/undefined 生效）
false || true   // => true   （|| 对所有 falsy 值生效：0, "", false, null, undefined）

0 ?? 42         // => 0
0 || 42         // => 42
```

## 异步编程

### async / await

项目中几乎所有函数都是异步的，因为 Playwright 操作都返回 Promise：

```typescript
// async 函数总是返回 Promise
async function searchJobList(params: SearchParams): Promise<any[]> {
  const result = await crawler.crawl(url, config);  // 暂停，等待完成
  return results;
}
```

### Promise.all — 并行执行

```typescript
// 对每个元素并行调用 handler，而不是一个一个等
const items = await Promise.all(
  elements.map((el) => rule.handler!(el))
);
```

对比顺序执行：

```typescript
// 慢：一个接一个
const items = [];
for (const el of elements) {
  items.push(await rule.handler!(el));
}
```

### try/catch/finally 资源管理

```typescript
const crawler = new WebCrawler();
try {
  const result = await crawler.crawl(url, config);
  // 正常处理...
} catch (err: any) {
  // 错误处理...
} finally {
  await crawler.close();   // 无论成功失败，都关闭浏览器
}
```

`finally` 保证资源一定被释放。

### .catch() 链式错误处理

```typescript
// 方式1: try/catch
try {
  await page.goto(url);
} catch {
  // 处理错误
}

// 方式2: .catch()（更简洁，常用于不需要详细错误处理时）
await page.goto(url).catch(() => {});  // 忽略错误，继续执行
```

## 模块系统

### CommonJS (本项目使用)

```typescript
// tsconfig.json 中 "module": "commonjs"
// 编译后的 JS 使用 require/module.exports

// TypeScript 中的写法（编译器会转换）
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export function searchJobList() { ... }
export type { SearchParams };

// 编译后的 JavaScript
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
exports.searchJobList = function() { ... };
```

### 判断是否直接运行

```typescript
// 当文件被 `node dist/index.js` 直接执行时为 true
// 当被 `require('./index')` 导入时为 false
if (require.main === module) {
  main();
}
```

## 实用模式

### 防御性数据提取

```typescript
// 坏：一个字段失败导致整个提取崩溃
const title = await element.$eval('.title', el => el.textContent);

// 好：单个字段失败返回空字符串，不影响其他字段
const title = await element.$eval('.title', el => el.textContent?.trim() || '').catch(() => '');
```

### 空值安全链

```typescript
// 可能返回 null 的调用链
const jobLink = await element.$('a[data-nick="job-detail-job-info"]');  // 可能是 null
const title = await jobLink?.$eval('.title', el => el.textContent);     // jobLink 为 null 时短路
```

### 展开运算符合并数组

```typescript
const tags = [...(jobTags || []), ...(companyTags || [])];
// 等价于: jobTags.concat(companyTags)，但更安全地处理了 null/undefined
```

### Array.filter(Boolean)

```typescript
const jobs = result.data.jobInfo.filter(Boolean);
// 过滤掉 null, undefined, 0, "", false 等 falsy 值
// 等价于: .filter(item => item !== null && item !== undefined && ...)
```

## tsconfig.json 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",              // 编译目标：ES2020 语法（支持 ?. 和 ??）
    "module": "commonjs",            // 模块系统：CommonJS（Node.js 标准）
    "outDir": "./dist",              // 编译输出目录
    "rootDir": "./src",              // 源码目录
    "strict": true,                  // 启用所有严格类型检查
    "esModuleInterop": true,         // 允许 import x from 'y' 语法导入 CommonJS 模块
    "skipLibCheck": true,            // 跳过 .d.ts 类型检查（加速编译）
    "forceConsistentCasingInFileNames": true  // 文件名大小写敏感
  }
}
```

## package.json 关键字段

```json
{
  "main": "./dist/index.js",          // require('mcp-jobs') 的入口
  "bin": { "mcp-jobs": "./dist/mcp.js" },  // npx mcp-jobs 或全局安装后的命令
  "scripts": { ... },                 // npm run 脚本
  "dependencies": { ... },            // 运行时依赖（打包发布时包含）
  "devDependencies": { ... },         // 开发依赖（编译、类型检查用，不发布）
  "files": ["dist", "README.md"],     // npm publish 时包含的文件
  "engines": { "node": ">=16.0.0" }   // Node.js 版本要求
}
```

dependencies vs devDependencies 的区别：
- `playwright` 在 dependencies：运行时需要启动浏览器
- `typescript` 在 devDependencies：只在开发时编译用，发布的是编译后的 .js
- `@types/node` 在 devDependencies：只提供类型提示，运行时不需要
