import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FormDefinition, DEFAULT_FORMS } from "@/models/form";
import { getIntegrationClient } from "@/lib/integration-app-client";
import { getStoredAuth, type AuthCustomer } from "@/lib/auth";
import { DEFAULT_FORMS as CONSTANTS_DEFAULT_FORMS } from "@/lib/constants";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const customerId = searchParams.get("customerId");

	if (!customerId) {
		return NextResponse.json(
			{ error: "Customer ID is required" },
			{ status: 400 }
		);
	}

	await connectToDatabase();

	// Ensure default forms exist for this customer
	const defaultForms = CONSTANTS_DEFAULT_FORMS;

	await Promise.all(
		defaultForms.map(async (defaultForm) => {
			await FormDefinition.findOneAndUpdate(
				{
					customerId,
					formId: defaultForm.formId,
					type: "default",
				},
				{
					formTitle: defaultForm.formTitle,
					updatedAt: new Date(),
				},
				{ upsert: true }
			);
		})
	);

	// Get all forms for the customer
	const forms = await FormDefinition.find({ customerId }).sort({
		type: -1,
		formTitle: 1,
	}); // Default forms first, then alphabetically

	return NextResponse.json({ forms });
}

export async function POST(request: Request) {
	const body = await request.json();
	const { customerId, formId, formTitle, integrationKey } = body;

	if (!customerId) {
		return NextResponse.json(
			{ error: "Customer ID is required" },
			{ status: 400 }
		);
	}

	// Create auth object for integration client
	const auth: AuthCustomer = {
		customerId,
		customerName: null,
	};

	await connectToDatabase();

	try {
		// Get integration client
		const integrationClient = await getIntegrationClient(auth);

		// Create field mapping
		await integrationClient
			.connection(integrationKey)
			.fieldMapping("objects", { instanceKey: formId.toLowerCase() })
			.get({ autoCreate: true });

		// Create form definition in MongoDB
		const form = await FormDefinition.create({
			customerId,
			formId: formId.toLowerCase(),
			formTitle,
			type: "custom",
			integrationKey,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		return NextResponse.json(form);
	} catch (error) {
		console.error("Error creating form:", error);
		return NextResponse.json(
			{ error: "Failed to create form and integration resources" },
			{ status: 500 }
		);
	}
}
