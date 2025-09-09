import { addMessageToChat } from "./procedures/add-message-to-chat";
import { createChat } from "./procedures/create-chat";
import { deleteChat } from "./procedures/delete-chat";
import { findChat } from "./procedures/find-chat";
import { listChats } from "./procedures/list-chats";
import { updateChat } from "./procedures/update-chat";

export const aiRouter = {
	chats: {
		list: listChats,
		find: findChat,
		create: createChat,
		update: updateChat,
		delete: deleteChat,
		messages: {
			add: addMessageToChat,
		},
	},
};
