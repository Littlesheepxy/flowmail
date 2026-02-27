"use client";

import {
	CheckCircle2Icon,
	InfoIcon,
	LoaderIcon,
	TriangleAlertIcon,
	XIcon,
} from "lucide-react";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { cn } from "../lib";
import { Button } from "./button";

type ToasterProps = React.ComponentProps<typeof Sonner>;

interface ToastProps {
	id: number | string;
	title?: string;
	description?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	cancel?: {
		label: string;
		onClick?: () => void;
	};
	icon?: React.ReactNode;
	type?: "success" | "error" | "info" | "warning" | "loading" | "default";
}

function Toast({
	id,
	title,
	description,
	action,
	cancel,
	icon,
	type = "default",
}: ToastProps) {
	const getIcon = () => {
		if (icon !== undefined) {
			return icon;
		}
		if (type === "success") {
			return (
				<CheckCircle2Icon
					className="size-5 text-success"
					aria-hidden="true"
				/>
			);
		}
		if (type === "error") {
			return (
				<XIcon className="size-5 text-destructive" aria-hidden="true" />
			);
		}
		if (type === "info") {
			return (
				<InfoIcon className="size-5 text-primary" aria-hidden="true" />
			);
		}
		if (type === "loading") {
			return (
				<LoaderIcon
					className="size-5 text-primary animate-spin"
					aria-hidden="true"
				/>
			);
		}
		if (type === "warning") {
			return (
				<TriangleAlertIcon
					className="size-5 text-amber-500"
					aria-hidden="true"
				/>
			);
		}
		return null;
	};

	const getBorderColor = () => {
		if (type === "success") {
			return "border-success/20";
		}
		if (type === "error") {
			return "border-destructive/20";
		}
		if (type === "info") {
			return "border-primary/20";
		}
		if (type === "warning") {
			return "border-amber-500/20";
		}
		return "border-border";
	};

	return (
		<div
			className={cn(
				"group pointer-events-auto relative flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-md transition-all",
				getBorderColor(),
			)}
		>
			{getIcon() && (
				<div className="flex shrink-0 items-center">{getIcon()}</div>
			)}
			<div className="flex flex-1 flex-col gap-1">
				{title && (
					<div className="font-medium leading-tight tracking-tight">
						{title}
					</div>
				)}
				{description && (
					<div className="text-muted-foreground text-sm leading-relaxed">
						{description}
					</div>
				)}
				{(action || cancel) && (
					<div className="mt-2 flex gap-2">
						{action && (
							<Button
								variant="primary"
								size="sm"
								onClick={action.onClick}
								className="h-7"
							>
								{action.label}
							</Button>
						)}
						{cancel && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									cancel.onClick?.();
									sonnerToast.dismiss(id);
								}}
								className="h-7"
							>
								{cancel.label}
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			toastOptions={{
				duration: 5000,
			}}
			{...props}
		/>
	);
};

type ToastOptions = Omit<
	Parameters<typeof sonnerToast.custom>[1],
	"description" | "title"
>;

interface ToastFunctionProps extends Omit<ToastProps, "id"> {
	description?: string;
}

function toast({
	title,
	description,
	action,
	cancel,
	icon,
	type = "default",
	...props
}: ToastFunctionProps & ToastOptions) {
	return sonnerToast.custom(
		(id) => (
			<Toast
				id={id}
				title={title}
				description={description}
				action={action}
				cancel={cancel}
				icon={icon}
				type={type}
			/>
		),
		props,
	);
}

const toastSuccess = (
	title: string,
	description?: string,
	options?: ToastOptions,
): ReturnType<typeof sonnerToast.custom> => {
	return toast({ title, description, type: "success", ...options });
};

const toastError = (
	title: string,
	description?: string,
	options?: ToastOptions,
): ReturnType<typeof sonnerToast.custom> => {
	return toast({ title, description, type: "error", ...options });
};

const toastInfo = (
	title: string,
	description?: string,
	options?: ToastOptions,
): ReturnType<typeof sonnerToast.custom> => {
	return toast({ title, description, type: "info", ...options });
};

const toastWarning = (
	title: string,
	description?: string,
	options?: ToastOptions,
): ReturnType<typeof sonnerToast.custom> => {
	return toast({ title, description, type: "warning", ...options });
};

const toastLoading = (
	title: string,
	description?: string,
	options?: ToastOptions,
): ReturnType<typeof sonnerToast.custom> => {
	return toast({ title, description, type: "loading", ...options });
};

const dismiss = (toastId?: number | string) => {
	sonnerToast.dismiss(toastId);
};

type PromiseOptions<T> = {
	loading: string | (() => string);
	success: string | ((data: T) => string);
	error: string | ((error: unknown) => string);
};

const toastPromise = <T,>(
	promise: Promise<T> | (() => Promise<T>),
	options: PromiseOptions<T>,
): ReturnType<typeof sonnerToast.promise> => {
	return sonnerToast.promise(promise, {
		loading:
			typeof options.loading === "function"
				? options.loading()
				: options.loading,
		success: (data: T) =>
			typeof options.success === "function"
				? options.success(data)
				: options.success,
		error: (error: unknown) =>
			typeof options.error === "function"
				? options.error(error)
				: options.error,
	});
};

export {
	Toaster,
	toast,
	toastSuccess,
	toastError,
	toastInfo,
	toastWarning,
	toastLoading,
	toastPromise,
	dismiss,
};
