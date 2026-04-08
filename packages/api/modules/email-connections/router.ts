import { checkInboundStatus } from "./procedures/check-inbound-status";
import { connectGmail } from "./procedures/connect-gmail";
import { connectImap } from "./procedures/connect-imap";
import { connectOAuth } from "./procedures/connect-oauth";
import { connectOutlook } from "./procedures/connect-outlook";
import { detectProvider } from "./procedures/detect-provider";
import { disconnectEmailConnection } from "./procedures/disconnect";
import { downloadAttachment } from "./procedures/download-attachment";
import { getInboundAddress } from "./procedures/get-inbound-address";
import { listEmailConnections } from "./procedures/list";
import { sendEmail } from "./procedures/send-email";
import { syncEmailConnection } from "./procedures/sync";
import { testEmailConnection } from "./procedures/test-connection";
import { updateImapPassword } from "./procedures/update-imap-password";

export const emailConnectionsRouter = {
	list: listEmailConnections,
	detectProvider,
	connectGmail,
	connectOutlook,
	connectImap,
	connectOAuth,
	disconnect: disconnectEmailConnection,
	test: testEmailConnection,
	sync: syncEmailConnection,
	updateImapPassword,
	downloadAttachment,
	sendEmail,
	getInboundAddress,
	checkInboundStatus,
};
