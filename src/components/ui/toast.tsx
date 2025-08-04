"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
	message: string;
	type: "success" | "error" | "info";
	onClose: () => void;
	duration?: number;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
	({ message, type, onClose, duration = 5000 }, ref) => {
		React.useEffect(() => {
			const timer = setTimeout(() => {
				onClose();
			}, duration);

			return () => clearTimeout(timer);
		}, [duration, onClose]);

		const getIcon = () => {
			switch (type) {
				case "success":
					return <CheckCircle className="h-4 w-4 text-green-600" />;
				case "error":
					return <AlertCircle className="h-4 w-4 text-red-600" />;
				case "info":
					return <Info className="h-4 w-4 text-blue-600" />;
				default:
					return null;
			}
		};

		const getStyles = () => {
			switch (type) {
				case "success":
					return "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200";
				case "error":
					return "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200";
				case "info":
					return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200";
				default:
					return "bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-800 dark:text-gray-200";
			}
		};

		return (
			<div
				ref={ref}
				className={cn(
					"fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out",
					getStyles()
				)}
			>
				{getIcon()}
				<span className="text-sm font-medium">{message}</span>
				<button
					onClick={onClose}
					className="ml-2 rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
				>
					<X className="h-3 w-3" />
				</button>
			</div>
		);
	}
);
Toast.displayName = "Toast";

export { Toast };
