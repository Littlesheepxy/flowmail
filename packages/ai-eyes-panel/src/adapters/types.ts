export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface SendOptions {
	message: string;
	context?: Record<string, unknown>;
}

export interface ChatAdapter {
	send(options: SendOptions): void;
	messages: ChatMessage[];
	isLoading: boolean;
	error?: Error | null;
}

export interface SuggestionChip {
	label: string;
	message: string;
}
