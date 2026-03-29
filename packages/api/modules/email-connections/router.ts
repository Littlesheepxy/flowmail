import { connectGmail } from "./procedures/connect-gmail";
import { connectImap } from "./procedures/connect-imap";
import { disconnectEmailConnection } from "./procedures/disconnect";
import { listEmailConnections } from "./procedures/list";
import { syncEmailConnection } from "./procedures/sync";
import { testEmailConnection } from "./procedures/test-connection";

export const emailConnectionsRouter = {
	list: listEmailConnections,
	connectGmail,
	connectImap,
	disconnect: disconnectEmailConnection,
	test: testEmailConnection,
	sync: syncEmailConnection,
};
