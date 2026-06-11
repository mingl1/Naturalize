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
import { Edit } from 'lucide-react';

export const RenameFolderDialog = ({
  open,
  onOpenChange,
  targetCollection,
  activeCollection,
  setActiveCollection,
  setFolderStack,
  user,
  API_BASE,
  fetchCollections,
  triggerToast
}) => {
  const [renamedCollectionName, setRenamedCollectionName] = useState('');

  useEffect(() => {
    if (open && targetCollection) {
      setRenamedCollectionName(targetCollection);
    }
  }, [open, targetCollection]);

  const handleRenameCollection = async (e) => {
    e.preventDefault();
    if (!renamedCollectionName.trim() || !targetCollection || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(targetCollection)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ new_name: renamedCollectionName.trim() })
      });
      if (res.ok) {
        triggerToast(`Collection renamed to "${renamedCollectionName.trim()}".`, "Folder Renamed");
        
        if (activeCollection === targetCollection) {
          setActiveCollection(renamedCollectionName.trim());
        }
        setFolderStack(prev => prev.map(c => c === targetCollection ? renamedCollectionName.trim() : c));
        
        setRenamedCollectionName('');
        onOpenChange(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to rename collection', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setRenamedCollectionName('');
      }
    }}>
      <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Edit className="w-5 h-5 text-[#96a68f]" /> Rename Folder
          </DialogTitle>
          <DialogDescription className="text-[#a39b90] text-xs mt-1">
            Rename folder "{targetCollection}" to a new name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRenameCollection} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">New Name</label>
            <Input
              type="text"
              placeholder="e.g. Vintage Keyboards"
              value={renamedCollectionName}
              onChange={(e) => setRenamedCollectionName(e.target.value)}
              className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20"
              required
            />
          </div>
          <DialogFooter className="flex gap-2 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setRenamedCollectionName('');
              }}
              className="flex-1 border-white/10 text-[#f5f2eb] hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#96a68f] text-[#181715] font-semibold hover:bg-[#a9b9a2]"
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameFolderDialog;
