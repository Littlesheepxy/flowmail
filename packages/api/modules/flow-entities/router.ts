import { addTimelineEvent } from "./procedures/add-timeline-event";
import { getEntity } from "./procedures/get";
import { getTimelineDiff } from "./procedures/get-timeline-diff";
import { listEntities } from "./procedures/list";
import { predictEntityRisk } from "./procedures/predict-risk";
import { submitFeedback } from "./procedures/submit-feedback";
import { updateEntityStatus } from "./procedures/update-status";

export const flowEntitiesRouter = {
	list: listEntities,
	get: getEntity,
	updateStatus: updateEntityStatus,
	addTimelineEvent,
	getTimelineDiff,
	predictRisk: predictEntityRisk,
	submitFeedback,
};
