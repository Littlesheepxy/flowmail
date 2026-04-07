import type { RouterClient } from "@orpc/server";
import { adminRouter } from "../modules/admin/router";
import { apiTokensRouter } from "../modules/api-tokens/router";
import { approvalsRouter } from "../modules/approvals/router";
import { categoriesRouter } from "../modules/categories/router";
import { contactRouter } from "../modules/contact/router";
import { emailConnectionsRouter } from "../modules/email-connections/router";
import { flowEntitiesRouter } from "../modules/flow-entities/router";
import { newsletterRouter } from "../modules/newsletter/router";
import { notificationsRouter } from "../modules/notifications/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentsRouter } from "../modules/payments/router";
import { setupGuideRouter } from "../modules/setup-guide/router";
import { usersRouter } from "../modules/users/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure.router({
	admin: adminRouter,
	newsletter: newsletterRouter,
	contact: contactRouter,
	organizations: organizationsRouter,
	users: usersRouter,
	payments: paymentsRouter,
	flowEntities: flowEntitiesRouter,
	approvals: approvalsRouter,
	emailConnections: emailConnectionsRouter,
	categories: categoriesRouter,
	apiTokens: apiTokensRouter,
	notifications: notificationsRouter,
	setupGuide: setupGuideRouter,
});

export type ApiRouterClient = RouterClient<typeof router>;
