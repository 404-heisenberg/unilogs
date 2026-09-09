export type Project = {
  id: number;
  name: string;
  description?: string;
  userId: string;
};

export type FieldDefinition = {
  id: number;
  projectId: number;
  name: string;
  fieldType: string;
};

export type EntryContent = Record<string, unknown>;

export type Entry = {
  id: number;
  projectId: number;
  date: string;
  createdAt: string;
  content: EntryContent;
};
