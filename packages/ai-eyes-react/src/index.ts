export type { AiEyesPosition, AiEyesProps } from "./components/AiEyes";
export { AiEyes } from "./components/AiEyes";
export type { AiEyesKitProps } from "./components/AiEyesKit";
export { AiEyesKit } from "./components/AiEyesKit";
/** @deprecated Use OrbDots instead */
export { EyeSvg } from "./components/EyeSvg";
export { HelpBubble } from "./components/HelpBubble";
export { OrbDots } from "./components/OrbDots";
export type { RadialMenuItem } from "./components/RadialMoodMenu";
export {
	DEFAULT_RADIAL_ITEMS,
	RadialMoodMenu,
} from "./components/RadialMoodMenu";
export { useDragPosition } from "./hooks/use-drag-position";
export type { EyeMood } from "./hooks/use-eye-animation";
/** @deprecated Use useOrbAnimation + OrbMood instead */
export { useEyeAnimation } from "./hooks/use-eye-animation";
export { useMouseTracker } from "./hooks/use-mouse-tracker";
export type { EyeState, OrbMood } from "./hooks/use-orb-animation";
export { useOrbAnimation } from "./hooks/use-orb-animation";
export { AiEyesProvider, useAiEyes } from "./provider/AiEyesProvider";
