import { useCallback, useRef, useState } from "react";
import type { ChatAdapter, ChatMessage, SendOptions } from "./types";

interface RestSseConfig {
	apiUrl: string;
	headers?: Record<string, string>;
}

export function useRestSseAdapter(config: RestSseConfig): ChatAdapter {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const idCounter = useRef(0);

	const send = useCallback(
		(options: SendOptions) => {
			const userMsg: ChatMessage = {
				id: `user-${++idCounter.current}`,
				role: "user",
				content: options.message,
				timestamp: Date.now(),
			};
			setMessages((prev) => [...prev, userMsg]);
			setIsLoading(true);
			setError(null);

			const assistantId = `assistant-${++idCounter.current}`;

			fetch(config.apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...config.headers,
				},
				body: JSON.stringify({
					messages: [...messages, userMsg].map((m) => ({
						role: m.role,
						content: m.content,
					})),
					context: options.context,
				}),
			})
				.then(async (res) => {
					if (!res.ok) {
						throw new Error(`Chat API error: ${res.status}`);
					}

					if (!res.body) {
						const data = (await res.json()) as { content?: string };
						setMessages((prev) => [
							...prev,
							{
								id: assistantId,
								role: "assistant",
								content: data.content ?? "",
								timestamp: Date.now(),
							},
						]);
						setIsLoading(false);
						return;
					}

					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					let content = "";

					setMessages((prev) => [
						...prev,
						{
							id: assistantId,
							role: "assistant",
							content: "",
							timestamp: Date.now(),
						},
					]);

					const read = async () => {
						const { done, value } = await reader.read();
						if (done) {
							setIsLoading(false);
							return;
						}
						const text = decoder.decode(value);
						const lines = text.split("\n");
						for (const line of lines) {
							if (line.startsWith("data: ")) {
								const data = line.slice(6);
								if (data === "[DONE]") {
									setIsLoading(false);
									return;
								}
								try {
									const parsed = JSON.parse(data) as {
										choices?: Array<{
											delta?: { content?: string };
										}>;
									};
									const delta =
										parsed.choices?.[0]?.delta?.content ??
										"";
									content += delta;
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantId
												? { ...m, content }
												: m,
										),
									);
								} catch {
									content += data;
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantId
												? { ...m, content }
												: m,
										),
									);
								}
							}
						}
						await read();
					};

					await read();
				})
				.catch((err) => {
					setError(
						err instanceof Error ? err : new Error(String(err)),
					);
					setIsLoading(false);
				});
		},
		[config.apiUrl, config.headers, messages],
	);

	return { send, messages, isLoading, error };
}
