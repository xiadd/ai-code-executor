export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size: string;
  modified: string;
};

export type OpenFile = {
  path: string;
  content: string;
  modified: boolean;
};

export type AuthUser = {
  id: number;
  login: string;
  name: string;
  avatar: string;
  email: string | null;
  org: string;
  team?: string;
};
