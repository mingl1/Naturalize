import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Palette } from 'lucide-react';
import { isColorLight } from '../../lib/helpers';

export const FolderStyleDialog = ({
  open,
  onOpenChange,
  targetCollection,
  collectionDetails,
  user,
  API_BASE,
  fetchCollections,
  triggerToast,
  defaultColor = '#eae6df'
}) => {
  const [selectedColor, setSelectedColor] = useState(defaultColor);

  useEffect(() => {
    if (open && targetCollection) {
      const currentDetail = collectionDetails.find(d => d.name === targetCollection);
      setSelectedColor(currentDetail?.color || defaultColor);
    }
  }, [open, targetCollection, collectionDetails, defaultColor]);

  const handleSaveColor = async () => {
    if (!targetCollection || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(targetCollection)}/color`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ color: selectedColor })
      });
      if (res.ok) {
        triggerToast(`Color for folder "${targetCollection}" updated successfully.`, "Folder Color Updated");
        onOpenChange(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to update folder color', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Palette className="w-5 h-5 text-[#96a68f]" /> Folder Style
          </DialogTitle>
          <DialogDescription className="text-[#a39b90] text-xs mt-1">
            Customize style and color for folder "{targetCollection}"
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Live Preview */}
          <div className="flex flex-col items-center justify-center p-6 bg-[#181715] rounded-xl border border-white/5 relative overflow-hidden h-28">
            <div className="absolute top-2 left-2 text-[10px] text-[#a39b90] uppercase tracking-wider font-semibold">Preview</div>
            <div 
              className="folder-tab-trapezoid font-semibold select-none scale-90"
              style={{
                backgroundColor: selectedColor,
                color: isColorLight(selectedColor) ? '#181715' : '#eae6df',
                transform: 'translateY(8px)'
              }}
            >
              <div 
                className="folder-index-badge"
                style={{
                  backgroundColor: isColorLight(selectedColor) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'
                }}
              >
                01
              </div>
              <span className="max-w-[120px] truncate">{targetCollection}</span>
            </div>
          </div>

          {/* Preset Swatches */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Preset Colors</label>
            <div className="grid grid-cols-5 gap-2.5">
              {[
                { hex: '#eae6df', name: 'Cream' },
                { hex: '#d6b885', name: 'Sand' },
                { hex: '#181715', name: 'Charcoal' },
                { hex: '#55614e', name: 'Sage' },
                { hex: '#ad765c', name: 'Clay' },
                { hex: '#466b73', name: 'Teal' },
                { hex: '#804a52', name: 'Berry' },
                { hex: '#69717d', name: 'Slate' },
                { hex: '#c0a468', name: 'Gold' },
                { hex: '#4e5561', name: 'Indigo' },
              ].map(preset => (
                <button
                  key={preset.hex}
                  type="button"
                  className="w-8 h-8 rounded-full border-2 transition-all relative group cursor-pointer p-0"
                  style={{
                    backgroundColor: preset.hex,
                    borderColor: selectedColor.toLowerCase() === preset.hex.toLowerCase() ? '#96a68f' : 'transparent',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                  }}
                  onClick={() => setSelectedColor(preset.hex)}
                  title={preset.name}
                >
                  {selectedColor.toLowerCase() === preset.hex.toLowerCase() && (
                    <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${isColorLight(preset.hex) ? 'text-zinc-900' : 'text-zinc-100'}`}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Color Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Custom HEX Color</label>
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 relative flex-shrink-0 cursor-pointer">
                <input 
                  type="color" 
                  value={selectedColor} 
                  onChange={(e) => setSelectedColor(e.target.value)} 
                  className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-150"
                />
              </div>
              <Input 
                type="text" 
                value={selectedColor} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('#') && val.length <= 7) {
                    setSelectedColor(val);
                  } else if (!val.startsWith('#') && val.length <= 6) {
                    setSelectedColor('#' + val);
                  }
                }} 
                placeholder="#ffffff" 
                className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20 font-mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2 border-t border-white/5">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="flex-1 border-white/10 text-[#f5f2eb] hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveColor}
            className="flex-1 bg-[#96a68f] text-[#181715] font-semibold hover:bg-[#a9b9a2]"
          >
            Save Color
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FolderStyleDialog;
