import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/server-auth";
import { getIntegrationClient } from "@/lib/integration-app-client";
import { Record, IRecord } from "@/models/record";
import { connectToDatabase } from "@/lib/mongodb";
import { RecordActionKey, RECORD_ACTIONS } from "@/lib/constants";

export async function GET(request: NextRequest) {
	try {
		const auth = getAuthFromRequest(request);
		if (!auth.customerId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const searchParams = request.nextUrl.searchParams;
		const actionKey = searchParams.get("action") as RecordActionKey;
		const instanceKey = searchParams.get("instanceKey");

		if (!actionKey) {
			return NextResponse.json(
				{ error: "Action key is required" },
				{ status: 400 }
			);
		}

		// Get default form types from RECORD_ACTIONS
		const defaultFormTypes = RECORD_ACTIONS.filter(
			(action) => action.type === "default"
		).map((action) => action.key.replace("get-", ""));

		// Extract the form ID from the action key
		const formId = actionKey?.startsWith("get-")
			? actionKey.substring(4)
			: null;
		const isCustomForm = formId && !defaultFormTypes.includes(formId);

		// For custom forms, instanceKey is required
		if (isCustomForm && !instanceKey) {
			return NextResponse.json(
				{ error: "Instance key is required for custom forms" },
				{ status: 400 }
			);
		}

		await connectToDatabase();
		const client = await getIntegrationClient(auth);
		const connectionsResponse = await client.connections.find();
		const firstConnection = connectionsResponse.items?.[0];

		if (!firstConnection) {
			return NextResponse.json({
				success: false,
				error: "No connection found",
			});
		}

		let allRecords: IRecord[] = [];
		let hasMoreRecords = true;
		let currentCursor = null;
		let newRecordsCount = 0;
		let existingRecordsCount = 0;

		// Keep fetching while there are more records
		while (hasMoreRecords) {
			console.log(`Fetching records with cursor: ${currentCursor}`);

			// Use the correct syntax for running the action
			const result = await client
				.connection(firstConnection.id)
				.action(actionKey, {
					instanceKey: instanceKey || undefined,
				})
				.run({ cursor: currentCursor });

			const records = result.output.records || [];
			allRecords = [...allRecords, ...records];

			// Debug: Log the structure of the first record to understand the data format
			if (records.length > 0) {
				console.log(
					"Sample record structure:",
					JSON.stringify(records[0], null, 2)
				);
			}

			// Save batch to MongoDB with duplicate checking
			if (records.length > 0) {
				const recordsToSave = records.map((record: IRecord) => ({
					...record,
					// Ensure name field exists - use id as fallback if name is missing
					name: record.name || record.id || "Unnamed Record",
					customerId: auth.customerId,
					recordType: isCustomForm ? instanceKey : actionKey,
				}));

				// Check for existing records and only save new ones
				for (const record of recordsToSave) {
					const existingRecord = await Record.findOne({
						id: record.id,
						customerId: auth.customerId,
						recordType: record.recordType,
					});

					if (existingRecord) {
						existingRecordsCount++;
						console.log(`Record ${record.id} already exists, skipping...`);
					} else {
						await Record.create(record);
						newRecordsCount++;
						console.log(`Saved new record ${record.id} to MongoDB`);
					}
				}

				console.log(
					`Processed ${records.length} records: ${newRecordsCount} new, ${existingRecordsCount} existing`
				);
			}

			// Check if there are more records to fetch
			currentCursor = result.output.cursor;
			hasMoreRecords = !!currentCursor;

			if (hasMoreRecords) {
				console.log("More records available, continuing to next page...");
			}
		}

		console.log(
			`Import completed. Total records processed: ${allRecords.length}, New: ${newRecordsCount}, Existing: ${existingRecordsCount}`
		);

		return NextResponse.json({
			success: true,
			recordsCount: allRecords.length,
			newRecordsCount,
			existingRecordsCount,
		});
	} catch (error) {
		console.error("Error in import:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
