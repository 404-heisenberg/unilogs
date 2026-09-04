export type Project = {
  id: number;
  name: string;
  userId: string;
};

export type FieldDefinition = {
  id: number;
  projectId: number;
  name: string;
  fieldType: string;
};

export type EntryContent = {
  description?: string;
  timeSpent?: string;
};

export type Entry = {
  id: number;
  projectId: number;
  date: string;
  createdAt: string;
  content: EntryContent;
};
