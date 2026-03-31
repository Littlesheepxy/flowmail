"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

/**
 * agentType 含义（产品态，非运行时切换）：
 * - flowmail: 默认，侧边栏使用 Flowmail 云端 Agent
 * - openclaw: 当前组织已配置 OpenClaw 接入（MCP 结果回流可见）
 * - custom:   预留
 */
type AgentType = "flowmail" | "openclaw" | "custom";

export interface SuggestionExecution {
	entityId: string;
	entityTitle: string;
	actionLabel: string;
	actionTool: string;
	actionParams: Record<string, unknown>;
	suggestionMessage: string;
	severity: "info" | "warning" | "critical";
}

interface AgentState {
	agentType: AgentType;
	setAgentType: (type: AgentType) => void;
	isFloatingOpen: boolean;
	setIsFloatingOpen: (open: boolean) => void;
	toggleFloating: () => void;
	contextEntityId: string | null;
	setContextEntityId: (id: string | null) => void;
	isOpenClawConnected: boolean;
	setIsOpenClawConnected: (connected: boolean) => void;
	executeSuggestion: (exec: SuggestionExecution) => void;
	pendingExecution: SuggestionExecution | null;
	consumeExecution: () => SuggestionExecution | null;
}

const AgentContext = createContext<AgentState | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
	const [agentType, setAgentType] = useState<AgentType>("flowmail");
	const [isFloatingOpen, setIsFloatingOpen] = useState(false);
	const [contextEntityId, setContextEntityId] = useState<string | null>(null);
	const [isOpenClawConnected, setIsOpenClawConnected] = useState(false);
	const [pendingExecution, setPendingExecution] = useState<SuggestionExecution | null>(null);
	const pendingRef = useRef<SuggestionExecution | null>(null);

	const executeSuggestion = useCallback((exec: SuggestionExecution) => {
		pendingRef.current = exec;
		setPendingExecution(exec);
		setContextEntityId(exec.entityId);
		setIsFloatingOpen(true);
	}, []);

	const consumeExecution = useCallback(() => {
		const exec = pendingRef.current;
		pendingRef.current = null;
		setPendingExecution(null);
		return exec;
	}, []);

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
				executeSuggestion,
				pendingExecution,
				consumeExecution,
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
