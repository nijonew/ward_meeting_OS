import type { AdminTableConfig } from "./types";
import {
  ASSIGNMENT_ROLES,
  MUSIC_TYPES,
  RABNM_TYPES,
  SPECIAL_FORMATS,
  SPEAKER_SLOTS_ADULT,
  SPEAKER_SLOTS_YOUTH,
  slotLabel,
} from "@/lib/data/sacrament-constants";
import { YOUTH_ACTIVITY_GROUPS, YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import { DEFAULT_CALLING_STATUSES, DEFAULT_RELEASE_STATUSES } from "@/lib/data/calling-planning";

/** Fields whose choices can be edited via the "Dropdown Option Lists"
 *  admin table below (admin_select_options) instead of code. Kept as an
 *  explicit list -- rather than free text on that table's field_key
 *  column -- so a typo there can't silently produce an empty dropdown
 *  somewhere else in the app. */
const OPTION_FIELD_KEYS = [
  { value: "calling_planning.calling_status", label: "Calling Planning → Calling Status" },
  { value: "calling_planning.release_status", label: "Calling Planning → Release Status" },
];

const PUBLISH_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

const SONGBOOKS = [
  { value: "hymns_for_home_and_church", label: "Hymns for Home and Church" },
  { value: "hymns_1985", label: "Hymns of The Church of Jesus Christ of Latter-day Saints" },
  { value: "childrens_songbook", label: "Children's Songbook" },
];

const SPEAKER_SLOT_OPTIONS_ADULT = SPEAKER_SLOTS_ADULT.map((s) => ({ value: s, label: slotLabel(s) }));
const SPEAKER_SLOT_OPTIONS_YOUTH = SPEAKER_SLOTS_YOUTH.map((s) => ({ value: s, label: slotLabel(s) }));

const SUBMISSION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** meetingTypeSlug narrows the Meeting calendar picker to just that
 *  type's dates -- pass none for tables that can reference any meeting
 *  type (agenda_items, announcements, council_notes, meeting_action_items,
 *  meeting_element_notes are all genuinely cross-type, per their own
 *  data-layer comments). */
const MEETING_FK = (meetingTypeSlug?: string) => ({ table: "meetings", valueColumn: "id", labelColumn: "date", meetingTypeSlug });
const PERSON_FK = { table: "people", valueColumn: "id", labelColumn: "name" };

/**
 * One entry per table exposed under /admin. Only tables listed here show
 * up at all; only the columns listed for a table are readable/writable.
 *
 * Deliberately excluded, by decision (not just pending):
 * - bishopric_minutes: PROJECT_CONTEXT.md flags this table's free-text
 *   fields as a known duplicate-entry hazard with the dynamic planning
 *   view -- stays out until that's consolidated, so this grid doesn't
 *   become a third place to edit the same data.
 * - meeting_element_types, meeting_templates, meeting_type_members,
 *   meeting_type_templates, meeting_types: the catalog that drives the
 *   dynamic planning view's rendering. meeting_templates now has its own
 *   purpose-built editor at /admin/meeting-templates instead (reorder +
 *   slot-count UI, keyed by meeting type + format); the rest stay
 *   admin-only via direct Supabase access rather than the generic grid,
 *   since a bad row here can
 *   break that page for an entire meeting type, not just create bad data.
 * - meeting_schedule_rules: already has a dedicated editor at
 *   /meeting-schedule with Edit/Copy -- no need to duplicate it here.
 * - rotations, rotation_members: /rotations already manages membership
 *   and ordering with the correct sort_order/next_index bookkeeping
 *   (see app/rotations/actions.ts) -- a raw grid edit to sort_order
 *   here could desync next_index from what member is actually "next."
 * - sacrament_rabnm_people: pure join table with a composite key
 *   (rabnm_id, person_id), no surrogate id column -- the generic editor
 *   assumes every table has an `id` primary key, so this one needs
 *   composite-key support that doesn't exist yet.
 *
 * Columns deliberately left off tables that ARE included:
 * - meetings.stage: the template/planning/review/ready/live/archived
 *   lifecycle controls what the public program page shows -- edit it
 *   through the meeting's own pages, not here.
 * - meetings.agenda_share_token: an unguessable-link secret. Exposing
 *   or hand-editing it in a grid defeats the point of it being one.
 */
export const ADMIN_TABLES: Record<string, AdminTableConfig> = {
  admin_select_options: {
    table: "admin_select_options",
    label: "Dropdown Option Lists",
    description:
      "Manage the choices shown in other tables' status dropdowns (currently Calling Planning's Calling Status and Release Status). Deleting every row for a Field Key falls back to that field's built-in default list rather than showing no choices at all.",
    orderBy: { column: "field_key", ascending: true },
    columns: [
      { column: "field_key", label: "Field Key", type: "select", required: true, options: OPTION_FIELD_KEYS },
      { column: "value", label: "Value (stored)", type: "text", required: true },
      { column: "label", label: "Label (shown)", type: "text", required: true },
      { column: "sort_order", label: "Sort Order", type: "number" },
    ],
  },

  hymnal_songs: {
    table: "hymnal_songs",
    label: "Hymnal / Songbook Reference",
    description:
      "Reference list of hymn/song numbers and titles across the three current music collections -- for looking things up while entering Sacrament Meeting Music, not tied to any specific meeting. Not pre-populated yet; add entries here as needed.",
    orderBy: { column: "songbook", ascending: true },
    columns: [
      { column: "songbook", label: "Songbook", type: "select", required: true, options: SONGBOOKS },
      { column: "number", label: "Number", type: "number", required: true },
      { column: "title", label: "Title", type: "text", required: true },
    ],
  },

  agenda_items: {
    table: "agenda_items",
    label: "Agenda Items",
    description: "Submitted agenda items for bishopric/council meetings.",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "title", label: "Title", type: "text", required: true },
      { column: "body", label: "Body", type: "long_text", required: true },
      { column: "submitted_by_name", label: "Submitted By", type: "text", required: true },
      { column: "submitted_by_email", label: "Email", type: "text" },
      { column: "status", label: "Status", type: "select", required: true, options: SUBMISSION_STATUSES },
      { column: "meeting_id", label: "Meeting", type: "foreign_key", foreignKey: MEETING_FK() },
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
      { column: "submitted_by_email", label: "Email", type: "text" },
      { column: "status", label: "Status", type: "select", required: true, options: SUBMISSION_STATUSES },
      { column: "meeting_id", label: "Meeting", type: "foreign_key", foreignKey: MEETING_FK() },
    ],
  },

  bishopric_assignments: {
    table: "bishopric_assignments",
    label: "Bishopric Meeting Assignment Rotation",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("bishopric-meeting") },
      { column: "role", label: "Role", type: "select", required: true, options: [...ASSIGNMENT_ROLES] },
      { column: "assigned_to_id", label: "Assigned To", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "confirmed", label: "Confirmed", type: "boolean" },
    ],
  },

  calling_planning: {
    table: "calling_planning",
    label: "Calling Planning",
    description:
      "Calling Status tracks the incoming person, Release Status tracks the outgoing one -- they're independent so you can have someone released before their replacement is even chosen.",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "calling_id", label: "Calling", type: "foreign_key", required: true, foreignKey: { table: "callings", valueColumn: "id", labelColumn: "name" } },
      {
        column: "calling_status",
        label: "Calling Status",
        type: "select",
        required: true,
        options: DEFAULT_CALLING_STATUSES,
        optionsFrom: "calling_planning.calling_status",
      },
      { column: "selected_person_id", label: "Selected Person", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "date_set_apart", label: "Date Set Apart", type: "date" },
      {
        column: "release_person_id",
        label: "Release Person",
        type: "foreign_key",
        foreignKey: PERSON_FK,
        // Narrowed to just this row's calling's current/backup holder,
        // instead of every person in the ward -- see AdminColumnConfig.scopedBy.
        scopedBy: { scopeColumn: "calling_id", lookupTable: "callings", lookupColumns: ["current_holder_id", "backup_holder_id"] },
        // Not a real person -- picking this clears release_person_id and
        // sets release_status to previously_vacant in the same save.
        specialOptions: [
          { value: "__previously_vacant__", label: "— Previously Vacant / New Calling —", patch: { release_status: "previously_vacant" } },
        ],
      },
      {
        column: "release_status",
        label: "Release Status",
        type: "select",
        required: true,
        options: DEFAULT_RELEASE_STATUSES,
        optionsFrom: "calling_planning.release_status",
      },
      { column: "notes", label: "Notes", type: "long_text" },
      { column: "announced_meeting_id", label: "Announced In", type: "foreign_key", foreignKey: MEETING_FK("sacrament-meeting") },
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
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK() },
      { column: "notes", label: "Notes", type: "long_text" },
      { column: "next_meeting_date", label: "Next Meeting Date", type: "date" },
    ],
  },

  meeting_action_items: {
    table: "meeting_action_items",
    label: "Meeting Action Items",
    orderBy: { column: "created_at", ascending: false },
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK() },
      { column: "description", label: "Description", type: "text", required: true },
      { column: "assigned_to_id", label: "Assigned To", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "due_date", label: "Due Date", type: "date" },
      { column: "completed", label: "Completed", type: "boolean" },
    ],
  },

  meeting_element_notes: {
    table: "meeting_element_notes",
    label: "Meeting Element Notes",
    description:
      "Free-text for planning-view elements with no table of their own -- e.g. Spiritual Thought and Handbook Training notes on the Bishopric Meeting side (element_key identifies which one). Most tables here have an obvious use; this one is closer to a catch-all, so it's normal not to need it often.",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK() },
      { column: "element_key", label: "Element Key", type: "text", required: true },
      { column: "person_id", label: "Person", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "text_value", label: "Text", type: "long_text" },
    ],
  },

  meetings: {
    table: "meetings",
    label: "Meetings",
    description:
      "Edit meeting metadata. Stage and the agenda share link are managed by the app, not editable here. Prefer /meetings/new or /meeting-schedule to create new meetings so rotations get assigned automatically -- a row added here skips that.",
    orderBy: { column: "date", ascending: false },
    columns: [
      { column: "meeting_type_id", label: "Meeting Type", type: "foreign_key", required: true, foreignKey: { table: "meeting_types", valueColumn: "id", labelColumn: "name" } },
      { column: "date", label: "Date", type: "date", required: true },
      { column: "time_of_day", label: "Time", type: "time" },
      { column: "duration_minutes", label: "Duration (min)", type: "number" },
    ],
  },

  people: {
    table: "people",
    label: "People",
    orderBy: { column: "name", ascending: true },
    columns: [
      { column: "name", label: "Name", type: "text", required: true },
      { column: "email", label: "Email", type: "text" },
      { column: "active", label: "Active", type: "boolean" },
      { column: "notes", label: "Notes", type: "long_text" },
    ],
  },

  sacrament_assignments: {
    table: "sacrament_assignments",
    label: "Sacrament Meeting Rotations",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("sacrament-meeting") },
      { column: "role", label: "Role", type: "select", required: true, options: [...ASSIGNMENT_ROLES] },
      { column: "assigned_to_id", label: "Assigned To", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "confirmed", label: "Confirmed", type: "boolean" },
    ],
  },

  sacrament_music: {
    table: "sacrament_music",
    label: "Sacrament Meeting Music",
    description:
      "submitted_by is left out -- it's attribution for whoever (bishopric/music planner) entered the item, not something to reassign. status is left out too: every entry is now treated as approved the moment it's entered (see the live Music planning view), so there's nothing left to toggle here.",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("sacrament-meeting") },
      { column: "type", label: "Type", type: "select", required: true, options: [...MUSIC_TYPES] },
      { column: "slot", label: "Slot", type: "text" },
      { column: "hymn_number", label: "Hymn #", type: "number" },
      { column: "piece_name", label: "Piece Name", type: "text" },
      { column: "individual_id", label: "Individual", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "group_name", label: "Group Name", type: "text" },
      { column: "accompanist_id", label: "Accompanist", type: "foreign_key", foreignKey: PERSON_FK },
    ],
  },

  sacrament_planning: {
    table: "sacrament_planning",
    label: "Sacrament Meeting Planning",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("sacrament-meeting") },
      { column: "special_format", label: "Special Format", type: "select", required: true, options: [...SPECIAL_FORMATS] },
      { column: "ward_business", label: "Ward Business", type: "long_text" },
      { column: "stake_business", label: "Stake Business", type: "long_text" },
      { column: "visiting_authorities", label: "Visiting Authorities", type: "long_text" },
      { column: "recognitions", label: "Recognitions", type: "long_text" },
      { column: "hidden_notes", label: "Hidden Notes", type: "long_text" },
    ],
  },

  sacrament_rabnm: {
    table: "sacrament_rabnm",
    label: "Recognitions / Advancements / Baptisms / New Members",
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("sacrament-meeting") },
      { column: "type", label: "Type", type: "select", required: true, options: [...RABNM_TYPES] },
      { column: "calling_id", label: "Calling", type: "foreign_key", foreignKey: { table: "callings", valueColumn: "id", labelColumn: "name" } },
      { column: "detail", label: "Detail", type: "text" },
      { column: "event_date", label: "Event Date", type: "date" },
    ],
  },

  sacrament_speakers_adults: {
    table: "sacrament_speakers_adults",
    label: "Sacrament Speakers (Adult)",
    orderBy: { column: "slot", ascending: true },
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("sacrament-meeting") },
      { column: "slot", label: "Slot", type: "select", required: true, options: SPEAKER_SLOT_OPTIONS_ADULT },
      { column: "speaker_id", label: "Speaker", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "guest_speaker_name", label: "Guest Speaker Name", type: "text" },
      { column: "topic", label: "Topic", type: "text" },
      { column: "duration", label: "Duration", type: "text" },
      { column: "confirmed", label: "Confirmed", type: "boolean" },
    ],
  },

  sacrament_speakers_youth: {
    table: "sacrament_speakers_youth",
    label: "Sacrament Speakers (Youth)",
    orderBy: { column: "slot", ascending: true },
    columns: [
      { column: "meeting_id", label: "Meeting", type: "foreign_key", required: true, foreignKey: MEETING_FK("sacrament-meeting") },
      { column: "slot", label: "Slot", type: "select", required: true, options: SPEAKER_SLOT_OPTIONS_YOUTH },
      { column: "speaker_id", label: "Speaker", type: "foreign_key", foreignKey: PERSON_FK },
      { column: "guest_speaker_name", label: "Guest Speaker Name", type: "text" },
      { column: "topic", label: "Topic", type: "text" },
      { column: "duration", label: "Duration", type: "text" },
      { column: "confirmed", label: "Confirmed", type: "boolean" },
    ],
  },

  ward_events: {
    table: "ward_events",
    label: "Ward Events",
    orderBy: { column: "event_date", ascending: true },
    columns: [
      { column: "event_date", label: "Date", type: "date", required: true },
      { column: "event_time", label: "Time", type: "time" },
      { column: "title", label: "Title", type: "text", required: true },
      { column: "location", label: "Location", type: "text" },
      { column: "notes", label: "Notes", type: "long_text" },
      { column: "status", label: "Status", type: "select", required: true, options: PUBLISH_STATUSES },
    ],
  },

  youth_activities: {
    table: "youth_activities",
    label: "Youth Activities",
    orderBy: { column: "activity_date", ascending: true },
    columns: [
      { column: "activity_date", label: "Date", type: "date", required: true },
      { column: "activity_time", label: "Time", type: "time" },
      { column: "title", label: "Title", type: "text", required: true },
      { column: "group_name", label: "Group", type: "select", required: true, options: YOUTH_ACTIVITY_GROUPS },
      { column: "location", label: "Location", type: "text" },
      { column: "development_category", label: "Development Category", type: "select", options: YOUTH_DEVELOPMENT_CATEGORIES },
      { column: "youth_lead", label: "Youth Lead", type: "text" },
      { column: "advisor_lead", label: "Advisor Lead", type: "text" },
      { column: "notes", label: "Notes", type: "long_text" },
      { column: "status", label: "Status", type: "select", required: true, options: PUBLISH_STATUSES },
    ],
  },
};

export function getAdminTableConfig(table: string): AdminTableConfig | null {
  return ADMIN_TABLES[table] ?? null;
}
