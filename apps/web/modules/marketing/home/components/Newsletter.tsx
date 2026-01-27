"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { CheckCircleIcon, KeyIcon } from "lucide-react";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
	email: z.string().email(),
});
type FormValues = z.infer<typeof formSchema>;

export function Newsletter() {
	const t = useTranslations();
	const newsletterSignupMutation = useMutation(
		orpc.newsletter.subscribe.mutationOptions(),
	);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
	});

	const onSubmit = form.handleSubmit(async ({ email }) => {
		try {
			await newsletterSignupMutation.mutateAsync({ email });
		} catch {
			form.setError("email", {
				message: t("newsletter.hints.error.message"),
			});
		}
	});

	return (
		<section className="pb-12 lg:pb-16 xl:pb-24">
			<div className="container max-w-3xl">
				<div className="p-6 bg-primary/5 rounded-4xl lg:p-8">
					<div className="mb-8 text-center">
						<KeyIcon className="mx-auto mb-3 size-10 text-primary" />
						<h1 className="font-serif font-medium text-lg md:text-xl lg:text-2xl xl:text-3xl leading-tighter text-foreground">
							{t("newsletter.title")}
						</h1>
						<p className="mt-2 text-foreground/60 text-sm sm:text-base">
							{t("newsletter.subtitle")}
						</p>
					</div>

					<div className="mx-auto max-w-lg">
						{form.formState.isSubmitSuccessful ? (
							<Alert variant="success">
								<CheckCircleIcon />
								<AlertTitle>
									{t("newsletter.hints.success.title")}
								</AlertTitle>
								<AlertDescription>
									{t("newsletter.hints.success.message")}
								</AlertDescription>
							</Alert>
						) : (
							<form onSubmit={onSubmit}>
								<div className="flex items-center gap-2">
									<Input
										type="email"
										required
										placeholder={t("newsletter.email")}
										{...form.register("email")}
									/>

									<Button
										type="submit"
										loading={form.formState.isSubmitting}
									>
										{t("newsletter.submit")}
									</Button>
								</div>
								{form.formState.errors.email && (
									<p className="mt-1 text-destructive text-xs">
										{form.formState.errors.email.message}
									</p>
								)}
							</form>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
