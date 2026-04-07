import { Hr, Link, Section, Text } from "@react-email/components";
import React from "react";
import PrimaryButton from "../components/PrimaryButton";
import Wrapper from "../components/Wrapper";

interface ApprovalResultProps {
	entityTitle: string;
	result: "approved" | "rejected";
	comment?: string;
	actorName?: string;
	entityUrl: string;
}

export function ApprovalResult({
	entityTitle,
	result,
	comment,
	actorName,
	entityUrl,
}: ApprovalResultProps) {
	const isApproved = result === "approved";
	const statusLabel = isApproved ? "已通过" : "已拒绝";
	const statusColor = isApproved ? "#22c55e" : "#ef4444";

	return (
		<Wrapper>
			<Section
				style={{
					backgroundColor: `${statusColor}10`,
					borderLeft: `4px solid ${statusColor}`,
					borderRadius: "4px",
					padding: "12px 16px",
					marginBottom: "16px",
				}}
			>
				<Text
					style={{
						color: statusColor,
						fontWeight: 600,
						fontSize: "14px",
						margin: 0,
					}}
				>
					审批{statusLabel}
				</Text>
			</Section>

			<Text className="text-foreground text-base font-semibold">
				{entityTitle}
			</Text>

			<Text className="text-muted-foreground text-sm">
				{actorName ? `${actorName} ` : ""}已将此审批标记为{statusLabel}
				。
			</Text>

			{comment && (
				<Section
					style={{
						backgroundColor: "#f8fafc",
						borderRadius: "4px",
						padding: "12px 16px",
						marginTop: "8px",
						marginBottom: "8px",
					}}
				>
					<Text
						className="text-muted-foreground text-sm"
						style={{ margin: 0 }}
					>
						{isApproved ? "批注" : "拒绝原因"}：{comment}
					</Text>
				</Section>
			)}

			<PrimaryButton href={entityUrl}>查看详情 &rarr;</PrimaryButton>

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

ApprovalResult.PreviewProps = {
	entityTitle: "Q1 预算审批申请",
	result: "approved" as const,
	comment: "预算合理，同意。",
	actorName: "张三",
	entityUrl: "https://flowmail.app/inbox/entity-123",
};

export default ApprovalResult;
