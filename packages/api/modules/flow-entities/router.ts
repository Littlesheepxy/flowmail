import { getEntity } from "./procedures/get";
import { listEntities } from "./procedures/list";
import { updateEntityStatus } from "./procedures/update-status";
import { addTimelineEvent } from "./procedures/add-timeline-event";
import { getTimelineDiff } from "./procedures/get-timeline-diff";
import { predictEntityRisk } from "./procedures/predict-risk";
import { submitFeedback } from "./procedures/submit-feedback";
import { mergeEntities } from "./procedures/merge";
import { splitEntity } from "./procedures/split";
import { reclassifyEntity } from "./procedures/reclassify";
import { enrichEntity } from "./procedures/enrich";
import { enrichBatch } from "./procedures/enrich-batch";
import { analyzeEmails } from "./procedures/analyze-emails";
import { seedDemo } from "./procedures/seed-demo";
import { clearDemo } from "./procedures/clear-demo";
import { getAttachmentUrl } from "./procedures/get-attachment-url";
import { deleteEntity } from "./procedures/delete";
import { deleteBatch } from "./procedures/delete-batch";

export const flowEntitiesRouter = {
	list: listEntities,
	get: getEntity,
	updateStatus: updateEntityStatus,
	addTimelineEvent,
	getTimelineDiff,
	predictRisk: predictEntityRisk,
	submitFeedback,
	merge: mergeEntities,
	split: splitEntity,
	reclassify: reclassifyEntity,
	enrich: enrichEntity,
	enrichBatch,
	analyzeEmails,
	seedDemo,
	clearDemo,
	getAttachmentUrl,
	delete: deleteEntity,
	deleteBatch,
};
