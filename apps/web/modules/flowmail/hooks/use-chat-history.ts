"use client";

import type { UIMessage } from "ai";
import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "flowmail-chat-sessions";
const MAX_SESSIONS = 50;

interface ChatSession {
	id: string;
	scope: "entity" | "all";
	entityId: string | null;
	entityTitle: string | null;
	messages: UIMessage[];
	createdAt: string;
	updatedAt: string;
}

function readSessions(): ChatSession[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function writeSessions(sessions: ChatSession[]) {
	try {
		const trimmed = sessions.slice(0, MAX_SESSIONS);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
	} catch {
		// localStorage quota exceeded — silently ignore
	}
}

function getFirstUserMessage(messages: UIMessage[]): string {
	for (const msg of messages) {
		if (msg.role === "user") {
			const parts = msg.parts ?? [];
			for (const p of parts) {
				if ("text" in p && typeof p.text === "string" && p.text.trim()) {
					return p.text.trim().slice(0, 60);
				}
			}
		}
	}
	return "";
}

export function useChatHistory() {
	const [sessions, setSessions] = useState<ChatSession[]>(readSessions);
	const activeSessionIdRef = useRef<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const refresh = useCallback(() => {
		setSessions(readSessions());
	}, []);

	const saveSession = useCallback(
		(
			scope: "entity" | "all",
			entityId: string | null,
			entityTitle: string | null,
			messages: UIMessage[],
		) => {
			if (messages.length === 0) {
				return;
			}

			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			debounceRef.current = setTimeout(() => {
				const all = readSessions();
				const now = new Date().toISOString();
				const existingIdx = activeSessionIdRef.current
					? all.findIndex((s) => s.id === activeSessionIdRef.current)
					: -1;

				if (existingIdx >= 0) {
					all[existingIdx] = {
						...all[existingIdx],
						messages,
						entityTitle,
						updatedAt: now,
					};
				} else {
					const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
					activeSessionIdRef.current = id;
					all.unshift({
						id,
						scope,
						entityId,
						entityTitle,
						messages,
						createdAt: now,
						updatedAt: now,
					});
				}

				all.sort(
					(a, b) =>
						new Date(b.updatedAt).getTime() -
						new Date(a.updatedAt).getTime(),
				);
				writeSessions(all);
				setSessions(all.slice(0, MAX_SESSIONS));
			}, 1000);
		},
		[],
	);

	const loadSession = useCallback(
		(
			id: string,
		): { messages: UIMessage[]; scope: "entity" | "all"; entityId: string | null } | null => {
			const all = readSessions();
			const session = all.find((s) => s.id === id);
			if (!session) {
				return null;
			}
			activeSessionIdRef.current = id;
			return {
				messages: session.messages,
				scope: session.scope,
				entityId: session.entityId,
			};
		},
		[],
	);

	const deleteSession = useCallback((id: string) => {
		const all = readSessions().filter((s) => s.id !== id);
		writeSessions(all);
		setSessions(all);
		if (activeSessionIdRef.current === id) {
			activeSessionIdRef.current = null;
		}
	}, []);

	const clearAll = useCallback(() => {
		writeSessions([]);
		setSessions([]);
		activeSessionIdRef.current = null;
	}, []);

	const startNewSession = useCallback(() => {
		activeSessionIdRef.current = null;
	}, []);

	return {
		sessions,
		saveSession,
		loadSession,
		deleteSession,
		clearAll,
		startNewSession,
		refresh,
		getFirstUserMessage,
	};
}
