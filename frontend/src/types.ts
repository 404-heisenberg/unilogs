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

export type FieldDefinition = {
  id: number;
  projectId: number;
  name: string;
  fieldType: string;
  todoEnabled?: boolean;
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

export type PagedEntries = {
  entries: Entry[];
  total: number;
  page: number;
  limit: number;
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
