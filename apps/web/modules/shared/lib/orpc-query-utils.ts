import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { orpcClient } from "./orpc-client";

export const orpc = createTanstackQueryUtils(orpcClient);
