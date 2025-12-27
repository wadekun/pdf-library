import React from 'react';
import { FolderOpen, ChevronDown, ChevronRight as ChevronRightIcon, RefreshCw, Trash2, AlertCircle, FileText } from 'lucide-react';
import { DirectoryData, FileData, Lang } from '../types';
import { TRANSLATIONS } from '../translations';

// --- Component: Directory Row ---
export const DirectoryRow: React.FC<{ 
  directory: DirectoryData; 
  onToggle: (id: string) => void; 
  onRemove: (id: string) => void;
  onVerifyPermission: (id: string) => void;
  onOpenFile: (file: FileData) => void;
  lang: Lang;
}> = ({ 
  directory, 
  onToggle, 
  onRemove,
  onVerifyPermission,
  onOpenFile,
  lang
}) => {
  const fileCount = directory.files.length;
  const t = TRANSLATIONS[lang];
  
  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-white cursor-pointer hover:bg-gray-50 border-b border-transparent"
        onClick={() => onToggle(directory.id)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="text-gray-400">
             {directory.isExpanded ? <ChevronDown size={20} /> : <ChevronRightIcon size={20} />}
          </div>
          <FolderOpen size={20} className={directory.status === 'connected' ? "text-indigo-500" : "text-gray-400"} />
          <div className="flex flex-col overflow-hidden">
            <span className="font-medium text-gray-800 truncate">{directory.name}</span>
            <span className="text-xs text-gray-500 flex items-center gap-2">
              {directory.status === 'connected' ? (
                <span className="text-green-600">{t.connected}</span>
              ) : directory.status === 'need-permission' ? (
                <span className="text-amber-600 font-medium">{t.permissionRequired}</span>
              ) : (
                <span>{fileCount} {t.filesCount}</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {directory.status === 'need-permission' && (
            <button 
              onClick={() => onVerifyPermission(directory.id)}
              className="px-3 py-1.5 text-xs bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} />
              {t.reconnect}
            </button>
          )}
          <button 
            onClick={() => onRemove(directory.id)}
            className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
            title="Remove from Library"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {directory.isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          {directory.error ? (
            <div className="text-red-500 text-sm p-2 flex items-center gap-2">
              <AlertCircle size={16} /> {directory.error}
            </div>
          ) : directory.files.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm italic">
              {t.noFiles}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {directory.files.map((file) => {
                 const progressPct = file.progress 
                 ? Math.round((file.progress.page / file.progress.totalPages) * 100) 
                 : 0;
                 return (
                  <div 
                    key={file.id} 
                    onDoubleClick={() => onOpenFile(file)}
                    className="group bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all flex flex-col h-32"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <FileText size={24} className="text-gray-300 group-hover:text-indigo-400" />
                      {file.progress && (
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                          {progressPct}%
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-h-0">
                      <h4 className="text-sm font-medium text-gray-700 line-clamp-2 leading-tight mb-1" title={file.name}>
                        {file.name}
                      </h4>
                    </div>
                    {file.progress ? (
                       <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                         <div className="h-full bg-indigo-500" style={{ width: `${progressPct}%` }} />
                       </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-gray-400">{t.new}</div>
                    )}
                  </div>
                 )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
