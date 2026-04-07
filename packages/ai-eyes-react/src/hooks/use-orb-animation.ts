import { useCallback, useEffect, useRef, useState } from "react";

export type OrbMood =
	| "idle"
	| "watching"
	| "thinking"
	| "alert"
	| "happy"
	| "sleeping"
	| "wink"
	| "confused"
	| "curious"
	| "sad";

export type EyeState = "open" | "closed" | "wink-right";

interface OrbAnimationState {
	mood: OrbMood;
	eyeState: EyeState;
	leftEyeR: number;
	rightEyeR: number;
	leftBreathe: number;
	rightBreathe: number;
	brightness: number;
	glowIntensity: number;
}

const BLINK_CLOSE_MS = 75;
const BLINK_OPEN_MS = 120;

function randomBetween(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

export function useOrbAnimation(externalMood?: OrbMood): OrbAnimationState {
	const [mood, setMood] = useState<OrbMood>(externalMood ?? "idle");
	const [eyeState, setEyeState] = useState<EyeState>("open");
	const [leftBreathe, setLeftBreathe] = useState(0);
	const [rightBreathe, setRightBreathe] = useState(0);
	const blinkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const sleepTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const lastActivityRef = useRef(Date.now());
	const breatheRaf = useRef(0);
	const breatheStart = useRef(0);

	useEffect(() => {
		if (externalMood !== undefined) {
			setMood(externalMood);
		}
	}, [externalMood]);

	// -- Random blink scheduler (Cassie-style opacity switch) --
	const triggerBlink = useCallback(() => {
		if (mood === "sleeping") {
			return;
		}

		setEyeState("closed");
		setTimeout(() => {
			setEyeState(mood === "wink" ? "wink-right" : "open");
			if (Math.random() < 0.12) {
				setTimeout(() => {
					setEyeState("closed");
					setTimeout(
						() => setEyeState(mood === "wink" ? "wink-right" : "open"),
						BLINK_CLOSE_MS,
					);
				}, 140);
			}
		}, BLINK_CLOSE_MS + BLINK_OPEN_MS);
	}, [mood]);

	useEffect(() => {
		const schedule = () => {
			const interval = randomBetween(1800, 4400);
			blinkTimerRef.current = setTimeout(() => {
				triggerBlink();
				schedule();
			}, interval);
		};
		schedule();
		return () => {
			if (blinkTimerRef.current) {
				clearTimeout(blinkTimerRef.current);
			}
		};
	}, [triggerBlink]);

	// -- Breathe animation (requestAnimationFrame) --
	useEffect(() => {
		breatheStart.current = performance.now();

		const loop = (now: number) => {
			const elapsed = (now - breatheStart.current) / 1000;
			setLeftBreathe(Math.sin(elapsed * 0.7) * 0.5 + 0.5);
			setRightBreathe(Math.sin(elapsed * 0.85 + 0.8) * 0.5 + 0.5);
			breatheRaf.current = requestAnimationFrame(loop);
		};
		breatheRaf.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(breatheRaf.current);
	}, []);

	// -- Activity tracking for auto-sleep --
	const recordActivity = useCallback(() => {
		lastActivityRef.current = Date.now();
		if (externalMood !== undefined) {
			return;
		}
		if (mood === "sleeping") {
			setMood("idle");
		}
		if (mood === "idle") {
			setMood("watching");
			if (idleTimerRef.current) {
				clearTimeout(idleTimerRef.current);
			}
			idleTimerRef.current = setTimeout(() => {
				setMood("idle");
			}, 5000);
		}
	}, [mood, externalMood]);

	useEffect(() => {
		const onMove = () => recordActivity();
		const onClick = () => recordActivity();
		document.addEventListener("mousemove", onMove, { passive: true });
		document.addEventListener("click", onClick, { passive: true });
		return () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("click", onClick);
		};
	}, [recordActivity]);

	useEffect(() => {
		if (externalMood !== undefined) {
			return;
		}
		const check = () => {
			const elapsed = Date.now() - lastActivityRef.current;
			if (elapsed > 60000 && mood !== "sleeping") {
				setMood("sleeping");
			}
		};
		sleepTimerRef.current = setInterval(
			check,
			10000,
		) as unknown as ReturnType<typeof setTimeout>;
		return () => {
			if (sleepTimerRef.current) {
				clearInterval(sleepTimerRef.current as unknown as number);
			}
		};
	}, [mood, externalMood]);

	// -- Sync eyeState with mood --
	useEffect(() => {
		switch (mood) {
			case "sleeping":
			case "happy":
				setEyeState("closed");
				break;
			case "wink":
				setEyeState("wink-right");
				break;
			default:
				setEyeState("open");
				break;
		}
	}, [mood]);

	const computeEyeRadii = (): { leftEyeR: number; rightEyeR: number } => {
		switch (mood) {
			case "curious":
			case "alert":
				return { leftEyeR: 3.5, rightEyeR: 3.5 };
			case "thinking":
				return { leftEyeR: 3, rightEyeR: 2.5 };
			case "confused":
				return { leftEyeR: 3, rightEyeR: 2.5 };
			case "sad":
				return { leftEyeR: 2.8, rightEyeR: 2.8 };
			default:
				return { leftEyeR: 3, rightEyeR: 3 };
		}
	};

	const computeBrightness = (): number => {
		switch (mood) {
			case "sleeping":
				return 0.6;
			case "alert":
				return 1.08;
			case "happy":
				return 1.05;
			case "sad":
				return 0.9;
			default:
				return 1.0;
		}
	};

	const computeGlow = (): number => {
		switch (mood) {
			case "sleeping":
				return 0.3;
			case "alert":
				return 1.4;
			case "happy":
				return 1.3;
			case "watching":
			case "curious":
				return 1.0;
			case "sad":
				return 0.4;
			default:
				return 0.7;
		}
	};

	const eyeRadii = computeEyeRadii();

	return {
		mood,
		eyeState,
		...eyeRadii,
		leftBreathe,
		rightBreathe,
		brightness: computeBrightness(),
		glowIntensity: computeGlow(),
	};
}
