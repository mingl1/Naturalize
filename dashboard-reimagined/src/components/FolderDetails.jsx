import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder as FolderIcon,
  ArrowLeft,
  Globe,
  Edit,
  Palette,
  Trash2,
  Database,
  ExternalLink
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPanel } from './FilterPanel';
import { getDomain, getCleanDomainName, formatDate, FOLDER_THEMES } from '../lib/helpers';

export const FolderDetails = ({
  activeCollection,
  collections,
  collectionsItems,
  collectionDetails,
  selectedWebsiteFilter,
  setSelectedWebsiteFilter,
  setActiveTab,
  onRenameClick,
  onColorClick,
  onDeleteClick
}) => {
  const [activeFilters, setActiveFilters] = useState([]);

  // Reset active filters whenever the active collection changes
  useEffect(() => {
    setActiveFilters([]);
  }, [activeCollection]);

  const rawItems = useMemo(() => {
    if (!activeCollection || !collectionsItems[activeCollection]) return [];
    return collectionsItems[activeCollection].items || [];
  }, [activeCollection, collectionsItems]);

  const websites = useMemo(() => {
    if (!activeCollection || !collectionsItems[activeCollection]) return [];
    return collectionsItems[activeCollection].websites || [];
  }, [activeCollection, collectionsItems]);

  const collectionIndex = useMemo(() => {
    return collections.indexOf(activeCollection) + 1;
  }, [collections, activeCollection]);

  // Gauge schema dynamically from rawItems
  const currentSchema = useMemo(() => {
    if (rawItems.length === 0) return null;

    let fields = {
      "price": "numeric"
    };

    rawItems.forEach(item => {
      if (item.metadata && typeof item.metadata === 'object') {
        Object.entries(item.metadata).forEach(([key, val]) => {
          if (key.startsWith('extracted_')) return;
          if (val === null || val === undefined || val === '') return;

          const fieldPath = `metadata.${key}`;
          if (!fields[fieldPath]) {
            let valType = typeof val;
            if (Array.isArray(val)) {
              fields[fieldPath] = "string";
            } else if (valType === 'number') {
              fields[fieldPath] = "numeric";
            } else if (valType === 'boolean') {
              fields[fieldPath] = "boolean";
            } else {
              fields[fieldPath] = "string";
            }
          }
        });
      }
    });

    return fields;
  }, [rawItems]);

  const isFilterActive = activeFilters.length > 0;

  const handleAddFilter = (newRule) => {
    setActiveFilters(prev => {
      const filtered = prev.filter(f => !(f.field === newRule.field && f.operator === newRule.operator));
      return [...filtered, newRule];
    });
  };

  const handleRemoveFilter = (id) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
  };

  const resetFilters = () => {
    setActiveFilters([]);
  };

  // Filter items in collection
  const activeItems = useMemo(() => {
    let items = [...rawItems];
    
    if (selectedWebsiteFilter && selectedWebsiteFilter !== 'none_filter_value') {
      items = items.filter(item => getDomain(item.source_url) === selectedWebsiteFilter);
    }

    activeFilters.forEach(rule => {
      const { field, operator, value } = rule;

      items = items.filter(item => {
        let val;
        if (field === 'price') {
          val = item.price;
        } else if (field.startsWith('metadata.')) {
          const key = field.slice(9);
          val = item.metadata ? item.metadata[key] : undefined;
        }

        if (val === undefined || val === null) return false;

        const fieldType = currentSchema ? currentSchema[field] : 'string';
        if (fieldType === 'numeric') {
          const numVal = parseFloat(val);
          const numLimit = parseFloat(value);
          if (isNaN(numVal) || isNaN(numLimit)) return false;

          if (operator === '<') return numVal < numLimit;
          if (operator === '>') return numVal > numLimit;
          if (operator === '=') return numVal === numLimit;
        } else if (fieldType === 'boolean') {
          const boolVal = String(val).toLowerCase() === 'true';
          const boolLimit = String(value).toLowerCase() === 'true';
          if (operator === '=') return boolVal === boolLimit;
        } else {
          // string
          const strVal = String(val).toLowerCase();
          const strLimit = String(value).toLowerCase();
          if (operator === '=') return strVal === strLimit;
          if (operator === 'contains') return strVal.includes(strLimit);
        }
        return true;
      });
    });

    return items;
  }, [rawItems, selectedWebsiteFilter, activeFilters, currentSchema]);

  return (
    <div className="fade-in h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-black/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setActiveTab('grid'); setSelectedWebsiteFilter(''); }} 
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors text-inherit border-none cursor-pointer" 
            title="Back to Folders"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-5 h-5 opacity-80" />
              <h2 className="text-xl font-bold font-title truncate max-w-[200px]" title={activeCollection}>{activeCollection}</h2>
            </div>
            <p className="text-[10px] text-inherit/60 font-mono mt-0.5">
              INDEX: #{collectionIndex.toString().padStart(3, '0')} — {activeItems.length} ITEMS CAPTURED
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {websites.length > 0 && (
            <Select value={selectedWebsiteFilter || 'none_filter_value'} onValueChange={setSelectedWebsiteFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-black/25 border-none text-inherit focus:ring-0 focus:ring-offset-0">
                <div className="flex items-center gap-1.5 truncate">
                  <Globe className="w-3.5 h-3.5 opacity-75" />
                  <SelectValue placeholder="All Domains" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#22201d] border-white/5 text-[#f5f2eb]">
                <SelectItem value="none_filter_value" className="text-xs">All Domains</SelectItem>
                {websites.map(web => (
                  <SelectItem key={web.domain} value={web.domain} className="text-xs">{web.name} ({web.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button 
            className="h-8 px-2.5 rounded bg-black/20 hover:bg-black/40 transition-colors flex items-center gap-1.5 text-xs text-inherit border-none cursor-pointer" 
            onClick={() => onRenameClick(activeCollection)} 
            title="Rename Folder"
          >
            <Edit className="w-3.5 h-3.5" /> Rename
          </button>
          <button 
            className="h-8 px-2.5 rounded bg-black/20 hover:bg-black/40 transition-colors flex items-center gap-1.5 text-xs text-inherit border-none cursor-pointer" 
            onClick={() => {
              const currentDetail = collectionDetails.find(d => d.name === activeCollection);
              const idx = collections.indexOf(activeCollection);
              onColorClick(activeCollection, currentDetail?.color || FOLDER_THEMES[idx % FOLDER_THEMES.length].hex);
            }} 
            title="Folder Color"
          >
            <Palette className="w-3.5 h-3.5" /> Color
          </button>
          <button 
            className="h-8 px-2.5 rounded bg-[#c99377]/10 hover:bg-[#c99377]/25 text-[#c99377] transition-colors flex items-center gap-1.5 text-xs border-none cursor-pointer" 
            onClick={() => onDeleteClick(activeCollection)} 
            title="Delete Folder"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {rawItems.length > 0 && currentSchema && (
        <FilterPanel
          currentSchema={currentSchema}
          activeFilters={activeFilters}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onResetFilters={resetFilters}
          darkTheme={false}
          title="Refine Folder Items"
        />
      )}

      <div className="flex-1 overflow-y-auto pr-1">
        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
            <Database className="w-12 h-12 mb-4" />
            <h4 className="text-sm font-semibold mb-1">No items found</h4>
            <p className="text-xs max-w-xs">{selectedWebsiteFilter ? 'No items match the domain filter.' : 'Generate or run scraper scripts to fill this folder.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
            {activeItems.map(item => (
              <div key={item._id} className="bg-black/15 border border-black/10 rounded-xl p-5 flex flex-col justify-between hover:bg-black/25 transition-all duration-200">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div>
                    <h4 className="font-semibold text-sm line-clamp-2 text-inherit">{item.title}</h4>
                    <span className="text-[10px] bg-black/10 border border-black/10 px-2 py-0.5 rounded-sm uppercase tracking-wider font-semibold font-mono inline-block mt-2">
                      {getCleanDomainName(getDomain(item.source_url))}
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-inherit whitespace-nowrap">${item.price?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-dashed border-black/15 text-xs">
                  <a 
                    href={item.source_url || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-semibold flex items-center gap-1 hover:underline text-inherit opacity-90 hover:opacity-100"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Source
                  </a>
                  <span className="text-[10px] opacity-75">{formatDate(item.updated_at || item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderDetails;
