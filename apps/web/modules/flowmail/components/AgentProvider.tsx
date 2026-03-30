"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * agentType 含义（产品态，非运行时切换）：
 * - flowmail: 默认，侧边栏使用 Flowmail 云端 Agent
 * - openclaw: 当前组织已配置 OpenClaw 接入（MCP 结果回流可见）
 * - custom:   预留
 */
type AgentType = "flowmail" | "openclaw" | "custom";

interface AgentState {
	agentType: AgentType;
	setAgentType: (type: AgentType) => void;
	isFloatingOpen: boolean;
	setIsFloatingOpen: (open: boolean) => void;
	toggleFloating: () => void;
	contextEntityId: string | null;
	setContextEntityId: (id: string | null) => void;
	/** OpenClaw 是否已配置接入（驱动 UI 提示与来源标注） */
	isOpenClawConnected: boolean;
	setIsOpenClawConnected: (connected: boolean) => void;
}

const AgentContext = createContext<AgentState | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
	const [agentType, setAgentType] = useState<AgentType>("flowmail");
	const [isFloatingOpen, setIsFloatingOpen] = useState(false);
	const [contextEntityId, setContextEntityId] = useState<string | null>(null);
	const [isOpenClawConnected, setIsOpenClawConnected] = useState(false);

	return (
		<AgentContext.Provider
			value={{
				agentType,
				setAgentType,
				isFloatingOpen,
				setIsFloatingOpen,
				toggleFloating: () => setIsFloatingOpen((v) => !v),
				contextEntityId,
				setContextEntityId,
				isOpenClawConnected,
				setIsOpenClawConnected,
			}}
		>
			{children}
		</AgentContext.Provider>
	);
}

export function useAgent() {
	const ctx = useContext(AgentContext);
	if (!ctx) {
		throw new Error("useAgent must be used within AgentProvider");
	}
	return ctx;
}
