import { Record } from "@/types/record";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Pen, Trash2 } from "lucide-react";
import { useState } from "react";
import { EditRecordModal } from "./edit-record-modal";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";

interface RecordsTableProps {
	records: Record[];
	isLoading?: boolean;
	isError?: Error | null;
	onLoadMore?: () => void;
	hasMore?: boolean;
	onRecordUpdated?: () => void;
	onRecordDeleted?: () => void;
}

function getDisplayableFields(record: Record): { [key: string]: string } {
	const displayableFields: { [key: string]: string } = {};

	// Add customerId to excluded fields here too
	const excludedTopLevelFields = [
		"id",
		"_id",
		"customerId",
		"recordType",
		"__v",
		"createdAt",
		"updatedAt",
		"created_at",
		"updated_at",
		"uri",
	];

	// Get string fields from top level
	Object.entries(record).forEach(([key, value]) => {
		if (
			typeof value === "string" &&
			!key.startsWith("_") &&
			!excludedTopLevelFields.includes(key)
		) {
			displayableFields[key] = value;
		}
	});

	// Get string fields from nested fields object
	if (record.fields) {
		Object.entries(record.fields).forEach(([key, value]) => {
			if (
				typeof value === "string" &&
				!key.startsWith("_") &&
				key !== "id" // Exclude id from fields since we have it at top level
			) {
				displayableFields[key] = value;
			}
		});
	}

	return displayableFields;
}

export function RecordsTable({
	records,
	isLoading = false,
	isError = null,
	onLoadMore,
	hasMore,
	onRecordUpdated,
	onRecordDeleted,
}: RecordsTableProps) {
	const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const formatDate = (dateString?: string) => {
		if (!dateString) return "-";
		try {
			return new Date(dateString).toLocaleString();
		} catch (error) {
			return "-";
		}
	};

	const handleEdit = (record: Record) => {
		setSelectedRecord(record);
		setIsEditModalOpen(true);
	};

	const handleDelete = (record: Record) => {
		setSelectedRecord(record);
		setIsDeleteDialogOpen(true);
	};

	const handleEditComplete = () => {
		setIsEditModalOpen(false);
		setSelectedRecord(null);
		onRecordUpdated?.();
	};

	const handleDeleteComplete = () => {
		setIsDeleteDialogOpen(false);
		setSelectedRecord(null);
		onRecordDeleted?.();
	};

	if (isError) {
		return (
			<div className="rounded-md border p-8 text-center">
				<p className="text-muted-foreground">
					Error loading records. Please try again later.
				</p>
			</div>
		);
	}

	return (
		<div className="relative">
			<ScrollArea className="h-[800px] w-full" scrollHideDelay={0}>
				<div className="space-y-3 p-4 pr-6">
					{isLoading ? (
						Array.from({ length: 3 }).map((_, index) => (
							<div
								key={`skeleton-${index}`}
								className="rounded-xl bg-sky-100/60 dark:bg-sky-900/20 p-4 shadow-sm"
							>
								<Skeleton className="h-7 w-1/3 mb-3" />
								<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
									<Skeleton className="h-12 w-full" />
									<Skeleton className="h-12 w-full" />
									<Skeleton className="h-12 w-full" />
									<Skeleton className="h-12 w-full" />
								</div>
							</div>
						))
					) : records.length === 0 ? (
						<div className="text-center text-muted-foreground py-8">
							No records found
						</div>
					) : (
						records.map((record, index) => {
							const displayFields = getDisplayableFields(record);

							return (
								<div
									key={`${record.id}-${record.customerId}-${index}-${
										record.created_at || record.createdTime || Date.now()
									}`}
									className="rounded-xl bg-sky-100/60 dark:bg-sky-900/20 p-4 shadow-sm hover:shadow-md transition-shadow group relative"
								>
									<div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={() => handleEdit(record)}
											className="p-2 rounded-full hover:bg-sky-200/60 dark:hover:bg-sky-800/60 transition-colors"
											title="Edit record"
										>
											<Pen className="h-4 w-4 text-gray-600 dark:text-gray-400" />
										</button>
										<button
											onClick={() => handleDelete(record)}
											className="p-2 rounded-full hover:bg-red-200/60 dark:hover:bg-red-800/60 transition-colors"
											title="Delete record"
										>
											<Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
										</button>
									</div>
									<div className="mb-3">
										<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
											ID: {record.id}
										</h3>
										{record.name && (
											<p className="text-sm text-gray-600 dark:text-gray-400">
												{record.name}
											</p>
										)}
									</div>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										{Object.entries(displayFields).map(([key, value]) => (
											<div key={key} className="flex flex-col gap-0.5">
												<span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
													{key}
												</span>
												<span className="text-sm leading-tight">{value}</span>
											</div>
										))}

										{/* Show created/updated time if available */}
										{(record.createdTime || record.created_at) && (
											<div className="flex flex-col gap-0.5">
												<span className="text-sm text-gray-500 dark:text-gray-400">
													Created
												</span>
												<span className="text-sm leading-tight">
													{formatDate(record.createdTime || record.created_at)}
												</span>
											</div>
										)}

										{(record.updatedTime || record.updated_at) && (
											<div className="flex flex-col gap-0.5">
												<span className="text-sm text-gray-500 dark:text-gray-400">
													Updated
												</span>
												<span className="text-sm leading-tight">
													{formatDate(record.updatedTime || record.updated_at)}
												</span>
											</div>
										)}
									</div>
								</div>
							);
						})
					)}
					{hasMore && !isLoading && (
						<div className="py-3 text-center">
							<button
								onClick={onLoadMore}
								className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
							>
								Load More
							</button>
						</div>
					)}
				</div>
				<ScrollBar orientation="vertical" />
			</ScrollArea>

			{selectedRecord && (
				<EditRecordModal
					record={selectedRecord}
					isOpen={isEditModalOpen}
					onClose={() => setIsEditModalOpen(false)}
					onComplete={handleEditComplete}
				/>
			)}

			{selectedRecord && (
				<DeleteConfirmationDialog
					isOpen={isDeleteDialogOpen}
					onClose={() => setIsDeleteDialogOpen(false)}
					onConfirm={handleDeleteComplete}
					record={selectedRecord}
					onRecordDeleted={onRecordDeleted || (() => {})}
				/>
			)}
		</div>
	);
}
