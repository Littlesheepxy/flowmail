import type { AiAdapter, AnalyzeRequest, AnalyzeResponse } from "./types";

interface VercelAiAdapterConfig {
	apiUrl?: string;
	headers?: Record<string, string>;
	/** 客户端超时毫秒，默认 12s（小于服务端 maxDuration 才能优雅取消）。设 0 关闭超时。 */
	timeoutMs?: number;
}

const NOOP_RESPONSE: AnalyzeResponse = {
	shouldHelp: false,
	message: "",
	confidence: 0,
};

export function createVercelAiAdapter(
	config?: VercelAiAdapterConfig,
): AiAdapter {
	const apiUrl = config?.apiUrl ?? "/api/ai-eyes/analyze";
	const timeoutMs = config?.timeoutMs ?? 12_000;

	return {
		async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
			// AI Eyes 是辅助型功能（用户困惑检测），失败必须静默：
			// 否则后台请求 408/超时会污染 console，让用户误以为页面挂了（2026-04-19 误诊事件）。
			const controller =
				timeoutMs > 0 && typeof AbortController !== "undefined"
					? new AbortController()
					: null;
			const timer = controller
				? setTimeout(() => controller.abort(), timeoutMs)
				: null;

			try {
				const res = await fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...config?.headers,
					},
					body: JSON.stringify({
						confusionEvent: request.confusionEvent,
						appContext: request.appContext,
						locale: request.locale,
					}),
					signal: controller?.signal,
				});

				if (!res.ok) {
					return NOOP_RESPONSE;
				}

				try {
					return (await res.json()) as AnalyzeResponse;
				} catch {
					return NOOP_RESPONSE;
				}
			} catch {
				return NOOP_RESPONSE;
			} finally {
				if (timer) {
					clearTimeout(timer);
				}
			}
		},
	};
}
