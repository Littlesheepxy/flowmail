import { createCategory } from "./procedures/create";
import { deleteCategory } from "./procedures/delete";
import { listCategories } from "./procedures/list";
import { reorderCategories } from "./procedures/reorder";
import { updateCategory } from "./procedures/update";

export const categoriesRouter = {
	list: listCategories,
	create: createCategory,
	update: updateCategory,
	delete: deleteCategory,
	reorder: reorderCategories,
};
