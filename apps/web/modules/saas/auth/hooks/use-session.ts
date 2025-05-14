import { useContext } from "react";
import { SessionContext } from "../lib/session-context";

export const useSession = () => {
	const sessionContext = useContext(SessionContext);

	if (sessionContext === undefined) {
		throw new Error("useSession must be used within SessionProvider");
	}

	return sessionContext;
};
