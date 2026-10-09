export type ReminderFrequency = 'DAILY' | 'WEEKLY' | 'OFF';

export type Project = {
  id: number;
  name: string;
  description?: string;
  archived: boolean;
  userId: string;
  reminderFrequency: ReminderFrequency;
  todoEnabled?: boolean;
};

export type AggregationKind = 'sum' | 'average' | 'max' | 'min';

export type FieldDefinition = {
  id: number;
  projectId: number;
  name: string;
  fieldType: string;
  todoEnabled?: boolean;
  aggregationOverride?: AggregationKind | null;
};

export type EntryContent = Record<string, unknown>;

export type EntryTag = {
  tag: { id: number; name: string };
};

export type Entry = {
  id: number;
  projectId: number;
  date: string;
  dueDate?: string | null;
  createdAt: string;
  title?: string | null;
  body?: string | null;
  content: EntryContent;
  tags?: EntryTag[];
  project?: Project;
  hasOpenFields?: boolean;
  isCompleted?: boolean;
};

// One row of an entry's audit trail, as returned by GET /api/entries/:id/history.
// `snapshot` is the entry as it stood after that write; a DELETE row carries the
// state it removed. Mirrors EntryVersion in
// backend/src/services/entry-history-service.ts.
export type EntryVersionSnapshot = {
  title: string | null;
  body: string | null;
  content: EntryContent;
  date: string;
  tagIds?: number[];
};

export type EntryVersion = {
  auditId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  modifiedAt: string;
  snapshot: EntryVersionSnapshot | null;
};

export type PagedEntries = {
  entries: Entry[];
  total: number;
  page: number;
  limit: number;
};

// An entry as it stood on a past date, rebuilt from its history. No
// `createdAt`, due date or completion state: only what history recorded.
export type AsAtEntry = {
  id: number;
  projectId: number;
  title: string | null;
  body: string | null;
  content: EntryContent;
  date: string;
  project: { id: number; name: string };
  tags: EntryTag[];
};

export type EntriesAsAt = {
  entries: AsAtEntry[];
  total: number;
  /** The YYYY-MM-DD day asked for, echoed back. */
  date: string;
};

export type TrashTag = { id: number; name: string };

export type TrashEntry = {
  id: number;
  date: string;
  title?: string | null;
  body?: string | null;
  content: EntryContent;
  deletedAt: string;
  tags: TrashTag[];
};

export type ProjectTrash = {
  project: Project;
  entries: TrashEntry[];
};

export type Notification = {
  id: number;
  userId: string;
  projectId: number | null;
  type: 'REMINDER' | 'SYSTEM';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationFeed = {
  notifications: Notification[];
  unreadCount: number;
};

export type Tag = {
  id: number;
  name: string;
  usageCount: number;
};

export type StatPanelAggregation = 'sum' | 'average';

export type StatPanelPoint = { date: string; value: number };

export type StatPanel = {
  id: number;
  projectId: number;
  name: string;
  expression: string;
  aggregation: StatPanelAggregation;
  rangeDays: number;
  position: number;
  hidden: boolean;
  createdAt: string;
  // The list endpoint computes these. `value` is null when evaluation failed,
  // and `error` then carries the reason.
  value: number | null;
  sampleCount: number;
  series: StatPanelPoint[];
  error?: string;
};

// A panel from GET /api/stat-panels: every project's panels in one list, each
// with its project and the field types formatStatValue needs.
export type DashboardStatPanel = StatPanel & {
  project: { id: number; name: string };
  fields: Pick<FieldDefinition, 'name' | 'fieldType'>[];
};

export type StatPanelInput = {
  expression: string;
  aggregation: StatPanelAggregation;
  rangeDays: number;
};

export type StatPanelPreview = {
  value: number;
  sampleCount: number;
  series: StatPanelPoint[];
};
