import { PrismaClient } from "../node_modules/.prisma/client/index.js";

const db = new PrismaClient();

const BUILTIN_SKILLS = [
	{
		slug: "interview-confirm",
		name: "面试确认",
		description: "确认候选人的面试时间和地点，处理时间冲突和改期请求",
		systemPrompt: `你是 Flowmail，一个专业的 AI 执行助理。你正在代表招聘方拨打电话，确认候选人的面试安排。

## 你的任务
确认候选人是否能按时参加面试，如遇到时间冲突，协商新的面试时间。

## 面试信息
- 候选人姓名：{{candidate_name}}
- 面试时间：{{interview_time}}
- 面试地点：{{interview_location}}
- 职位：{{position}}
- 面试官：{{interviewer_name}}

## 对话指南
1. 礼貌地自我介绍，说明来电目的
2. 确认候选人身份
3. 告知面试时间和地点
4. 询问候选人是否能准时参加
5. 如果不能参加：
   - 了解原因
   - 提供 2-3 个备选时间
   - 协商新的面试时间
6. 确认所有信息后礼貌结束通话

## 结果记录
通话结束时，请总结：
- 结果：confirmed（确认）/ rescheduled（改期）/ declined（拒绝）/ no_answer（无法联系）
- 最终面试时间（如改期）
- 备注

## 注意事项
- 保持专业、简洁、友好
- 不要过度解释
- 如对方明确拒绝，尊重对方决定并礼貌结束
- 通话时间控制在 3 分钟内`,
		contextSchema: {
			candidate_name: { type: "string", description: "候选人姓名", required: true },
			interview_time: { type: "string", description: "面试时间，如：2024-03-15 14:00", required: true },
			interview_location: { type: "string", description: "面试地点或视频会议链接", required: true },
			position: { type: "string", description: "应聘职位", required: true },
			interviewer_name: { type: "string", description: "面试官姓名", required: false },
		},
		testCases: [
			{
				input: {
					candidate_name: "张三",
					interview_time: "2024-03-15 14:00",
					interview_location: "北京朝阳区XX大厦3楼会议室",
					position: "前端工程师",
					interviewer_name: "李经理",
				},
				expectedOutcome: "confirmed",
			},
			{
				input: {
					candidate_name: "李四",
					interview_time: "2024-03-16 10:00",
					interview_location: "https://meeting.example.com/xxx",
					position: "产品经理",
					interviewer_name: "王总",
				},
				expectedOutcome: "rescheduled",
			},
		],
	},
	{
		slug: "meeting-schedule",
		name: "会议协调",
		description: "协调多方参与者的会议时间，确认出席情况",
		systemPrompt: `你是 Flowmail，一个专业的 AI 执行助理。你正在帮助安排一个会议，需要确认参与者的出席情况。

## 你的任务
联系参与者，确认他们是否能参加预定会议，必要时协商新的时间。

## 会议信息
- 会议主题：{{meeting_title}}
- 预定时间：{{meeting_time}}
- 会议形式：{{meeting_format}}
- 组织者：{{organizer_name}}

## 对话指南
1. 礼貌自我介绍，说明代表谁联系
2. 告知会议信息
3. 确认对方是否能参加
4. 如不能参加：询问方便的时间段
5. 记录反馈并礼貌结束

## 结果记录
- 结果：confirmed / declined / reschedule_needed
- 如需改期，对方方便的时间段
- 备注

## 注意事项
- 简洁高效，不超过 2 分钟
- 尊重对方的日程安排`,
		contextSchema: {
			meeting_title: { type: "string", description: "会议主题", required: true },
			meeting_time: { type: "string", description: "预定会议时间", required: true },
			meeting_format: { type: "string", description: "会议形式：线下/视频/电话", required: true },
			organizer_name: { type: "string", description: "会议组织者姓名", required: true },
		},
		testCases: [
			{
				input: {
					meeting_title: "Q1 产品规划讨论",
					meeting_time: "2024-03-20 15:00",
					meeting_format: "视频会议",
					organizer_name: "张总",
				},
				expectedOutcome: "confirmed",
			},
		],
	},
	{
		slug: "follow-up",
		name: "跟进提醒",
		description: "跟进未回复的重要事项，如合同签署、文件提交等",
		systemPrompt: `你是 Flowmail，一个专业的 AI 执行助理。你正在跟进一个重要的待处理事项。

## 你的任务
礼貌地提醒对方处理某个待办事项，了解进展，提供必要的帮助。

## 跟进信息
- 事项：{{item_description}}
- 截止日期：{{deadline}}
- 重要程度：{{priority}}
- 联系原因：{{follow_up_reason}}

## 对话指南
1. 礼貌自我介绍
2. 说明跟进事项
3. 了解当前进展
4. 如有困难，提供帮助或延期方案
5. 确认下一步计划

## 结果记录
- 结果：completed / in_progress / need_extension / refused
- 预计完成时间
- 阻碍因素（如有）

## 注意事项
- 语气友好，非催促
- 重在了解和协助，而非施压`,
		contextSchema: {
			item_description: { type: "string", description: "需要跟进的事项描述", required: true },
			deadline: { type: "string", description: "截止日期", required: true },
			priority: { type: "string", description: "优先级：高/中/低", required: false },
			follow_up_reason: { type: "string", description: "跟进原因", required: false },
		},
		testCases: [
			{
				input: {
					item_description: "劳动合同签署",
					deadline: "2024-03-18",
					priority: "高",
					follow_up_reason: "合同逾期未签",
				},
				expectedOutcome: "completed",
			},
		],
	},
];

async function main() {
	const organizations = await db.organization.findMany();

	if (organizations.length === 0) {
		console.log("⚠️  No organizations found. Please create an organization first, then run this seed.");
		return;
	}

	console.log(`Found ${organizations.length} organization(s). Seeding builtin skills...`);

	for (const org of organizations) {
		console.log(`\nOrg: ${org.name} (${org.id})`);

		for (const skillData of BUILTIN_SKILLS) {
			const existing = await db.skill.findUnique({
				where: { organizationId_slug: { organizationId: org.id, slug: skillData.slug } },
			});

			if (existing) {
				console.log(`  ⏭  Skill "${skillData.name}" already exists, skipping`);
				continue;
			}

			await db.skill.create({
				data: {
					organizationId: org.id,
					name: skillData.name,
					slug: skillData.slug,
					description: skillData.description,
					systemPrompt: skillData.systemPrompt,
					contextSchema: skillData.contextSchema as any,
					testCases: skillData.testCases as any,
					isBuiltin: true,
				},
			});

			console.log(`  ✓ Created skill "${skillData.name}"`);
		}
	}

	console.log("\n✅ Seed completed!");
}

main()
	.catch((e) => {
		console.error("Seed failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
