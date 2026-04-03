import { useCallback, useEffect, useRef, useState } from "react";

interface Position {
	x: number;
	y: number;
}

const STORAGE_KEY = "ai-eyes-position";

function loadPosition(defaultPos: Position): Position {
	if (typeof window === "undefined") {
		return defaultPos;
	}
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored) as Position;
		}
	} catch {
		// ignore
	}
	return defaultPos;
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
	defaultPosition?: Position,
	onPositionChange?: (pos: Position) => void,
): {
	position: Position;
	isDragging: boolean;
	handlePointerDown: (e: React.PointerEvent) => void;
} {
	const fallback = defaultPosition ?? {
		x: typeof window !== "undefined" ? window.innerWidth - 72 : 0,
		y: typeof window !== "undefined" ? window.innerHeight - 72 : 0,
	};

	const [position, setPosition] = useState<Position>(() =>
		loadPosition(fallback),
	);
	const [isDragging, setIsDragging] = useState(false);
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
		onPositionChangeRef.current?.(position);
	}, [position]);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!enabled) {
				return;
			}
			dragState.current = {
				startX: e.clientX,
				startY: e.clientY,
				startPosX: position.x,
				startPosY: position.y,
				moved: false,
			};
			(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
		},
		[enabled, position],
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
		};
	}, [enabled, position]);

	return { position, isDragging, handlePointerDown };
}
