import { Button } from "@ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export type PaginatioProps = {
	className?: string;
	totalItems: number;
	itemsPerPage: number;
	currentPage: number;
	onChangeCurrentPage: (page: number) => void;
};

const Pagination = ({
	currentPage,
	totalItems,
	itemsPerPage,
	className,
	onChangeCurrentPage,
}: PaginatioProps) => {
	const numberOfPages = Math.ceil(totalItems / itemsPerPage);

	return (
		<div className={className}>
			<div className="flex items-center justify-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					disabled={currentPage === 1}
					onClick={() => onChangeCurrentPage(currentPage - 1)}
				>
					<ChevronLeftIcon />
				</Button>
				<span className="text-gray-500 text-sm">
					{currentPage * itemsPerPage - itemsPerPage + 1} -{" "}
					{currentPage * itemsPerPage > totalItems
						? totalItems
						: currentPage * itemsPerPage}{" "}
					of {totalItems}
				</span>
				<Button
					variant="ghost"
					size="icon"
					disabled={currentPage === numberOfPages}
					onClick={() => onChangeCurrentPage(currentPage + 1)}
				>
					<ChevronRightIcon />
				</Button>
			</div>
		</div>
	);
};
Pagination.displayName = "Pagination";

export { Pagination };
