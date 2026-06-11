import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Folder as FolderIcon,
  FolderPlus,
  RotateCw,
  Edit,
  Palette,
  Trash2,
  Database
} from 'lucide-react';
import { getBentoLayoutClasses, FOLDER_THEMES, getDomain, getCleanDomainName } from '../lib/helpers';

export const FoldersGrid = ({
  isLoadingItems,
  collections,
  collectionsItems,
  collectionDetails,
  fetchCollections,
  setActiveCollection,
  setSelectedWebsiteFilter,
  setActiveTab,
  onNewFolderClick,
  onRenameFolderClick,
  onColorFolderClick,
  onDeleteFolderClick
}) => {
  return (
    <div className="fade-in h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-title">Catalog Folders</h2>
          <p className="text-xs text-[#a39b90]">Select a folder to browse captured listing data grids</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="border-white/10 bg-white/5 hover:bg-white/10 text-xs gap-2 text-[#96a68f]" 
            onClick={onNewFolderClick}
          >
            <FolderPlus className="w-3.5 h-3.5" /> New Folder
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-white/10 bg-white/5 hover:bg-white/10 text-xs gap-2" 
            onClick={() => fetchCollections()}
          >
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {isLoadingItems && collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#a39b90]">
          <RotateCw className="w-8 h-8 animate-spin mb-4 text-[#96a68f]" />
          <p>Syncing catalog databases...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[#a39b90]">
          <Database className="w-12 h-12 mb-4 text-[#96a68f]" />
          <h3 className="text-[#f5f2eb] text-lg font-semibold mb-2">No folders captured yet</h3>
          <p className="text-sm max-w-sm">Use the chrome extension on visual listing grids to auto-generate BeautifulSoup parser scripts and populate your folders.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[360px] pr-2">
          {collections.map((col, idx) => {
            const colData = collectionsItems[col];
            const itemsCount = colData ? colData.items?.length : 0;
            const websites = colData ? colData.websites : [];
            return (
              <div key={col} className="bg-[#22201d] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-[#8c9c86]/30 transition-all duration-300 group">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderIcon className="w-5 h-5 text-[#96a68f] flex-shrink-0" />
                      <h3 className="font-bold text-lg text-[#f5f2eb] group-hover:text-[#96a68f] transition-colors truncate" title={col}>{col}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        className="text-zinc-500 hover:text-[#96a68f] transition-colors p-1 bg-transparent border-none cursor-pointer" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onRenameFolderClick(col);
                        }} 
                        title="Rename Folder"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        className="text-zinc-500 hover:text-[#96a68f] transition-colors p-1 bg-transparent border-none cursor-pointer" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const currentDetail = collectionDetails.find(d => d.name === col);
                          const currentTheme = FOLDER_THEMES[idx % FOLDER_THEMES.length];
                          onColorFolderClick(col, currentDetail?.color || currentTheme.hex);
                        }} 
                        title="Folder Color"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 bg-transparent border-none cursor-pointer" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onDeleteFolderClick(col);
                        }} 
                        title="Delete Folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-semibold text-[#a39b90] whitespace-nowrap">{itemsCount} items</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#a39b90] mb-2 font-semibold">Web Sources Layout</p>
                    {websites.length === 0 ? (
                      <div className="h-24 bg-black/20 border border-dashed border-white/5 rounded-lg flex items-center justify-center text-xs text-[#a39b90] italic">Empty folder content</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 h-28">
                        {websites.slice(0, 3).map((web, wIdx) => {
                          const bentoClass = getBentoLayoutClasses(wIdx, Math.min(websites.length, 3));
                          return (
                            <div 
                              key={web.domain} 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setActiveCollection(col); 
                                setSelectedWebsiteFilter(web.domain); 
                                setActiveTab('details'); 
                              }} 
                              className={`${bentoClass} bg-black/40 border border-white/5 hover:border-[#96a68f]/40 hover:bg-black/60 rounded-lg p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer`}
                            >
                              <div className="flex items-center gap-1.5">
                                <img 
                                  src={`https://www.google.com/s2/favicons?domain=${web.domain}&sz=32`} 
                                  alt={web.name} 
                                  onError={(e) => { e.target.style.display = 'none'; }} 
                                  className="w-4 h-4 rounded-sm flex-shrink-0" 
                                />
                                <span className="text-xs font-semibold truncate text-[#f5f2eb]">{web.name}</span>
                              </div>
                              <span className="text-[10px] text-[#a39b90]">{web.count} files</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <Button 
                  className="w-full mt-4 bg-transparent border border-white/10 text-xs text-[#f5f2eb] hover:bg-[#96a68f] hover:text-[#181715] transition-colors py-1 h-8" 
                  onClick={() => { 
                    setActiveCollection(col); 
                    setSelectedWebsiteFilter(''); 
                    setActiveTab('details'); 
                  }}
                >
                  Open Folder
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FoldersGrid;
