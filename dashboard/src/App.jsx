import React, { useState, useEffect } from 'react';

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
  const [isSearching, setIsSearching] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  // General UI state
  const [toast, setToast] = useState('');

  // Show toast utility
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast('');
    }, 3000);
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

  // Initialize data on mount
  useEffect(() => {
    if (user) {
      fetchCollections();
      setGeminiKeyInput(user.gemini_api_key || '');
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
        gemini_api_key: data.gemini_api_key || ''
      };
      
      // Update local storage and state
      localStorage.setItem('ag_user', JSON.stringify(userSession));
      setUser(userSession);
      setGeminiKeyInput(userSession.gemini_api_key);
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
        body: JSON.stringify({ gemini_api_key: geminiKeyInput })
      });

      if (res.ok) {
        const updatedUser = { ...user, gemini_api_key: geminiKeyInput };
        localStorage.setItem('ag_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setShowSettings(false);
        triggerToast('API Key saved successfully.');
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
    <div className="app-container">
      {/* Toast popup */}
      {toast && <div className="toast">{toast}</div>}

      {/* Auth View */}
      {!user ? (
        <div className="auth-wrapper">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-logo">
                <span>🍃</span> NATURALIZE
              </div>
              <p className="auth-subtitle">
                {isLoginView ? 'Login to your visual extraction dashboard' : 'Create an extraction account'}
              </p>
            </div>

            {authError && <div className="auth-error">{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. scraper_pro"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary">
                {isLoginView ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-toggle-link">
              {isLoginView ? (
                <>
                  Don't have an account? <span onClick={() => { setIsLoginView(false); setAuthError(''); }}>Sign up</span>
                </>
              ) : (
                <>
                  Already have an account? <span onClick={() => { setIsLoginView(true); setAuthError(''); }}>Sign in</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard View */
        <div className="dashboard-wrapper">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <span>🍃</span> Naturalize
              </div>
            </div>

            <div className="collections-list">
              <div className="collections-title">Collections</div>
              {collections.length === 0 ? (
                <p style={{ padding: '0 8px', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No scraping collections found. Run a parser in the extension to create one.
                </p>
              ) : (
                collections.map((col) => (
                  <div
                    key={col}
                    className={`collection-item ${activeCollection === col ? 'active' : ''}`}
                    onClick={() => {
                      setActiveCollection(col);
                      setSearchQuery(''); // clear query on switch
                    }}
                  >
                    <div className="collection-item-left">
                      <span>📁</span>
                      <span>{col}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="sidebar-footer">
              <div className="user-badge">
                <div className="user-avatar">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="user-name">{user.username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Workspace Active</div>
                </div>
              </div>

              <button className="btn-sidebar-action" onClick={() => {
                setGeminiKeyInput(user.gemini_api_key || '');
                setShowSettings(true);
              }}>
                <span>⚙️</span> Extension Settings
              </button>

              <button className="btn-sidebar-action" onClick={handleLogout} style={{ color: 'var(--color-clay)' }}>
                <span>🚪</span> Sign Out
              </button>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="main-panel">
            {/* Header / Search bar */}
            <header className="main-header">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Semantic search (e.g. 'items under $100', 'green shirts', 'amenities with wifi')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <span className="search-clear" onClick={() => setSearchQuery('')}>✕</span>
                  )}
                </div>
              </div>

              <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">
                ⚙️
              </button>
            </header>

            {/* Content area */}
            <div className="content-area">
              {activeCollection ? (
                <>
                  <div className="collection-header-row">
                    <div className="collection-title-container">
                      <h2 className="collection-title">📁 {activeCollection}</h2>
                      <div className="collection-meta">
                        {isSearching ? (
                          <span>Searching...</span>
                        ) : (
                          <span>Showing {items.length} item{items.length === 1 ? '' : 's'}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Refresh button */}
                    <button className="btn-sidebar-action" onClick={() => fetchItems(activeCollection, searchQuery)} style={{ fontSize: '12px' }}>
                      🔄 Refresh
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">🔎</div>
                      <h3>No items found</h3>
                      <p>
                        {searchQuery 
                          ? `No matches for "${searchQuery}" in this collection.`
                          : "This collection doesn't contain any items yet."
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="items-grid">
                      {items.map((item) => (
                        <div key={item._id} className="item-card">
                          <div className="item-header">
                            <h3 className="item-title" title={item.title}>{item.title}</h3>
                            <div className="item-price">
                              {item.price > 0 ? `$${item.price.toFixed(2)}` : 'N/A'}
                            </div>
                          </div>

                          {/* Dynamic Metadata Tags */}
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <div className="item-metadata-list">
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
                                  <span key={key} className="metadata-tag" title={`${key}: ${displayVal}`}>
                                    <strong>{key}:</strong> {displayVal}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          <div className="item-footer">
                            <a
                              href={item.source_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="item-source-link"
                            >
                              🔗 Source URL
                            </a>
                            <span className="item-date">
                              {formatDate(item.updated_at || item.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ height: '70vh' }}>
                  <div className="empty-state-icon">🍃</div>
                  <h3>Welcome to Naturalize</h3>
                  <p>Select a catalog collection from the sidebar, or run the extension to capture your first visual grid listing!</p>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">⚙️ Extension Settings</h3>
              <button className="modal-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Extension Access Token</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none' }}>Use in Chrome Extension</span>
              </label>
              <div className="token-copy-box">
                <span className="token-text">
                  {showToken ? user?.token : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-icon" onClick={() => setShowToken(!showToken)} title={showToken ? "Hide Token" : "Show Token"}>
                    {showToken ? '👁️' : '🕶️'}
                  </button>
                  <button className="btn-icon" onClick={handleCopyToken} title="Copy Token">
                    📋
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Copy this token and paste it in your Naturalize Chrome extension popup config to authenticate your sessions.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="AIzaSy..."
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                Optional. If defined, the Chrome extension uses this key to run parser generation models. Also enables AI semantic search in your dashboard.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn-primary" onClick={handleSaveSettings} style={{ flex: 1 }}>
                Save Settings
              </button>
              <button
                className="btn-sidebar-action"
                onClick={() => {
                  setShowSettings(false);
                  setGeminiKeyInput(user?.gemini_api_key || '');
                }}
                style={{ flex: 1, height: '44px', border: '1px solid var(--border-light)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
