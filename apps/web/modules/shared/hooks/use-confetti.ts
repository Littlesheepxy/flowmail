"use client";

import { useCallback } from "react";

export function useConfetti() {
	const fire = useCallback(async () => {
		const confetti = (await import("canvas-confetti")).default;
		const duration = 2000;
		const end = Date.now() + duration;

		const frame = () => {
			confetti({
				particleCount: 3,
				angle: 60,
				spread: 55,
				origin: { x: 0, y: 0.65 },
				colors: ["#6366f1", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"],
			});
			confetti({
				particleCount: 3,
				angle: 120,
				spread: 55,
				origin: { x: 1, y: 0.65 },
				colors: ["#6366f1", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"],
			});

			if (Date.now() < end) {
				requestAnimationFrame(frame);
			}
		};

		frame();
	}, []);

	return { fire };
}
