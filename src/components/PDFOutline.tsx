import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { PDFOutlineItem } from '../types';

interface OutlineNodeProps {
  item: PDFOutlineItem;
  onItemClick: (dest: any) => void;
  depth?: number;
}

const OutlineNode: React.FC<OutlineNodeProps> = ({ item, onItemClick, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.items && item.items.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.dest) {
      onItemClick(item.dest);
    }
    // Also toggle expand if clicking the row but not strictly required
    // if (hasChildren) setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div 
        className={`
          flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors
          hover:bg-gray-700 text-gray-300 hover:text-white
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Icon or Spacer */}
        <div 
          onClick={hasChildren ? handleToggle : undefined}
          className={`
            p-0.5 rounded hover:bg-gray-600 transition-colors
            ${hasChildren ? 'cursor-pointer text-gray-400' : 'opacity-0 pointer-events-none'}
          `}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {/* Title */}
        <span 
          className="text-sm truncate select-none flex-1" 
          title={item.title}
        >
          {item.title}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {item.items.map((child, index) => (
            <OutlineNode 
              key={index} 
              item={child} 
              onItemClick={onItemClick} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface PDFOutlineProps {
  items: PDFOutlineItem[];
  onItemClick: (dest: any) => void;
}

export const PDFOutline: React.FC<PDFOutlineProps> = ({ items, onItemClick }) => {
  if (!items || items.length === 0) {
    return <div className="p-4 text-gray-500 text-sm text-center">No outline available</div>;
  }

  return (
    <div className="flex flex-col pb-4">
      {items.map((item, index) => (
        <OutlineNode key={index} item={item} onItemClick={onItemClick} />
      ))}
    </div>
  );
};
