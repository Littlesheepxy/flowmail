import { dismissSetupGuide } from "./procedures/dismiss";
import { getSetupGuideStatus } from "./procedures/get-status";
import { markSetupStep } from "./procedures/mark-step";

export const setupGuideRouter = {
	getStatus: getSetupGuideStatus,
	markStep: markSetupStep,
	dismiss: dismissSetupGuide,
};
