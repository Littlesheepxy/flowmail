"use client";

import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { useMemo, useRef } from "react";
import type { ReactCropperElement } from "react-cropper";
import Cropper from "react-cropper";

export function CropImageDialog({
	image,
	open,
	onOpenChange,
	onCrop,
}: {
	image: File | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCrop: (croppedImage: Blob | null) => void;
}) {
	const cropperRef = useRef<ReactCropperElement>(null);

	const getCroppedImage = async () => {
		const cropper = cropperRef.current?.cropper;

		const imageBlob = await new Promise<Blob | null>((resolve) => {
			cropper
				?.getCroppedCanvas({
					maxWidth: 256,
					maxHeight: 256,
				})
				.toBlob(resolve);
		});

		return imageBlob;
	};

	const imageSrc = useMemo(
		() => image && URL.createObjectURL(image),
		[image],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle />
				</DialogHeader>
				<div>
					{imageSrc && (
						<Cropper
							src={imageSrc}
							style={{ width: "100%" }}
							initialAspectRatio={1}
							aspectRatio={1}
							guides={true}
							ref={cropperRef}
						/>
					)}
				</div>
				<DialogFooter>
					<Button
						onClick={async () => {
							onCrop(await getCroppedImage());
							onOpenChange(false);
						}}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
