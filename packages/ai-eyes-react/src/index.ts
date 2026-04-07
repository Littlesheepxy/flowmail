export { AiEyes } from "./components/AiEyes";
export type { AiEyesProps, AiEyesPosition } from "./components/AiEyes";
export { AiEyesKit } from "./components/AiEyesKit";
export type { AiEyesKitProps } from "./components/AiEyesKit";
export { OrbDots } from "./components/OrbDots";
export { RadialMoodMenu, DEFAULT_RADIAL_ITEMS } from "./components/RadialMoodMenu";
export type { RadialMenuItem } from "./components/RadialMoodMenu";
/** @deprecated Use OrbDots instead */
export { EyeSvg } from "./components/EyeSvg";
export { HelpBubble } from "./components/HelpBubble";
export { AiEyesProvider, useAiEyes } from "./provider/AiEyesProvider";
export { useMouseTracker } from "./hooks/use-mouse-tracker";
export { useOrbAnimation } from "./hooks/use-orb-animation";
export type { OrbMood, EyeState } from "./hooks/use-orb-animation";
/** @deprecated Use useOrbAnimation + OrbMood instead */
export { useEyeAnimation } from "./hooks/use-eye-animation";
export type { EyeMood } from "./hooks/use-eye-animation";
export { useDragPosition } from "./hooks/use-drag-position";
