import { connectGmail } from "./procedures/connect-gmail";
import { connectImap } from "./procedures/connect-imap";
import { connectOAuth } from "./procedures/connect-oauth";
import { disconnectEmailConnection } from "./procedures/disconnect";
import { downloadAttachment } from "./procedures/download-attachment";
import { listEmailConnections } from "./procedures/list";
import { sendEmail } from "./procedures/send-email";
import { syncEmailConnection } from "./procedures/sync";
import { testEmailConnection } from "./procedures/test-connection";
import { updateImapPassword } from "./procedures/update-imap-password";

export const emailConnectionsRouter = {
	list: listEmailConnections,
	connectGmail,
	connectImap,
	connectOAuth,
	disconnect: disconnectEmailConnection,
	test: testEmailConnection,
	sync: syncEmailConnection,
	updateImapPassword,
	downloadAttachment,
	sendEmail,
};
