import React, { useState } from 'react';
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
import { FolderPlus } from 'lucide-react';

export const CreateFolderDialog = ({ open, onOpenChange, user, API_BASE, fetchCollections, triggerToast }) => {
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim() || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ name: newCollectionName.trim() })
      });
      if (res.ok) {
        triggerToast(`Collection "${newCollectionName.trim()}" created successfully.`, "Folder Created");
        setNewCollectionName('');
        onOpenChange(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to create collection', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setNewCollectionName('');
      }
    }}>
      <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <FolderPlus className="w-5 h-5 text-[#96a68f]" /> Create New Folder
          </DialogTitle>
          <DialogDescription className="text-[#a39b90] text-xs mt-1">
            Create a new empty catalog folder to store your scraped items.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateCollection} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Folder Name</label>
            <Input
              type="text"
              placeholder="e.g. Mechanical Keyboards"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
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
                setNewCollectionName('');
              }}
              className="flex-1 border-white/10 text-[#f5f2eb] hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#96a68f] text-[#181715] font-semibold hover:bg-[#a9b9a2]"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFolderDialog;
