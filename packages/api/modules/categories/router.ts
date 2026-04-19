import { bulkCreateCategories } from "./procedures/bulk-create";
import { createCategory } from "./procedures/create";
import { deleteCategory } from "./procedures/delete";
import { listCategories } from "./procedures/list";
import { reorderCategories } from "./procedures/reorder";
import { suggestFromInbox } from "./procedures/suggest-from-inbox";
import { updateCategory } from "./procedures/update";

export const categoriesRouter = {
	list: listCategories,
	create: createCategory,
	bulkCreate: bulkCreateCategories,
	update: updateCategory,
	delete: deleteCategory,
	reorder: reorderCategories,
	suggestFromInbox: suggestFromInbox,
};
