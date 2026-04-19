import { createEntityView } from "./procedures/create";
import { deleteEntityView } from "./procedures/delete";
import { getEntityView } from "./procedures/get";
import { listEntityViews } from "./procedures/list";
import { updateEntityView } from "./procedures/update";

export const entityViewsRouter = {
	list: listEntityViews,
	get: getEntityView,
	create: createEntityView,
	update: updateEntityView,
	delete: deleteEntityView,
};
