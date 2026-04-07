"use client";

import type {
	AiEyesCoreConfig,
	ConfusionEvent,
	HelpSuggestion,
	RecorderConfig,
} from "@ai-eyes/core";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import type { EyeMood } from "../hooks/use-eye-animation";
import { AiEyesProvider } from "../provider/AiEyesProvider";
import { AiEyes } from "./AiEyes";

interface AnalyzerAdapter {
	analyze(event: ConfusionEvent, appContext?: Record<string, unknown>): Promise<HelpSuggestion | null>;
}

/**
 * AiEyesKit — one-component integration for AI behavior sensing.
 *
 * Wraps Provider + Eyes + analysis in a single component.
 * Just drop it into your layout:
 *
 * ```tsx
 * <AiEyesKit analyzeUrl="/api/ai-eyes/analyze">
 *   {children}
 * </AiEyesKit>
 * ```
 *
 * Or bring your own adapter:
 *
 * ```tsx
 * <AiEyesKit adapter={myAdapter}>
 *   {children}
 * </AiEyesKit>
 * ```
 */
export interface AiEyesKitProps {
	children: ReactNode;

	/** URL for the built-in fetch adapter. Simplest integration path. */
	analyzeUrl?: string;
	/** Custom analyzer adapter (takes precedence over analyzeUrl). */
	adapter?: AnalyzerAdapter;
	/** Headers to include in fetch requests when using analyzeUrl. */
	headers?: Record<string, string>;

	/** Rolling window duration for the action recorder. Default 30s. */
	recorderDuration?: number;
	/** Full recorder config override. */
	recorderConfig?: RecorderConfig;

	/** Eye character size. Default 48. */
	eyeSize?: number;
	/** Initial position. Default "bottom-right". */
	eyePosition?: "bottom-right" | "bottom-left";
	/** Whether the eye is draggable. Default true. */
	draggable?: boolean;
	/** Callback when user clicks the eye. */
	onClick?: () => void;
	/** Callback when user accepts a help suggestion. */
	onHelpAccepted?: (suggestion: HelpSuggestion) => void;
	/** Override eye mood externally. */
	mood?: EyeMood;
	/** Disable the entire system. */
	disabled?: boolean;
	/** CSS custom properties / inline styles for the eye. */
	eyeStyle?: React.CSSProperties;
	/** CSS class for the eye. */
	eyeClassName?: string;

	/** Locale strings. */
	locale?: {
		helpAccept?: string;
		helpDismiss?: string;
	};

	/** Extra app context passed to the AI analyzer alongside each confusion event. */
	appContext?: Record<string, unknown>;
}

function createFetchAdapter(url: string, headers?: Record<string, string>): AnalyzerAdapter {
	return {
		async analyze(event, appContext) {
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...headers },
				body: JSON.stringify({ confusionEvent: event, appContext }),
			});
			if (!res.ok) {
				return null;
			}
			return (await res.json()) as HelpSuggestion;
		},
	};
}

export function AiEyesKit({
	children,
	analyzeUrl = "/api/ai-eyes/analyze",
	adapter,
	headers,
	recorderDuration,
	recorderConfig,
	eyeSize = 48,
	eyePosition = "bottom-right",
	draggable = true,
	onClick,
	onHelpAccepted,
	mood,
	disabled,
	eyeStyle,
	eyeClassName,
	locale,
	appContext,
}: AiEyesKitProps) {
	const effectiveAdapter = useMemo(
		() => adapter ?? createFetchAdapter(analyzeUrl, headers),
		[adapter, analyzeUrl, headers],
	);
	const appContextRef = useRef(appContext);
	appContextRef.current = appContext;

	const config = useMemo<AiEyesCoreConfig>(
		() => ({
			enabled: !disabled,
			recorder: recorderConfig ?? (recorderDuration ? { durationMs: recorderDuration } : undefined),
		}),
		[disabled, recorderConfig, recorderDuration],
	);

	const handleConfusion = useCallback(
		async (event: ConfusionEvent): Promise<HelpSuggestion | null> => {
			try {
				return await effectiveAdapter.analyze(event, appContextRef.current);
			} catch {
				return null;
			}
		},
		[effectiveAdapter],
	);

	if (disabled) {
		return <>{children}</>;
	}

	return (
		<AiEyesProvider config={config} onConfusion={handleConfusion}>
			{children}
			<AiEyes
				size={eyeSize}
				position={eyePosition}
				draggable={draggable}
				onClick={onClick}
				onHelpAccepted={onHelpAccepted}
				mood={mood}
				locale={locale}
				className={eyeClassName}
				style={eyeStyle}
			/>
		</AiEyesProvider>
	);
}
