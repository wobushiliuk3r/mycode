# 高匿穿透多用户反向代理网关 + KV 管理后台

这是一个基于 Cloudflare Workers 和 TypeScript 构建的企业级 API 反向代理网关。

它兼具了**“底层流式纯穿透”**的极致性能和高保真度，又融合了**“多用户防刷隔离”**和**“KV 数据库在线后台管理”**。

## 核心特性

- 🚀 **原生流式穿透**：由于没有协议转换开销，底层采用 ReadableStream 管道传输。SSE 打字机效果原生保留，多模态（图片上传等）完美支持。
- 🛡️ **高匿反爬隐藏**：自动剔除所有 Cloudflare 和代理特征请求头（如 `CF-Connecting-IP`, `X-Forwarded-For`），伪装 `Host`，对上游彻底隐藏你的真实客户端和代理层身份。
- 🔐 **多租户防刷隔离**：可配置多个 `GATEWAY_KEY` 分发给不同的人。网关会在内存中严格对不同密码进行频率限流（默认单人 60次/分钟），且某个用户的上游被封记录（冷却池）**完全隔离**，不会产生“一人作恶，全员宕机”的公地悲剧。
- 🔄 **智能轮询与数据库联动转移**：
  - 自动将所有的请求轮询分配给存活的上游 API Key。
  - 遇到 429(限流)、401(封号) 会对客户端**无感知、无缝切换重试**。
  - **KV 联动（高级）**：如果重试时发现上游返回了 401/403，不仅会在当前请求中换 Key，还会**自动在 KV 数据库中将该 Key 标记为失效并停用**！
- 💻 **内置漂亮的管理后台**：绑定 KV 数据库后，访问 `/admin` 即可进入图形化网页后台。支持一键批量导入 Token、一键检测存活状态、开启/禁用，完全不需要改代码重新部署。

---

## 部署教程（GitHub Actions 自动化）

所有的配置和 Key 都在 GitHub 的加密 Secrets 中管理，代码仓库不会暴露你的任何隐私。

### 第 1 步：获取 Cloudflare 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 获取 **账户 ID (Account ID)**：点击左侧 **Workers 和 Pages**，右侧会显示账户 ID，复制它。
3. 创建 **KV 命名空间**：在 "Workers 和 Pages" 下点击 **KV** -> **创建命名空间**，名字随便起（比如 `my_tokens`）。创建后，复制对应的 **命名空间 ID**。
4. 获取 **API 令牌 (API Token)**：
   - 点击右上角头像 → **我的个人资料** → 左侧 **API 令牌**
   - 点击 **创建令牌**，选择 **编辑 Cloudflare Workers** 模板
   - 确认权限后创建，复制生成的令牌（只显示一次）。

### 第 2 步：配置 GitHub Secrets

将这个目录作为一个新的 Git 仓库推送到你的 GitHub 后，进入该仓库的页面：
进入 **Settings** → **Secrets and variables** → **Actions** → 点击 **New repository secret**，依次添加以下 Secrets：

| Secret 名称 | 示例值 | 说明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | *第 1 步获取的 API 令牌* | Cloudflare 部署凭证 |
| `CLOUDFLARE_ACCOUNT_ID` | *第 1 步获取的账户 ID* | Cloudflare 账户标识 |
| `KV_NAMESPACE_ID` | *第 1 步获取的 KV 命名空间 ID* | 用于存储 Token 和展示后台的数据库 |
| `GATEWAY_KEY` | `sk-zhangsan,sk-lisi` | **重要**：访问 API 以及登录管理后台的统一密码，支持多个用逗号分隔，实现多人隔离！ |
| `TARGET_BASE_URL` | `https://api.openai.com` | 你想要代理的上游真实地址 |
| `UPSTREAM_KEYS` | *(可选)* `sk-real-1,sk-real-2` | 真实的 API Key，可留空，后续直接在网页管理后台里加 |

### 第 3 步：触发部署

只要你将代码 push 到 `main` 分支，GitHub 就会自动调用 `wrangler` 进行部署。

部署成功后，你可以在 Cloudflare Dashboard 的 Workers 页面看到你的服务。
- **配置自定义域名（推荐）**：在 Worker 的设置页面 -> **触发器 (Triggers)** -> **自定义域 (Custom Domains)** 中，添加你自己绑定的域名（如 `api.yourdomain.com`）。
- **默认子域名**：如果没有自定义域名，也可以直接使用 Cloudflare 免费分配的子域名，如 `https://my-proxy-gateway.<你的子域名>.workers.dev`。

部署完成后：
- **管理后台**：访问 `https://你的域名/admin`。登录密码就是你设置的 `GATEWAY_KEY`。在里面尽情添加你的真实 Key 吧！
- **API 端点**：将你的客户端 Base URL 设置为 `https://你的域名` 即可。

---

## 工作原理图说明

```
张三 (拿着 sk-zhangsan)                李四 (拿着 sk-lisi)
          |                                  |
          v                                  v
============================================================
|  Cloudflare Worker 网关层                                 |
|                                                          |
|  1. 验证密码，如果是张三，去张三的限流器(+1)              |
|     (如果超过 60次/分，直接踢掉，不影响李四)              |
|                                                          |
|  2. 读取合并后的可用 Key 池 (KV数据库里的 + 环境变量里的) |
|                                                          |
|  3. 避开张三自己的【冷却池】，随机抽一个真实 Key (如 KeyA)|
|                                                          |
|  4. 抹除 CF 头，伪造 Host，发起高匿代理请求               |
============================================================
          |
          v
上游真实服务器 (如 https://api.openai.com)
          |
          +-> 如果 KeyA 返回 429: 
          |   将 KeyA 放入【张三的冷却池】(李四依然可用 KeyA)
          |   网关内部重试，给张三换 KeyB 再次请求。
          |
          +-> 如果 KeyA 返回 401 封号:
          |   不仅放入张三的冷却池，还会异步去 KV 数据库里
          |   把 KeyA 永久标红禁用。同时网关内部换 KeyB 重试。
          |
          +-> 如果 200 OK: 
              直接 Pipe 底层 ReadableStream 回去，SSE 原生输出。
```

## 本地开发调试

```bash
# 1. 在 wrangler.toml 里写好测试配置，并加上 KV 绑定
# 2. 安装依赖
npm install
# 3. 启动开发服务器
npx wrangler dev
```
