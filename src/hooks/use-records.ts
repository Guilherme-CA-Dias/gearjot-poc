import useSWR from "swr";
import { RecordsResponse } from "@/types/record";
import { authenticatedFetcher } from "@/lib/fetch-utils";
import { useState, useCallback, useEffect } from "react";
import { RECORD_ACTIONS } from "@/lib/constants";
import { Record } from "@/types/record";

export function useRecords(actionKey: string | null, search: string = "") {
	const [allRecords, setAllRecords] = useState<Record[]>([]);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [isImporting, setIsImporting] = useState(false);

	// Get default form types from RECORD_ACTIONS
	const defaultFormTypes = RECORD_ACTIONS.filter(
		(action) => action.type === "default"
	).map((action) => action.key.replace("get-", ""));

	// Extract the form ID from the action key for custom forms
	const formId = actionKey?.startsWith("get-") ? actionKey.substring(4) : null;
	const isCustomForm = formId && !defaultFormTypes.includes(formId);

	// For custom forms, we'll use 'get-objects' with instanceKey parameter
	const apiEndpoint = actionKey
		? isCustomForm
			? `/api/records?action=get-objects&instanceKey=${formId}${
					search ? `&search=${encodeURIComponent(search)}` : ""
			  }`
			: `/api/records?action=${actionKey}${
					search ? `&search=${encodeURIComponent(search)}` : ""
			  }`
		: null;

	const { data, error, isLoading, mutate } = useSWR<RecordsResponse>(
		apiEndpoint,
		authenticatedFetcher
	);

	// Reset records when action or search changes
	useEffect(() => {
		setAllRecords([]);
	}, [actionKey, search]);

	useEffect(() => {
		if (data?.records) {
			setAllRecords((prev) =>
				prev.length === 0 ? data.records : [...prev, ...data.records]
			);
		}
	}, [data]);

	const loadMore = useCallback(async () => {
		if (!data?.cursor || isLoadingMore || !actionKey) return;

		setIsLoadingMore(true);
		try {
			// For custom forms, use 'get-objects' with instanceKey
			const endpoint = isCustomForm
				? `/api/records?action=get-objects&instanceKey=${formId}&cursor=${
						data.cursor
				  }${search ? `&search=${encodeURIComponent(search)}` : ""}`
				: `/api/records?action=${actionKey}&cursor=${data.cursor}${
						search ? `&search=${encodeURIComponent(search)}` : ""
				  }`;

			const nextPage = (await authenticatedFetcher(
				endpoint
			)) as RecordsResponse;
			setAllRecords((prev) => [...prev, ...nextPage.records]);
			await mutate(
				{ ...nextPage, records: [...allRecords, ...nextPage.records] },
				false
			);
		} catch (error) {
			console.error("Error loading more records:", error);
		} finally {
			setIsLoadingMore(false);
		}
	}, [
		data?.cursor,
		actionKey,
		isLoadingMore,
		allRecords,
		mutate,
		search,
		formId,
		isCustomForm,
	]);

	const importRecords = async () => {
		if (!actionKey || isImporting) return;

		setIsImporting(true);
		try {
			// For custom forms, use 'get-objects' with instanceKey
			const endpoint = isCustomForm
				? `/api/records/import?action=get-objects&instanceKey=${formId}`
				: `/api/records/import?action=${actionKey}`;

			const response = (await authenticatedFetcher(endpoint)) as {
				success: boolean;
				recordsCount: number;
				newRecordsCount: number;
				existingRecordsCount: number;
				error?: string;
			};

			if (response.error) {
				throw new Error(response.error);
			}

			await mutate();
			return response;
		} catch (error) {
			console.error("Error importing records:", error);
			throw error;
		} finally {
			setIsImporting(false);
		}
	};

	return {
		records: allRecords,
		isLoading,
		isError: error,
		hasMore: !!data?.cursor,
		loadMore,
		isLoadingMore,
		importRecords,
		isImporting,
		mutate,
	};
}
