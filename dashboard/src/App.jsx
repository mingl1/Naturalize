import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  RotateCw,
  SearchX,
  ExternalLink,
  Settings,
  LogOut,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

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
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);

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

  // Show toast utility wrapper
  const triggerToast = (msg) => {
    toast({
      description: msg,
    });
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
        setCollections(data.collections || []);
        if (data.collections?.length > 0 && !activeCollection) {
          setActiveCollection(data.collections[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch collections", err);
    }
  };

  // Fetch items in the active collection
  const fetchItems = async (colName = activeCollection, query = '', token = user?.token) => {
    if (!colName || !token) {
      setItems([]);
      return;
    }
    
    setIsSearching(!!query);
    try {
      let url = `${API_BASE}/api/collections/${colName}/items`;
      if (query) {
        url += `?q=${encodeURIComponent(query)}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch collection items", err);
    } finally {
      setIsSearching(false);
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

  // Fetch items when active collection changes
  useEffect(() => {
    if (activeCollection && user) {
      fetchItems(activeCollection, searchQuery);
    } else {
      setItems([]);
    }
  }, [activeCollection, searchQuery]);

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
      
      // Update local storage and state
      localStorage.setItem('ag_user', JSON.stringify(userSession));
      setUser(userSession);
      setGeminiKeyInput(userSession.gemini_api_key);
      setGeneratorModel(userSession.generator_model);
      setValidatorModel(userSession.validator_model);
      setSearchModel(userSession.search_model);
      setUsernameInput('');
      setPasswordInput('');
      triggerToast(`Welcome back, ${userSession.username}!`);
    } catch (err) {
      setAuthError('Could not reach backend service.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ag_user');
    setUser(null);
    setCollections([]);
    setActiveCollection('');
    setItems([]);
    setSearchQuery('');
    setSearchInput('');
    setShowSettings(false);
    triggerToast('Logged out successfully.');
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
        triggerToast('Settings saved successfully.');
        // Refresh collections / search after settings update
        fetchCollections();
      } else {
        const data = await res.json();
        triggerToast(`Error: ${data.detail || 'Failed to save settings'}`);
      }
    } catch (err) {
      triggerToast('Could not save settings.');
    }
  };

  const handleCopyToken = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.token);
    triggerToast('Token copied to clipboard!');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  // Format Dates
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body selection:bg-primary/30">
      {/* Toast rendering component */}
      <Toaster />

      {/* Auth View */}
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,#23221f_0%,var(--bg-main)_70%)]">
          <Card className="w-full max-w-[420px] bg-secondary border border-border shadow-lg p-8">
            <CardHeader className="text-center pb-6">
              <div className="flex items-center justify-center gap-2 text-2xl font-title font-bold tracking-wider text-accent mb-2">
                <Leaf className="w-8 h-8 text-primary animate-pulse" />
                <span>NATURALIZE</span>
              </div>
              <CardDescription className="text-sm text-muted-foreground">
                {isLoginView ? 'Login to your visual extraction dashboard' : 'Create an extraction account'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {authError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm mb-5">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</label>
                  <Input
                    type="text"
                    placeholder="e.g. scraper_pro"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="bg-background border-border focus:border-ring focus:ring-ring/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="bg-background border-border focus:border-ring focus:ring-ring/20"
                  />
                </div>

                <Button type="submit" className="w-full bg-primary hover:bg-primary/95 text-background font-semibold py-2.5 mt-2">
                  {isLoginView ? 'Sign In' : 'Sign Up'}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="justify-center pt-4 border-t border-border mt-4">
              <div className="text-sm text-muted-foreground">
                {isLoginView ? (
                  <>
                    Don't have an account?{' '}
                    <span
                      onClick={() => { setIsLoginView(false); setAuthError(''); }}
                      className="text-accent hover:underline cursor-pointer font-medium"
                    >
                      Sign up
                    </span>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <span
                      onClick={() => { setIsLoginView(true); setAuthError(''); }}
                      className="text-accent hover:underline cursor-pointer font-medium"
                    >
                      Sign in
                    </span>
                  </>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : (
        /* Dashboard View */
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[280px] bg-secondary border-r border-border flex flex-col flex-shrink-0">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="font-title font-bold text-lg tracking-widest text-accent flex items-center gap-2">
                <Leaf className="w-5 h-5 text-primary" />
                <span>Naturalize</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3 px-2 font-semibold">
                Collections
              </div>
              {collections.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground italic">
                  No scraping collections found. Run a parser in the extension to create one.
                </p>
              ) : (
                <div className="space-y-1">
                  {collections.map((col) => (
                    <div
                      key={col}
                      className={`flex items-center justify-between py-2 px-3 rounded-md cursor-pointer transition-all duration-200 text-sm hover:bg-card hover:text-foreground ${
                        activeCollection === col
                          ? 'bg-primary/15 text-primary font-medium border-l-2 border-primary'
                          : ''
                      }`}
                      onClick={() => {
                        setActiveCollection(col);
                        setSearchQuery(''); // clear query on switch
                        setSearchInput(''); // clear input on switch
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{col}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex flex-col gap-3">
              <div className="flex items-center gap-2.5 text-sm p-1">
                <div className="w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center font-bold text-sm">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <div className="font-medium truncate text-foreground">{user.username}</div>
                  <div className="text-[10px] text-muted-foreground">Workspace Active</div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full text-xs justify-start gap-2 border-border hover:bg-card"
                onClick={handleOpenSettings}
              >
                <Settings className="w-3.5 h-3.5" /> Extension Settings
              </Button>

              <Button
                variant="outline"
                className="w-full text-xs justify-start gap-2 border-border hover:bg-card text-destructive hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="w-3.5 h-3.5 animate-pulse" /> Sign Out
              </Button>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 flex flex-col bg-background overflow-hidden">
            {/* Header / Search bar */}
            <header className="py-6 px-8 border-b border-border flex items-center justify-between gap-5">
              <form className="relative max-w-[500px] w-full" onSubmit={handleSearchSubmit}>
                <div className="flex items-center bg-secondary border border-border rounded-full py-1.5 px-4 transition-all duration-200 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
                  <Search className="text-muted-foreground mr-2.5 w-4 h-4 flex-shrink-0" />
                  <input
                    type="text"
                    className="w-full bg-transparent border-0 p-1 text-sm focus:outline-none placeholder:text-muted-foreground"
                    placeholder="Semantic search (e.g. 'items under $100', 'green shirts')"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  {searchInput && (
                    <span
                      className="text-xs font-semibold cursor-pointer text-muted-foreground ml-2 hover:text-foreground p-1"
                      onClick={() => {
                        setSearchInput('');
                        setSearchQuery('');
                      }}
                    >
                      ✕
                    </span>
                  )}
                </div>
              </form>

              <Button
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-border bg-secondary hover:border-ring hover:text-primary"
                onClick={handleOpenSettings}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </header>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-8">
              {activeCollection ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Folder className="w-6 h-6 text-primary" /> {activeCollection}
                      </h2>
                      <div className="text-xs text-muted-foreground">
                        {isSearching ? (
                          <span>Searching...</span>
                        ) : (
                          <span>Showing {items.length} item{items.length === 1 ? '' : 's'}</span>
                        )}
                      </div>
                    </div>

                    {/* Refresh button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border text-xs"
                      onClick={() => fetchItems(activeCollection, searchQuery)}
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </div>

                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-muted-foreground">
                      <SearchX className="w-12 h-12 mb-4 text-primary opacity-80" />
                      <h3 className="text-foreground text-lg font-semibold mb-2">No items found</h3>
                      <p className="text-sm max-w-xs">
                        {searchQuery
                          ? `No matches for "${searchQuery}" in this collection.`
                          : "This collection doesn't contain any items yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                      {items.map((item) => (
                        <Card
                          key={item._id}
                          className="bg-secondary border-border flex flex-col justify-between h-full min-h-[180px] p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:bg-card"
                        >
                          <div className="mb-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <h3 className="text-base font-semibold leading-snug line-clamp-2 text-foreground" title={item.title}>
                                {item.title}
                              </h3>
                              <span className="font-title text-lg font-semibold text-gold whitespace-nowrap">
                                {item.price > 0 ? `$${item.price.toFixed(2)}` : 'N/A'}
                              </span>
                            </div>

                            {/* Dynamic Metadata Tags */}
                            {item.metadata && Object.keys(item.metadata).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {Object.entries(item.metadata).map(([key, val]) => {
                                  // Skip raw extraction elements if any
                                  if (key.startsWith('extracted_')) return null;

                                  // Format value for display (string, arrays, objects)
                                  let displayVal = '';
                                  if (Array.isArray(val)) {
                                    displayVal = val.join(', ');
                                  } else if (typeof val === 'object' && val !== null) {
                                    displayVal = JSON.stringify(val);
                                  } else {
                                    displayVal = String(val);
                                  }

                                  if (!displayVal || displayVal.length > 50) return null;

                                  return (
                                    <span
                                      key={key}
                                      className="bg-background border border-border rounded-sm py-0.5 px-2 text-[10px] text-muted-foreground truncate max-w-full"
                                      title={`${key}: ${displayVal}`}
                                    >
                                      <strong>{key}:</strong> {displayVal}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-dashed border-border text-xs">
                            <a
                              href={item.source_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary font-medium flex items-center gap-1 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> Source URL
                            </a>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(item.updated_at || item.created_at)}
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[70vh] text-center text-muted-foreground">
                  <Leaf className="w-16 h-16 mb-4 text-primary opacity-60 animate-bounce" />
                  <h3 className="text-foreground text-xl font-bold mb-2">Welcome to Naturalize</h3>
                  <p className="text-sm max-w-sm">
                    Select a catalog collection from the sidebar, or run the extension to capture your first visual grid listing!
                  </p>
                </div>
              )}
            </div>
          </main>
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
        <DialogContent className="max-w-[500px] bg-secondary border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Settings className="w-5 h-5 text-primary" /> Extension Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Configure your browser extension API key, models, and session tokens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Extension Token */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extension Access Token</label>
                <span className="text-[10px] text-muted-foreground lowercase">Use in Chrome Extension</span>
              </div>
              <div className="bg-background border border-border rounded-md p-3 flex items-center justify-between gap-3">
                <span className="font-mono text-xs truncate text-accent select-all">
                  {showToken ? user?.token : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken(!showToken)}
                    title={showToken ? "Hide Token" : "Show Token"}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground"
                    onClick={handleCopyToken}
                    title="Copy Token"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Copy this token and paste it in your Naturalize Chrome extension popup config to authenticate your sessions.
              </p>
            </div>

            {/* Gemini API Key */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gemini API Key</label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                className="bg-background border-border focus:border-ring focus:ring-ring/20"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                Optional. If defined, the Chrome extension uses this key to run parser generation models. Also enables AI semantic search in your dashboard.
              </p>
            </div>

            {/* Code Generator Model Select */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code Generator Model</label>
              <Select
                value={generatorModel}
                onValueChange={setGeneratorModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border text-foreground">
                  {availableModels.length === 0 ? (
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash (In: $1.50, Out: $9.00 / 1M)</SelectItem>
                  ) : (
                    availableModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} (In: ${m.input_price_1m.toFixed(3)}, Out: ${m.output_price_1m.toFixed(3)} / 1M)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Specifies the model used to write scraping scripts.
              </p>
            </div>

            {/* Validator Judge Model Select */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validator / LLM Judge Model</label>
              <Select
                value={validatorModel}
                onValueChange={setValidatorModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border text-foreground">
                  {availableModels.length === 0 ? (
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash (In: $1.50, Out: $9.00 / 1M)</SelectItem>
                  ) : (
                    availableModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} (In: ${m.input_price_1m.toFixed(3)}, Out: ${m.output_price_1m.toFixed(3)} / 1M)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Specifies the model used to run instructions and schema compliance checks.
              </p>
            </div>

            {/* Semantic Search Model Select */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semantic Search Model</label>
              <Select
                value={searchModel}
                onValueChange={setSearchModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border text-foreground">
                  {availableModels.length === 0 ? (
                    <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash (In: $1.50, Out: $9.00 / 1M)</SelectItem>
                  ) : (
                    availableModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} (In: ${m.input_price_1m.toFixed(3)}, Out: ${m.output_price_1m.toFixed(3)} / 1M)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Specifies the model used to search and match items semantically in the dashboard.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t border-border mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowSettings(false);
                setGeminiKeyInput(user?.gemini_api_key || '');
                setGeneratorModel(user?.generator_model || 'gemini-3.5-flash');
                setValidatorModel(user?.validator_model || 'gemini-3.5-flash');
                setSearchModel(user?.search_model || 'gemini-3.5-flash');
              }}
              className="flex-1 border-border"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary text-background font-semibold hover:bg-primary/95"
              onClick={handleSaveSettings}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
