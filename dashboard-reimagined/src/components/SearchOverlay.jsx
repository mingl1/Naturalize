import React, { useState, useMemo } from 'react';
import { Search, X, ExternalLink } from 'lucide-react';
import { FilterPanel } from './FilterPanel';
import { getDomain, getCleanDomainName } from '../lib/helpers';

export const SearchOverlay = ({
  searchQuery,
  searchResults,
  onClose
}) => {
  const [activeFilters, setActiveFilters] = useState([]);

  const resetFilters = () => {
    setActiveFilters([]);
  };

  const handleAddFilter = (newRule) => {
    setActiveFilters(prev => {
      const filtered = prev.filter(f => !(f.field === newRule.field && f.operator === newRule.operator));
      return [...filtered, newRule];
    });
  };

  const handleRemoveFilter = (id) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
  };

  // Gauge schema dynamically from searchResults
  const currentSchema = useMemo(() => {
    if (!searchResults) return null;

    let fields = {
      "price": "numeric"
    };

    searchResults.forEach(item => {
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
  }, [searchResults]);

  // Apply filters to search results
  const filteredSearchResults = useMemo(() => {
    if (!searchResults) return null;
    let items = [...searchResults];

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
  }, [searchResults, activeFilters, currentSchema]);

  return (
    <div className="absolute inset-0 bg-[#181715] text-[#f5f2eb] p-8 overflow-y-auto z-30 fade-in">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-[#96a68f]" />
          <h2 className="text-xl font-bold font-title">Semantic Search Matches</h2>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-[#a39b90]">"{searchQuery}"</span>
        </div>
        <button 
          onClick={onClose} 
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-inherit border-none cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Schema Filters inside Search Overlay */}
      {searchResults.length > 0 && currentSchema && (
        <FilterPanel
          currentSchema={currentSchema}
          activeFilters={activeFilters}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onResetFilters={resetFilters}
          darkTheme={true}
          title="Refine Search Results"
        />
      )}

      {filteredSearchResults.length === 0 ? (
        <div className="text-center py-20 text-[#a39b90]">
          <p className="text-lg font-semibold mb-2">No matching items found</p>
          <p className="text-sm">Try running queries like "price under 100" or typing alternative keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSearchResults.map(item => (
            <div key={item._id} className="bg-[#22201d] border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-[#8c9c86]/30 transition-all">
              <div>
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h4 className="font-semibold text-sm line-clamp-2 text-[#f5f2eb]">{item.title}</h4>
                  <span className="font-title text-base font-bold text-[#cca678]">${item.price?.toFixed(2)}</span>
                </div>
                <span className="text-[10px] bg-white/5 border border-white/10 text-[#a39b90] px-2 py-0.5 rounded-sm uppercase tracking-wider font-semibold">
                  {getCleanDomainName(getDomain(item.source_url))}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-white/10 flex items-center justify-between text-xs">
                <a 
                  href={item.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#96a68f] hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> View Source
                </a>
                <span className="text-[10px] text-[#a39b90]">Collection: {item.collection_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchOverlay;
