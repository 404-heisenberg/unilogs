export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'duration';

export interface FieldDefinition {
  id: string;
  label?: string;

  // Added to support ProjectDetailPage UI fallbacks
  name?: string;
  key?: string;
  fieldType?: FieldType;
  type?: FieldType;

  value?: string;
}

export interface TagItem {
  id?: number;
  name?: string;
}

export interface EntryTag {
  tag: TagItem | string;
}

export interface Entry {
  id: number;
  projectId?: number | null;
  project?: {
    id: number;
    name: string;
  } | null;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  content?: Record<string, string> | FieldDefinition[] | string;
  tags?: EntryTag[];
}

export type LogEntry = Entry;

export interface Project {
  id: number;
  name: string;
  description?: string;
  fields?: FieldDefinition[];
  entries?: Entry[];

  _count?: {
    entries: number;
  };
}
