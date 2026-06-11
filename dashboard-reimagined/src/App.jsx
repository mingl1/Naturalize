import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import {
  Leaf,
  Settings,
  LogOut,
  Search,
  Plus,
  RotateCw,
  Database
} from 'lucide-react';

import Folder from './components/Folder';
import AuthView from './components/AuthView';
import FoldersGrid from './components/FoldersGrid';
import FolderDetails from './components/FolderDetails';
import SearchOverlay from './components/SearchOverlay';

import SettingsDialog from './components/dialogs/SettingsDialog';
import CreateFolderDialog from './components/dialogs/CreateFolderDialog';
import RenameFolderDialog from './components/dialogs/RenameFolderDialog';
import FolderStyleDialog from './components/dialogs/FolderStyleDialog';
import DeleteFolderDialog from './components/dialogs/DeleteFolderDialog';

import { isColorLight, FOLDER_THEMES, getDomain, getCleanDomainName } from './lib/helpers';

const API_BASE = "http://127.0.0.1:8000";

function App() {
  // Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ag_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Dashboard Data State
  const [collections, setCollections] = useState([]);
  const [folderStack, setFolderStack] = useState([]);
  const [activeCollection, setActiveCollection] = useState('');
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' or 'details'
  
  // All items inside each collection fetched on load
  const [collectionsItems, setCollectionsItems] = useState({});
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState('');

  // Dialog triggers
  const [showSettings, setShowSettings] = useState(false);
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  
  const [renameCollectionOpen, setRenameCollectionOpen] = useState(false);
  const [targetCollectionToRename, setTargetCollectionToRename] = useState('');

  const [deleteCollectionOpen, setDeleteCollectionOpen] = useState(false);
  const [targetCollectionToDelete, setTargetCollectionToDelete] = useState('');

  const [collectionDetails, setCollectionDetails] = useState([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [targetCollectionForColor, setTargetCollectionForColor] = useState('');

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Scrape ID State
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeIdInput, setScrapeIdInput] = useState('');

  // Toast Hook
  const { toast } = useToast();

  const triggerToast = (msg, title = "Notification") => {
    toast({
      title: title,
      description: msg,
    });
  };

  const fetchCollections = async (token = user?.token) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.collections || [];
        setCollections(list);
        setCollectionDetails(data.details || []);
        fetchAllCollectionsItems(list, token);
      }
    } catch (err) {
      console.error("Failed to fetch collections", err);
    }
  };

  const fetchAllCollectionsItems = async (collectionsList, token = user?.token) => {
    if (!token || collectionsList.length === 0) return;
    setIsLoadingItems(true);
    const dataMap = {};
    try {
      await Promise.all(collectionsList.map(async (col) => {
        const res = await fetch(`${API_BASE}/api/collections/${col}/items`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const resData = await res.json();
          const items = resData.items || [];
          const websitesMap = {};
          items.forEach(item => {
            const domain = getDomain(item.source_url);
            if (!websitesMap[domain]) {
              websitesMap[domain] = { domain, name: getCleanDomainName(domain), count: 0 };
            }
            websitesMap[domain].count += 1;
          });
          const websites = Object.values(websitesMap).sort((a, b) => b.count - a.count);
          dataMap[col] = { items, websites };
        }
      }));
      setCollectionsItems(dataMap);
    } catch (err) {
      console.error("Error fetching items for collections", err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCollections();
    }
  }, [user]);

  useEffect(() => {
    setFolderStack(prev => {
      const filtered = prev.filter(c => collections.includes(c));
      const added = collections.filter(c => !filtered.includes(c));
      return [...filtered, ...added];
    });
  }, [collections]);

  useEffect(() => {
    if (activeTab === 'details' && activeCollection) {
      setFolderStack(prev => {
        const filtered = prev.filter(c => c !== activeCollection);
        return [activeCollection, ...filtered];
      });
    }
  }, [activeCollection, activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('ag_user');
    setUser(null);
    setCollections([]);
    setActiveCollection('');
    setActiveTab('grid');
    setCollectionsItems({});
    setSearchResults(null);
    setSearchQuery('');
    setSearchOpen(false);
    setScrapeOpen(false);
    setShowSettings(false);
    triggerToast('Logged out successfully.', "Authentication");
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !user) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`${API_BASE}/api/collections/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          q: searchQuery,
          collection_name: activeTab === 'details' ? activeCollection : undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items || []);
        triggerToast(`Found ${data.items?.length || 0} items.`, "Search Results");
      } else {
        triggerToast("Failed to perform search query.", "Error");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to connect to search service.", "Error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleScrapeSubmit = (e) => {
    e.preventDefault();
    if (!scrapeIdInput.trim()) return;
    const targetId = scrapeIdInput.trim();
    setScrapeIdInput('');
    setScrapeOpen(false);
    triggerToast(`Connecting to scrape node [${targetId}]...`, "Scraper Hub");
    setTimeout(() => {
      triggerToast(`Extracting grid selectors from target engine...`, "Scraper Hub");
      setTimeout(() => {
        triggerToast(`Successfully ingested and compiled new catalog items into database!`, "Scraper Hub");
        fetchCollections();
      }, 2000);
    }, 1500);
  };

  const totalFileCount = useMemo(() => {
    let sum = 0;
    Object.values(collectionsItems).forEach(col => {
      sum += col.items?.length || 0;
    });
    return sum;
  }, [collectionsItems]);

  const chunkedTabs = useMemo(() => {
    const allTabs = [
      { id: 'all', name: 'All Folders', count: totalFileCount, isAll: true, theme: { bg: 'bg-[#eae6df] text-[#181715]', hex: '#eae6df', textHex: '#181715' } }
    ];
    collections.forEach((col, idx) => {
      const colData = collectionsItems[col];
      const count = colData ? colData.items?.length : 0;
      
      const detail = collectionDetails.find(d => d.name === col);
      let hex = detail?.color;
      let theme;
      if (hex) {
        const isLight = isColorLight(hex);
        theme = {
          bg: isLight ? `bg-[${hex}] text-[#181715]` : `bg-[${hex}] text-[#eae6df]`,
          hex,
          textHex: isLight ? '#181715' : '#eae6df'
        };
      } else {
        theme = FOLDER_THEMES[idx % FOLDER_THEMES.length];
      }
      
      allTabs.push({ id: col, name: col, count, isAll: false, theme });
    });
    return allTabs;
  }, [collections, collectionsItems, totalFileCount, collectionDetails]);

  return (
    <div className="min-h-screen flex flex-col bg-[#181715] text-[#f5f2eb] font-body selection:bg-primary/30">
      <Toaster />

      {!user ? (
        <AuthView
          onSubmitSuccess={(userSession) => setUser(userSession)}
          API_BASE={API_BASE}
          triggerToast={triggerToast}
        />
      ) : (
        <div className="flex-1 flex flex-col grid-paper min-h-screen relative overflow-x-hidden p-6 md:p-10 select-none">
          <header className="w-full max-w-[1000px] mx-auto mb-8 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#181715] border border-white/10 flex items-center justify-center text-[#d4c2ab]">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight font-title text-[#181715]">NATURALIZE OS</h1>
                <p className="text-[10px] text-zinc-800 uppercase tracking-widest font-semibold">Visual Data Folders</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block mr-2">
                <p className="text-xs font-semibold text-zinc-900">{user.username}</p>
                <p className="text-[10px] text-zinc-700">Workspace Active</p>
              </div>
              <Button variant="outline" size="icon" className="w-10 h-10 rounded-full border-zinc-300 bg-[#181715] text-[#f5f2eb] hover:bg-[#292723]" onClick={() => setShowSettings(true)} title="System Settings">
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="w-10 h-10 rounded-full border-zinc-300 bg-[#181715] text-[#c99377] hover:bg-[#292723]" onClick={handleLogout} title="Log Out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          <div className="absolute top-72 left-24 font-title text-5xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">8</div>
          <div className="absolute top-96 left-80 font-title text-4xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">7</div>
          <div className="absolute top-64 right-96 font-title text-3xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">3</div>
          <div className="absolute top-96 right-40 font-title text-5xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">6</div>

          <div className="flex-1 flex flex-col items-center py-4 z-10 w-full">
            <div className="folders-cabinet relative w-full max-w-[1000px] flex-1 mx-auto">
              {chunkedTabs.map((tab, idx) => {
                const isActive = tab.isAll ? activeTab === 'grid' : (activeTab === 'details' && activeCollection === tab.id);
                const isLight = tab.theme.textHex === '#181715';
                
                // Calculate folder heights and stack z-indexes using folderStack sequence
                let folderHeightVal;
                let bodyZ;
                let tabZ;
                
                if (activeTab === 'grid') {
                  folderHeightVal = Math.max(70, 100 - idx * 4);
                  bodyZ = isActive ? 100 : 10 + idx;
                  tabZ = isActive ? 120 : 30 + idx;
                } else {
                  let slotIdx;
                  if (tab.isAll) {
                    slotIdx = collections.length;
                  } else {
                    slotIdx = folderStack.indexOf(tab.id);
                    if (slotIdx === -1) {
                      slotIdx = collections.indexOf(tab.id);
                    }
                    if (slotIdx === -1) {
                      slotIdx = idx;
                    }
                  }
                  
                  // Active is slot 0 (75% height), and other folders stack taller behind it (up to 100%)
                  folderHeightVal = Math.min(100, 75 + slotIdx * 4);
                  
                  // Stacking z-indexes decrease sequentially as we move back in the stack
                  bodyZ = 100 - slotIdx * 5;
                  tabZ = 120 - slotIdx * 5;
                }
                
                const folderHeight = `${folderHeightVal}%`;
                const tabX = `${10 + (idx * 16) % 75}%`;
                return (
                  <Folder
                    key={tab.id}
                    height={folderHeight}
                    tabX={tabX}
                    backgroundColor={tab.theme.hex}
                    textColor={tab.theme.textHex}
                    isActive={isActive}
                    index={idx}
                    bodyZ={bodyZ}
                    tabZ={tabZ}
                    onClick={() => {
                      if (tab.isAll) {
                        setActiveTab('grid');
                        setSelectedWebsiteFilter('');
                      } else {
                        setActiveCollection(tab.id);
                        setSelectedWebsiteFilter('');
                        setActiveTab('details');
                      }
                    }}
                    label={tab.name}
                    count={tab.count}
                    isLight={isLight}
                  >
                    {searchResults !== null && (
                      <SearchOverlay
                        searchQuery={searchQuery}
                        searchResults={searchResults}
                        onClose={() => {
                          setSearchResults(null);
                          setSearchQuery('');
                        }}
                      />
                    )}

                    {tab.isAll ? (
                      <FoldersGrid
                        isLoadingItems={isLoadingItems}
                        collections={collections}
                        collectionsItems={collectionsItems}
                        collectionDetails={collectionDetails}
                        fetchCollections={fetchCollections}
                        setActiveCollection={setActiveCollection}
                        setSelectedWebsiteFilter={setSelectedWebsiteFilter}
                        setActiveTab={setActiveTab}
                        onNewFolderClick={() => setCreateCollectionOpen(true)}
                        onRenameFolderClick={(col) => {
                          setTargetCollectionToRename(col);
                          setRenameCollectionOpen(true);
                        }}
                        onColorFolderClick={(col, color) => {
                          setTargetCollectionForColor(col);
                          setColorPickerOpen(true);
                        }}
                        onDeleteFolderClick={(col) => {
                          setTargetCollectionToDelete(col);
                          setDeleteCollectionOpen(true);
                        }}
                      />
                    ) : (
                      <FolderDetails
                        activeCollection={activeCollection}
                        collections={collections}
                        collectionsItems={collectionsItems}
                        collectionDetails={collectionDetails}
                        selectedWebsiteFilter={selectedWebsiteFilter}
                        setSelectedWebsiteFilter={setSelectedWebsiteFilter}
                        setActiveTab={setActiveTab}
                        onRenameClick={(col) => {
                          setTargetCollectionToRename(col);
                          setRenameCollectionOpen(true);
                        }}
                        onColorClick={(col, color) => {
                          setTargetCollectionForColor(col);
                          setColorPickerOpen(true);
                        }}
                        onDeleteClick={(col) => {
                          setTargetCollectionToDelete(col);
                          setDeleteCollectionOpen(true);
                        }}
                      />
                    )}
                  </Folder>
                );
              })}
            </div>

            <div className="w-full max-w-[1000px] mt-4 flex flex-wrap justify-between items-center px-4 text-xs font-mono text-zinc-800 z-10 font-bold uppercase tracking-wider gap-2 mx-auto">
              <span>{totalFileCount} Files Generated</span>
              <span>24 JAN — 30 DES 1971</span>
              <span>OS SYSTEM v0.1.0</span>
            </div>
          </div>

          <div className="action-controls-container">
            <div className={`expand-left-bar ${scrapeOpen ? 'expanded' : ''}`}>
              <form onSubmit={handleScrapeSubmit} className="flex items-center w-full">
                <Database className="w-4 h-4 text-[#a39b90] mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Paste in or type scrape ID..."
                  value={scrapeIdInput}
                  onChange={(e) => setScrapeIdInput(e.target.value)}
                  disabled={!scrapeOpen}
                />
                <button type="submit" className="hidden" />
                {scrapeIdInput && (
                  <span className="cursor-pointer text-[10px] hover:text-[#f5f2eb]" onClick={() => setScrapeIdInput('')}>✕</span>
                )}
              </form>
            </div>

            <div className={`expand-left-bar ${searchOpen ? 'expanded' : ''}`}>
              <form onSubmit={handleSearchSubmit} className="flex items-center w-full">
                <Search className="w-4 h-4 text-[#a39b90] mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Type search & press Enter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!searchOpen}
                />
                <button type="submit" className="hidden" />
                {searchQuery && (
                  <span className="cursor-pointer text-[10px] hover:text-[#f5f2eb]" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>✕</span>
                )}
              </form>
            </div>

            <div 
              onClick={() => { setScrapeOpen(!scrapeOpen); setSearchOpen(false); }}
              className={`floating-action-btn ${scrapeOpen ? 'active' : ''}`}
              title="Add Scrape Task"
            >
              <Plus className="w-6 h-6" />
            </div>

            <div 
              onClick={() => { setSearchOpen(!searchOpen); setScrapeOpen(false); }}
              className={`floating-action-btn ${searchOpen ? 'active' : ''}`}
              title="Search Catalog Items"
            >
              <Search className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        user={user}
        setUser={setUser}
        API_BASE={API_BASE}
        triggerToast={triggerToast}
      />

      {/* Create Collection Dialog */}
      <CreateFolderDialog
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        user={user}
        API_BASE={API_BASE}
        fetchCollections={fetchCollections}
        triggerToast={triggerToast}
      />

      {/* Rename Collection Dialog */}
      <RenameFolderDialog
        open={renameCollectionOpen}
        onOpenChange={setRenameCollectionOpen}
        targetCollection={targetCollectionToRename}
        activeCollection={activeCollection}
        setActiveCollection={setActiveCollection}
        setFolderStack={setFolderStack}
        user={user}
        API_BASE={API_BASE}
        fetchCollections={fetchCollections}
        triggerToast={triggerToast}
      />

      {/* Customize Folder Color Dialog */}
      <FolderStyleDialog
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        targetCollection={targetCollectionForColor}
        collectionDetails={collectionDetails}
        user={user}
        API_BASE={API_BASE}
        fetchCollections={fetchCollections}
        triggerToast={triggerToast}
      />

      {/* Delete Collection Confirmation Dialog */}
      <DeleteFolderDialog
        open={deleteCollectionOpen}
        onOpenChange={setDeleteCollectionOpen}
        targetCollection={targetCollectionToDelete}
        activeCollection={activeCollection}
        setActiveCollection={setActiveCollection}
        setFolderStack={setFolderStack}
        user={user}
        API_BASE={API_BASE}
        fetchCollections={fetchCollections}
        triggerToast={triggerToast}
      />
    </div>
  );
}

export default App;
