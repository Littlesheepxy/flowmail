import { auth } from "@repo/auth";
import { Hono } from "hono";

export const authRouter = new Hono()
	.get("/auth/**", (c) => {
		return auth.handler(c.req.raw);
	})
	.post("/auth/**", (c) => {
		return auth.handler(c.req.raw);
	});
