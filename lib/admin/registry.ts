import type { AdminTableConfig } from "./types";

const SUBMISSION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const CALLING_STATUSES = [
  { value: "discussing", label: "Discussing" },
  { value: "future", label: "Future" },
  { value: "declined", label: "Declined" },
  { value: "to_announce", label: "To Announce in Sacrament" },
  { value: "to_be_set_apart", label: "To Be Set Apart" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
];

const RELEASE_STATUSES = [
  { value: "previously_vacant", label: "Previously Vacant" },
  { value: "discussing", label: "Discussing" },
  { value: "to_announce", label: "To Announce in Sacrament" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
];

const MEETING_FK = { table: "meetings", valueColumn: "id", labelColumn: "date" };
const PERSON_FK = { table: "people", valueColumn: "id", labelColumn: "name" };

/**
 * One entry per table exposed under /admin. Only tables listed here show
 * up at all; only the columns listed for a table are readable/writable.
 *
 * Deliberately NOT included yet (need a decision, see chat):
 * - bishopric_minutes: PROJECT_CONTEXT.md flags this table's free-text
 *   fields as a known duplicate-entry hazard with the dynamic planning
 *   view -- don't wire up a third way to edit them without asking.
 * - meeting_element_types, meeting_templates, meeting_type_members,
 *   meeting_type_templates, meeting_types: these are the catalog that
 *   drives the dynamic planning view's rendering. A bad row here can
 *   break that page for an entire meeting type, not just create bad data.
 * - meeting_schedule_rules: already has a dedicated editor at
 *   /meeting-schedule with Edit/Copy -- no need to duplicate it here.
 */
export const ADMIN_TABLES: Record<string, AdminTableConfig> = {
  agenda_items: {
    table: "agenda_items",
    label: "Agenda Items",
    description: "Submitted agenda items for bishopric/council meetings.",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "title", label: "Title", type: "text", required: true },
      { column: "body", label: "Body", type: "long_text", required: true },
      { column: "submitted_by_name", label: "Submitted By", type: "text", required: true },
      { column: "submitted_by_email", label: "Email", type: "text", required: true },
      { column: "status", label: "Status", type: "select", required: true, options: SUBMISSION_STATUSES },
      { column: "meeting_id", label: "Meeting", type: "foreign_key", foreignKey: MEETING_FK },
    ],
  },

  announcements: {
    table: "announcements",
    label: "Announcements",
    description: "Submitted announcements, published to the public landing page when marked Published.",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "title", label: "Title", type: "text", required: true },
      { column: "body", label: "Body", type: "long_text", required: true },
      { column: "submitted_by_name", label: "Submitted By", type: "text", required: true },
      { column: "submitted_by_email", label: "Email", type: "text", required: true },
      { column: "status", label: "Status", type: "select", required: true, options: SUBMISSION_STATUSES },
      { column: "meeting_id", label: "Meeting", type: "foreign_key", foreignKey: MEETING_FK },
    ],
  },

  bishopric_assignments: {
    table: "bishopric_assignments",
    label: "Bishopric Assignments",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK },
      { column: "role", label: "Role", type: "text", required: true },
      { column: "assigned_to_id", label: "Assigned To", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "confirmed", label: "Confirmed", type: "boolean" },
    ],
  },

  calling_planning: {
    table: "calling_planning",
    label: "Calling Planning",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "calling_id", label: "Calling", type: "foreign_key", required: true, foreignKey: { table: "callings", valueColumn: "id", labelColumn: "name" } },
      { column: "calling_status", label: "Calling Status", type: "select", required: true, options: CALLING_STATUSES },
      { column: "selected_person_id", label: "Selected Person", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "date_set_apart", label: "Date Set Apart", type: "date" },
      { column: "release_person_id", label: "Release Person", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "release_status", label: "Release Status", type: "select", required: true, options: RELEASE_STATUSES },
      { column: "notes", label: "Notes", type: "long_text" },
      { column: "announced_meeting_id", label: "Announced In", type: "foreign_key", foreignKey: MEETING_FK },
    ],
  },

  callings: {
    table: "callings",
    label: "Callings",
    orderBy: { column: "sort_order", ascending: true },
    columns: [
      { column: "name", label: "Name", type: "text", required: true },
      { column: "title_prefix", label: "Title Prefix", type: "text" },
      { column: "current_holder_id", label: "Current Holder", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "backup_holder_id", label: "Backup Holder", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "sort_order", label: "Sort Order", type: "number" },
      { column: "active", label: "Active", type: "boolean" },
    ],
  },

  council_notes: {
    table: "council_notes",
    label: "Council Notes",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK },
      { column: "notes", label: "Notes", type: "long_text" },
      { column: "next_meeting_date", label: "Next Meeting Date", type: "date" },
    ],
  },

  meeting_action_items: {
    table: "meeting_action_items",
    label: "Meeting Action Items",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK },
      { column: "description", label: "Description", type: "text", required: true },
      { column: "assigned_to_id", label: "Assigned To", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "due_date", label: "Due Date", type: "date" },
      { column: "completed", label: "Completed", type: "boolean" },
    ],
  },

  meeting_element_notes: {
    table: "meeting_element_notes",
    label: "Meeting Element Notes",
    description: "Generic free-text notes for planning-view elements that don't have their own table.",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK },
      { column: "element_key", label: "Element Key", type: "text", required: true },
      { column: "person_id", label: "Person", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "text_value", label: "Text", type: "long_text" },
    ],
  },
};

export function getAdminTableConfig(table: string): AdminTableConfig | null {
  return ADMIN_TABLES[table] ?? null;
}
