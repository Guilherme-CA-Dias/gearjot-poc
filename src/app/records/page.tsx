"use client";

import { RecordsTable } from "./components/records-table";
import { useRecords } from "@/hooks/use-records";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/app/auth-provider";
import { Toast } from "@/components/ui/toast";

interface FormDefinition {
	_id: string;
	formId: string;
	formTitle: string;
	type: "default" | "custom";
	integrationKey?: string;
	createdAt: string;
	updatedAt: string;
}

export default function RecordsPage() {
	const [selectedAction, setSelectedAction] = useState<string | "">("");
	const [searchQuery, setSearchQuery] = useState("");
	const [forms, setForms] = useState<FormDefinition[]>([]);
	const [isLoadingForms, setIsLoadingForms] = useState(true);
	const [toast, setToast] = useState<{
		type: "success" | "error" | "info";
		message: string;
	} | null>(null);
	const { customerId } = useAuth();

	const {
		records,
		isLoading,
		isError,
		hasMore,
		loadMore,
		importRecords,
		isImporting,
		mutate,
	} = useRecords(selectedAction || null, searchQuery);

	// Fetch forms from MongoDB
	useEffect(() => {
		const fetchForms = async () => {
			if (!customerId) return;

			try {
				setIsLoadingForms(true);
				const response = await fetch(`/api/forms?customerId=${customerId}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to fetch forms");
				}

				setForms(data.forms);

				// Clear selected action if the form no longer exists
				if (
					selectedAction &&
					!data.forms.find(
						(f: FormDefinition) =>
							`get-${f.formId}` === selectedAction ||
							(f.type === "default" && `get-${f.formId}s` === selectedAction)
					)
				) {
					setSelectedAction("");
				}
			} catch (error) {
				console.error("Error fetching forms:", error);
			} finally {
				setIsLoadingForms(false);
			}
		};

		fetchForms();
	}, [customerId, selectedAction]);

	const handleRecordUpdated = () => {
		// Refresh the records list
		mutate();
	};

	const handleRecordDeleted = () => {
		// Refresh the records list
		mutate();
	};

	const handleImportRecords = async () => {
		try {
			const result = await importRecords();

			// Show success message with import results
			if (result && typeof result === "object" && "newRecordsCount" in result) {
				const { newRecordsCount, existingRecordsCount } = result;
				setToast({
					type: "success",
					message: `Import completed! ${newRecordsCount} new records imported, ${existingRecordsCount} existing records skipped.`,
				});
			} else {
				setToast({
					type: "success",
					message: "Records imported successfully!",
				});
			}
		} catch (error) {
			setToast({
				type: "error",
				message: `Import failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			});
		}
	};

	return (
		<div className="container mx-auto py-10 space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Records</h1>
				<p className="text-muted-foreground mt-2">
					Select a record type to view and manage your records
				</p>
			</div>

			{/* Record Type Selection and Search */}
			<div className="grid gap-6 md:grid-cols-[2fr,2fr,auto]">
				<Select
					value={selectedAction}
					onChange={(e) => setSelectedAction(e.target.value)}
					className="w-full"
					disabled={isLoadingForms}
				>
					<option value="">Select record type</option>
					{forms.map((form) => {
						// For default forms, use the standard action keys (get-contacts, get-leads, etc.)
						// For custom forms, use get-objects with the form ID
						const actionKey =
							form.type === "default"
								? `get-${form.formId}`
								: `get-${form.formId}`;

						return (
							<option key={form.formId} value={actionKey}>
								{form.formTitle} {form.type === "custom" ? "(Custom)" : ""}
							</option>
						);
					})}
				</Select>

				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
					<Input
						placeholder="Search records..."
						className="pl-10"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<Button
					onClick={handleImportRecords}
					disabled={!selectedAction || isImporting}
				>
					{isImporting ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Importing...
						</>
					) : (
						<>
							<RefreshCw className="mr-2 h-4 w-4" />
							Import Records
						</>
					)}
				</Button>
			</div>

			{/* Records Table */}
			<div className="mt-6">
				<RecordsTable
					records={records}
					isLoading={isLoading}
					isError={isError}
					hasMore={hasMore}
					onLoadMore={loadMore}
					onRecordUpdated={handleRecordUpdated}
					onRecordDeleted={handleRecordDeleted}
				/>
			</div>

			{/* Toast Notification */}
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
					duration={5000}
				/>
			)}
		</div>
	);
}
