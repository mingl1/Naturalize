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
  Folder,
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
  SlidersHorizontal
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

// Colors and styles matching the AI OS folder mockup
const FOLDER_THEMES = [
  { bg: 'bg-[#eae6df] text-[#181715]', badgeBg: 'bg-black/10 text-[#181715]', hex: '#eae6df' },
  { bg: 'bg-[#d6b885] text-[#181715]', badgeBg: 'bg-black/10 text-[#181715]', hex: '#d6b885' },
  { bg: 'bg-[#181715] text-[#eae6df] border-zinc-800', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#181715' },
  { bg: 'bg-[#55614e] text-[#eae6df]', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#55614e' },
  { bg: 'bg-[#ad765c] text-[#eae6df]', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#ad765c' },
];

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
  const [activeCollection, setActiveCollection] = useState('');
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' or 'details'
  
  // All items inside each collection fetched on load
  const [collectionsItems, setCollectionsItems] = useState({});
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState('');

  // Dynamic schema filtering states (List of rule-based filter objects)
  const [activeFilters, setActiveFilters] = useState([]);
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterOperator, setNewFilterOperator] = useState('=');
  const [newFilterValue, setNewFilterValue] = useState('');

  const resetFilters = () => {
    setActiveFilters([]);
    setNewFilterField('');
    setNewFilterValue('');
  };

  const handleAddFilter = () => {
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

    setActiveFilters(prev => {
      const filtered = prev.filter(f => !(f.field === newFilterField && f.operator === newFilterOperator));
      return [...filtered, newRule];
    });
    setNewFilterValue('');
  };

  const handleRemoveFilter = (id) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
  };

  // Custom collections CRUD states
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const [renameCollectionOpen, setRenameCollectionOpen] = useState(false);
  const [targetCollectionToRename, setTargetCollectionToRename] = useState('');
  const [renamedCollectionName, setRenamedCollectionName] = useState('');

  const [deleteCollectionOpen, setDeleteCollectionOpen] = useState(false);
  const [targetCollectionToDelete, setTargetCollectionToDelete] = useState('');

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

  // Capitalize name
  const getCleanDomainName = (domain) => {
    if (domain === 'Unknown Source') return 'Unknown';
    const part = domain.split('.')[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  };

  // Fetch collections when user is authenticated
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
        
        // Fetch items for all collections to construct Bento box sizes
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
          
          // Group by website/domain
          const websitesMap = {};
          items.forEach(item => {
            const domain = getDomain(item.source_url);
            if (!websitesMap[domain]) {
              websitesMap[domain] = { domain, name: getCleanDomainName(domain), count: 0 };
            }
            websitesMap[domain].count += 1;
          });

          // Convert to sorted array
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

  // Refetches items for active collection specifically
  const refreshActiveCollectionItems = async () => {
    if (!activeCollection || !user?.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections/${activeCollection}/items`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        const resData = await res.json();
        const items = resData.items || [];
        
        // Group by website/domain
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

  // Fetch available models list from backend
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

  // Initialize data on mount
  useEffect(() => {
    if (user) {
      fetchCollections();
      setGeminiKeyInput(user.gemini_api_key || '');
      setGeneratorModel(user.generator_model || 'gemini-3.5-flash');
      setValidatorModel(user.validator_model || 'gemini-3.5-flash');
      setSearchModel(user.search_model || 'gemini-3.5-flash');
    }
  }, [user]);

  // Reset filters when changing collections, tabs, or when search results are cleared
  useEffect(() => {
    resetFilters();
  }, [activeCollection, activeTab, searchResults === null]);

  // Handlers for Authentication
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

  // Handlers for Settings
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

  // Semantic/Keyword Search Handler
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

  // Mock Scrape ID trigger
  const handleScrapeSubmit = (e) => {
    e.preventDefault();
    if (!scrapeIdInput.trim()) return;
    
    const targetId = scrapeIdInput.trim();
    setScrapeIdInput('');
    setScrapeOpen(false);
    
    triggerToast(`Connecting to scrape node [${targetId}]...`, "Scraper Hub");
    
    // Trigger a mock scrape progress and notify
    setTimeout(() => {
      triggerToast(`Extracting grid selectors from target engine...`, "Scraper Hub");
      setTimeout(() => {
        triggerToast(`Successfully ingested and compiled new catalog items into database!`, "Scraper Hub");
        fetchCollections(); // Refresh
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

  // Dynamic Bento sizes based on website density/count
  const getBentoLayoutClasses = (index, total) => {
    if (total === 1) {
      return "col-span-3 row-span-2";
    } else if (total === 2) {
      return index === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-2";
    } else if (total === 3) {
      if (index === 0) return "col-span-2 row-span-2";
      if (index === 1) return "col-span-1 row-span-1";
      return "col-span-1 row-span-1";
    } else {
      // 4 or more
      if (index === 0) return "col-span-2 row-span-2";
      if (index === 1) return "col-span-1 row-span-1";
      if (index === 2) return "col-span-1 row-span-1";
      return "col-span-3 row-span-1";
    }
  };

  // Gauge schema dynamically from current items list (collection items or search results)
  // Maps fieldPath (e.g. 'price' or 'metadata.brand') -> fieldType ('numeric', 'boolean', 'string')
  const currentSchema = useMemo(() => {
    let sourceItems = [];
    if (activeTab === 'details' && activeCollection && collectionsItems[activeCollection]) {
      sourceItems = collectionsItems[activeCollection].items || [];
    } else if (searchResults !== null) {
      sourceItems = searchResults;
    } else {
      return null;
    }

    let fields = {
      "price": "numeric"
    };

    sourceItems.forEach(item => {
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
  }, [activeTab, activeCollection, collectionsItems, searchResults]);

  const isFilterActive = useMemo(() => {
    return activeFilters.length > 0;
  }, [activeFilters]);

  // Filter logic helper applied to any item list
  const applyHardFilters = (itemsList) => {
    let items = [...itemsList];

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
  };

  // Active collection detail item list
  const activeItems = useMemo(() => {
    if (!activeCollection || !collectionsItems[activeCollection]) return [];
    let rawItems = collectionsItems[activeCollection].items || [];
    
    if (selectedWebsiteFilter) {
      rawItems = rawItems.filter(item => getDomain(item.source_url) === selectedWebsiteFilter);
    }
    return applyHardFilters(rawItems);
  }, [activeCollection, collectionsItems, selectedWebsiteFilter, activeFilters, currentSchema]);

  // Filtered Search Results
  const filteredSearchResults = useMemo(() => {
    if (searchResults === null) return null;
    return applyHardFilters(searchResults);
  }, [searchResults, activeFilters, currentSchema]);

  // Compute total file count across all folders
  const totalFileCount = useMemo(() => {
    let sum = 0;
    Object.values(collectionsItems).forEach(col => {
      sum += col.items?.length || 0;
    });
    return sum;
  }, [collectionsItems]);

  return (
    <div className="min-h-screen flex flex-col bg-[#181715] text-[#f5f2eb] font-body selection:bg-primary/30">
      <Toaster />

      {/* Auth Wrapper */}
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
                <Input
                  type="text"
                  placeholder="e.g. scraper_pro"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a39b90]">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="bg-[#12110f] border-white/5 focus:border-[#8c9c86] focus:ring-[#8c9c86]/20"
                />
              </div>

              <Button type="submit" className="w-full bg-[#96a68f] hover:bg-[#a9b9a2] text-[#181715] font-semibold py-2.5 mt-2 transition-all duration-200">
                {isLoginView ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>

            <div className="justify-center pt-4 border-t border-white/5 mt-6 flex text-sm text-[#a39b90]">
              {isLoginView ? (
                <>
                  Don't have an account?{' '}
                  <span
                    onClick={() => { setIsLoginView(false); setAuthError(''); }}
                    className="text-[#d4c2ab] hover:underline cursor-pointer font-medium ml-1"
                  >
                    Sign up
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span
                    onClick={() => { setIsLoginView(true); setAuthError(''); }}
                    className="text-[#d4c2ab] hover:underline cursor-pointer font-medium ml-1"
                  >
                    Sign in
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Reimagined Folders Dashboard Workspace */
        <div className="flex-1 flex flex-col grid-paper min-h-screen relative overflow-x-hidden p-6 md:p-10 select-none">
          
          {/* Header Area */}
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
              <Button
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-zinc-300 bg-[#181715] text-[#f5f2eb] hover:bg-[#292723]"
                onClick={handleOpenSettings}
                title="System Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-zinc-300 bg-[#181715] text-[#c99377] hover:bg-[#292723]"
                onClick={handleLogout}
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* BACKGROUND DECORATIONS (mocking the image design elements) */}
          <div className="absolute top-28 left-6 md:left-20 pointer-events-none hidden xl:block opacity-75">
            <div className="retro-dial"></div>
            <p className="text-[10px] font-mono text-zinc-800 mt-2 text-center">UI DESIGN PLACE</p>
          </div>
          <div className="absolute top-28 right-6 md:right-20 pointer-events-none hidden xl:block opacity-75">
            <div className="retro-dial"></div>
            <p className="text-[10px] font-mono text-zinc-800 mt-2 text-center">FOLDERS CONTROLS</p>
          </div>
          
          {/* Scattered numbers on gridpaper matching mockup style */}
          <div className="absolute top-72 left-24 font-title text-5xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">8</div>
          <div className="absolute top-96 left-80 font-title text-4xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">7</div>
          <div className="absolute top-64 right-96 font-title text-3xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">3</div>
          <div className="absolute top-96 right-40 font-title text-5xl font-extrabold text-zinc-800/15 pointer-events-none hidden lg:block">6</div>

          {/* MAIN FOLDER CARD COMPONENT */}
          <div className="flex-1 flex items-center justify-center py-4 z-10">
            <div className="folder-wrapper">
              
              {/* Overlapping index card tabs */}
              <div className="folder-tabs-row">
                <div 
                  onClick={() => { setActiveTab('grid'); setSelectedWebsiteFilter(''); }}
                  className={`folder-tab tab-white ${activeTab === 'grid' ? 'active' : ''}`}
                >
                  <div className="folder-index-badge">00</div>
                  <span>All Folders</span>
                </div>

                {collections.map((col, idx) => {
                  const theme = FOLDER_THEMES[idx % FOLDER_THEMES.length];
                  const colData = collectionsItems[col];
                  const count = colData ? colData.items?.length : '..';
                  
                  return (
                    <div
                      key={col}
                      onClick={() => {
                        setActiveCollection(col);
                        setSelectedWebsiteFilter('');
                        setActiveTab('details');
                      }}
                      className={`folder-tab ${theme.bg} ${activeTab === 'details' && activeCollection === col ? 'active' : ''}`}
                    >
                      <div className="folder-index-badge">{(idx + 1).toString().padStart(2, '0')}</div>
                      <span className="max-w-[120px] truncate">{col}</span>
                      <span className="text-[10px] opacity-70">({count})</span>
                    </div>
                  );
                })}
              </div>

              {/* Folder container body card */}
              <div className={`folder-body-card ${activeTab === 'details' ? FOLDER_THEMES[collections.indexOf(activeCollection) % FOLDER_THEMES.length].bg : 'bg-[#181715] text-[#f5f2eb] border-white/5'}`}>
                
                {/* Search Results Display Overlay */}
                {searchResults !== null && (
                  <div className="absolute inset-0 bg-[#181715] text-[#f5f2eb] p-8 overflow-y-auto z-30 fade-in">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-[#96a68f]" />
                        <h2 className="text-xl font-bold font-title">Semantic Search Matches</h2>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-[#a39b90]">
                          "{searchQuery}"
                        </span>
                      </div>
                      <button 
                        onClick={() => { setSearchResults(null); setSearchQuery(''); }}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dynamic Schema Filters inside Search Overlay */}
                    {searchResults.length > 0 && currentSchema && (
                      <div className="mb-6 bg-[#22201d]/60 p-5 rounded-xl border border-white/5 shadow-inner">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-[#96a68f]" />
                            <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 font-title">Refine Search Results</h3>
                          </div>
                          {isFilterActive && (
                            <button
                              onClick={resetFilters}
                              className="text-[10px] uppercase font-bold text-[#cca678] hover:text-[#d4c2ab] transition-all hover:underline"
                            >
                              Clear Active Filters
                            </button>
                          )}
                        </div>

                        {/* Active Rule Tags */}
                        {activeFilters.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {activeFilters.map(f => (
                              <div key={f.id} className="flex items-center gap-1.5 bg-[#8c9c86]/20 border border-[#8c9c86]/40 text-[#f5f2eb] px-2.5 py-1 rounded-md text-[10px] font-mono">
                                <span className="opacity-75">{f.field === 'price' ? 'price' : f.field.replace('metadata.', '')}</span>
                                <span className="text-[#cca678] font-bold">{f.operator}</span>
                                <span>{String(f.value)}</span>
                                <button 
                                  onClick={() => handleRemoveFilter(f.id)}
                                  className="w-3.5 h-3.5 rounded-full hover:bg-white/10 flex items-center justify-center text-[10px] ml-1 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Rule Builder Row */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
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
                            <SelectTrigger className="w-[150px] bg-[#12110f]/80 border-white/5 text-xs h-8 text-[#f5f2eb]">
                              <SelectValue placeholder="Select Field" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#22201d] border-white/10 text-xs">
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
                              <SelectTrigger className="w-[85px] bg-[#12110f]/80 border-white/5 text-xs h-8 text-[#f5f2eb] font-mono">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#22201d] border-white/10 text-xs">
                                {currentSchema[newFilterField] === 'numeric' && (
                                  <>
                                    <SelectItem value="<">&lt;</SelectItem>
                                    <SelectItem value=">">&gt;</SelectItem>
                                    <SelectItem value="=">=</SelectItem>
                                  </>
                                )}
                                {newFilterField && currentSchema[newFilterField] === 'boolean' && (
                                  <SelectItem value="=">=</SelectItem>
                                )}
                                {newFilterField && currentSchema[newFilterField] === 'string' && (
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
                                <SelectTrigger className="w-[100px] bg-[#12110f]/80 border-white/5 text-xs h-8 text-[#f5f2eb]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#22201d] border-white/10 text-xs">
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
                                    handleAddFilter();
                                  }
                                }}
                                className="bg-[#12110f]/60 border border-white/5 rounded px-3 h-8 text-xs text-[#f5f2eb] focus:border-[#8c9c86] focus:outline-none focus:ring-1 focus:ring-[#8c9c86]/30 font-mono min-w-[120px] flex-1 max-w-[200px]"
                              />
                            )
                          )}

                          {newFilterField && (
                            <Button 
                              onClick={handleAddFilter} 
                              disabled={!newFilterField || (currentSchema[newFilterField] !== 'boolean' && !newFilterValue)}
                              className="bg-[#96a68f] hover:bg-[#a9b9a2] text-[#181715] text-xs h-8 px-3.5 font-bold transition-all ml-auto md:ml-0"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {filteredSearchResults.length === 0 ? (
                      <div className="text-center py-20 text-[#a39b90]">
                        <p className="text-lg font-semibold mb-2">No matching items found</p>
                        <p className="text-sm">Try running queries like "price under 100" or clearing active filters.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredSearchResults.map(item => (
                          <div key={item._id} className="bg-[#22201d] border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-[#8c9c86]/30 transition-all font-body">
                            <div>
                              <div className="flex justify-between items-start gap-4 mb-2">
                                <h4 className="font-semibold text-sm line-clamp-2 text-[#f5f2eb]">{item.title}</h4>
                                <span className="font-title text-base font-bold text-[#cca678]">
                                  {item.price > 0 ? `$${item.price.toFixed(2)}` : 'N/A'}
                                </span>
                              </div>
                              <span className="text-[10px] bg-white/5 border border-white/10 text-[#a39b90] px-2 py-0.5 rounded-sm uppercase tracking-wider font-semibold">
                                {getCleanDomainName(getDomain(item.source_url))}
                              </span>

                              {item.metadata && Object.keys(item.metadata).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {Object.entries(item.metadata).map(([key, val]) => {
                                    if (key.startsWith('extracted_')) return null;
                                    let dVal = Array.isArray(val) ? val.join(', ') : (typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val));
                                    if (!dVal || dVal.length > 40) return null;

                                    return (
                                      <span 
                                        key={key} 
                                        className="bg-white/5 border border-white/10 rounded-sm py-0.5 px-1.5 text-[9px] truncate max-w-full font-mono opacity-85"
                                        title={`${key}: ${dVal}`}
                                      >
                                        <strong>{key}:</strong> {dVal}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-dashed border-white/10 flex items-center justify-between text-xs">
                              <a href={item.source_url || '#'} target="_blank" rel="noopener noreferrer" className="text-[#96a68f] hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> View Source
                              </a>
                              <span className="text-[10px] text-[#a39b90]">Collection: {item.collection_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 1: FOLDERS OVERVIEW GRID */}
                {activeTab === 'grid' && (
                  <div className="fade-in">
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
                          onClick={() => setCreateCollectionOpen(true)}
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
                        <p className="text-sm max-w-sm">
                          Use the chrome extension on visual listing grids to auto-generate BeautifulSoup parser scripts and populate your folders.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {collections.map((col, idx) => {
                          const colData = collectionsItems[col];
                          const itemsCount = colData ? colData.items?.length : 0;
                          const websites = colData ? colData.websites : [];
                          const theme = FOLDER_THEMES[idx % FOLDER_THEMES.length];

                          return (
                            <div 
                              key={col}
                              className="bg-[#22201d] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-[#8c9c86]/30 transition-all duration-300 group shadow-md"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Folder className="w-5 h-5 text-[#96a68f] flex-shrink-0" />
                                    <h3 className="font-bold text-lg text-[#f5f2eb] group-hover:text-[#96a68f] transition-colors truncate" title={col}>{col}</h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      className="text-zinc-500 hover:text-[#96a68f] transition-colors p-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTargetCollectionToRename(col);
                                        setRenamedCollectionName(col);
                                        setRenameCollectionOpen(true);
                                      }}
                                      title="Rename Folder"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTargetCollectionToDelete(col);
                                        setDeleteCollectionOpen(true);
                                      }}
                                      title="Delete Folder"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-semibold text-[#a39b90] whitespace-nowrap">
                                      {itemsCount} items
                                    </span>
                                  </div>
                                </div>

                                {/* Bento Box sources preview inside folder card */}
                                <div className="mt-3">
                                  <p className="text-[10px] uppercase tracking-wider text-[#a39b90] mb-2 font-semibold">Web Sources Layout</p>
                                  {websites.length === 0 ? (
                                    <div className="h-24 bg-black/20 border border-dashed border-white/5 rounded-lg flex items-center justify-center text-xs text-[#a39b90] italic">
                                      Empty folder content
                                    </div>
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
                )}

                {/* VIEW 2: FOLDER DETAIL VIEW */}
                {activeTab === 'details' && (
                  <div className="fade-in">
                    
                    {/* Folder details Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-black/10">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => { setActiveTab('grid'); setSelectedWebsiteFilter(''); }}
                          className="w-9 h-9 rounded-full bg-black/15 flex items-center justify-center hover:bg-black/35 transition-colors border border-black/10 text-inherit"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <Folder className="w-5 h-5 opacity-80" />
                            <h2 className="text-xl font-bold font-title uppercase tracking-wide max-w-[200px] truncate" title={activeCollection}>{activeCollection}</h2>
                            <button 
                              className="opacity-60 hover:opacity-100 transition-opacity p-1 text-inherit"
                              onClick={() => {
                                setTargetCollectionToRename(activeCollection);
                                setRenamedCollectionName(activeCollection);
                                setRenameCollectionOpen(true);
                              }}
                              title="Rename Folder"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              className="opacity-60 hover:opacity-100 hover:text-red-600 transition-all p-1 text-inherit"
                              onClick={() => {
                                setTargetCollectionToDelete(activeCollection);
                                setDeleteCollectionOpen(true);
                              }}
                              title="Delete Folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs opacity-75">
                            Showing {activeItems.length} of {(collectionsItems[activeCollection]?.items || []).length} catalog records
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedWebsiteFilter && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs hover:bg-black/10 hover:text-inherit"
                            onClick={() => setSelectedWebsiteFilter('')}
                          >
                            Clear Filter
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-black/20 bg-black/10 hover:bg-black/25 text-xs gap-1.5"
                          onClick={() => refreshActiveCollectionItems()}
                        >
                          <RotateCw className="w-3.5 h-3.5" /> Synchronize
                        </Button>
                      </div>
                    </div>

                    {/* Bento filter items widget within details view */}
                    {collectionsItems[activeCollection]?.websites?.length > 1 && (
                      <div className="mb-6 bg-black/15 p-4 rounded-xl border border-black/5">
                        <p className="text-[10px] uppercase font-bold tracking-wider opacity-75 mb-2.5">Filter items by Website Node</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedWebsiteFilter('')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${!selectedWebsiteFilter ? 'bg-[#181715] text-[#f5f2eb] border-zinc-700' : 'bg-transparent border-black/25 hover:bg-black/10 text-inherit'}`}
                          >
                            All Sources ({collectionsItems[activeCollection]?.items?.length})
                          </button>
                          {collectionsItems[activeCollection].websites.map(web => (
                            <button
                              key={web.domain}
                              onClick={() => setSelectedWebsiteFilter(web.domain === selectedWebsiteFilter ? '' : web.domain)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${web.domain === selectedWebsiteFilter ? 'bg-[#181715] text-[#f5f2eb] border-zinc-700' : 'bg-transparent border-black/25 hover:bg-black/10 text-inherit'}`}
                            >
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${web.domain}&sz=32`}
                                alt={web.name}
                                onError={(e) => { e.target.style.display = 'none'; }}
                                className="w-3.5 h-3.5 rounded-sm"
                              />
                              {web.name} ({web.count})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Schema Filters Panel */}
                    {currentSchema && (
                      <div className="mb-6 bg-black/10 p-5 rounded-xl border border-black/15 shadow-inner">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-black/10">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 opacity-80" />
                            <h3 className="text-xs uppercase font-bold tracking-wider opacity-85 font-title">Refine Collection Data</h3>
                          </div>
                          {isFilterActive && (
                            <button
                              onClick={resetFilters}
                              className="text-[10px] uppercase font-bold text-inherit hover:underline transition-all"
                            >
                              Clear Active Filters
                            </button>
                          )}
                        </div>

                        {/* Active Rule Tags */}
                        {activeFilters.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {activeFilters.map(f => (
                              <div key={f.id} className="flex items-center gap-1.5 bg-black/15 border border-black/25 text-inherit px-2.5 py-1 rounded-md text-[10px] font-mono">
                                <span className="opacity-75">{f.field === 'price' ? 'price' : f.field.replace('metadata.', '')}</span>
                                <span className="font-bold opacity-90">{f.operator}</span>
                                <span>{String(f.value)}</span>
                                <button 
                                  onClick={() => handleRemoveFilter(f.id)}
                                  className="w-3.5 h-3.5 rounded-full hover:bg-black/10 flex items-center justify-center text-[10px] ml-1 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Rule Builder Row */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-70">
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
                            <SelectTrigger className="w-[150px] bg-black/15 border-black/25 text-xs h-8 text-inherit">
                              <SelectValue placeholder="Select Field" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#22201d] border-white/10 text-xs">
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
                              <SelectTrigger className="w-[85px] bg-black/15 border-black/25 text-xs h-8 text-inherit font-mono">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#22201d] border-white/10 text-xs">
                                {currentSchema[newFilterField] === 'numeric' && (
                                  <>
                                    <SelectItem value="<">&lt;</SelectItem>
                                    <SelectItem value=">">&gt;</SelectItem>
                                    <SelectItem value="=">=</SelectItem>
                                  </>
                                )}
                                {newFilterField && currentSchema[newFilterField] === 'boolean' && (
                                  <SelectItem value="=">=</SelectItem>
                                )}
                                {newFilterField && currentSchema[newFilterField] === 'string' && (
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
                                <SelectTrigger className="w-[100px] bg-black/15 border-black/25 text-xs h-8 text-inherit">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#22201d] border-white/10 text-xs">
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
                                    handleAddFilter();
                                  }
                                }}
                                className="bg-black/15 border border-black/25 rounded px-3 h-8 text-xs text-inherit placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-black/20 font-mono min-w-[120px] flex-1 max-w-[200px]"
                              />
                            )
                          )}

                          {newFilterField && (
                            <Button 
                              onClick={handleAddFilter} 
                              disabled={!newFilterField || (currentSchema[newFilterField] !== 'boolean' && !newFilterValue)}
                              className="bg-black/80 hover:bg-black/95 text-[#eae6df] text-xs h-8 px-3.5 font-bold transition-all ml-auto md:ml-0"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Items Grid list */}
                    {activeItems.length === 0 ? (
                      <div className="text-center py-20 opacity-75">
                        <p className="text-lg font-semibold mb-1">No items found</p>
                        <p className="text-xs">Either empty collection or mismatching filters applied.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeItems.map(item => (
                          <div 
                            key={item._id} 
                            className="bg-black/20 hover:bg-black/30 border border-black/10 rounded-xl p-4 flex flex-col justify-between transition-all duration-200"
                          >
                            <div className="mb-4">
                              <div className="flex justify-between items-start gap-3 mb-2">
                                <h3 className="font-semibold text-sm leading-snug line-clamp-2" title={item.title}>
                                  {item.title}
                                </h3>
                                <span className="font-title text-base font-bold whitespace-nowrap text-[#cca678]">
                                  {item.price > 0 ? `$${item.price.toFixed(2)}` : 'N/A'}
                                </span>
                              </div>

                              {item.metadata && Object.keys(item.metadata).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {Object.entries(item.metadata).map(([key, val]) => {
                                    if (key.startsWith('extracted_')) return null;
                                    let dVal = Array.isArray(val) ? val.join(', ') : (typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val));
                                    if (!dVal || dVal.length > 40) return null;

                                    return (
                                      <span 
                                        key={key} 
                                        className="bg-black/15 border border-black/10 rounded-sm py-0.5 px-1.5 text-[9px] truncate max-w-full font-mono opacity-85"
                                        title={`${key}: ${dVal}`}
                                      >
                                        <strong>{key}:</strong> {dVal}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
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
                              <span className="text-[10px] opacity-75">
                                {formatDate(item.updated_at || item.created_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Folder Footer info bar */}
              <div className="mt-4 flex flex-wrap justify-between items-center px-4 text-xs font-mono text-zinc-800 z-10 font-bold uppercase tracking-wider gap-2">
                <span>{totalFileCount} Files Generated</span>
                <span>24 JAN — 30 DES 1971</span>
                <span>OS SYSTEM v0.1.0</span>
              </div>
            </div>
          </div>

          {/* FLOATING ACTION OVERLAY CONTROLS (bottom right) */}
          <div className="action-controls-container">
            {/* Scrape Add Floating Panel */}
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
