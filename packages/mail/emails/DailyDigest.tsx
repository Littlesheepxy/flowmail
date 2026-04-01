import { Hr, Link, Section, Text } from "@react-email/components";
import React from "react";
import PrimaryButton from "../components/PrimaryButton";
import Wrapper from "../components/Wrapper";

interface DigestItem {
	label: string;
	count: number;
	color?: string;
}

interface DailyDigestProps {
	date: string;
	items: DigestItem[];
	inboxUrl: string;
	organizationName?: string;
}

export function DailyDigest({
	date,
	items,
	inboxUrl,
	organizationName,
}: DailyDigestProps) {
	return (
		<Wrapper>
			<Text className="text-foreground text-lg font-semibold" style={{ margin: "0 0 4px" }}>
				每日摘要
			</Text>
			<Text className="text-muted-foreground text-xs" style={{ margin: "0 0 16px" }}>
				{organizationName ? `${organizationName} · ` : ""}{date}
			</Text>

			<Section
				style={{
					backgroundColor: "#f8f8f8",
					borderRadius: "8px",
					padding: "16px",
					marginBottom: "16px",
				}}
			>
				{items.map((item) => (
					<Section
						key={item.label}
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							padding: "8px 0",
							borderBottom: "1px solid #eaeaea",
						}}
					>
						<Text className="text-foreground text-sm" style={{ margin: 0 }}>
							{item.label}
						</Text>
						<Text
							style={{
								color: item.color ?? "#313539",
								fontWeight: 600,
								fontSize: "18px",
								margin: 0,
							}}
						>
							{item.count}
						</Text>
					</Section>
				))}
			</Section>

			{items.some((i) => i.count > 0) && (
				<PrimaryButton href={inboxUrl}>查看收件箱 &rarr;</PrimaryButton>
			)}

			<Hr className="border-border my-4" />

			<Text className="text-muted-foreground text-xs">
				此邮件由 Flowmail 系统每日自动发送。
				<Link href={inboxUrl} className="text-primary">
					管理通知偏好
				</Link>
			</Text>
		</Wrapper>
	);
}

DailyDigest.PreviewProps = {
	date: "2026年4月1日",
	items: [
		{ label: "待审批", count: 3, color: "#f59e0b" },
		{ label: "昨日新增", count: 5 },
		{ label: "状态变更", count: 2 },
		{ label: "即将到期", count: 1, color: "#ef4444" },
	],
	inboxUrl: "https://flowmail.app/inbox",
	organizationName: "Acme Corp",
};

export default DailyDigest;
