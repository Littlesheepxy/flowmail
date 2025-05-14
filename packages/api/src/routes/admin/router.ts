import { Hono } from "hono";
import { organizationRouter } from "./organizations";
import { userRouter } from "./users";

export const adminRouter = new Hono()
	.basePath("/admin")
	.route("/", organizationRouter)
	.route("/", userRouter);
