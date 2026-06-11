import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from 'lucide-react';

export const FilterPanel = ({
  currentSchema,
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  onResetFilters,
  darkTheme = false,
  title = "Refine Items"
}) => {
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterOperator, setNewFilterOperator] = useState('=');
  const [newFilterValue, setNewFilterValue] = useState('');

  const isFilterActive = activeFilters.length > 0;

  const handleAddClick = () => {
    if (!newFilterField) return;
    const fieldType = currentSchema ? currentSchema[newFilterField] : 'string';
    let val = typeof newFilterValue === 'string' ? newFilterValue.trim() : newFilterValue;
    
    if (fieldType === 'numeric') {
      const parsed = parseFloat(val);
      if (isNaN(parsed)) return;
      val = parsed;
    } else if (fieldType === 'boolean') {
      val = String(val).toLowerCase() === 'true';
    }

    const newRule = {
      id: String(Math.random() + Date.now()),
      field: newFilterField,
      operator: newFilterOperator,
      value: val
    };

    onAddFilter(newRule);
    setNewFilterValue('');
  };

  // Dynamic theme class definitions
  const containerClass = darkTheme 
    ? "mb-6 bg-[#22201d]/60 p-5 rounded-xl border border-white/5 shadow-inner"
    : "mb-4 bg-black/10 p-5 rounded-xl border border-black/15 shadow-inner";

  const borderClass = darkTheme 
    ? "border-white/10" 
    : "border-black/15";

  const headerTitleClass = darkTheme 
    ? "text-xs uppercase font-bold tracking-wider text-zinc-400 font-title"
    : "text-xs uppercase font-bold tracking-wider opacity-85 font-title";

  const clearBtnClass = darkTheme
    ? "text-[10px] uppercase font-bold text-[#cca678] hover:text-[#d4c2ab] transition-all hover:underline"
    : "text-[10px] uppercase font-bold text-inherit hover:opacity-80 transition-all hover:underline cursor-pointer border-none bg-transparent p-0";

  const tagClass = darkTheme
    ? "flex items-center gap-1.5 bg-[#8c9c86]/20 border border-[#8c9c86]/40 text-[#f5f2eb] px-2.5 py-1 rounded-md text-[10px] font-mono"
    : "flex items-center gap-1.5 bg-black/15 border border-black/20 text-inherit px-2.5 py-1 rounded-md text-[10px] font-mono";

  const tagOperatorClass = darkTheme
    ? "text-[#cca678] font-bold"
    : "opacity-90 font-bold";

  const tagCloseClass = darkTheme
    ? "w-3.5 h-3.5 rounded-full hover:bg-white/10 flex items-center justify-center text-[10px] ml-1 transition-colors border-none bg-transparent cursor-pointer"
    : "w-3.5 h-3.5 rounded-full hover:bg-black/10 flex items-center justify-center text-[10px] ml-1 transition-colors border-none bg-transparent cursor-pointer";

  const ruleLabelClass = darkTheme
    ? "flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500"
    : "flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-60";

  const triggerClass = darkTheme
    ? "bg-[#12110f]/80 border-white/5 text-xs h-8 text-[#f5f2eb] focus:ring-0 focus:ring-offset-0"
    : "bg-black/25 border-black/15 text-xs h-8 text-inherit focus:ring-0 focus:ring-offset-0";

  const operatorTriggerClass = darkTheme
    ? "w-[85px] bg-[#12110f]/80 border-white/5 text-xs h-8 text-[#f5f2eb] font-mono focus:ring-0 focus:ring-offset-0"
    : "w-[85px] bg-black/25 border-black/15 text-xs h-8 text-inherit focus:ring-0 focus:ring-offset-0 font-mono";

  const booleanTriggerClass = darkTheme
    ? "w-[100px] bg-[#12110f]/80 border-white/5 text-xs h-8 text-[#f5f2eb] focus:ring-0 focus:ring-offset-0"
    : "w-[100px] bg-black/25 border-black/15 text-xs h-8 text-inherit focus:ring-0 focus:ring-offset-0";

  const inputClass = darkTheme
    ? "bg-[#12110f]/80 border border-white/5 rounded px-3 h-8 text-xs text-[#f5f2eb] placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[#8c9c86]/20 font-mono min-w-[120px] flex-1 max-w-[200px]"
    : "bg-black/25 border border-black/15 rounded px-3 h-8 text-xs text-inherit placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-black/20 font-mono min-w-[120px] flex-1 max-w-[200px]";

  const submitBtnClass = darkTheme
    ? "bg-[#8c9c86] hover:bg-[#a1b09b] text-[#181715] text-xs h-8 px-3.5 font-bold transition-all ml-auto md:ml-0"
    : "bg-black/35 hover:bg-black/50 text-inherit text-xs h-8 px-3.5 font-bold transition-all ml-auto md:ml-0";

  return (
    <div className={containerClass}>
      <div className={`flex justify-between items-center mb-4 pb-2 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className={`w-4 h-4 ${darkTheme ? "text-[#96a68f]" : "opacity-80"}`} />
          <h3 className={headerTitleClass}>{title}</h3>
        </div>
        {isFilterActive && (
          <button onClick={onResetFilters} className={clearBtnClass}>
            Clear Active Filters
          </button>
        )}
      </div>

      {/* Active Rule Tags */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map(f => (
            <div key={f.id} className={tagClass}>
              <span className="opacity-75">{f.field === 'price' ? 'price' : f.field.replace('metadata.', '')}</span>
              <span className={tagOperatorClass}>{f.operator}</span>
              <span>{String(f.value)}</span>
              <button 
                onClick={() => onRemoveFilter(f.id)}
                className={tagCloseClass}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Rule Builder Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={ruleLabelClass}>
          <span>Add Rule:</span>
        </div>

        {/* Choose Field dropdown */}
        <Select 
          value={newFilterField} 
          onValueChange={(val) => {
            setNewFilterField(val);
            const type = currentSchema[val];
            if (type === 'numeric') {
              setNewFilterOperator('<');
              setNewFilterValue('');
            } else if (type === 'boolean') {
              setNewFilterOperator('=');
              setNewFilterValue('true');
            } else {
              setNewFilterOperator('contains');
              setNewFilterValue('');
            }
          }}
        >
          <SelectTrigger className={`w-[150px] ${triggerClass}`}>
            <SelectValue placeholder="Select Field" />
          </SelectTrigger>
          <SelectContent className="bg-[#22201d] border-white/10 text-xs text-[#f5f2eb]">
            {Object.keys(currentSchema).map(path => (
              <SelectItem key={path} value={path} className="text-[#f5f2eb] hover:bg-white/5 focus:bg-white/5 cursor-pointer">
                {path === 'price' ? 'Price' : path.replace('metadata.', '')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Choose Operator dropdown */}
        {newFilterField && (
          <Select value={newFilterOperator} onValueChange={setNewFilterOperator}>
            <SelectTrigger className={operatorTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#22201d] border-white/10 text-xs text-[#f5f2eb]">
              {currentSchema[newFilterField] === 'numeric' && (
                <>
                  <SelectItem value="<">&lt;</SelectItem>
                  <SelectItem value=">">&gt;</SelectItem>
                  <SelectItem value="=">=</SelectItem>
                </>
              )}
              {currentSchema[newFilterField] === 'boolean' && (
                <SelectItem value="=">=</SelectItem>
              )}
              {currentSchema[newFilterField] === 'string' && (
                <>
                  <SelectItem value="contains">contains</SelectItem>
                  <SelectItem value="=">=</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )}

        {/* Input value */}
        {newFilterField && (
          currentSchema[newFilterField] === 'boolean' ? (
            <Select value={newFilterValue} onValueChange={setNewFilterValue}>
              <SelectTrigger className={booleanTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#22201d] border-white/10 text-xs text-[#f5f2eb]">
                <SelectItem value="true">TRUE</SelectItem>
                <SelectItem value="false">FALSE</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <input
              type={currentSchema[newFilterField] === 'numeric' ? 'number' : 'text'}
              placeholder="Value"
              value={newFilterValue}
              onChange={(e) => setNewFilterValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFilterField && newFilterValue) {
                  e.preventDefault();
                  handleAddClick();
                }
              }}
              className={inputClass}
            />
          )
        )}

        {newFilterField && (
          <Button 
            onClick={handleAddClick} 
            disabled={!newFilterField || (currentSchema[newFilterField] !== 'boolean' && !newFilterValue)}
            className={submitBtnClass}
          >
            {darkTheme ? 'Add' : 'Apply Rule'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
