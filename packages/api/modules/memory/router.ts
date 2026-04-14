import { listMemories } from "./procedures/list";
import { updateMemory } from "./procedures/update";
import { deleteMemory } from "./procedures/delete";
import { getContactProfile } from "./procedures/get-contact-profile";
import { listObjects } from "./procedures/list-objects";
import { getObject, getObjectHistory } from "./procedures/get-object";
import { updateObjectAttribute } from "./procedures/update-object";
import { deleteObject } from "./procedures/delete-object";

export const memoryRouter = {
	list: listMemories,
	update: updateMemory,
	delete: deleteMemory,
	getContactProfile: getContactProfile,
	listObjects: listObjects,
	getObject: getObject,
	getObjectHistory: getObjectHistory,
	updateObjectAttribute: updateObjectAttribute,
	deleteObject: deleteObject,
};
