// --- Types ---

export interface ReadingProgress {
  page: number;
  totalPages: number;
  lastRead: number; // timestamp
}

export interface FileData {
  id: string; // unique ID composed of dirId + fileName
  directoryId: string;
  name: string;
  handle?: FileSystemFileHandle; 
  progress?: ReadingProgress;
}

export interface DirectoryData {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle | null;
  isExpanded: boolean;
  status: 'connected' | 'need-permission';
  files: FileData[];
  error?: string;
}

export type ViewState = 'library' | 'reader' | 'history';
export type Lang = 'en' | 'zh';
