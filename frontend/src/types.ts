export type Project = {
  id: number;
  name: string;
  description?: string;
  userId: string;
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
