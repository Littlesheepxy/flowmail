export { DEFAULT_SENSOR_CONFIG, DEFAULT_SIGNAL_WEIGHTS } from "./constants";
export { ActionRecorder } from "./sensor/action-recorder";
export { BehaviorSensor } from "./sensor/behavior-sensor";
export { ConfusionDetector } from "./sensor/confusion-detector";
export { ContextCollector } from "./sensor/context-collector";
export type {
	ActionType,
	AiEyesCoreConfig,
	ConfusionEvent,
	ConfusionSignal,
	HelpSuggestion,
	PageContext,
	RecorderConfig,
	SensorConfig,
	SignalType,
	UserAction,
} from "./types";
