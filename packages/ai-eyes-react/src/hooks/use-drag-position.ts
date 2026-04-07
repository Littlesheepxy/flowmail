import { useCallback, useEffect, useRef, useState } from "react";

interface Position {
	x: number;
	y: number;
}

const STORAGE_KEY = "ai-eyes-position";

function loadPosition(): Position | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored) as Position;
		}
	} catch {
		// ignore
	}
	return null;
}

function savePosition(pos: Position): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
	} catch {
		// ignore
	}
}

export function useDragPosition(
	enabled: boolean,
	onPositionChange?: (pos: Position) => void,
): {
	position: Position;
	isDragging: boolean;
	hasDragged: boolean;
	handlePointerDown: (e: React.PointerEvent) => void;
} {
	const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [hasDragged, setHasDragged] = useState(false);
	const dragState = useRef<{
		startX: number;
		startY: number;
		startPosX: number;
		startPosY: number;
		moved: boolean;
	} | null>(null);
	const onPositionChangeRef = useRef(onPositionChange);
	onPositionChangeRef.current = onPositionChange;

	useEffect(() => {
		const saved = loadPosition();
		if (saved) {
			setPosition(saved);
			setHasDragged(true);
		}
	}, []);

	useEffect(() => {
		if (hasDragged) {
			onPositionChangeRef.current?.(position);
		}
	}, [position, hasDragged]);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!enabled || e.button !== 0) {
				return;
			}
			const el = e.currentTarget as HTMLElement;
			const rect = el.getBoundingClientRect();
			dragState.current = {
				startX: e.clientX,
				startY: e.clientY,
				startPosX: rect.left,
				startPosY: rect.top,
				moved: false,
			};
			el.setPointerCapture?.(e.pointerId);
		},
		[enabled],
	);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const onMove = (e: PointerEvent) => {
			if (!dragState.current) {
				return;
			}
			const dx = e.clientX - dragState.current.startX;
			const dy = e.clientY - dragState.current.startY;
			if (!dragState.current.moved && Math.abs(dx) + Math.abs(dy) < 5) {
				return;
			}
			dragState.current.moved = true;
			setIsDragging(true);
			setHasDragged(true);

			const newX = Math.max(
				0,
				Math.min(
					window.innerWidth - 56,
					dragState.current.startPosX + dx,
				),
			);
			const newY = Math.max(
				0,
				Math.min(
					window.innerHeight - 56,
					dragState.current.startPosY + dy,
				),
			);
			setPosition({ x: newX, y: newY });
		};

		const onUp = () => {
			if (dragState.current?.moved) {
				savePosition(position);
			}
			dragState.current = null;
			setIsDragging(false);
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
		return () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			dragState.current = null;
			setIsDragging(false);
		};
	}, [enabled, position]);

	return { position, isDragging, hasDragged, handlePointerDown };
}
