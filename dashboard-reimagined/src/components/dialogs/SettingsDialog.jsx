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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';

export const SettingsDialog = ({ open, onOpenChange, user, setUser, API_BASE, triggerToast }) => {
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [generatorModel, setGeneratorModel] = useState('gemini-3.5-flash');
  const [validatorModel, setValidatorModel] = useState('gemini-3.5-flash');
  const [searchModel, setSearchModel] = useState('gemini-3.5-flash');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const fetchAvailableModels = async (token) => {
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

  useEffect(() => {
    if (open && user) {
      setGeminiKeyInput(user.gemini_api_key || '');
      setGeneratorModel(user.generator_model || 'gemini-3.5-flash');
      setValidatorModel(user.validator_model || 'gemini-3.5-flash');
      setSearchModel(user.search_model || 'gemini-3.5-flash');
      fetchAvailableModels(user.token);
    }
  }, [open, user]);

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
        onOpenChange(false);
        triggerToast('Settings saved successfully.', "Success");
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

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen && user) {
          setShowToken(false);
          setGeminiKeyInput(user.gemini_api_key || '');
          setGeneratorModel(user.generator_model || 'gemini-3.5-flash');
          setValidatorModel(user.validator_model || 'gemini-3.5-flash');
          setSearchModel(user.search_model || 'gemini-3.5-flash');
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
              onOpenChange(false);
              if (user) {
                setGeminiKeyInput(user.gemini_api_key || '');
                setGeneratorModel(user.generator_model || 'gemini-3.5-flash');
                setValidatorModel(user.validator_model || 'gemini-3.5-flash');
                setSearchModel(user.search_model || 'gemini-3.5-flash');
              }
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
  );
};

export default SettingsDialog;
