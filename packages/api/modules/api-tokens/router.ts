import { createApiToken } from "./procedures/create";
import { listApiTokens } from "./procedures/list";
import { revokeApiToken } from "./procedures/revoke";

export const apiTokensRouter = {
	create: createApiToken,
	list: listApiTokens,
	revoke: revokeApiToken,
};
