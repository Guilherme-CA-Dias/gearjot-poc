"use client";

import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/app/auth-provider";
import { DataInput } from "@integration-app/react";
import { useSchema } from "@/hooks/useSchema";
import { Loader2 } from "lucide-react";
import { sendToWebhook } from "@/lib/webhook-utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormDefinition {
	_id: string;
	formId: string;
	formTitle: string;
	type: "default" | "custom";
	integrationKey?: string;
	createdAt: string;
	updatedAt: string;
}

export default function SubmitFormPage() {
	const [selectedForm, setSelectedForm] = useState("");
	const [forms, setForms] = useState<FormDefinition[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [formData, setFormData] = useState<{ fields: Record<string, any> }>({
		fields: {},
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitSuccess, setSubmitSuccess] = useState(false);
	const { customerId } = useAuth();

	// Get schema for the selected form
	const {
		schema,
		isLoading: schemaLoading,
		error: schemaError,
	} = useSchema(selectedForm || "");

	// Fetch forms from MongoDB
	useEffect(() => {
		const fetchForms = async () => {
			if (!customerId) return;

			try {
				setIsLoading(true);
				const response = await fetch(`/api/forms?customerId=${customerId}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to fetch forms");
				}

				setForms(data.forms);
			} catch (error) {
				console.error("Error fetching forms:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchForms();
	}, [customerId]);

	const handleFieldChange = (value: unknown) => {
		setFormData({
			fields: value as Record<string, any>,
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!selectedForm || !customerId) return;

		try {
			setIsSubmitting(true);

			// Generate a unique ID for the new record
			const recordId = `REC${Date.now().toString().slice(-8)}`;

			// Prepare the record data
			const recordType = selectedForm.replace("get-", "");
			const recordData = {
				id: recordId,
				...formData.fields,
				recordType,
			};

			// Send the data via webhook
			await sendToWebhook({
				type: "created",
				data: recordData,
				customerId,
			});

			// Reset form and show success message
			setFormData({ fields: {} });
			setSubmitSuccess(true);

			// Hide success message after 3 seconds
			setTimeout(() => {
				setSubmitSuccess(false);
			}, 3000);
		} catch (error) {
			console.error("Error submitting form:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="container mx-auto py-10 space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Submit Form</h1>
				<p className="text-muted-foreground mt-2">
					Select a form type and submit data
				</p>
			</div>

			{/* Form Selection */}
			<div className="grid gap-6 md:grid-cols-[1fr]">
				<Select
					value={selectedForm}
					onChange={(e) => setSelectedForm(e.target.value)}
					className="w-full"
					disabled={isLoading}
				>
					<option value="">Select form type</option>
					{forms.map((form) => {
						const formKey = `get-${form.formId}`;
						return (
							<option key={form.formId} value={formKey}>
								{form.formTitle} {form.type === "custom" ? "(Custom)" : ""}
							</option>
						);
					})}
				</Select>
			</div>

			{/* Form Content */}
			{selectedForm && (
				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
					<div className="p-6 space-y-4">
						<div>
							<h2 className="text-lg font-semibold">
								{forms.find((f) => `get-${f.formId}` === selectedForm)
									?.formTitle || "Form"}
							</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								Fill out the form fields below
							</p>
						</div>

						<form onSubmit={handleSubmit}>
							{schemaLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : schemaError ? (
								<div className="text-red-500">
									{schemaError?.message || "Failed to load form schema"}
								</div>
							) : (
								<ScrollArea className="h-[50vh]">
									<div className="rounded-xl bg-white-100/60 dark:bg-sky-900/20 p-4 shadow-sm">
										<DataInput
											schema={schema}
											value={formData.fields}
											onChange={handleFieldChange}
										/>
									</div>

									<div className="flex justify-between mt-6 gap-2">
										<Button
											type="button"
											variant="outline"
											className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-red-700 dark:hover:bg-red-700 dark:hover:text-red-100"
											onClick={() => setFormData({ fields: {} })}
										>
											Reset
										</Button>
										<Button
											type="submit"
											className="bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100 hover:bg-blue-200 hover:text-blue-800 dark:hover:bg-blue-800 dark:hover:text-blue-100"
											disabled={isSubmitting || schemaLoading}
										>
											{isSubmitting ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Submitting...
												</>
											) : (
												"Submit Form"
											)}
										</Button>
									</div>
								</ScrollArea>
							)}
						</form>
					</div>
				</div>
			)}

			{/* Success Message */}
			{submitSuccess && (
				<div
					className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative"
					role="alert"
				>
					<strong className="font-bold">Success!</strong>
					<span className="block sm:inline"> Form submitted successfully.</span>
				</div>
			)}
		</div>
	);
}
