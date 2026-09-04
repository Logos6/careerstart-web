# 启航 CareerStart - Web 版

专为 35+ 女性与宝妈打造的职业重启平台（桌面端优先）。

## 功能概览

| 模块 | 说明 |
|------|------|
| 6维AI测评 | 基于兴趣、技能、能力模型的全方位匹配分析 |
| 65+ 岗位库 | 精选年龄友好 / 宝妈弹性岗位，支持搜索 |
| 技能充电站 | 32 门 B 站精选免费课程，按类目筛选 |
| AI 简历诊断 | 检测年龄歧视与隐形扣分项 |
| AI 模拟面试 | 针对 35+ 高频难点问题对话演练 |
| 会员系统 | 月/季/年三档，个人收款码支付 + 人工激活 |

## 本地运行

```bash
# 启动本地静态服务器 (端口 8080)
node server.js

# 浏览器访问
# http://localhost:8080
```

## 部署到公网 (零成本)

### 方案 A: Vercel (推荐)

**第一步: 注册 Vercel 账号**

1. 打开浏览器访问 https://vercel.com
2. 点击右上角 **Sign Up**
3. 选择 **Continue with GitHub** 或 **Continue with Email**
4. 如果选 Email：输入邮箱 → 设置密码 → 验证邮箱
5. 完成注册后进入 Dashboard

**第二步: 导入 Gitee 仓库**

1. 在 Vercel Dashboard 点击 **New Project**
2. 选择 **Import Git Repository**
3. 在 Git 提供商列表中选择 **Gitee**
4. 点击 **Authorize Vercel** 授权访问 Gitee
5. 在仓库列表中找到并选择 `logos-light/careerstart-web`
6. 点击 **Import**

**第三步: 配置项目**

1. **Project Name**: 保持 `careerstart-web` 或自定义
2. **Framework Preset**: 选择 **Other**
3. **Root Directory**: 保持 `./`
4. **Build Command**: **留空**（静态站点无需构建）
5. **Output Directory**: 填 `.`（当前目录）
6. 点击 **Deploy**

**第四步: 等待部署**

1. 等待 1-2 分钟完成构建
2. 看到绿色 **Congratulations!** 表示成功
3. 点击 **Visit** 查看你的网站
4. 获得 `*.vercel.app` 公网 HTTPS 地址（如 `careerstart-web.vercel.app`）

**后续更新**: 每次推送到 Gitee，Vercel 会自动重新部署

### 方案 B: Cloudflare Pages

1. 将本项目推送到 GitHub
2. 登录 Cloudflare Dashboard → **Workers & Pages** → **Create**
3. 选择 **Pages** → **Connect to Git**，选中仓库
4. **Build command** 留空，**Build output directory** 填 `.`
5. 点击 **Save and Deploy**
6. 获得 `*.pages.dev` 公网 HTTPS 地址

### 推送到 GitHub

```bash
cd C:\Users\20895\careerstart_web
git init
git add .
git commit -m "feat: 启航 CareerStart web v1.0"
git branch -M main
git remote add origin https://github.com/你的用户名/careerstart-web.git
git push -u origin main
```

## 第三方库声明

本项目 vendor 目录包含以下第三方库（已本地化）：

| 库 | 版本 | 许可证 | 用途 |
|----|------|--------|------|
| Chart.js | latest | MIT | 测评雷达图 |
| Remix Icon | v3.5.0 | Apache 2.0 | UI 图标 |

## 支付说明

当前版本采用**个人收款码 + 人工确认**方式：
- 用户在页面查看个人微信/支付宝收款码
- 支付后填写手机号/微信备注名
- 管理员核对后手动激活会员

**无需商户号、无需营业执照、零手续费。**

## 技术栈

- 纯 HTML5 + CSS3 + Vanilla JavaScript（零依赖）
- CSS 变量 + 响应式 Grid 布局
- Chart.js 可视化 + Remix Icon 图标

## License

MIT
