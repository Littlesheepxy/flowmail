import { getEntity } from "./procedures/get";
import { listEntities } from "./procedures/list";
import { updateEntityStatus } from "./procedures/update-status";
import { addTimelineEvent } from "./procedures/add-timeline-event";
import { getTimelineDiff } from "./procedures/get-timeline-diff";
import { predictEntityRisk } from "./procedures/predict-risk";
import { submitFeedback } from "./procedures/submit-feedback";

export const flowEntitiesRouter = {
	list: listEntities,
	get: getEntity,
	updateStatus: updateEntityStatus,
	addTimelineEvent,
	getTimelineDiff,
	predictRisk: predictEntityRisk,
	submitFeedback,
};
