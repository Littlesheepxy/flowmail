import { getEntity } from "./procedures/get";
import { listEntities } from "./procedures/list";
import { updateEntityStatus } from "./procedures/update-status";

export const flowEntitiesRouter = {
	list: listEntities,
	get: getEntity,
	updateStatus: updateEntityStatus,
};
