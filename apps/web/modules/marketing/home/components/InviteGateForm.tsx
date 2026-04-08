"use client";

import { authLoginHref } from "@i18n/lib/auth-login-href";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ArrowRightIcon, LoaderIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { withQuery } from "ufo";

type Status = "idle" | "submitting" | "error";

interface InviteGateFormProps {
	/** Use on dark sections (e.g. BottomCTA) so text stays readable. */
	tone?: "default" | "onDark";
}

export function InviteGateForm({ tone = "default" }: InviteGateFormProps) {
	const t = useTranslations();
	const locale = useLocale();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [status, setStatus] = useState<Status>("idle");

	const isOnDark = tone === "onDark";
	const mutedTextClass = isOnDark
		? "text-background/70"
		: "text-foreground/60";
	const linkClass = isOnDark
		? "font-medium text-background underline-offset-4 hover:underline"
		: "font-medium text-foreground underline-offset-4 hover:underline";
	const errorTextClass = isOnDark ? "text-red-300" : "text-destructive";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!email || !code.trim() || status === "submitting") {
			return;
		}

		setStatus("submitting");
		try {
			const res = await fetch("/api/invite-code/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: code.trim() }),
			});
			if (!res.ok) {
				throw new Error();
			}
			if (typeof sessionStorage !== "undefined") {
				sessionStorage.setItem("flowmail_invite_code", code.trim());
			}
			router.push(
				withQuery("/auth/signup", {
					email,
					locale,
				}),
			);
		} catch {
			setStatus("error");
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
		>
			<Input
				type="text"
				autoComplete="one-time-code"
				required
				placeholder={t("hero.invite_code_placeholder")}
				value={code}
				onChange={(e) => {
					setCode(e.target.value);
					if (status === "error") {
						setStatus("idle");
					}
				}}
				className="h-11 w-full rounded-full bg-background px-4 text-sm sm:w-44"
			/>
			<Input
				type="email"
				required
				placeholder={t("hero.invite_email_placeholder")}
				value={email}
				onChange={(e) => {
					setEmail(e.target.value);
					if (status === "error") {
						setStatus("idle");
					}
				}}
				className="h-11 w-full rounded-full bg-background px-4 text-sm sm:w-64"
			/>
			<Button
				type="submit"
				size="lg"
				variant="primary"
				disabled={status === "submitting"}
				className="rounded-full"
			>
				{status === "submitting" ? (
					<>
						<LoaderIcon className="mr-2 size-4 animate-spin" />
						{t("hero.invite_submitting")}
					</>
				) : (
					<>
						{t("hero.invite_cta")}
						<ArrowRightIcon className="ml-2 size-4" />
					</>
				)}
			</Button>
			<p
				className={`w-full text-center text-sm sm:text-left ${mutedTextClass}`}
			>
				{t("hero.invite_has_account")}{" "}
				<Link href={authLoginHref(locale)} className={linkClass}>
					{t("common.menu.login")}
				</Link>
			</p>
			{status === "error" && (
				<p className={`w-full text-sm ${errorTextClass}`}>
					{t("hero.invite_error")}
				</p>
			)}
		</form>
	);
}
