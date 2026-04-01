import { getUnreadCount } from "./procedures/get-unread-count";
import { listNotifications } from "./procedures/list";
import { markRead } from "./procedures/mark-read";

export const notificationsRouter = {
	list: listNotifications,
	markRead,
	getUnreadCount,
};
