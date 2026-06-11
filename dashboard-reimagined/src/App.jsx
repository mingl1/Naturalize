import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Leaf,
  Folder as FolderIcon,
  Search,
  Plus,
  RotateCw,
  ExternalLink,
  Settings,
  LogOut,
  Copy,
  Eye,
  EyeOff,
  ArrowLeft,
  X,
  Globe,
  Database,
  FolderPlus,
  Edit,
  Trash2,
  Palette
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

// Colors and styles matching the AI OS folder mockup
const FOLDER_THEMES = [
  { bg: 'bg-[#eae6df] text-[#181715]', badgeBg: 'bg-black/10 text-[#181715]', hex: '#eae6df', textHex: '#181715' },
  { bg: 'bg-[#d6b885] text-[#181715]', badgeBg: 'bg-black/10 text-[#181715]', hex: '#d6b885', textHex: '#181715' },
  { bg: 'bg-[#181715] text-[#eae6df] border-zinc-800', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#181715', textHex: '#eae6df' },
  { bg: 'bg-[#55614e] text-[#eae6df]', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#55614e', textHex: '#eae6df' },
  { bg: 'bg-[#ad765c] text-[#eae6df]', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#ad765c', textHex: '#eae6df' },
];

// Base Folder Component with customizable height and tabX offset
const Folder = ({ 
  height, 
  tabX, 
  backgroundColor, 
  textColor, 
  isActive, 
  index, 
  onClick, 
  label, 
  count, 
  isLight,
  bodyZ,
  tabZ,
  children 
}) => {

  return (
    <>
      {/* Folder Tab */}
      <div 
        onClick={onClick}
        className={`folder-tab-container ${isActive ? 'active' : ''} pointer-events-auto`}
        style={{
          left: tabX,
          bottom: height, // sits right on top of the card body
          zIndex: tabZ,
          position: 'absolute'
        }}
      >
        <div 
          className="folder-tab-trapezoid font-semibold"
          style={{
            backgroundColor,
            color: textColor
          }}
        >
          <div 
            className="folder-index-badge"
            style={{
              backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'
            }}
          >
            {index === 0 ? '00' : index.toString().padStart(2, '0')}
          </div>
          <span className="max-w-[120px] truncate">{label}</span>
          <span className="text-[10px] opacity-75 font-mono font-bold">({count})</span>
        </div>
      </div>

      {/* Folder Body Card */}
      <div 
        className={`folder-body-card flex flex-col transition-all duration-300 pointer-events-auto ${
          isActive ? 'opacity-100 visible shadow-2xl' : 'opacity-100 visible'
        } ${isLight ? 'text-zinc-900 border-zinc-900/10' : 'text-[#f5f2eb] border-white/5'}`}
        style={{
          height,
          backgroundColor,
          color: textColor,
          width: '100%',
          position: 'absolute',
          bottom: 0,
          left: 0,
          zIndex: bodyZ
        }}
      >
        {isActive ? children : null}
      </div>
    </>
  );
};

function App() {
  // Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ag_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoginView, setIsLoginView] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Data State
  const [collections, setCollections] = useState([]);
  const [folderStack, setFolderStack] = useState([]);
  const [activeCollection, setActiveCollection] = useState('');
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' or 'details'
  
  // All items inside each collection fetched on load
  const [collectionsItems, setCollectionsItems] = useState({});
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState('');

  // Custom collections CRUD states
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const [renameCollectionOpen, setRenameCollectionOpen] = useState(false);
  const [targetCollectionToRename, setTargetCollectionToRename] = useState('');
  const [renamedCollectionName, setRenamedCollectionName] = useState('');

  const [deleteCollectionOpen, setDeleteCollectionOpen] = useState(false);
  const [targetCollectionToDelete, setTargetCollectionToDelete] = useState('');

  const [collectionDetails, setCollectionDetails] = useState([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [targetCollectionForColor, setTargetCollectionForColor] = useState('');
  const [selectedColor, setSelectedColor] = useState('#eae6df');

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Scrape ID State
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeIdInput, setScrapeIdInput] = useState('');

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [generatorModel, setGeneratorModel] = useState('gemini-3.5-flash');
  const [validatorModel, setValidatorModel] = useState('gemini-3.5-flash');
  const [searchModel, setSearchModel] = useState('gemini-3.5-flash');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Toast Hook
  const { toast } = useToast();

  const triggerToast = (msg, title = "Notification") => {
    toast({
      title: title,
      description: msg,
    });
  };

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
        setCreateCollectionOpen(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to create collection', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  const handleRenameCollection = async (e) => {
    e.preventDefault();
    if (!renamedCollectionName.trim() || !targetCollectionToRename || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(targetCollectionToRename)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ new_name: renamedCollectionName.trim() })
      });
      if (res.ok) {
        triggerToast(`Collection renamed to "${renamedCollectionName.trim()}".`, "Folder Renamed");
        
        if (activeCollection === targetCollectionToRename) {
          setActiveCollection(renamedCollectionName.trim());
        }
        setFolderStack(prev => prev.map(c => c === targetCollectionToRename ? renamedCollectionName.trim() : c));
        
        setRenamedCollectionName('');
        setTargetCollectionToRename('');
        setRenameCollectionOpen(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to rename collection', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  const handleDeleteCollection = async () => {
    if (!targetCollectionToDelete || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(targetCollectionToDelete)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (res.ok) {
        triggerToast(`Collection "${targetCollectionToDelete}" deleted successfully.`, "Folder Deleted");
        
        if (activeCollection === targetCollectionToDelete) {
          setActiveCollection('');
          setActiveTab('grid');
        }
        setFolderStack(prev => prev.filter(c => c !== targetCollectionToDelete));
        
        setTargetCollectionToDelete('');
        setDeleteCollectionOpen(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to delete collection', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  const isColorLight = (hex) => {
    if (!hex) return true;
    const c = hex.substring(1);      // strip #
    const rgb = parseInt(c, 16);   // convert rrggbb to decimal
    if (isNaN(rgb)) return true;
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma > 128;
  };

  const handleSaveColor = async () => {
    if (!targetCollectionForColor || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(targetCollectionForColor)}/color`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ color: selectedColor })
      });
      if (res.ok) {
        triggerToast(`Color for folder "${targetCollectionForColor}" updated successfully.`, "Folder Color Updated");
        setColorPickerOpen(false);
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to update folder color', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  const handleMoveItem = async (itemId, targetCol) => {
    if (!itemId || !targetCol || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/items/${itemId}/collection`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ collection_name: targetCol })
      });
      if (res.ok) {
        triggerToast(`Item moved to folder "${targetCol}".`, "Item Reorganized");
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to move item', "Error");
      }
    } catch (err) {
      triggerToast('Could not connect to backend service.', "Error");
    }
  };

  // Extract clean domain from URL
  const getDomain = (url) => {
    if (!url) return 'Unknown Source';
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch (e) {
      return 'Unknown Source';
    }
  };

  const getCleanDomainName = (domain) => {
    if (domain === 'Unknown Source') return 'Unknown';
    const part = domain.split('.')[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
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

  const refreshActiveCollectionItems = async () => {
    if (!activeCollection || !user?.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${activeCollection}/items`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
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
        setCollectionsItems(prev => ({
          ...prev,
          [activeCollection]: { items, websites }
        }));
        triggerToast(`Refreshed ${items.length} items from ${websites.length} sources.`, "Success");
      }
    } catch (err) {
      console.error("Error refreshing active collection items", err);
    }
  };

  const fetchAvailableModels = async (token = user?.token) => {
    if (!token) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch(`${API_BASE}/api/models`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data.models || []);
      }
    } catch (err) {
      console.error("Failed to fetch models list", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleOpenSettings = () => {
    if (user) {
      setGeminiKeyInput(user.gemini_api_key || '');
      setGeneratorModel(user.generator_model || 'gemini-3.5-flash');
      setValidatorModel(user.validator_model || 'gemini-3.5-flash');
      setSearchModel(user.search_model || 'gemini-3.5-flash');
      fetchAvailableModels(user.token);
      setShowSettings(true);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCollections();
      setGeminiKeyInput(user.gemini_api_key || '');
      setGeneratorModel(user.generator_model || 'gemini-3.5-flash');
      setValidatorModel(user.validator_model || 'gemini-3.5-flash');
      setSearchModel(user.search_model || 'gemini-3.5-flash');
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Please fill in all fields.');
      return;
    }
    const endpoint = isLoginView ? 'login' : 'register';
    try {
      const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Authentication failed.');
        return;
      }
      const userSession = {
        user_id: data.user_id,
        username: data.username,
        token: data.token,
        gemini_api_key: data.gemini_api_key || '',
        generator_model: data.generator_model || 'gemini-3.5-flash',
        validator_model: data.validator_model || 'gemini-3.5-flash',
        search_model: data.search_model || 'gemini-3.5-flash'
      };
      localStorage.setItem('ag_user', JSON.stringify(userSession));
      setUser(userSession);
      setGeminiKeyInput(userSession.gemini_api_key);
      setGeneratorModel(userSession.generator_model);
      setValidatorModel(userSession.validator_model);
      setSearchModel(userSession.search_model);
      setUsernameInput('');
      setPasswordInput('');
      triggerToast(`Welcome back, ${userSession.username}!`, "Authentication");
    } catch (err) {
      setAuthError('Could not reach backend service.');
    }
  };

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

  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          gemini_api_key: geminiKeyInput,
          generator_model: generatorModel,
          validator_model: validatorModel,
          search_model: searchModel
        })
      });
      if (res.ok) {
        const updatedUser = {
          ...user,
          gemini_api_key: geminiKeyInput,
          generator_model: generatorModel,
          validator_model: validatorModel,
          search_model: searchModel
        };
        localStorage.setItem('ag_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setShowSettings(false);
        triggerToast('Settings saved successfully.', "Success");
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(data.detail || 'Failed to save settings', "Error");
      }
    } catch (err) {
      triggerToast('Could not save settings.', "Error");
    }
  };

  const handleCopyToken = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.token);
    triggerToast('Token copied to clipboard!', "Success");
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const getBentoLayoutClasses = (index, total) => {
    if (total === 1) return "col-span-3 row-span-2";
    if (total === 2) return index === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-2";
    if (total === 3) {
      if (index === 0) return "col-span-2 row-span-2";
      if (index === 1) return "col-span-1 row-span-1";
      return "col-span-1 row-span-1";
    }
    if (index === 0) return "col-span-2 row-span-2";
    if (index === 1) return "col-span-1 row-span-1";
    if (index === 2) return "col-span-1 row-span-1";
    return "col-span-3 row-span-1";
  };

  const activeItems = useMemo(() => {
    if (!activeCollection || !collectionsItems[activeCollection]) return [];
    const rawItems = collectionsItems[activeCollection].items || [];
    if (selectedWebsiteFilter && selectedWebsiteFilter !== 'none_filter_value') {
      return rawItems.filter(item => getDomain(item.source_url) === selectedWebsiteFilter);
    }
    return rawItems;
  }, [activeCollection, collectionsItems, selectedWebsiteFilter]);

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
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,#23221f_0%,#181715_70%)]">
          <div className="w-full max-w-[420px] bg-[#22201d] border border-white/5 rounded-2xl shadow-2xl p-8 transition-all duration-300 hover:border-[#8c9c86]/20">
            <div className="text-center pb-6">
              <div className="flex items-center justify-center gap-2 text-2xl font-title font-bold tracking-wider text-[#d4c2ab] mb-2">
                <Leaf className="w-8 h-8 text-[#96a68f] animate-pulse" />
                <span>NATURALIZE</span>
              </div>
              <p className="text-sm text-[#a39b90]">
                {isLoginView ? 'Login to your visual extraction dashboard' : 'Create an extraction account'}
              </p>
            </div>
            {authError && (
              <div className="bg-[#c99377]/10 border border-[#c99377]/20 text-[#c99377] rounded-md p-3 text-sm mb-5">
                {authError}
              </div>
            )}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Username</label>
                <Input type="text" placeholder="e.g. scraper_pro" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Password</label>
                <Input type="password" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20" />
              </div>
              <Button type="submit" className="w-full bg-[#96a68f] hover:bg-[#a9b9a2] text-[#181715] font-semibold py-2.5 mt-2 transition-all duration-200">
                {isLoginView ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>
            <div className="justify-center pt-4 border-t border-white/5 mt-6 flex text-sm text-[#a39b90]">
              {isLoginView ? (
                <>
                  Don't have an account?{' '}
                  <span onClick={() => { setIsLoginView(false); setAuthError(''); }} className="text-[#d4c2ab] hover:underline cursor-pointer font-medium ml-1">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span onClick={() => { setIsLoginView(true); setAuthError(''); }} className="text-[#d4c2ab] hover:underline cursor-pointer font-medium ml-1">Sign in</span>
                </>
              )}
            </div>
          </div>
        </div>
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
              <Button variant="outline" size="icon" className="w-10 h-10 rounded-full border-zinc-300 bg-[#181715] text-[#f5f2eb] hover:bg-[#292723]" onClick={handleOpenSettings} title="System Settings">
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
                      <div className="absolute inset-0 bg-[#181715] text-[#f5f2eb] p-8 overflow-y-auto z-30 fade-in">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-[#96a68f]" />
                            <h2 className="text-xl font-bold font-title">Semantic Search Matches</h2>
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-[#a39b90]">"{searchQuery}"</span>
                          </div>
                          <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-inherit">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {searchResults.length === 0 ? (
                          <div className="text-center py-20 text-[#a39b90]">
                            <p className="text-lg font-semibold mb-2">No matching items found</p>
                            <p className="text-sm">Try running queries like "price under 100" or typing alternative keywords.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map(item => (
                              <div key={item._id} className="bg-[#22201d] border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-[#8c9c86]/30 transition-all">
                                <div>
                                  <div className="flex justify-between items-start gap-4 mb-2">
                                    <h4 className="font-semibold text-sm line-clamp-2 text-[#f5f2eb]">{item.title}</h4>
                                    <span className="font-title text-base font-bold text-[#cca678]">${item.price?.toFixed(2)}</span>
                                  </div>
                                  <span className="text-[10px] bg-white/5 border border-white/10 text-[#a39b90] px-2 py-0.5 rounded-sm uppercase tracking-wider font-semibold">{getCleanDomainName(getDomain(item.source_url))}</span>
                                </div>
                                <div className="mt-4 pt-3 border-t border-dashed border-white/10 flex items-center justify-between text-xs">
                                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-[#96a68f] hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> View Source</a>
                                  <span className="text-[10px] text-[#a39b90]">Collection: {item.collection_name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {tab.isAll ? (
                      <div className="fade-in h-full overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h2 className="text-2xl font-bold font-title">Catalog Folders</h2>
                            <p className="text-xs text-[#a39b90]">Select a folder to browse captured listing data grids</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 text-xs gap-2 text-[#96a68f]" onClick={() => setCreateCollectionOpen(true)}><FolderPlus className="w-3.5 h-3.5" /> New Folder</Button>
                            <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 text-xs gap-2" onClick={() => fetchCollections()}><RotateCw className="w-3.5 h-3.5" /> Refresh</Button>
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
                                        <button className="text-zinc-500 hover:text-[#96a68f] transition-colors p-1 bg-transparent border-none cursor-pointer" onClick={(e) => { e.stopPropagation(); setTargetCollectionToRename(col); setRenamedCollectionName(col); setRenameCollectionOpen(true); }} title="Rename Folder"><Edit className="w-3.5 h-3.5" /></button>
                                        <button className="text-zinc-500 hover:text-[#96a68f] transition-colors p-1 bg-transparent border-none cursor-pointer" onClick={(e) => { e.stopPropagation(); setTargetCollectionForColor(col); const currentDetail = collectionDetails.find(d => d.name === col); setSelectedColor(currentDetail?.color || FOLDER_THEMES[idx % FOLDER_THEMES.length].hex); setColorPickerOpen(true); }} title="Folder Color"><Palette className="w-3.5 h-3.5" /></button>
                                        <button className="text-zinc-500 hover:text-red-400 transition-colors p-1 bg-transparent border-none cursor-pointer" onClick={(e) => { e.stopPropagation(); setTargetCollectionToDelete(col); setDeleteCollectionOpen(true); }} title="Delete Folder"><Trash2 className="w-3.5 h-3.5" /></button>
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
                                              <div key={web.domain} onClick={(e) => { e.stopPropagation(); setActiveCollection(col); setSelectedWebsiteFilter(web.domain); setActiveTab('details'); }} className={`${bentoClass} bg-black/40 border border-white/5 hover:border-[#96a68f]/40 hover:bg-black/60 rounded-lg p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer`}>
                                                <div className="flex items-center gap-1.5">
                                                  <img src={`https://www.google.com/s2/favicons?domain=${web.domain}&sz=32`} alt={web.name} onError={(e) => { e.target.style.display = 'none'; }} className="w-4 h-4 rounded-sm flex-shrink-0" />
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
                                  <Button className="w-full mt-4 bg-transparent border border-white/10 text-xs text-[#f5f2eb] hover:bg-[#96a68f] hover:text-[#181715] transition-colors py-1 h-8" onClick={() => { setActiveCollection(col); setSelectedWebsiteFilter(''); setActiveTab('details'); }}>Open Folder</Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="fade-in h-full flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-black/10 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <button onClick={() => { setActiveTab('grid'); setSelectedWebsiteFilter(''); }} className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors text-inherit border-none cursor-pointer" title="Back to Folders"><ArrowLeft className="w-4 h-4" /></button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <FolderIcon className="w-5 h-5 opacity-80" />
                                <h2 className="text-xl font-bold font-title truncate max-w-[200px]" title={activeCollection}>{activeCollection}</h2>
                              </div>
                              <p className="text-[10px] text-inherit/60 font-mono mt-0.5">INDEX: #{(collections.indexOf(activeCollection) + 1).toString().padStart(3, '0')} — {activeItems.length} ITEMS CAPTURED</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {collectionsItems[activeCollection]?.websites?.length > 0 && (
                              <Select value={selectedWebsiteFilter || 'none_filter_value'} onValueChange={setSelectedWebsiteFilter}>
                                <SelectTrigger className="w-[160px] h-8 text-xs bg-black/25 border-none text-inherit focus:ring-0 focus:ring-offset-0">
                                  <div className="flex items-center gap-1.5 truncate"><Globe className="w-3.5 h-3.5 opacity-75" /><SelectValue placeholder="All Domains" /></div>
                                </SelectTrigger>
                                <SelectContent className="bg-[#22201d] border-white/5 text-[#f5f2eb]">
                                  <SelectItem value="none_filter_value" className="text-xs">All Domains</SelectItem>
                                  {collectionsItems[activeCollection].websites.map(web => (
                                    <SelectItem key={web.domain} value={web.domain} className="text-xs">{web.name} ({web.count})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <button className="h-8 px-2.5 rounded bg-black/20 hover:bg-black/40 transition-colors flex items-center gap-1.5 text-xs text-inherit border-none cursor-pointer" onClick={() => { setTargetCollectionToRename(activeCollection); setRenamedCollectionName(activeCollection); setRenameCollectionOpen(true); }} title="Rename Folder"><Edit className="w-3.5 h-3.5" /> Rename</button>
                            <button className="h-8 px-2.5 rounded bg-black/20 hover:bg-black/40 transition-colors flex items-center gap-1.5 text-xs text-inherit border-none cursor-pointer" onClick={() => { setTargetCollectionForColor(activeCollection); const currentDetail = collectionDetails.find(d => d.name === activeCollection); const idx = collections.indexOf(activeCollection); setSelectedColor(currentDetail?.color || FOLDER_THEMES[idx % FOLDER_THEMES.length].hex); setColorPickerOpen(true); }} title="Folder Color"><Palette className="w-3.5 h-3.5" /> Color</button>
                            <button className="h-8 px-2.5 rounded bg-[#c99377]/10 hover:bg-[#c99377]/25 text-[#c99377] transition-colors flex items-center gap-1.5 text-xs border-none cursor-pointer" onClick={() => { setTargetCollectionToDelete(activeCollection); setDeleteCollectionOpen(true); }} title="Delete Folder"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                          </div>
                        </div>
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
                                      <h4 className="font-semibold text-sm leading-snug line-clamp-2 text-inherit" title={item.title}>{item.title}</h4>
                                      <span className="text-[10px] bg-black/10 border border-black/10 px-2 py-0.5 rounded-sm uppercase tracking-wider font-semibold font-mono inline-block mt-2">{getCleanDomainName(getDomain(item.source_url))}</span>
                                    </div>
                                    <span className="font-mono text-base font-bold text-inherit whitespace-nowrap">${item.price?.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-black/15 text-xs">
                                    <a href={item.source_url || '#'} target="_blank" rel="noopener noreferrer" className="font-semibold flex items-center gap-1 hover:underline text-inherit opacity-90 hover:opacity-100"><ExternalLink className="w-3.5 h-3.5" /> View Source</a>
                                    <span className="text-[10px] opacity-75">{formatDate(item.updated_at || item.created_at)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
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

            {/* Search Floating Panel */}
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

            {/* Plus Button */}
            <div 
              onClick={() => { setScrapeOpen(!scrapeOpen); setSearchOpen(false); }}
              className={`floating-action-btn ${scrapeOpen ? 'active' : ''}`}
              title="Add Scrape Task"
            >
              <Plus className="w-6 h-6" />
            </div>

            {/* Search Button */}
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
      <Dialog
        open={showSettings}
        onOpenChange={(open) => {
          if (!open) {
            setShowSettings(false);
            setGeminiKeyInput(user?.gemini_api_key || '');
            setGeneratorModel(user?.generator_model || 'gemini-3.5-flash');
            setValidatorModel(user?.validator_model || 'gemini-3.5-flash');
            setSearchModel(user?.search_model || 'gemini-3.5-flash');
          }
        }}
      >
        <DialogContent className="max-w-[500px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Settings className="w-5 h-5 text-[#96a68f]" /> Extension Settings
            </DialogTitle>
            <DialogDescription className="text-[#a39b90] text-xs mt-1">
              Configure your browser extension API key, models, and session tokens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Extension Access Token</label>
                <span className="text-[10px] text-[#a39b90] lowercase">Use in Chrome Extension</span>
              </div>
              <div className="bg-[#12110f] border border-white/5 rounded-md p-3 flex items-center justify-between gap-3">
                <span className="font-mono text-xs truncate text-[#d4c2ab] select-all">
                  {showToken ? user?.token : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-[#a39b90] hover:text-[#f5f2eb]"
                    onClick={() => setShowToken(!showToken)}
                    title={showToken ? "Hide Token" : "Show Token"}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-[#a39b90] hover:text-[#f5f2eb]"
                    onClick={handleCopyToken}
                    title="Copy Token"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Gemini API Key</label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Code Generator Model</label>
              <Select
                value={generatorModel}
                onValueChange={setGeneratorModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full bg-[#12110f] border-white/5 text-[#f5f2eb]">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
                  {availableModels.length === 0 ? (
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash</SelectItem>
                  ) : (
                    availableModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Validator / LLM Judge Model</label>
              <Select
                value={validatorModel}
                onValueChange={setValidatorModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full bg-[#12110f] border-white/5 text-[#f5f2eb]">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
                  {availableModels.length === 0 ? (
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash</SelectItem>
                  ) : (
                    availableModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Semantic Search Model</label>
              <Select
                value={searchModel}
                onValueChange={setSearchModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full bg-[#12110f] border-white/5 text-[#f5f2eb]">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
                  {availableModels.length === 0 ? (
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash</SelectItem>
                  ) : (
                    availableModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t border-white/5">
            <Button
              variant="outline"
              onClick={() => {
                setShowSettings(false);
                setGeminiKeyInput(user?.gemini_api_key || '');
                setGeneratorModel(user?.generator_model || 'gemini-3.5-flash');
                setValidatorModel(user?.validator_model || 'gemini-3.5-flash');
                setSearchModel(user?.search_model || 'gemini-3.5-flash');
              }}
              className="flex-1 border-white/10 text-[#f5f2eb] hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#96a68f] text-[#181715] font-semibold hover:bg-[#a9b9a2]"
              onClick={handleSaveSettings}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Collection Dialog */}
      <Dialog open={createCollectionOpen} onOpenChange={setCreateCollectionOpen}>
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
                  setCreateCollectionOpen(false);
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

      {/* Rename Collection Dialog */}
      <Dialog open={renameCollectionOpen} onOpenChange={setRenameCollectionOpen}>
        <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Edit className="w-5 h-5 text-[#96a68f]" /> Rename Folder
            </DialogTitle>
            <DialogDescription className="text-[#a39b90] text-xs mt-1">
              Rename folder "{targetCollectionToRename}" to a new name.
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
                  setRenameCollectionOpen(false);
                  setRenamedCollectionName('');
                  setTargetCollectionToRename('');
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

      {/* Customize Folder Color Dialog */}
      <Dialog open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
        <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Palette className="w-5 h-5 text-[#96a68f]" /> Folder Style
            </DialogTitle>
            <DialogDescription className="text-[#a39b90] text-xs mt-1">
              Customize style and color for folder "{targetCollectionForColor}"
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
                <span className="max-w-[120px] truncate">{targetCollectionForColor}</span>
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
              onClick={() => setColorPickerOpen(false)} 
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

      {/* Delete Collection Confirmation Dialog */}
      <Dialog open={deleteCollectionOpen} onOpenChange={setDeleteCollectionOpen}>
        <DialogContent className="max-w-[400px] bg-[#22201d] border-zinc-800 text-[#f5f2eb]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-red-400">
              <Trash2 className="w-5 h-5" /> Delete Folder
            </DialogTitle>
            <DialogDescription className="text-[#a39b90] text-xs mt-1">
              Are you sure you want to delete folder "{targetCollectionToDelete}"?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-sm text-[#f5f2eb]">
            This action <strong className="text-red-400">cannot be undone</strong>. All scraped catalog items inside this folder will be permanently deleted.
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteCollectionOpen(false);
                setTargetCollectionToDelete('');
              }}
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
    </div>
  );
}

export default App;
