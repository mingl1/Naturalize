import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf } from 'lucide-react';

export const AuthView = ({ onSubmitSuccess, API_BASE, triggerToast }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

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
      onSubmitSuccess(userSession);
      setUsernameInput('');
      setPasswordInput('');
      triggerToast(`Welcome back, ${userSession.username}!`, "Authentication");
    } catch (err) {
      setAuthError('Could not reach backend service.');
    }
  };

  return (
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
  );
};

export default AuthView;
