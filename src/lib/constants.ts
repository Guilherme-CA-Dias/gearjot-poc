export const RECORD_ACTIONS = [
	{
		key: "get-equipment",
		name: "Equipment",
		type: "default",
	},
] as const;

export type RecordActionKey = (typeof RECORD_ACTIONS)[number]["key"] | string;

export const DEFAULT_FORMS = [
	{ formId: "equipment", formTitle: "Equipment", type: "default" },
] as const;
