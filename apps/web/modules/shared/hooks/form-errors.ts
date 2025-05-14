import { type TranslationValues, useTranslations } from "next-intl";
import { ZodIssueCode, ZodParsedType, defaultErrorMap } from "zod";
import type { ZodErrorMap } from "zod";

/**
 * This error map is a modified version of the on used by zod-i18n
 * Checkout the original at: https://github.com/aiji42/zod-i18n
 */

const jsonStringifyReplacer = (_: string, value: unknown): unknown => {
	if (typeof value === "bigint") {
		return value.toString();
	}
	return value;
};

function joinValues<T extends unknown[]>(array: T, separator = " | "): string {
	return array
		.map((val) => (typeof val === "string" ? `'${val}'` : val))
		.join(separator);
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const key in value) {
		if (!Object.prototype.hasOwnProperty.call(value, key)) {
			return false;
		}
	}

	return true;
};

const getKeyAndValues = (
	param: unknown,
	defaultKey: string,
): {
	values: Record<string, unknown>;
	key: string;
} => {
	if (typeof param === "string") {
		return { key: param, values: {} };
	}

	if (isRecord(param)) {
		const key =
			"key" in param && typeof param.key === "string"
				? param.key
				: defaultKey;
		const values =
			"values" in param && isRecord(param.values) ? param.values : {};
		return { key, values };
	}

	return { key: defaultKey, values: {} };
};

export function useFormErrors() {
	const t = useTranslations();

	type TranslationKey = Parameters<typeof t>[0];

	const zodErrorMap: ZodErrorMap = (issue, ctx) => {
		let message: string;
		message = defaultErrorMap(issue, ctx).message;

		switch (issue.code) {
			case ZodIssueCode.invalid_type:
				if (issue.received === ZodParsedType.undefined) {
					message = t("zod.errors.invalid_type_received_undefined");
				} else {
					message = t("zod.errors.invalid_type", {
						expected: t(
							`zod.types.${issue.expected}` as TranslationKey,
						),
						received: t(
							`zod.types.${issue.received}` as TranslationKey,
						),
					});
				}
				break;
			case ZodIssueCode.invalid_literal:
				message = t("zod.errors.invalid_literal", {
					expected: JSON.stringify(
						issue.expected,
						jsonStringifyReplacer,
					),
				});
				break;
			case ZodIssueCode.unrecognized_keys:
				message = t("zod.errors.unrecognized_keys", {
					keys: joinValues(issue.keys, ", "),
					count: issue.keys.length,
				});
				break;
			case ZodIssueCode.invalid_union:
				message = t("zod.errors.invalid_union");
				break;
			case ZodIssueCode.invalid_union_discriminator:
				message = t("zod.errors.invalid_union_discriminator", {
					options: joinValues(issue.options),
				});
				break;
			case ZodIssueCode.invalid_enum_value:
				message = t("zod.errors.invalid_enum_value", {
					options: joinValues(issue.options),
					received: issue.received,
				});
				break;
			case ZodIssueCode.invalid_arguments:
				message = t("zod.errors.invalid_arguments");
				break;
			case ZodIssueCode.invalid_return_type:
				message = t("zod.errors.invalid_return_type");
				break;
			case ZodIssueCode.invalid_date:
				message = t("zod.errors.invalid_date");
				break;
			case ZodIssueCode.invalid_string:
				if (typeof issue.validation === "object") {
					if ("startsWith" in issue.validation) {
						message = t("zod.errors.invalid_string.startsWith", {
							startsWith: issue.validation.startsWith,
						});
					} else if ("endsWith" in issue.validation) {
						message = t("zod.errors.invalid_string.endsWith", {
							endsWith: issue.validation.endsWith,
						});
					}
				} else {
					message = t(
						`zod.errors.invalid_string.${issue.validation}` as TranslationKey,
						{
							validation: t(
								`zod.validations.${issue.validation}` as TranslationKey,
							),
						},
					);
				}
				break;
			case ZodIssueCode.too_small: {
				const minimum =
					issue.type === "date"
						? new Date(issue.minimum as number)
						: (issue.minimum as number);
				message = t(
					`zod.errors.too_small.${issue.type}.${
						issue.exact
							? "exact"
							: issue.inclusive
								? "inclusive"
								: "not_inclusive"
					}` as TranslationKey,
					{
						minimum,
						count: typeof minimum === "number" ? minimum : "",
					},
				);
				break;
			}
			case ZodIssueCode.too_big: {
				const maximum =
					issue.type === "date"
						? new Date(issue.maximum as number)
						: (issue.maximum as number);
				message = t(
					`zod.errors.too_big.${issue.type}.${
						issue.exact
							? "exact"
							: issue.inclusive
								? "inclusive"
								: "not_inclusive"
					}` as TranslationKey,
					{
						maximum,
						count: typeof maximum === "number" ? maximum : "",
					},
				);
				break;
			}
			case ZodIssueCode.custom: {
				const { key, values } = getKeyAndValues(
					issue.params?.i18n,
					"zod.errors.custom",
				);

				message = t(
					`zod.errors.custom.${key}` as Parameters<typeof t>[0],
					(values as TranslationValues) ?? {},
				);
				break;
			}
			case ZodIssueCode.invalid_intersection_types:
				message = t("zod.errors.invalid_intersection_types");
				break;
			case ZodIssueCode.not_multiple_of:
				message = t("zod.errors.not_multiple_of");
				break;
			case ZodIssueCode.not_finite:
				message = t("zod.errors.not_finite");
				break;
			default:
		}

		return { message };
	};

	return {
		zodErrorMap,
	};
}
