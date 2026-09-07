# 桥比特官网

`https://qiaobit.com/` 的唯一源码项目。

## 项目边界

本仓库只负责：

- 桥比特个人介绍、内容、播客、活动、项目矩阵与联系页面
- 官网商务合作申请
- 隐私最小化的网站访问统计
- Cloudflare Worker 静态资源托管、HTTPS 跳转和内部路径保护

本仓库不负责：

- AI Skills 的支付、分销、邮件交付与后台，源码位于平行项目 `../AI Skills`
- 容易发扩展、授权、兑换码与商店材料，源码位于平行项目 `../谷歌插件`
- 乾X企业官网，源码位于平行项目 `../乾X官网`
- 企业微信运营自动化，源码位于平行项目 `../Techbridge运营自动化`
- 硅基物语会员原型，源码位于 `../硅基物语H5/website-prototype`

官网可以展示这些产品的卡片和外链，但不得重新引入它们的支付、授权、数据库迁移、后台或部署代码。

## 本地运行

```bash
npm install
python3 -m http.server 8080 --bind 127.0.0.1
```

访问：`http://127.0.0.1:8080/index.html`

## 验证

```bash
npm run check
npm run deploy:dry-run
```

检查内容包括 JavaScript 语法、官网 API 测试、内部目录防公开测试和 Cloudflare 部署包生成。

## 生产安全

旧服务的保留版本：

- Worker：`techbridge`
- Version ID：`f5a9dd06-36b2-4a5e-a9ea-64845a3b0ad6`
- 上线时间：2026-08-30

官网通过 `wrangler.frontend.jsonc` 发布到 `techbridge-frontend`，使用路由覆盖官网前端。API 和本仓库中不存在的旧产品页面，通过 `LEGACY_SITE` 服务绑定交给原 `techbridge` 处理。旧服务的代码、密钥、数据绑定和定时任务保持不变。

**禁止直接运行不带配置的 `wrangler deploy`：根目录 `wrangler.jsonc` 仍指向旧服务，清理版 `worker.js` 不具备旧产品接口。** 使用 `npm run deploy`，只发布官网前端。

首次切换可通过删除 `techbridge-frontend` 的两条官网路由回退：原 Custom Domain 仍指向未修改的 `techbridge`。日常前端回滚使用 `techbridge-frontend` 的上一版本。

## 目标发布流程

```text
codex/功能分支
→ Pull Request
→ npm run check
→ npm run deploy:dry-run
→ 合并受保护的 master
→ GitHub Actions 自动部署 Cloudflare
→ 线上冒烟验证
```

日常发布不再从脏的本地工作区直接执行 `wrangler deploy`。以上自动部署为目标流程，是否已启用以 GitHub Actions 配置为准；本次采用经过验证的干净提交发布。
