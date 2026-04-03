"use client";

import {
	ActionRecorder,
	BehaviorSensor,
	ConfusionDetector,
	ContextCollector,
	type AiEyesCoreConfig,
	type ConfusionEvent,
	type HelpSuggestion,
} from "@ai-eyes/core";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type { EyeMood } from "../hooks/use-eye-animation";

interface AiEyesContextValue {
	sensor: BehaviorSensor;
	detector: ConfusionDetector;
	collector: ContextCollector;
	recorder: ActionRecorder;

	mood: EyeMood;
	setMood: (mood: EyeMood) => void;

	activeSuggestion: HelpSuggestion | null;
	setActiveSuggestion: (s: HelpSuggestion | null) => void;

	confusionScore: number;
	enabled: boolean;
	setEnabled: (v: boolean) => void;
}

const AiEyesContext = createContext<AiEyesContextValue | null>(null);

interface AiEyesProviderProps {
	config?: AiEyesCoreConfig;
	onConfusion?: (event: ConfusionEvent) => Promise<HelpSuggestion | null> | void;
	children: ReactNode;
}

export function AiEyesProvider({
	config,
	onConfusion,
	children,
}: AiEyesProviderProps) {
	const [mood, setMood] = useState<EyeMood>("idle");
	const [activeSuggestion, setActiveSuggestion] =
		useState<HelpSuggestion | null>(null);
	const [confusionScore, setConfusionScore] = useState(0);
	const [enabled, setEnabled] = useState(config?.enabled !== false);
	const onConfusionRef = useRef(onConfusion);
	onConfusionRef.current = onConfusion;

	const sensor = useMemo(
		() => new BehaviorSensor(config?.sensor, config?.recorder),
		// biome-ignore lint: config is a stable prop from parent
		[],
	);
	const detector = useMemo(
		() => new ConfusionDetector(config?.sensor),
		[],
	);
	const collector = useMemo(() => new ContextCollector(), []);
	const recorder = sensor.recorder;

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const unsubSignal = sensor.onSignal((signal) => {
			const ctx = collector.collect();
			const actions = sensor.getRecentActions();
			detector.addSignal(signal, ctx, actions);
			setConfusionScore(detector.getScore());
		});

		const unsubConfusion = detector.onConfusion(async (event) => {
			setMood("thinking");
			try {
				const result = await onConfusionRef.current?.(event);
				if (result?.shouldHelp) {
					setMood("alert");
					setActiveSuggestion(result);
				} else {
					setMood("watching");
				}
			} catch {
				setMood("watching");
			}
		});

		sensor.start();

		return () => {
			sensor.stop();
			unsubSignal();
			unsubConfusion();
		};
	}, [enabled, sensor, detector, collector]);

	const contextValue = useMemo(
		() => ({
			sensor,
			detector,
			collector,
			recorder,
			mood,
			setMood,
			activeSuggestion,
			setActiveSuggestion,
			confusionScore,
			enabled,
			setEnabled,
		}),
		[sensor, detector, collector, recorder, mood, activeSuggestion, confusionScore, enabled],
	);

	return (
		<AiEyesContext.Provider value={contextValue}>
			{children}
		</AiEyesContext.Provider>
	);
}

export function useAiEyes(): AiEyesContextValue {
	const ctx = useContext(AiEyesContext);
	if (!ctx) {
		throw new Error("useAiEyes must be used within <AiEyesProvider>");
	}
	return ctx;
}
