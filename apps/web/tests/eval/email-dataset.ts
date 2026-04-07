/**
 * 100 封测试邮件数据集，每封标注 ground truth 分类和难度等级
 *
 * 分类体系（模拟真实业务场景）：
 *   ci-alert     — CI/CD 构建通知与告警
 *   monitoring   — 监控系统告警（CPU/内存/磁盘等）
 *   product-req  — 产品需求文档与评审
 *   weekly-report — 周报/进展汇报
 *   hr-admin     — HR/行政事务
 *   customer-feedback — 客户反馈与工单
 *   approval     — 审批请求
 *   other        — 杂项/无法归类
 *
 * 难度标注：
 *   easy     — 明确关键词、明确发件人，应100%正确
 *   medium   — 有一定线索但需要综合判断
 *   hard     — 边界模糊、跨分类、容易混淆
 *   tricky   — 故意设计的陷阱/反直觉 case
 */

export interface TestEmail {
	id: string;
	subject: string;
	sender: string;
	senderName: string;
	bodyText: string;
	groundTruth: string;
	difficulty: "easy" | "medium" | "hard" | "tricky";
	note?: string;
}

export const EMAIL_DATASET: TestEmail[] = [
	// ═══════════════════ CI/CD 告警 (15封) ═══════════════════

	{
		id: "ci-01",
		subject: "[BUILD FAILED] api-service #1234",
		sender: "jenkins@company.com",
		senderName: "Jenkins CI",
		bodyText:
			"Build #1234 of api-service has FAILED.\n\nFailed stage: unit-test\nError: TimeoutError: test exceeded 30s\n\nCommit: abc123 by dev@company.com\nBranch: feature/user-auth",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},
	{
		id: "ci-02",
		subject: "[BUILD SUCCESS] web-frontend #567",
		sender: "jenkins@company.com",
		senderName: "Jenkins CI",
		bodyText:
			"Build #567 of web-frontend has succeeded.\n\nAll 234 tests passed.\nDeploy to staging: complete\nArtifact: web-frontend-2.3.1.tar.gz",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},
	{
		id: "ci-03",
		subject: "GitHub Actions: deploy-prod workflow failed",
		sender: "noreply@github.com",
		senderName: "GitHub",
		bodyText:
			"Run #89 of deploy-prod workflow in org/repo has failed.\n\nJob: deploy\nStep: Push to registry\nError: unauthorized: authentication required",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},
	{
		id: "ci-04",
		subject: "[DEPLOY] v2.3.1 deployed to production",
		sender: "deploy-bot@company.com",
		senderName: "Deploy Bot",
		bodyText:
			"Release v2.3.1 has been successfully deployed to production.\n\nChanges:\n- Fix: login page redirect loop\n- Feature: export to CSV\n- Perf: reduce bundle size by 15%",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},
	{
		id: "ci-05",
		subject: "Pipeline warning: test coverage dropped below 80%",
		sender: "sonarqube@company.com",
		senderName: "SonarQube",
		bodyText:
			"Quality Gate warning for project api-service:\n\nCode coverage: 78.2% (threshold: 80%)\nNew issues: 3 (1 bug, 2 code smells)\n\nPlease review before merging.",
		groundTruth: "ci-alert",
		difficulty: "medium",
	},
	{
		id: "ci-06",
		subject: "Re: 构建失败的问题我查了一下",
		sender: "dev@company.com",
		senderName: "张开发",
		bodyText:
			"Jenkins那个构建失败我查了，是测试环境的Redis连接超时导致的，不是代码问题。我已经重启了测试环境的Redis，现在重新跑一下应该就好了。",
		groundTruth: "ci-alert",
		difficulty: "hard",
		note: "人工讨论CI问题，容易被分为other",
	},
	{
		id: "ci-07",
		subject: "Dependabot: security update for lodash",
		sender: "dependabot@github.com",
		senderName: "Dependabot",
		bodyText:
			"Dependabot has created a PR to update lodash from 4.17.20 to 4.17.21.\n\nThis update fixes CVE-2021-23337 (prototype pollution).\n\nReview PR #456 to merge.",
		groundTruth: "ci-alert",
		difficulty: "medium",
	},
	{
		id: "ci-08",
		subject: "Docker image build timeout",
		sender: "registry@company.com",
		senderName: "Container Registry",
		bodyText:
			"Image build for api-service:latest timed out after 30 minutes.\n\nPossible causes:\n- Large dependencies\n- Network issues during npm install\n\nPlease retry or optimize Dockerfile.",
		groundTruth: "ci-alert",
		difficulty: "medium",
	},
	{
		id: "ci-09",
		subject: "你们的部署流程需要优化一下",
		sender: "cto@company.com",
		senderName: "CTO",
		bodyText:
			"最近几次部署都出问题了，我觉得我们需要：\n1. 加一个staging环境的自动化测试\n2. 部署前必须有人review\n3. 回滚机制要更快\n\n这个事情让DevOps组牵头搞一下。",
		groundTruth: "product-req",
		difficulty: "tricky",
		note: "讨论部署流程但本质是需求/改进建议，不是CI告警",
	},
	{
		id: "ci-10",
		subject: "[GitLab] Merge request !234 merged",
		sender: "gitlab@company.com",
		senderName: "GitLab",
		bodyText:
			"Merge request !234 'feat: add user export' has been merged into main.\n\nApproved by: tech-lead@company.com\nPipeline: passed",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},
	{
		id: "ci-11",
		subject: "npm audit: 2 high severity vulnerabilities",
		sender: "npm-audit@company.com",
		senderName: "NPM Audit Bot",
		bodyText:
			"Weekly npm audit report:\n\n2 high severity vulnerabilities found:\n- xml2js: prototype pollution\n- semver: regex DoS\n\nRun `npm audit fix` to resolve.",
		groundTruth: "ci-alert",
		difficulty: "medium",
	},
	{
		id: "ci-12",
		subject: "Sentry: New issue in production - TypeError",
		sender: "noreply@sentry.io",
		senderName: "Sentry",
		bodyText:
			"New issue: TypeError: Cannot read property 'id' of undefined\n\nFile: src/handlers/user.ts:45\nFrequency: 23 events in last hour\nAffected users: 12\n\nFirst seen: 10 minutes ago",
		groundTruth: "monitoring",
		difficulty: "tricky",
		note: "Sentry是监控而非CI，但很多人会混淆",
	},
	{
		id: "ci-13",
		subject: "Renovate: 15 package updates available",
		sender: "renovate@company.com",
		senderName: "Renovate Bot",
		bodyText:
			"The following package updates are available:\n\n- next: 16.0.1 → 16.0.3\n- react: 19.0.0 → 19.0.1\n- typescript: 5.7.0 → 5.8.0\n\n15 PRs have been created automatically.",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},
	{
		id: "ci-14",
		subject: "构建服务器硬盘快满了",
		sender: "ops@company.com",
		senderName: "运维",
		bodyText:
			"Jenkins构建服务器 /var/lib/docker 使用率已经到92%了，需要清理一下旧的镜像和构建缓存。我先手动清一波，后面加个定时任务自动清理。",
		groundTruth: "monitoring",
		difficulty: "hard",
		note: "关于构建服务器但本质是监控/运维告警",
	},
	{
		id: "ci-15",
		subject: "Pre-release v3.0.0-beta.1 published",
		sender: "release-bot@company.com",
		senderName: "Release Bot",
		bodyText:
			"Pre-release v3.0.0-beta.1 has been published to npm.\n\nBreaking changes:\n- Dropped Node 18 support\n- New config format\n\nPlease test and report issues.",
		groundTruth: "ci-alert",
		difficulty: "easy",
	},

	// ═══════════════════ 监控告警 (12封) ═══════════════════

	{
		id: "mon-01",
		subject: "[ALERT] CPU Usage > 90% on prod-api-3",
		sender: "monitor@company.com",
		senderName: "Monitor System",
		bodyText:
			"CRITICAL: Server prod-api-3\n\nCPU: 95.2% (threshold: 90%)\nDuration: 15 minutes\nProcess: node (PID 12345) consuming 80% CPU\n\nAction required: investigate immediately.",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-02",
		subject: "[WARN] Disk usage 85% on db-master",
		sender: "monitor@company.com",
		senderName: "Monitor System",
		bodyText:
			"WARNING: Database server db-master\n\nDisk /data: 85% used (340GB / 400GB)\nGrowth rate: 2GB/day\nEstimated full: 7 days\n\nPlease plan capacity expansion.",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-03",
		subject: "[RESOLVED] Memory alert on prod-web-2",
		sender: "monitor@company.com",
		senderName: "Monitor System",
		bodyText:
			"RESOLVED: Memory usage on prod-web-2 has returned to normal.\n\nPeak: 92% at 14:30\nCurrent: 68%\nDuration: 25 minutes\n\nRoot cause: memory leak in image processing module (auto-restarted).",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-04",
		subject: "Grafana alert: API response time > 2s",
		sender: "grafana@company.com",
		senderName: "Grafana",
		bodyText:
			"Alert: API P99 latency exceeded threshold\n\nEndpoint: /api/v2/search\nP99: 3.2s (threshold: 2s)\nDuration: 10 minutes\nPossible cause: database query slow",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-05",
		subject: "CloudWatch: RDS connections nearing limit",
		sender: "aws-notifications@amazon.com",
		senderName: "AWS",
		bodyText:
			"Your RDS instance prod-db-main is approaching the connection limit.\n\nCurrent: 180/200 connections\nAvg over last hour: 165\n\nConsider increasing max_connections or implementing connection pooling.",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-06",
		subject: "SSL证书即将到期提醒",
		sender: "certbot@company.com",
		senderName: "Certbot",
		bodyText:
			"以下域名的SSL证书将在14天后到期：\n\n- api.company.com (到期: 2026-04-21)\n- app.company.com (到期: 2026-04-21)\n\n请及时更新证书。",
		groundTruth: "monitoring",
		difficulty: "medium",
	},
	{
		id: "mon-07",
		subject: "每日数据库备份报告",
		sender: "backup@company.com",
		senderName: "Backup Service",
		bodyText:
			"每日备份报告 2026-04-06:\n\n✅ prod-main: 成功 (4.2GB, 耗时3m12s)\n✅ prod-analytics: 成功 (12.1GB, 耗时8m45s)\n❌ prod-logs: 失败 (磁盘空间不足)\n\n请关注 prod-logs 备份失败问题。",
		groundTruth: "monitoring",
		difficulty: "medium",
	},
	{
		id: "mon-08",
		subject: "PagerDuty: Incident #789 triggered",
		sender: "noreply@pagerduty.com",
		senderName: "PagerDuty",
		bodyText:
			"Incident #789: Production API 5xx errors spike\n\nTriggered at: 2026-04-06 15:30 UTC\nService: api-gateway\nEscalation: Level 1 (on-call: dev@company.com)\n\nError rate: 15% (normal: <1%)",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-09",
		subject: "客户反馈说系统很慢",
		sender: "support@company.com",
		senderName: "客服",
		bodyText:
			"今天有3个客户反馈说系统加载特别慢，尤其是报表页面。我看了一下确实比平时慢不少，不知道是不是服务器的问题？能帮忙看看吗？",
		groundTruth: "customer-feedback",
		difficulty: "tricky",
		note: "虽然涉及性能问题但本质是客户反馈，不是监控系统告警",
	},
	{
		id: "mon-10",
		subject: "UptimeRobot: app.company.com is DOWN",
		sender: "alert@uptimerobot.com",
		senderName: "UptimeRobot",
		bodyText:
			"Monitor is DOWN\n\nMonitor: app.company.com\nReason: Connection Timeout\nDatetime: 2026-04-06 16:45 UTC\n\nThis is an automated alert.",
		groundTruth: "monitoring",
		difficulty: "easy",
	},
	{
		id: "mon-11",
		subject: "Weekly infrastructure cost report",
		sender: "finops@company.com",
		senderName: "FinOps Bot",
		bodyText:
			"Weekly AWS cost report (2026-03-31 to 2026-04-06):\n\nTotal: $4,521.30 (+8.2% vs last week)\n- EC2: $2,100 (+15%)\n- RDS: $890 (flat)\n- S3: $340 (-5%)\n\nEC2 increase due to new staging instances.\n\n⚠️ COST ANOMALY DETECTED:\nThe EC2 cost increase of +15% exceeds the configured threshold of 10%. This is triggered by the automated cost monitoring pipeline.\n\nAnomaly Details:\n- 3 new c5.2xlarge instances were provisioned in us-east-1 on 2026-04-03\n- These instances appear to be running idle — average CPU utilization is only 3.2%\n- If left running, projected monthly waste: ~$1,260\n\nRECOMMENDED ACTION:\nPlease investigate whether these instances are still needed. The FinOps monitoring system flagged this as a potential resource leak. Auto-remediation is disabled for production accounts — manual review required.\n\nThis alert is generated by the infrastructure cost monitoring system. To adjust thresholds, update the FinOps dashboard at https://finops.internal/settings.",
		groundTruth: "monitoring",
		difficulty: "hard",
		note: "成本报告算monitoring还是weekly-report？深读正文有anomaly detection线索",
	},
	{
		id: "mon-12",
		subject: "Datadog: Anomaly detected in login success rate",
		sender: "alerts@datadoghq.com",
		senderName: "Datadog",
		bodyText:
			"Anomaly detected: Login success rate dropped to 82% (normal: 97%)\n\nTimeframe: last 30 minutes\nAffected service: auth-service\n\nPossible causes:\n- Auth provider issues\n- Database connectivity",
		groundTruth: "monitoring",
		difficulty: "easy",
	},

	// ═══════════════════ 产品需求 (15封) ═══════════════════

	{
		id: "req-01",
		subject: "【PRD】用户权限管理模块 V2.0",
		sender: "pm@company.com",
		senderName: "产品经理",
		bodyText:
			"附件是用户权限管理模块的 PRD 文档。\n\n核心变更：\n1. 支持自定义角色\n2. 细粒度权限控制（页面级+按钮级）\n3. 权限继承机制\n\n请各位本周五前评审反馈。",
		groundTruth: "product-req",
		difficulty: "easy",
	},
	{
		id: "req-02",
		subject: "Re: 导出功能需求讨论",
		sender: "frontend-lead@company.com",
		senderName: "前端负责人",
		bodyText:
			"关于导出功能，我有几个技术方案的想法：\n\n方案A：前端直接生成Excel（小数据量）\n方案B：后端生成+下载链接（大数据量）\n\n建议两种都支持，根据数据量自动选择。产品那边觉得呢？",
		groundTruth: "product-req",
		difficulty: "medium",
	},
	{
		id: "req-03",
		subject: "需求评审会议纪要 - 搜索功能优化",
		sender: "pm@company.com",
		senderName: "产品经理",
		bodyText:
			"今天搜索功能优化的评审结论：\n\n1. 支持模糊搜索和精确搜索切换 ✅\n2. 搜索历史记录（最近10条）✅\n3. 搜索建议/自动补全 → 二期\n4. 全文搜索 → 需要Elasticsearch，暂不做\n\n开发排期：4月第2周启动。",
		groundTruth: "product-req",
		difficulty: "easy",
	},
	{
		id: "req-04",
		subject: "竞品分析：飞书邮箱的智能分类功能",
		sender: "pm2@company.com",
		senderName: "产品经理B",
		bodyText:
			"我研究了一下飞书邮箱的智能分类：\n\n1. 自动识别10+种邮件类型\n2. 支持自定义规则\n3. 优先级排序\n\n建议我们也做类似功能，但要做得更智能。详细方案我写在文档里了。",
		groundTruth: "product-req",
		difficulty: "medium",
	},
	{
		id: "req-05",
		subject: "API设计评审邀请：v3 REST API",
		sender: "backend-lead@company.com",
		senderName: "后端负责人",
		bodyText:
			"V3 API设计文档已完成，请评审：\n\n主要变更：\n1. RESTful → 部分改用GraphQL\n2. 统一错误码体系\n3. Rate limiting策略\n\n评审时间：周三下午3点\n会议室：A302",
		groundTruth: "product-req",
		difficulty: "medium",
		note: "技术评审也属于产品/需求范畴",
	},
	{
		id: "req-06",
		subject: "用户调研结果汇总",
		sender: "ux@company.com",
		senderName: "UX设计师",
		bodyText:
			"上周的用户调研结果出来了：\n\n痛点TOP3：\n1. 找不到历史邮件（67%用户提到）\n2. 移动端体验差（54%）\n3. 通知太多（43%）\n\n建议优先解决搜索和移动端的问题。详细数据见附件。",
		groundTruth: "product-req",
		difficulty: "medium",
	},
	{
		id: "req-07",
		subject: "Re: Re: 移动端适配方案讨论",
		sender: "mobile-dev@company.com",
		senderName: "移动端开发",
		bodyText:
			"PWA方案我评估了一下，主要问题：\n1. iOS的PWA推送通知限制很大\n2. 离线功能不如原生\n3. 性能可以接受\n\n如果不需要推送，PWA够用了。需要推送的话还是得做原生。",
		groundTruth: "product-req",
		difficulty: "hard",
		note: "技术讨论但本质是产品方案选型",
	},
	{
		id: "req-08",
		subject: "Figma: 新版仪表盘设计稿已更新",
		sender: "noreply@figma.com",
		senderName: "Figma",
		bodyText:
			"李设计 updated the file '仪表盘 V3.0'\n\nPages updated:\n- Dashboard Overview\n- Analytics Charts\n- Settings Panel\n\nView the latest designs: https://figma.com/file/xxx",
		groundTruth: "product-req",
		difficulty: "medium",
	},
	{
		id: "req-09",
		subject: "客户要求增加批量导入功能",
		sender: "sales@company.com",
		senderName: "销售",
		bodyText:
			"大客户A提了一个需求：他们有几千条历史数据需要导入系统，现在只能一条条手动录入太慢了。能不能加一个Excel批量导入功能？\n\n这个客户合同马上要续约了，希望能尽快支持。\n\n我和产品经理李总讨论了一下，他也认为批量导入是我们产品长期缺失的能力，不只是这个客户需要。目前至少有5个客户在过去3个月提过类似需求。\n\n初步方案讨论：\n1. 支持 Excel/CSV 两种格式上传\n2. 字段映射界面（客户的列名可能和我们不一样）\n3. 数据校验和错误提示\n4. 异步处理 + 进度条（大文件可能要几分钟）\n\n产品经理说可以排进 Sprint 24，预计2周开发。我觉得这个功能上了以后对所有中大客户都有吸引力，建议产品团队优先评估排期。\n\n@产品经理 请确认是否纳入下个Sprint？\n@后端负责人 技术方案有什么限制吗？\n\n注意：这封邮件发起的是一个内部产品需求评估流程。虽然需求来源于客户，但销售团队已完成初步方案讨论并提出产品建议。接下来需要产品团队评审排期、后端评估技术可行性。这属于标准的产品需求发起流程（参见产品流程文档 PM-PROCESS-001），不是单纯的客户反馈转发。\n\n历史类似需求参考：\n- 2026年1月 客户C 提过类似需求 → 当时产品未排期\n- 2026年2月 客户D/E 也提了 → 产品承认是高频需求\n- 本次合计6个客户需求，产品团队应正式立项评估",
		groundTruth: "product-req",
		difficulty: "hard",
		note: "来自销售的需求传递，深读正文有明确的内部产品评估流程线索",
	},
	{
		id: "req-10",
		subject: "技术方案：引入消息队列",
		sender: "architect@company.com",
		senderName: "架构师",
		bodyText:
			"为了解决高并发下的邮件处理延迟问题，建议引入消息队列。\n\n方案对比：\n- RabbitMQ: 成熟稳定，运维成本高\n- Redis Streams: 轻量，但持久化弱\n- Kafka: 吞吐量大，但架构重\n\n推荐Redis Streams，符合当前规模。",
		groundTruth: "product-req",
		difficulty: "hard",
		note: "纯技术方案但属于产品架构决策",
	},
	{
		id: "req-11",
		subject: "Sprint 23 backlog整理",
		sender: "scrum-master@company.com",
		senderName: "Scrum Master",
		bodyText:
			"Sprint 23 的 backlog 已整理完毕：\n\n高优先级：\n- 搜索优化 (8 story points)\n- 导出功能 (5 sp)\n\n中优先级：\n- 通知设置页面 (3 sp)\n- Bug修复 x 5 (8 sp)\n\n请大家确认工作量评估。",
		groundTruth: "product-req",
		difficulty: "medium",
	},
	{
		id: "req-12",
		subject: "关于国际化方案的建议",
		sender: "i18n-lead@company.com",
		senderName: "国际化负责人",
		bodyText:
			"目前系统只支持中文，但已经有海外客户了。建议第一阶段先支持英文：\n\n1. 前端文案提取到i18n文件\n2. 后端错误信息国际化\n3. 日期/数字格式适配\n\n预估工作量：2人/2周",
		groundTruth: "product-req",
		difficulty: "medium",
	},
	{
		id: "req-13",
		subject: "Feature request: Dark mode",
		sender: "feedback@company.com",
		senderName: "用户反馈系统",
		bodyText:
			"New feature request from user #4521:\n\nTitle: Please add dark mode\nDescription: Working late at night, the bright UI hurts my eyes. Please add a dark mode option.\nVotes: 23 other users also requested this.",
		groundTruth: "customer-feedback",
		difficulty: "tricky",
		note: "虽然是feature request但来自用户反馈系统",
	},
	{
		id: "req-14",
		subject: "数据库表结构变更评审",
		sender: "dba@company.com",
		senderName: "DBA",
		bodyText:
			"以下表结构变更需要评审：\n\n1. user表新增 timezone 字段\n2. email_thread表新增全文索引\n3. 新建 audit_log 表\n\nmigration脚本已提PR #789。请确认是否有性能影响。",
		groundTruth: "product-req",
		difficulty: "hard",
		note: "数据库变更本质上是需求实现的一部分",
	},
	{
		id: "req-15",
		subject: "产品路线图 Q2 更新",
		sender: "vp-product@company.com",
		senderName: "产品VP",
		bodyText:
			"Q2产品路线图已更新：\n\n4月：搜索优化 + 导出功能\n5月：移动端适配 + 通知系统重构\n6月：AI智能分类 + 数据分析仪表盘\n\n请各团队根据路线图安排资源。",
		groundTruth: "product-req",
		difficulty: "easy",
	},

	// ═══════════════════ 周报/汇报 (15封) ═══════════════════

	{
		id: "rpt-01",
		subject: "【周报】前端组 第14周工作汇报",
		sender: "frontend-lead@company.com",
		senderName: "前端负责人",
		bodyText:
			"本周完成：\n1. 登录页面重构 ✅\n2. 搜索组件开发 80%\n3. 修复了5个线上bug\n\n下周计划：\n1. 完成搜索组件\n2. 开始导出功能\n\n风险：设计稿还没最终确认。",
		groundTruth: "weekly-report",
		difficulty: "easy",
	},
	{
		id: "rpt-02",
		subject: "Weekly Report - Backend Team",
		sender: "backend-lead@company.com",
		senderName: "后端负责人",
		bodyText:
			"This week:\n- Completed API v2 migration (100%)\n- Database optimization: query time reduced by 40%\n- Fixed memory leak in image service\n\nNext week:\n- Start v3 API development\n- Set up Redis cluster",
		groundTruth: "weekly-report",
		difficulty: "easy",
	},
	{
		id: "rpt-03",
		subject: "项目进展更新：客户管理系统",
		sender: "pm@company.com",
		senderName: "项目经理",
		bodyText:
			"客户管理系统项目进展：\n\n整体进度：62%\n- 需求分析：100% ✅\n- UI设计：90%\n- 后端开发：55%\n- 前端开发：40%\n- 测试：0%\n\n预计延期1周，原因是设计变更。",
		groundTruth: "weekly-report",
		difficulty: "easy",
	},
	{
		id: "rpt-04",
		subject: "Re: 本月OKR完成情况",
		sender: "manager@company.com",
		senderName: "部门经理",
		bodyText:
			"各组请汇报3月OKR完成情况：\n\nKR1: 用户增长20% → 实际18%（基本达成）\nKR2: 系统可用性99.9% → 实际99.7%（未达标）\nKR3: 客户满意度4.5分 → 实际4.3分（未达标）\n\n需要分析KR2和KR3差距原因。",
		groundTruth: "weekly-report",
		difficulty: "medium",
	},
	{
		id: "rpt-05",
		subject: "市场部月度运营数据",
		sender: "marketing@company.com",
		senderName: "市场经理",
		bodyText:
			"3月运营数据报告：\n\n官网UV: 45,000 (+12%)\n注册转化率: 3.2% (+0.5%)\n付费转化率: 1.8% (-0.2%)\n客户获取成本: ¥280/人 (+15%)\n\n付费转化下降主要因为竞品降价，建议调整定价策略。",
		groundTruth: "weekly-report",
		difficulty: "medium",
	},
	{
		id: "rpt-06",
		subject: "DevOps组工作日志",
		sender: "devops@company.com",
		senderName: "DevOps",
		bodyText:
			"今日工作：\n- 09:00 升级Kubernetes到1.29 ✅\n- 11:00 迁移3个服务到新集群 ✅\n- 14:00 解决prod-web-2内存告警\n- 16:00 配置新的监控dashboard\n\n无异常。",
		groundTruth: "weekly-report",
		difficulty: "medium",
		note: "日报也算汇报类",
	},
	{
		id: "rpt-07",
		subject: "季度安全审计报告",
		sender: "security@company.com",
		senderName: "安全团队",
		bodyText:
			"Q1安全审计报告摘要：\n\n发现问题：12个\n- 严重：0\n- 高危：2（已修复1个）\n- 中危：4（已修复3个）\n- 低危：6（修复中）\n\n主要风险：SQL注入防护不完整、密码策略过于宽松。",
		groundTruth: "weekly-report",
		difficulty: "medium",
	},
	{
		id: "rpt-08",
		subject: "客户成功团队周报",
		sender: "cs-lead@company.com",
		senderName: "客户成功负责人",
		bodyText:
			"本周客户情况：\n\n新增客户：3家\n流失风险：客户B（使用率持续下降）\n升级意向：客户C（希望升级企业版）\n\n需要产品配合：客户B反馈搜索太慢。",
		groundTruth: "weekly-report",
		difficulty: "medium",
		note: "包含客户反馈信息但主体是周报",
	},
	{
		id: "rpt-09",
		subject: "自动化测试覆盖率周报",
		sender: "qa-bot@company.com",
		senderName: "QA Bot",
		bodyText:
			"Weekly Test Coverage Report:\n\nOverall: 82.3% (+1.2%)\n- Unit tests: 88% \n- Integration: 75%\n- E2E: 62%\n\nNew tests added: 34\nFlaky tests fixed: 5\nRemaining flaky: 8",
		groundTruth: "weekly-report",
		difficulty: "hard",
		note: "自动化报告，像CI也像周报",
	},
	{
		id: "rpt-10",
		subject: "上周销售数据汇总",
		sender: "sales-ops@company.com",
		senderName: "销售运营",
		bodyText:
			"上周销售数据：\n\n新签合同：¥156,000（目标¥200,000）\n续约金额：¥89,000\n管道金额：¥1.2M\n\n差距分析：2个大客户决策延迟，预计本周能关闭。",
		groundTruth: "weekly-report",
		difficulty: "easy",
	},
	{
		id: "rpt-11",
		subject: "技术债务清理进展",
		sender: "tech-lead@company.com",
		senderName: "技术负责人",
		bodyText:
			"技术债务清理第3周进展：\n\n已完成：\n- 移除废弃API（12个）\n- 升级过时依赖（23个包）\n- 重构auth模块\n\n进行中：\n- 数据库查询优化\n\n总进度：65%",
		groundTruth: "weekly-report",
		difficulty: "medium",
	},
	{
		id: "rpt-12",
		subject: "Re: 你们组这周做了什么？",
		sender: "vp-eng@company.com",
		senderName: "技术VP",
		bodyText:
			"麻烦各组在今天下班前把周报发给我。格式不限，简要说下：\n1. 本周完成了什么\n2. 下周计划做什么\n3. 有什么需要帮助的\n\n谢谢。",
		groundTruth: "weekly-report",
		difficulty: "hard",
		note: "催周报的邮件本身不是周报，但属于汇报流程",
	},
	{
		id: "rpt-13",
		subject: "数据看板异常通知",
		sender: "bi@company.com",
		senderName: "BI系统",
		bodyText:
			"数据看板检测到异常：\n\n指标：昨日新增用户数\n正常范围：100-200\n实际值：45\n偏差：-65%\n\n请相关同事排查原因。",
		groundTruth: "monitoring",
		difficulty: "tricky",
		note: "BI异常通知更像监控而非汇报",
	},
	{
		id: "rpt-14",
		subject: "研发效能月度报告",
		sender: "devex@company.com",
		senderName: "研发效能",
		bodyText:
			"3月研发效能报告：\n\nPR平均合并时间：4.2h（目标<4h）\n代码review覆盖率：92%\n部署频率：3.2次/天\n变更失败率：8%（目标<5%）\n\n建议重点改善变更失败率。",
		groundTruth: "weekly-report",
		difficulty: "medium",
	},
	{
		id: "rpt-15",
		subject: "个人述职报告 - 张三",
		sender: "zhangsan@company.com",
		senderName: "张三",
		bodyText:
			"2026年Q1个人述职：\n\n工作成果：\n1. 主导完成了搜索系统重构\n2. 优化了3个核心API性能\n3. 带了2个新人\n\n自我评价：基本完成OKR，搜索重构效果超预期。\n\n下季度计划：推进微服务化改造。",
		groundTruth: "weekly-report",
		difficulty: "easy",
	},

	// ═══════════════════ HR/行政 (12封) ═══════════════════

	{
		id: "hr-01",
		subject: "新人入职培训安排 - 4月7日",
		sender: "hr@company.com",
		senderName: "HR",
		bodyText:
			"各部门好，4月7日有3位新同事入职：\n\n- 王五（后端开发）→ 技术部\n- 赵六（产品经理）→ 产品部\n- 孙七（设计师）→ 设计部\n\n请各部门主管安排 buddy 带教。培训日程见附件。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-02",
		subject: "4月团建活动报名",
		sender: "admin@company.com",
		senderName: "行政",
		bodyText:
			"4月团建活动来啦！\n\n时间：4月19日（周六）\n地点：怀柔户外拓展基地\n活动：真人CS + BBQ\n费用：公司承担\n\n请在本周三前回复是否参加。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-03",
		subject: "调薪通知",
		sender: "hr-compensation@company.com",
		senderName: "HR薪酬",
		bodyText:
			"您好，根据年度绩效评估结果，您的薪资自2026年4月起调整如下：\n\n调整幅度：+12%\n生效日期：2026年4月1日\n\n具体金额请查看薪资系统。如有疑问请联系HR。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-04",
		subject: "请假申请已批准",
		sender: "oa@company.com",
		senderName: "OA系统",
		bodyText:
			"您的请假申请已审批通过。\n\n类型：年假\n日期：2026年4月14日 - 2026年4月18日（5天）\n审批人：李经理\n\n请做好工作交接。",
		groundTruth: "hr-admin",
		difficulty: "medium",
		note: "OA审批通知，容易误分为approval",
	},
	{
		id: "hr-05",
		subject: "办公室搬迁通知",
		sender: "admin@company.com",
		senderName: "行政",
		bodyText:
			"公司将于4月底搬迁至新办公室。\n\n新地址：朝阳区xx路xx号\n搬迁日期：4月26-27日（周末）\n\n请大家本周开始整理个人物品。详细安排另行通知。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-06",
		subject: "推荐一个候选人给你们",
		sender: "recruiter@company.com",
		senderName: "猎头",
		bodyText:
			"您好，有一位很优秀的全栈工程师候选人推荐给您：\n\n5年经验，前美团高级工程师\n技术栈：React + Node.js + PostgreSQL\n\n简历见附件，有兴趣可以安排面试。",
		groundTruth: "hr-admin",
		difficulty: "medium",
	},
	{
		id: "hr-07",
		subject: "全员大会通知 - 4月10日",
		sender: "ceo-office@company.com",
		senderName: "CEO办公室",
		bodyText:
			"全员大会通知：\n\n时间：4月10日（周五）14:00-16:00\n地点：大会议室 + 线上同步\n\n议程：\n1. Q1业务回顾\n2. Q2战略目标\n3. 组织架构调整\n\n请全员参加，不可请假。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-08",
		subject: "员工满意度调查",
		sender: "survey@company.com",
		senderName: "HR",
		bodyText:
			"请花5分钟完成员工满意度调查：\n\nhttps://survey.company.com/2026q1\n\n调查内容包括：工作环境、管理效能、职业发展、薪酬福利。\n\n截止日期：4月12日。所有回答匿名处理。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-09",
		subject: "报销审批：差旅费用 ¥3,500",
		sender: "oa@company.com",
		senderName: "OA系统",
		bodyText:
			"报销申请已提交：\n\n申请人：张三\n类型：差旅费用\n金额：¥3,500\n明细：机票¥2,200 + 酒店¥1,300\n\n请审批。",
		groundTruth: "approval",
		difficulty: "tricky",
		note: "报销审批本质上是approval，不是hr-admin",
	},
	{
		id: "hr-10",
		subject: "生日快乐！🎂",
		sender: "hr@company.com",
		senderName: "HR",
		bodyText:
			"亲爱的张三：\n\n祝你生日快乐！\n\n公司为你准备了生日蛋糕，今天下午3点在休息区，欢迎同事们一起来庆祝！\n\n— HR团队",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},
	{
		id: "hr-11",
		subject: "面试反馈：后端工程师候选人A",
		sender: "hiring-manager@company.com",
		senderName: "面试官",
		bodyText:
			"后端工程师候选人A的面试反馈：\n\n技术能力：4/5（系统设计较强）\n沟通能力：3/5（偏内向）\n文化匹配：4/5\n\n总体评价：建议进入终面。\n\n@HR 请安排终面时间。",
		groundTruth: "hr-admin",
		difficulty: "medium",
	},
	{
		id: "hr-12",
		subject: "公司制度更新：远程办公政策",
		sender: "hr-policy@company.com",
		senderName: "HR",
		bodyText:
			"经管理层讨论，远程办公政策更新如下：\n\n- 每周可远程办公2天（之前1天）\n- 需提前在OA申请\n- 核心会议日（周二/周四）建议到岗\n\n生效日期：4月15日。",
		groundTruth: "hr-admin",
		difficulty: "easy",
	},

	// ═══════════════════ 客户反馈 (12封) ═══════════════════

	{
		id: "fb-01",
		subject: "客户工单 #2345: 无法导出数据",
		sender: "support@company.com",
		senderName: "客服系统",
		bodyText:
			"新工单 #2345\n\n客户：ABC科技\n优先级：高\n\n问题描述：点击导出按钮后一直loading，等了5分钟没反应。浏览器控制台有报错。\n\n环境：Chrome 120, macOS",
		groundTruth: "customer-feedback",
		difficulty: "easy",
	},
	{
		id: "fb-02",
		subject: "Re: 感谢你们的产品，建议增加xxx功能",
		sender: "client-a@external.com",
		senderName: "客户A",
		bodyText:
			"你们的产品用着很不错，但有一个建议：\n\n能不能增加一个邮件模板功能？我们每天要发很多类似的邮件，如果有模板会方便很多。\n\n另外，能支持定时发送就更好了。",
		groundTruth: "customer-feedback",
		difficulty: "easy",
	},
	{
		id: "fb-03",
		subject: "投诉：升级后系统频繁崩溃",
		sender: "client-b@external.com",
		senderName: "客户B（VIP）",
		bodyText:
			"自从上周升级后，系统每天至少崩溃2-3次。我们是付费企业客户，这个稳定性完全不能接受。\n\n如果本周不能解决，我们会考虑更换供应商。\n\n请尽快处理并给出解决方案。",
		groundTruth: "customer-feedback",
		difficulty: "easy",
	},
	{
		id: "fb-04",
		subject: "NPS调查结果汇总",
		sender: "analytics@company.com",
		senderName: "数据分析",
		bodyText:
			"3月NPS调查结果：\n\n总分：42（上月45）\n推荐者：38%\n中立者：35%\n贬低者：27%\n\n主要负面反馈：性能慢、功能不够多、移动端差\n\n建议重点改善性能问题。",
		groundTruth: "customer-feedback",
		difficulty: "hard",
		note: "数据分析报告但内容是客户反馈",
	},
	{
		id: "fb-05",
		subject: "Zendesk: Ticket #891 escalated",
		sender: "zendesk@company.com",
		senderName: "Zendesk",
		bodyText:
			"Ticket #891 has been escalated to Level 2.\n\nCustomer: Enterprise Corp\nIssue: SSO integration not working after update\nPriority: Critical\nOpen for: 48 hours\n\nPlease respond within 4 hours.",
		groundTruth: "customer-feedback",
		difficulty: "easy",
	},
	{
		id: "fb-06",
		subject: "App Store新评价提醒",
		sender: "appstore-alert@company.com",
		senderName: "AppStore Monitor",
		bodyText:
			'新的1星评价：\n\n用户：anonymous_user_123\n评分：★☆☆☆☆\n内容："App太卡了，动不动就闪退。而且找不到设置在哪里。差评。"\n\n设备：iPhone 15, iOS 18.2',
		groundTruth: "customer-feedback",
		difficulty: "easy",
	},
	{
		id: "fb-07",
		subject: "大客户C的续约谈判进展",
		sender: "sales@company.com",
		senderName: "销售",
		bodyText:
			"客户C的续约谈判更新：\n\n客户诉求：\n1. 降价15%\n2. 增加API调用额度\n3. 专属客服通道\n\n我的建议：可以谈到降价8%+增加额度，专属客服需要产品配合。\n\n这个客户年合同¥80万，不能丢。",
		groundTruth: "customer-feedback",
		difficulty: "hard",
		note: "销售跟进但核心是客户诉求",
	},
	{
		id: "fb-08",
		subject: "用户访谈记录 - 客户D",
		sender: "cs@company.com",
		senderName: "客户成功",
		bodyText:
			'客户D用户访谈记录：\n\n使用场景：每天处理200+封邮件\n最喜欢的功能：AI分类\n最大痛点：批量操作不方便\n\n原话："如果能像Gmail那样多选然后批量归类就好了"\n\n建议产品重点优化批量操作。',
		groundTruth: "customer-feedback",
		difficulty: "medium",
	},
	{
		id: "fb-09",
		subject: "Intercom: 3 new conversations",
		sender: "notifications@intercom.io",
		senderName: "Intercom",
		bodyText:
			'You have 3 new conversations:\n\n1. "How to set up SSO?" - Enterprise customer\n2. "Pricing for 50+ seats?" - New lead\n3. "Bug: email not syncing" - Free user\n\nRespond in Intercom dashboard.',
		groundTruth: "customer-feedback",
		difficulty: "medium",
	},
	{
		id: "fb-10",
		subject: "竞品用户流入分析",
		sender: "growth@company.com",
		senderName: "增长团队",
		bodyText:
			"最近30天从竞品流入的用户分析：\n\n来源：\n- 竞品A: 45人\n- 竞品B: 23人\n- 竞品C: 12人\n\n流入原因TOP3：\n1. 价格更低\n2. AI功能\n3. 界面更好\n\n建议在landing page突出AI优势。\n\n以下是本周数据明细（同比上周）：\n\n日期          竞品A  竞品B  竞品C  总计\n2026-03-31    7      4      2      13\n2026-04-01    6      3      1      10\n2026-04-02    8      2      2      12\n2026-04-03    5      5      1      11\n2026-04-04    7      3      3      13\n2026-04-05    6      4      2      12\n2026-04-06    6      2      1       9\n\n周环比变化：+6.5%（上周总计75人）\n月环比变化：+12.3%\n\n这是增长团队的每周定期数据报告，汇报竞品用户流入趋势。数据来源于产品埋点和用户注册问卷。下周的报告将增加用户留存率指标。\n\n本报告由增长数据系统自动生成，每周一 9:00 发送。如需调整报告内容或接收人，请联系 growth@company.com。",
		groundTruth: "weekly-report",
		difficulty: "tricky",
		note: "深读正文有明确的'每周定期数据报告'和自动发送标记",
	},
	{
		id: "fb-11",
		subject: "客户安全审查问卷",
		sender: "security@external-client.com",
		senderName: "客户安全团队",
		bodyText:
			"我们正在对供应商进行年度安全审查，请回复以下问题：\n\n1. 数据存储在哪个区域？\n2. 是否通过SOC2认证？\n3. 数据加密方式？\n4. 数据保留策略？\n\n请在1周内回复。谢谢。",
		groundTruth: "customer-feedback",
		difficulty: "hard",
		note: "客户发起的安全审查请求",
	},
	{
		id: "fb-12",
		subject: "退款请求：订单 #ORD-2345",
		sender: "billing@company.com",
		senderName: "计费系统",
		bodyText:
			'客户退款请求：\n\n订单号：ORD-2345\n客户：小型科技公司\n金额：¥299/月\n原因：功能不满足需求\n\n客户留言："试用了一个月，发现不支持我们用的163邮箱，很遗憾只能退款。"',
		groundTruth: "customer-feedback",
		difficulty: "medium",
	},

	// ═══════════════════ 审批 (10封) ═══════════════════

	{
		id: "apr-01",
		subject: "【审批】服务器采购申请 ¥45,000",
		sender: "ops@company.com",
		senderName: "运维",
		bodyText:
			"申请采购2台服务器用于扩容生产环境。\n\n配置：32核/64GB/1TB SSD × 2\n总价：¥45,000\n供应商：xxx云\n\n原因：当前服务器负载已达85%，预计下月超载。",
		groundTruth: "approval",
		difficulty: "easy",
	},
	{
		id: "apr-02",
		subject: "请审批：新增2个前端开发岗位",
		sender: "hiring@company.com",
		senderName: "HR招聘",
		bodyText:
			"申请新增2个前端开发岗位：\n\n级别：P5-P6\n薪资范围：25-40K/月\n需求原因：Q2有3个前端项目同时启动\n\n已获部门负责人同意，请VP审批。",
		groundTruth: "approval",
		difficulty: "easy",
	},
	{
		id: "apr-03",
		subject: "预算申请：Q2营销活动 ¥50,000",
		sender: "marketing@company.com",
		senderName: "市场经理",
		bodyText:
			"Q2营销活动预算申请：\n\n线上广告：¥25,000\n内容营销：¥15,000\n线下活动：¥10,000\n\n预期ROI：3x（基于Q1数据推算）\n\n请领导审批。",
		groundTruth: "approval",
		difficulty: "easy",
	},
	{
		id: "apr-04",
		subject: "合同审批：与XX公司的合作协议",
		sender: "legal@company.com",
		senderName: "法务",
		bodyText:
			"请审批以下合同：\n\n合作方：XX科技有限公司\n合同类型：技术服务合同\n金额：¥180,000/年\n期限：1年（可续约）\n\n法务已审核条款，无风险。请签字。",
		groundTruth: "approval",
		difficulty: "easy",
	},
	{
		id: "apr-05",
		subject: "能不能批一下我的出差申请",
		sender: "sales-rep@company.com",
		senderName: "销售代表",
		bodyText:
			"老板，下周需要去深圳见客户E，能批一下出差申请吗？\n\n时间：4月14-16日\n预算：机票¥2,000 + 酒店¥800×2 + 交通¥500\n\n这个客户意向很强，见面谈能加快签约。",
		groundTruth: "approval",
		difficulty: "medium",
		note: "非正式的审批请求语气",
	},
	{
		id: "apr-06",
		subject: "OA审批提醒：您有3笔待审批",
		sender: "oa@company.com",
		senderName: "OA系统",
		bodyText:
			"您有以下待审批事项：\n\n1. 张三 - 年假申请（4/14-4/18）\n2. 李四 - 报销 ¥1,200（餐费）\n3. 王五 - 采购申请（显示器×3）\n\n请登录OA系统处理。",
		groundTruth: "approval",
		difficulty: "easy",
	},
	{
		id: "apr-07",
		subject: "技术方案审批：是否引入GraphQL",
		sender: "tech-lead@company.com",
		senderName: "技术负责人",
		bodyText:
			'技术方案需要决策层审批：\n\n提议：在V3 API中部分接口改用GraphQL\n优势：前端查询更灵活，减少over-fetching\n风险：团队学习成本，运维复杂度增加\n\n影响范围大，需要CTO审批。\n\n审批流程说明：\n根据公司《技术决策管理规范》（TDR-2025-003），涉及核心架构变更的技术方案需要经过以下审批流程：\n\n1. 技术负责人提交方案 ✅（已完成）\n2. 架构评审委员会评审 ✅（已通过，纪要见附件）\n3. CTO 最终审批 ← 当前步骤\n4. 实施计划制定\n\n审批截止日期：2026年4月15日\n\n@CTO 请审批此技术方案。如果批准，我们将在Sprint 24开始实施。如果需要修改，请标注具体修改意见。\n\n如您同意，请直接回复"approved"；如需讨论，请回复"需要会议讨论"。\n\n此邮件属于正式审批流程的一部分，审批结果将记录在技术决策日志中。\n\n审批关联信息：\n- 审批编号：TDR-2026-007\n- 提交人：张技术（技术负责人）\n- 审批权限等级：CTO 级别（因涉及核心架构变更，超出技术总监审批权限）\n- 预算影响：培训费用 ¥30,000 + 工具许可 ¥12,000/年\n- 关联文档：技术方案书（附件1）、架构评审纪要（附件2）、成本评估表（附件3）',
		groundTruth: "approval",
		difficulty: "hard",
		note: "深读正文有完整的审批流程说明、审批编号和操作请求",
	},
	{
		id: "apr-08",
		subject: "权限申请：需要生产数据库只读权限",
		sender: "analyst@company.com",
		senderName: "数据分析师",
		bodyText:
			"因数据分析需要，申请生产数据库只读权限。\n\n数据库：prod-analytics-db\n权限级别：只读\n用途：月度用户行为分析报告\n有效期：3个月\n\n请DBA和安全组审批。",
		groundTruth: "approval",
		difficulty: "medium",
	},
	{
		id: "apr-09",
		subject: "第三方工具采购评估",
		sender: "procurement@company.com",
		senderName: "采购",
		bodyText:
			"以下第三方工具已完成评估，需要审批采购：\n\n1. Figma Team Plan - $45/人/月 × 8人\n2. Notion Business - $15/人/月 × 30人\n3. Slack Pro - $7.25/人/月 × 50人\n\n总年费：约¥120,000。详细对比见附件。",
		groundTruth: "approval",
		difficulty: "easy",
	},
	{
		id: "apr-10",
		subject: "客户折扣审批：客户F要求打8折",
		sender: "sales@company.com",
		senderName: "销售",
		bodyText:
			"客户F（年合同¥50万）要求续约时打8折。\n\n背景：\n- 客户使用2年，一直按原价\n- 竞品报价确实更低\n- 客户表示不降价就换\n\n建议给到85折+增加功能权限，请领导审批。",
		groundTruth: "approval",
		difficulty: "medium",
	},

	// ═══════════════════ 杂项/其他 (9封) ═══════════════════

	{
		id: "oth-01",
		subject: "午餐一起吗？",
		sender: "colleague@company.com",
		senderName: "同事",
		bodyText:
			"今天中午一起去楼下那个新开的面馆吃吗？听说还不错。12点大厅见？",
		groundTruth: "other",
		difficulty: "easy",
	},
	{
		id: "oth-02",
		subject: "快递到了，前台代收",
		sender: "reception@company.com",
		senderName: "前台",
		bodyText:
			"张三你好，你有一个顺丰快递到了，已放在前台。请今天内来取，谢谢。\n\n快递单号：SF1234567890",
		groundTruth: "other",
		difficulty: "easy",
	},
	{
		id: "oth-03",
		subject: "Re: 推荐一本技术书",
		sender: "dev-friend@company.com",
		senderName: "技术同事",
		bodyText:
			"你推荐的《设计数据密集型应用》我看完了，确实很好！尤其是分布式那几章。你还有其他推荐吗？最近想学学Rust。",
		groundTruth: "other",
		difficulty: "easy",
	},
	{
		id: "oth-04",
		subject: "LinkedIn: 你有一个新的连接邀请",
		sender: "notifications@linkedin.com",
		senderName: "LinkedIn",
		bodyText:
			"猎头王先生想与你建立连接。\n\n他的简介：资深IT猎头，服务于BAT等头部企业\n\n接受邀请: https://linkedin.com/xxx",
		groundTruth: "other",
		difficulty: "easy",
	},
	{
		id: "oth-05",
		subject: "行业分享：2026年AI趋势报告",
		sender: "newsletter@techblog.com",
		senderName: "Tech Blog",
		bodyText:
			"2026年AI趋势报告要点：\n\n1. Agent成为主流交互方式\n2. 多模态AI普及\n3. AI编码助手渗透率超70%\n\n完整报告下载: https://techblog.com/report",
		groundTruth: "other",
		difficulty: "medium",
		note: "行业资讯邮件",
	},
	{
		id: "oth-06",
		subject: "会议室预约确认：A302 周三14:00-16:00",
		sender: "calendar@company.com",
		senderName: "日历系统",
		bodyText:
			"您的会议室预约已确认：\n\n会议室：A302\n时间：4月9日 14:00-16:00\n主题：API设计评审\n参与人：5人\n\n设备：投影仪、白板已就绪。",
		groundTruth: "other",
		difficulty: "medium",
		note: "会议室预约通知",
	},
	{
		id: "oth-07",
		subject: "外卖到了！",
		sender: "waimai@meituan.com",
		senderName: "美团外卖",
		bodyText:
			"您的外卖订单已送达！\n\n订单号：MT202604071234\n商家：沙县小吃\n取餐码：8234\n\n请尽快取餐，祝用餐愉快！",
		groundTruth: "other",
		difficulty: "easy",
	},
	{
		id: "oth-08",
		subject: "这个周末有空打球吗",
		sender: "friend@company.com",
		senderName: "老王",
		bodyText:
			"这周六下午打羽毛球吗？上次那个场地还不错。叫上小李和老张，四个人双打。",
		groundTruth: "other",
		difficulty: "easy",
	},
	{
		id: "oth-09",
		subject: "服务器迁移完成通知",
		sender: "infra@company.com",
		senderName: "基础设施",
		bodyText:
			"各位好，上周末的服务器迁移已全部完成。\n\n迁移内容：\n- 3台应用服务器（app-01, app-02, app-03）\n- 1台数据库从库（db-slave-02）\n\n目前运行正常，如发现异常请及时反馈。\n\n这是一次性的基础设施变更通知，不是持续性的系统告警。迁移项目已于上周五结项，本邮件仅作为最终完成确认。\n\n变更背景：\n公司决定将部分服务从阿里云迁移到腾讯云以降低成本（参见行政通知 ADM-2026-017）。本次迁移属于该计划的第一批，后续批次将在5月和6月进行。\n\n无需任何操作：\n- DNS已自动切换，无需修改配置\n- 应用代码不受影响\n- 数据已完整迁移并验证\n\n如有问题请联系基础设施组，但请注意这不是故障通知，系统运行一切正常。\n\n此邮件由基础设施项目组手动发送（发件人：李运维），不是监控系统自动生成的。这属于项目管理类的一次性通知邮件，后续不会定期发送。类似于搬家后通知大家新地址——是一个行政性质的信息同步，不涉及系统异常也不需要任何监控响应。\n\n如需了解迁移详情，请查看 Confluence 文档：基础设施迁移计划 2026-Q2。\n\n感谢各团队在迁移周末期间的配合。特别感谢QA组帮忙做了全量回归测试验证。\n\n祝好，\n基础设施项目组",
		groundTruth: "other",
		difficulty: "hard",
		note: "深读正文明确说明是'一次性变更通知'而非监控告警",
	},
];

export const EXPECTED_CATEGORIES = [
	{ slug: "ci-alert", name: "CI/CD通知", count: 13 },
	{ slug: "monitoring", name: "监控告警", count: 13 },
	{ slug: "product-req", name: "产品需求", count: 14 },
	{ slug: "weekly-report", name: "周报汇报", count: 14 },
	{ slug: "hr-admin", name: "HR行政", count: 11 },
	{ slug: "customer-feedback", name: "客户反馈", count: 11 },
	{ slug: "approval", name: "审批", count: 11 },
	{ slug: "other", name: "其他", count: 9 },
];
