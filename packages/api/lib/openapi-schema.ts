import { isErrorResult, type MergeInput, merge } from "openapi-merge";

export function mergeOpenApiSchemas({
	appSchema,
	authSchema,
}: {
	appSchema: MergeInput[number]["oas"];
	authSchema: MergeInput[number]["oas"];
}) {
	const mergedSchema = merge([
		{
			oas: appSchema,
		},
		{
			oas: authSchema,
			pathModification: {
				prepend: "/api/auth",
			},
		},
	]);

	if (isErrorResult(mergedSchema)) {
		return {};
	}

	const output = mergedSchema.output;

	Object.entries(output.paths).forEach(([path, pathItem]) => {
		if (path.startsWith("/api/auth")) {
			const methods = ["post", "get", "put", "delete", "patch"];
			methods.forEach((method) => {
				const methodItem = pathItem[method as keyof typeof pathItem];
				if (
					methodItem &&
					typeof methodItem === "object" &&
					!Array.isArray(methodItem)
				) {
					methodItem.tags = ["Auth"];
				}
			});
		}
	});

	return output;
}
