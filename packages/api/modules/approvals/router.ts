import { approveRequest } from "./procedures/approve";
import { listPendingApprovals } from "./procedures/list-pending";
import { rejectRequest } from "./procedures/reject";

export const approvalsRouter = {
	listPending: listPendingApprovals,
	approve: approveRequest,
	reject: rejectRequest,
};
