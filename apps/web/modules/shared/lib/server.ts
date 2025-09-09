import "server-only";

import { createQueryClient } from "@shared/lib/query-client";
import { cache } from "react";

export const getServerQueryClient = cache(createQueryClient);
