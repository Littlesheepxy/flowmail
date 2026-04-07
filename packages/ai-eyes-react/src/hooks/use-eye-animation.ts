import { useCallback, useEffect, useRef, useState } from "react";

export type EyeMood =
	| "idle"
	| "watching"
	| "thinking"
	| "alert"
	| "happy"
	| "sleeping"
	| "wink";

interface EyeAnimationState {
	mood: EyeMood;
	blinkPhase: "open" | "closing" | "closed" | "opening";
	leftEyeScale: { x: number; y: number };
	rightEyeScale: { x: number; y: number };
	mouthPath: string;
	pupilScale: number;
	bodyBounce: number;
}

const BLINK_INTERVAL_BASE = 4000;
const BLINK_INTERVAL_RANDOM = 3000;
const BLINK_DURATION = 150;

export function useEyeAnimation(externalMood?: EyeMood): EyeAnimationState {
	const [mood, setMood] = useState<EyeMood>(externalMood ?? "idle");
	const [blinkPhase, setBlinkPhase] =
		useState<EyeAnimationState["blinkPhase"]>("open");
	const [bodyBounce, setBodyBounce] = useState(0);
	const blinkTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const sleepTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const lastActivityRef = useRef(Date.now());

	useEffect(() => {
		if (externalMood !== undefined) {
			setMood(externalMood);
		}
	}, [externalMood]);

	const triggerBlink = useCallback(() => {
		if (mood === "sleeping" || mood === "happy") {
			return;
		}
		setBlinkPhase("closing");
		setTimeout(() => setBlinkPhase("closed"), BLINK_DURATION / 3);
		setTimeout(() => setBlinkPhase("opening"), (BLINK_DURATION * 2) / 3);
		setTimeout(() => setBlinkPhase("open"), BLINK_DURATION);
	}, [mood]);

	useEffect(() => {
		const scheduleBlink = () => {
			const interval =
				BLINK_INTERVAL_BASE + Math.random() * BLINK_INTERVAL_RANDOM;
			blinkTimerRef.current = setTimeout(() => {
				triggerBlink();
				scheduleBlink();
			}, interval);
		};
		scheduleBlink();
		return () => {
			if (blinkTimerRef.current) {
				clearTimeout(blinkTimerRef.current);
			}
		};
	}, [triggerBlink]);

	const recordActivity = useCallback(() => {
		lastActivityRef.current = Date.now();
		if (mood === "sleeping") {
			setMood("idle");
		}
		if (mood === "idle" && externalMood === undefined) {
			setMood("watching");
			if (idleTimerRef.current) {
				clearTimeout(idleTimerRef.current);
			}
			idleTimerRef.current = setTimeout(() => {
				if (externalMood === undefined) {
					setMood("idle");
				}
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

	useEffect(() => {
		if (mood === "alert") {
			setBodyBounce(1);
			const t = setTimeout(() => setBodyBounce(0), 400);
			return () => clearTimeout(t);
		}
		if (mood === "happy") {
			setBodyBounce(0.5);
			const t = setTimeout(() => setBodyBounce(0), 300);
			return () => clearTimeout(t);
		}
	}, [mood]);

	const getEyeScale = (): { x: number; y: number } => {
		if (blinkPhase === "closed" || blinkPhase === "closing") {
			return { x: 1, y: 0.1 };
		}
		if (blinkPhase === "opening") {
			return { x: 1, y: 0.5 };
		}
		switch (mood) {
			case "idle":
				return { x: 1, y: 0.8 };
			case "watching":
				return { x: 1, y: 1 };
			case "thinking":
				return { x: 1, y: 0.6 };
			case "alert":
				return { x: 1.05, y: 1.1 };
			case "happy":
				return { x: 1.1, y: 0.15 };
			case "sleeping":
				return { x: 1, y: 0.05 };
			case "wink":
				return { x: 1, y: 1 };
			default:
				return { x: 1, y: 1 };
		}
	};

	const getWinkRightEye = (): { x: number; y: number } => {
		if (mood === "wink") {
			return { x: 1, y: 0.1 };
		}
		return getEyeScale();
	};

	const getMouthPath = (): string => {
		switch (mood) {
			case "happy":
				return "M17 33 Q24 38 31 33";
			case "alert":
				return "M20 33 Q24 34 28 33";
			case "sleeping":
				return "M20 33 Q24 32 28 33";
			case "thinking":
				return "M21 33 Q24 32 27 33";
			default:
				return "M19 33 Q24 36 29 33";
		}
	};

	const getPupilScale = (): number => {
		switch (mood) {
			case "alert":
				return 1.2;
			case "thinking":
				return 0.85;
			case "sleeping":
				return 0;
			case "happy":
				return 0;
			default:
				return 1;
		}
	};

	const eyeScale = getEyeScale();

	return {
		mood,
		blinkPhase,
		leftEyeScale: eyeScale,
		rightEyeScale: getWinkRightEye(),
		mouthPath: getMouthPath(),
		pupilScale: getPupilScale(),
		bodyBounce,
	};
}
