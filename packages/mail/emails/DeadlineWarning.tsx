import { Hr, Link, Section, Text } from "@react-email/components";
import React from "react";
import PrimaryButton from "../components/PrimaryButton";
import Wrapper from "../components/Wrapper";

interface DeadlineWarningProps {
	entityTitle: string;
	deadline: string;
	hoursRemaining: number;
	entityUrl: string;
	isOverdue?: boolean;
}

export function DeadlineWarning({
	entityTitle,
	deadline,
	hoursRemaining,
	entityUrl,
	isOverdue,
}: DeadlineWarningProps) {
	const urgencyLabel = isOverdue
		? "已过期"
		: hoursRemaining <= 24
			? "紧急：剩余不到 24 小时"
			: "提醒：剩余不到 48 小时";

	const urgencyColor = isOverdue || hoursRemaining <= 24 ? "#ef4444" : "#f59e0b";

	return (
		<Wrapper>
			<Section
				style={{
					backgroundColor: `${urgencyColor}10`,
					borderLeft: `4px solid ${urgencyColor}`,
					borderRadius: "4px",
					padding: "12px 16px",
					marginBottom: "16px",
				}}
			>
				<Text
					style={{
						color: urgencyColor,
						fontWeight: 600,
						fontSize: "14px",
						margin: 0,
					}}
				>
					{urgencyLabel}
				</Text>
			</Section>

			<Text className="text-foreground text-base font-semibold">
				{entityTitle}
			</Text>

			<Text className="text-muted-foreground text-sm">
				截止日期：{deadline}
				{!isOverdue && ` （剩余约 ${Math.ceil(hoursRemaining)} 小时）`}
				{isOverdue && " （已过期）"}
			</Text>

			<Text className="text-muted-foreground text-sm">
				请尽快处理此审批事项，避免影响业务进度。
			</Text>

			<PrimaryButton href={entityUrl}>查看并处理 &rarr;</PrimaryButton>

			<Hr className="border-border my-4" />

			<Text className="text-muted-foreground text-xs">
				此邮件由 Flowmail 系统自动发送。
				<Link href={entityUrl} className="text-primary">
					点击查看详情
				</Link>
			</Text>
		</Wrapper>
	);
}

DeadlineWarning.PreviewProps = {
	entityTitle: "Q1 预算审批申请",
	deadline: "2026-04-03",
	hoursRemaining: 18,
	entityUrl: "https://flowmail.app/inbox/entity-123",
	isOverdue: false,
};

export default DeadlineWarning;
