import { useRouter as useBaseRouter, usePathname } from "next/navigation";
import NProgress from "nprogress";
import { useCallback, useEffect } from "react";

export const useRouter = () => {
	const router = useBaseRouter();
	const pathname = usePathname();
	useEffect(() => {
		NProgress.done();
	}, [pathname]);
	const replace = useCallback(
		(href: string, options?: Parameters<typeof router.replace>[1]) => {
			href !== pathname && NProgress.start();
			router.replace(href, options);
		},
		[router, pathname],
	);

	const push = useCallback(
		(href: string, options?: Parameters<typeof router.push>[1]) => {
			href !== pathname && NProgress.start();
			router.push(href, options);
		},
		[router, pathname],
	);

	return {
		...router,
		replace,
		push,
	};
};
