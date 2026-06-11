import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from 'lucide-react';

export const DeleteFolderDialog = ({
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

  const handleDeleteCollection = async () => {
    if (!targetCollection || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(targetCollection)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (res.ok) {
        triggerToast(`Collection "${targetCollection}" deleted successfully.`, "Folder Deleted");
        
        if (activeCollection === targetCollection) {
          setActiveCollection('');
        }
        setFolderStack(prev => prev.filter(c => c !== targetCollection));
        
        onOpenChange(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to delete collection', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-red-400">
            <Trash2 className="w-5 h-5" /> Delete Folder
          </DialogTitle>
          <DialogDescription className="text-[#a39b90] text-xs mt-1">
            Are you sure you want to delete folder "{targetCollection}"?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 text-sm text-[#f5f2eb]">
          This action <strong className="text-red-400">cannot be undone</strong>. All scraped catalog items inside this folder will be permanently deleted.
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
            type="button"
            onClick={handleDeleteCollection}
            className="flex-1 bg-red-500 text-white font-semibold hover:bg-red-600 border border-red-600"
          >
            Delete Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteFolderDialog;
