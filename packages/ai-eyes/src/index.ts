export { BehaviorSensor } from "./sensor/behavior-sensor";
export { ConfusionDetector } from "./sensor/confusion-detector";
export { ContextCollector } from "./sensor/context-collector";
export { ActionRecorder } from "./sensor/action-recorder";
export { DEFAULT_SIGNAL_WEIGHTS, DEFAULT_SENSOR_CONFIG } from "./constants";
export type {
	SignalType,
	ActionType,
	ConfusionSignal,
	ConfusionEvent,
	PageContext,
	UserAction,
	SensorConfig,
	RecorderConfig,
	AiEyesCoreConfig,
	HelpSuggestion,
} from "./types";
