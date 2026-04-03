import { useCallback, useEffect, useRef, useState } from "react";

interface MousePosition {
	x: number;
	y: number;
}

interface PupilOffset {
	x: number;
	y: number;
}

interface MouseTrackerConfig {
	maxOffset: number;
	smoothing: number;
	deadZone: number;
	active: boolean;
	lowPowerFps?: number;
}

export function useMouseTracker(
	eyeRef: React.RefObject<HTMLElement | SVGElement | null>,
	config: MouseTrackerConfig,
): PupilOffset {
	const [pupil, setPupil] = useState<PupilOffset>({ x: 0, y: 0 });
	const mousePos = useRef<MousePosition>({ x: 0, y: 0 });
	const currentPupil = useRef<PupilOffset>({ x: 0, y: 0 });
	const rafId = useRef<number>(0);
	const lastFrame = useRef(0);

	const minInterval = config.active ? 16 : 1000 / (config.lowPowerFps ?? 15);

	const animate = useCallback(() => {
		const now = performance.now();
		if (now - lastFrame.current < minInterval) {
			rafId.current = requestAnimationFrame(animate);
			return;
		}
		lastFrame.current = now;

		const el = eyeRef.current;
		if (!el) {
			rafId.current = requestAnimationFrame(animate);
			return;
		}

		const rect = el.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const dx = mousePos.current.x - centerX;
		const dy = mousePos.current.y - centerY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		let targetX = 0;
		let targetY = 0;

		if (dist > config.deadZone) {
			const angle = Math.atan2(dy, dx);
			const clampedDist = Math.min(dist, 600);
			const normalized = clampedDist / 600;
			targetX = Math.cos(angle) * normalized * config.maxOffset;
			targetY = Math.sin(angle) * normalized * config.maxOffset;
		}

		const prev = currentPupil.current;
		const newX = prev.x + (targetX - prev.x) * config.smoothing;
		const newY = prev.y + (targetY - prev.y) * config.smoothing;

		if (
			Math.abs(newX - prev.x) > 0.01 ||
			Math.abs(newY - prev.y) > 0.01
		) {
			currentPupil.current = { x: newX, y: newY };
			setPupil({ x: newX, y: newY });
		}

		rafId.current = requestAnimationFrame(animate);
	}, [eyeRef, config.maxOffset, config.smoothing, config.deadZone, minInterval]);

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			mousePos.current = { x: e.clientX, y: e.clientY };
		};
		document.addEventListener("mousemove", onMouseMove, { passive: true });
		rafId.current = requestAnimationFrame(animate);

		return () => {
			document.removeEventListener("mousemove", onMouseMove);
			cancelAnimationFrame(rafId.current);
		};
	}, [animate]);

	return pupil;
}
