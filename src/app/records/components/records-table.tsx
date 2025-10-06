import { Record } from "@/types/record";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Pen, Trash2, Grid3X3, Table } from "lucide-react";
import { useState, useEffect } from "react";
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

interface GroupedFields {
	[groupName: string]: {
		[fieldName: string]: string;
	};
}

function getDisplayableFields(record: Record): GroupedFields {
	const groupedFields: GroupedFields = {};

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

	// Helper function to process nested objects and group them
	const processObject = (obj: any, groupName = "General"): void => {
		Object.entries(obj).forEach(([key, value]) => {
			if (value === null || value === undefined) {
				// Skip null/undefined values
				return;
			} else if (typeof value === "string") {
				if (!groupedFields[groupName]) {
					groupedFields[groupName] = {};
				}
				groupedFields[groupName][key] = value;
			} else if (typeof value === "number" || typeof value === "boolean") {
				if (!groupedFields[groupName]) {
					groupedFields[groupName] = {};
				}
				groupedFields[groupName][key] = String(value);
			} else if (typeof value === "object" && !Array.isArray(value)) {
				// Process nested objects as separate groups
				processObject(value, key);
			} else if (Array.isArray(value)) {
				if (!groupedFields[groupName]) {
					groupedFields[groupName] = {};
				}
				groupedFields[groupName][key] = value
					.map((item) =>
						typeof item === "object" ? JSON.stringify(item) : String(item)
					)
					.join(", ");
			} else {
				if (!groupedFields[groupName]) {
					groupedFields[groupName] = {};
				}
				groupedFields[groupName][key] = String(value);
			}
		});
	};

	// Get string fields from top level (excluding fields object)
	Object.entries(record).forEach(([key, value]) => {
		if (
			key !== "fields" &&
			typeof value === "string" &&
			!key.startsWith("_") &&
			!excludedTopLevelFields.includes(key)
		) {
			if (!groupedFields["General"]) {
				groupedFields["General"] = {};
			}
			groupedFields["General"][key] = value;
		}
	});

	// Process fields from nested fields object
	if (record.fields) {
		processObject(record.fields);
	}

	return groupedFields;
}

// Helper function to get all unique field names across all records for table headers
function getAllFieldNames(records: Record[]): string[] {
	const allFields = new Set<string>();

	records.forEach((record) => {
		const groupedFields = getDisplayableFields(record);
		Object.values(groupedFields).forEach((fields) => {
			Object.keys(fields).forEach((fieldName) => {
				allFields.add(fieldName);
			});
		});
	});

	return Array.from(allFields).sort();
}

type ViewMode = "cards" | "table";

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
	const [viewMode, setViewMode] = useState<ViewMode>(() => {
		// Try to get the last selected view mode from localStorage
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("viewMode") as ViewMode;
			return saved && (saved === "cards" || saved === "table")
				? saved
				: "cards";
		}
		return "cards";
	});

	// Save view mode to localStorage whenever it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("viewMode", viewMode);
		}
	}, [viewMode]);

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

	// Get all unique field names for table headers
	const allFieldNames = getAllFieldNames(records);

	return (
		<div className="space-y-4">
			{/* View Toggle */}
			<div className="flex justify-between items-center">
				<h3 className="text-lg font-semibold">Records</h3>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setViewMode("cards")}
						className={`p-2 rounded-md transition-colors ${
							viewMode === "cards"
								? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
								: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
						}`}
						title="Card View"
					>
						<Grid3X3 className="h-4 w-4" />
					</button>
					<button
						onClick={() => setViewMode("table")}
						className={`p-2 rounded-md transition-colors ${
							viewMode === "table"
								? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
								: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
						}`}
						title="Table View"
					>
						<Table className="h-4 w-4" />
					</button>
				</div>
			</div>

			{viewMode === "table" ? (
				// Table view - no ScrollArea wrapper to allow horizontal scroll
				<div className="space-y-3">
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
						// Table View
						<div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
							<table
								className="w-full border-collapse"
								style={{ minWidth: "max-content" }}
							>
								<thead>
									<tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
										<th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
											ID
										</th>
										<th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
											Name
										</th>
										{allFieldNames.map((fieldName) => (
											<th
												key={fieldName}
												className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]"
											>
												{fieldName}
											</th>
										))}
										<th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{records.map((record, index) => {
										const groupedFields = getDisplayableFields(record);
										const allFields = Object.values(groupedFields).reduce(
											(acc, fields) => ({ ...acc, ...fields }),
											{}
										);

										return (
											<tr
												key={`${record.id}-${record.customerId}-${index}`}
												className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
											>
												<td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap min-w-[120px]">
													{record.id}
												</td>
												<td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap min-w-[150px]">
													{record.name}
												</td>
												{allFieldNames.map((fieldName) => (
													<td
														key={fieldName}
														className="p-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[120px]"
													>
														{allFields[fieldName] || "-"}
													</td>
												))}
												<td className="p-4 whitespace-nowrap min-w-[100px]">
													<div className="flex gap-2">
														<button
															onClick={() => handleEdit(record)}
															className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
															title="Edit record"
														>
															<Pen className="h-4 w-4 text-gray-600 dark:text-gray-400" />
														</button>
														<button
															onClick={() => handleDelete(record)}
															className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
															title="Delete record"
														>
															<Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			) : (
				// Card view - use ScrollArea for vertical scroll
				<ScrollArea
					className="h-[calc(100vh-16rem)] w-full border border-gray-200 dark:border-gray-700 rounded-lg"
					scrollHideDelay={0}
				>
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
								const groupedFields = getDisplayableFields(record);

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
										<div className="space-y-4">
											{Object.entries(groupedFields).map(
												([groupName, fields]) => (
													<div key={groupName} className="space-y-2">
														<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">
															{groupName}
														</h4>
														<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
															{Object.entries(fields).map(([key, value]) => (
																<div
																	key={key}
																	className="flex flex-col gap-0.5"
																>
																	<span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
																		{key}
																	</span>
																	<span className="text-sm leading-tight">
																		{value}
																	</span>
																</div>
															))}
														</div>
													</div>
												)
											)}

											{/* Show created/updated time if available */}
											{(record.createdTime ||
												record.created_at ||
												record.updatedTime ||
												record.updated_at) && (
												<div className="space-y-2">
													<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">
														Timestamps
													</h4>
													<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
														{(record.createdTime || record.created_at) && (
															<div className="flex flex-col gap-0.5">
																<span className="text-sm text-gray-500 dark:text-gray-400">
																	Created
																</span>
																<span className="text-sm leading-tight">
																	{formatDate(
																		record.createdTime || record.created_at
																	)}
																</span>
															</div>
														)}

														{(record.updatedTime || record.updated_at) && (
															<div className="flex flex-col gap-0.5">
																<span className="text-sm text-gray-500 dark:text-gray-400">
																	Updated
																</span>
																<span className="text-sm leading-tight">
																	{formatDate(
																		record.updatedTime || record.updated_at
																	)}
																</span>
															</div>
														)}
													</div>
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
					<ScrollBar
						orientation="vertical"
						className="bg-gray-200 dark:bg-gray-700"
					/>
				</ScrollArea>
			)}

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
