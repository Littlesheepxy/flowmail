import { listTags } from "./procedures/list";
import { createTag } from "./procedures/create";
import { addTagToEntity } from "./procedures/add-to-entity";
import { removeTagFromEntity } from "./procedures/remove-from-entity";
import { deleteTag } from "./procedures/delete";

export const tagsRouter = {
	list: listTags,
	create: createTag,
	addToEntity: addTagToEntity,
	removeFromEntity: removeTagFromEntity,
	delete: deleteTag,
};
