import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Record } from "@/types/record";
import { ensureAuth } from "@/lib/auth";
import { sendToWebhook } from "@/lib/webhook-utils";

interface DeleteConfirmationDialogProps {
	record: Record | null;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	onRecordDeleted: () => void;
}

export function DeleteConfirmationDialog({
	record,
	isOpen,
	onClose,
	onConfirm,
	onRecordDeleted,
}: DeleteConfirmationDialogProps) {
	const [isDeleting, setIsDeleting] = useState(false);

	const handleConfirm = async () => {
		if (!record) return;

		setIsDeleting(true);
		try {
			const auth = await ensureAuth();

			// Send webhook notification
			await sendToWebhook({
				type: "deleted",
				data: {
					id: record.id,
					recordType: record.recordType,
					...record,
				},
				customerId: auth.customerId,
			});

			// Delete from database
			const response = await fetch(`/api/records/${record.id}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${auth.token}`,
				},
				body: JSON.stringify({
					customerId: auth.customerId,
					recordType: record.recordType,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to delete record");
			}

			// Notify parent components
			onRecordDeleted();
			onConfirm();
			onClose();
		} catch (error) {
			console.error("Error deleting record:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Delete Record</DialogTitle>
				</DialogHeader>
				<div className="py-4">
					<p className="text-sm text-gray-500">
						Are you sure you want to delete this record? This action cannot be
						undone.
					</p>
					<p className="mt-2 text-sm font-medium">
						Record ID: <span className="font-mono">{record?.id}</span>
					</p>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={isDeleting}
						className="bg-gray-100 text-gray-600"
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleConfirm}
						disabled={isDeleting}
						className="bg-red-100 text-red-700 hover:bg-red-200"
					>
						{isDeleting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Deleting...
							</>
						) : (
							"Delete Record"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
