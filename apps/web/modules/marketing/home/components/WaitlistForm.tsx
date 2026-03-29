"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ArrowRightIcon, CheckIcon, LoaderIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
	const t = useTranslations();
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<Status>("idle");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!email || status === "submitting") {
			return;
		}

		setStatus("submitting");
		try {
			const res = await fetch("/api/waitlist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			if (!res.ok) {
				throw new Error();
			}
			setStatus("success");
		} catch {
			setStatus("error");
		}
	}

	if (status === "success") {
		return (
			<div className="flex items-center gap-2 rounded-full bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-sm text-green-600 dark:text-green-400">
				<CheckIcon className="size-4" />
				{t("hero.waitlist_success")}
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="flex items-center gap-2">
			<Input
				type="email"
				required
				placeholder={t("hero.waitlist_placeholder")}
				value={email}
				onChange={(e) => {
					setEmail(e.target.value);
					if (status === "error") {
						setStatus("idle");
					}
				}}
				className="h-11 w-64 rounded-full bg-background px-4 text-sm"
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
						{t("hero.waitlist_submitting")}
					</>
				) : (
					<>
						{t("hero.waitlist_cta")}
						<ArrowRightIcon className="ml-2 size-4" />
					</>
				)}
			</Button>
			{status === "error" && (
				<p className="text-sm text-destructive">
					{t("hero.waitlist_error")}
				</p>
			)}
		</form>
	);
}
