import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Record } from "@/models/record";
import { RecordActionKey } from "@/lib/constants";

interface WebhookPayload {
	customerId: string;
	recordType: RecordActionKey;
	data: {
		id: string | number;
		name?: string;
		fields?: {
			[key: string]: any;
		};
		createdTime?: string;
		updatedTime?: string;
		// Any other fields that might come
		[key: string]: any;
	};
}

export async function POST(request: NextRequest) {
	try {
		const payload = (await request.json()) as WebhookPayload;
		console.log("Received webhook payload:", {
			customerId: payload.customerId,
			recordId: payload.data.id,
			recordType: payload.recordType,
		});

		await connectToDatabase();

		// Ensure we have the required fields
		if (!payload.customerId || !payload.data.id || !payload.recordType) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Check for existing record
		const existingRecord = await Record.findOne({
			id: payload.data.id.toString(),
			customerId: payload.customerId,
		});

		// Compare records to check if update is needed
		if (existingRecord) {
			// Convert both records to comparable objects
			const existingData = {
				...existingRecord.toObject(),
				_id: undefined, // Exclude MongoDB _id from comparison
				__v: undefined, // Exclude version from comparison
				updatedTime: undefined, // Exclude updatedTime from comparison
			};

			const newData = {
				...payload.data,
				id: payload.data.id.toString(),
				customerId: payload.customerId,
				recordType: payload.recordType,
				_id: undefined,
				__v: undefined,
				updatedTime: undefined,
			};

			// Only update if data has changed
			if (JSON.stringify(existingData) === JSON.stringify(newData)) {
				console.log("Record unchanged, skipping update:", payload.data.id);
				return NextResponse.json({
					success: true,
					recordId: payload.data.id,
					_id: existingRecord._id,
					customerId: payload.customerId,
					recordType: payload.recordType,
					status: "unchanged",
				});
			}
		}

		// Update or insert the record
		const result = await Record.findOneAndUpdate(
			{
				id: payload.data.id.toString(),
				customerId: payload.customerId,
			},
			{
				$set: {
					...payload.data,
					id: payload.data.id.toString(),
					customerId: payload.customerId,
					recordType: payload.recordType,
					updatedTime: new Date().toISOString(),
				},
			},
			{
				upsert: true,
				new: true, // Return the updated/inserted document
			}
		);

		console.log("Record updated:", {
			id: payload.data.id,
			_id: result._id,
			customerId: payload.customerId,
			recordType: payload.recordType,
			status: existingRecord ? "updated" : "created",
		});

		return NextResponse.json({
			success: true,
			recordId: payload.data.id,
			_id: result._id,
			customerId: payload.customerId,
			recordType: payload.recordType,
			status: existingRecord ? "updated" : "created",
		});
	} catch (error) {
		console.error("Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
