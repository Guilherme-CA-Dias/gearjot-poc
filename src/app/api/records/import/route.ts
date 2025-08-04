import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/server-auth";
import { getIntegrationClient } from "@/lib/integration-app-client";
import { Record, IRecord } from "@/models/record";
import { connectToDatabase } from "@/lib/mongodb";
import { RecordActionKey } from "@/lib/constants";

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

		// For get-objects action, instanceKey is required
		if (actionKey === "get-objects" && !instanceKey) {
			return NextResponse.json(
				{ error: "Instance key is required for get-objects action" },
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

			// Save batch to MongoDB with duplicate checking
			if (records.length > 0) {
				const recordsToSave = records.map((record: IRecord) => ({
					...record,
					customerId: auth.customerId,
					recordType: actionKey === "get-objects" ? instanceKey : actionKey,
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
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
