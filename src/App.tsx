import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Send, 
  Square,
  PanelLeft, 
  User,
  Search,
  Settings,
  Globe,
  Zap,
  ChevronDown,
  Share2,
  Image as ImageIcon,
  X,
  Loader2,
  Download,
  Upload,
  FileText,
  Copy,
  Check,
  Key
} from 'lucide-react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { ChatSession, Message } from './types';
import { generateChatResponse, testApiKey as validateApiKey } from './services/gemini';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [tempUsername, setTempUsername] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, intelligent AI assistant named Lumina AI. Provide concise, accurate, and well-formatted responses. Use markdown for code blocks and lists.');
  const [apiKeySource, setApiKeySource] = useState<'lumina' | 'custom'>(() => 
    (localStorage.getItem('lumina_api_key_source') as 'lumina' | 'custom') || 'lumina'
  );
  const [customApiKey, setCustomApiKey] = useState(() => 
    localStorage.getItem('lumina_custom_api_key') || ''
  );
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const testAbortControllerRef = useRef<AbortController | null>(null);

  const handleTestApiKey = async () => {
    if (!customApiKey.trim()) {
      setTestResult({ success: false, message: "Please enter an API key first." });
      return;
    }

    // Abort any previous test
    if (testAbortControllerRef.current) {
      testAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    testAbortControllerRef.current = controller;
    
    setIsTestingKey(true);
    setTestResult(null);

    try {
      const isValid = await validateApiKey(customApiKey.trim());
      
      if (isValid) {
        setTestResult({ success: true, message: "API Key verified successfully!" });
      } else {
        setTestResult({ success: false, message: "API call succeeded, but the response was incorrect. The key might be restricted." });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('API Key Test aborted');
        return;
      }
      console.error('API Key Test Error:', err);
      setTestResult({ success: false, message: err.message || "Invalid API Key or connection error." });
    } finally {
      if (testAbortControllerRef.current === controller) {
        setIsTestingKey(false);
        testAbortControllerRef.current = null;
      }
    }
  };
  
  // New features state
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply theme
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Load settings from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('lumina_username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('lumina_api_key_source', apiKeySource);
    localStorage.setItem('lumina_custom_api_key', customApiKey);
  }, [apiKeySource, customApiKey]);

  // Sessions are NOT saved to localStorage anymore as per user request
  // to make history vanish after site refresh.

  // Create initial session if logged in but no sessions
  useEffect(() => {
    if (username && sessions.length === 0 && !currentSessionId) {
      const sessionId = generateId();
      const greeting = apiKeySource === 'lumina' 
        ? "This is original key and stuff" 
        : "This is second key";
        
      const initialSession: ChatSession = {
        id: sessionId,
        title: 'New Chat',
        messages: [
          {
            id: generateId(),
            role: 'model',
            content: greeting,
            timestamp: Date.now()
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      setSessions([initialSession]);
      setCurrentSessionId(sessionId);
    }
  }, [username, apiKeySource]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUsername.trim().length >= 2) {
      const name = tempUsername.trim();
      setUsername(name);
      localStorage.setItem('lumina_username', name);
    }
  };

  const handleLogout = () => {
    setUsername(null);
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem('lumina_username');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isLoading]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const createNewSession = () => {
    const greeting = apiKeySource === 'lumina' 
      ? "This is original key and stuff" 
      : "This is second key";
      
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [
        {
          id: generateId(),
          role: 'model',
          content: greeting,
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const exportChat = (session: ChatSession) => {
    const data = JSON.stringify(session, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_history.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAllChats = () => {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina_chat_history_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content);
        
        if (Array.isArray(imported)) {
          // Importing multiple sessions
          const validSessions = imported.filter(s => s.id && s.messages);
          setSessions(prev => [...validSessions, ...prev]);
          if (validSessions.length > 0) setCurrentSessionId(validSessions[0].id);
        } else if (imported.id && imported.messages) {
          // Importing a single session
          setSessions(prev => [imported, ...prev]);
          setCurrentSessionId(imported.id);
        }
        setError(null);
      } catch (err) {
        console.error("Import failed", err);
        setError("Failed to import chat. Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (currentSessionId === id) {
        setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setError("Image size must be under 4MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const data = base64.split(',')[1];
      setSelectedImage({
        data,
        mimeType: file.type
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    setError(null);
    console.log(`[App] handleSend triggered. Current State - Source: ${apiKeySource}, Model: Lumina-Lite, CustomKey: ${customApiKey ? customApiKey.substring(0, 6) + '...' : 'None'}`);

    if (apiKeySource === 'custom' && !customApiKey.trim()) {
      setError("Please enter a custom API key in Settings or switch to Lumina (Original).");
      setIsSettingsOpen(true);
      return;
    }

    const userMessageContent = input.trim();
    const userImageData = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessageId = generateId();
    const aiMessageId = generateId();
    
    // Determine the session ID before state updates to avoid race conditions
    let sessionId = currentSessionId;
    let isNewSession = false;
    
    if (!sessionId) {
      sessionId = generateId();
      isNewSession = true;
      setCurrentSessionId(sessionId);
    }

    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: userMessageContent,
      timestamp: Date.now(),
      imageData: userImageData || undefined,
      apiKeySource: apiKeySource
    };

    const aiMessage: Message = {
      id: aiMessageId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      apiKeySource: apiKeySource
    };

    setSessions(prev => {
      if (isNewSession) {
        const newSession: ChatSession = {
          id: sessionId!,
          title: userMessageContent.slice(0, 30) || 'Image Analysis',
          messages: [userMessage, aiMessage],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return [newSession, ...prev];
      }

      return prev.map(s => {
        if (s.id === sessionId) {
          const updatedMessages = [...s.messages, userMessage, aiMessage];
          return {
            ...s,
            messages: updatedMessages,
            updatedAt: Date.now(),
            title: s.messages.length === 0 
              ? (userMessageContent.slice(0, 40) || 'Image Analysis') 
              : s.title
          };
        }
        return s;
      });
    });

    console.log(`[App] Sending message. Source: ${apiKeySource}, Model: Lumina-Lite, Key: ${customApiKey ? customApiKey.substring(0, 4) + '...' : 'None'}`);
    
    try {
      let responseContent = "";
      
      // We need the history for the API call
      // Limit to last 10 messages for maximum performance
      const currentMessages = currentSession ? currentSession.messages : [];
      const history = [...currentMessages, userMessage].slice(-10);

      await generateChatResponse(
        history, 
        (chunk) => {
          if (controller.signal.aborted) return;
          responseContent += chunk;
          setSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
              return {
                ...s,
                messages: s.messages.map(m => 
                  m.id === aiMessageId ? { ...m, content: responseContent } : m
                )
              };
            }
            return s;
          }));
        },
        { 
          systemPrompt,
          model: 'lumina-lite',
          signal: controller.signal,
          apiKey: apiKeySource === 'custom' ? customApiKey : undefined
        }
      );

    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Generation aborted') {
        console.log('Generation aborted by user');
      } else {
        console.error(err);
        setError(err.message || "Failed to generate response. Please check your API key.");
      }
      // Remove the empty AI message if it failed or was aborted with no content
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          const lastMsg = s.messages[s.messages.length - 1];
          if (lastMsg && lastMsg.id === aiMessageId && !lastMsg.content) {
            return {
              ...s,
              messages: s.messages.filter(m => m.id !== aiMessageId)
            };
          }
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-screen w-full bg-ds-bg overflow-hidden text-[15px] text-ds-text">
      <AnimatePresence>
        {!username && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ds-bg p-4"
          >
            <div className="max-w-md w-full space-y-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-ds-blue rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-ds-blue/20">
                  <Zap size={40} fill="currentColor" />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-white">Lumina AI</h1>
                <p className="text-ds-muted text-lg">Enter your username to start chatting</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ds-muted" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Username"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    className="w-full bg-ds-input border border-ds-border rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-ds-blue focus:ring-4 focus:ring-ds-blue/5 transition-all text-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={tempUsername.trim().length < 2}
                  className="w-full bg-ds-blue text-white py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-ds-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Started
                </button>
              </form>
              
              <p className="text-[11px] text-ds-muted">
                Your chats are NOT saved across sessions.
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3 text-amber-500 text-xs text-left">
                <Download size={16} className="shrink-0" />
                <span>Warning: Chat history vanishes after site refresh. Please export your history if you want to keep it.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={isMobile ? { x: -260 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 260, opacity: 1 }}
            exit={isMobile ? { x: -260 } : { width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "h-full bg-ds-sidebar border-r border-ds-border flex flex-col z-40",
              isMobile ? "fixed inset-y-0 left-0 shadow-2xl" : "relative"
            )}
          >
            <div className="p-3 flex flex-col gap-2 h-full">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 font-bold text-lg text-ds-blue">
                  <div className="w-8 h-8 bg-ds-blue rounded-lg flex items-center justify-center text-white">
                    <Zap size={20} fill="currentColor" />
                  </div>
                  Lumina AI
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-ds-hover rounded-md text-ds-muted"
                >
                  <PanelLeft size={18} />
                </button>
              </div>

              <button
                onClick={createNewSession}
                className="flex items-center gap-2 w-full p-2.5 rounded-xl border border-ds-border bg-ds-input hover:bg-ds-hover transition-all text-sm font-medium shadow-sm mb-2"
              >
                <Plus size={18} className="text-ds-blue" />
                New Chat
              </button>

              <div className="flex gap-2 mb-2">
                <label className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border border-ds-border bg-ds-input hover:bg-ds-hover transition-all text-xs font-medium cursor-pointer">
                  <Upload size={14} className="text-ds-muted" />
                  Import
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
                <button 
                  onClick={exportAllChats}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border border-ds-border bg-ds-input hover:bg-ds-hover transition-all text-xs font-medium"
                >
                  <Download size={14} className="text-ds-muted" />
                  Export All
                </button>
              </div>

              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-muted" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-ds-input border-transparent border hover:border-ds-border rounded-xl text-xs focus:outline-none focus:bg-ds-hover focus:border-ds-blue transition-all"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-start gap-2 text-amber-500 text-[10px] leading-tight mb-2">
                <Download size={12} className="shrink-0 mt-0.5" />
                <span>History vanishes on refresh. Keep your history exported!</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                <div className="text-[11px] font-bold text-ds-muted px-2 py-2 uppercase tracking-wider">Recent</div>
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-sm",
                      currentSessionId === session.id 
                        ? "bg-ds-input border border-ds-border shadow-sm text-ds-blue font-medium" 
                        : "hover:bg-ds-hover text-ds-muted"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare size={16} className={cn("shrink-0", currentSessionId === session.id ? "text-ds-blue" : "text-ds-muted")} />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteSession(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-ds-border mt-auto">
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-ds-hover transition-all text-sm text-ds-muted"
                >
                  <Settings size={18} />
                  Settings
                </button>
                <div className="flex items-center justify-between p-2 mt-1">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-ds-blue/10 flex items-center justify-center text-ds-blue text-xs font-bold border border-ds-blue/20 shrink-0">
                      {username?.slice(0, 2).toUpperCase() || '??'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-medium truncate">{username}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-1.5 hover:bg-ds-hover rounded-lg text-ds-muted"
                    title="Logout"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-ds-border flex items-center justify-between px-4 bg-ds-bg/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-ds-hover rounded-md transition-colors text-ds-muted"
              >
                <PanelLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all">
              <span className="text-sm font-semibold">Lumina-Lite</span>
            </div>
            <div className={cn(
              "hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
              apiKeySource === 'custom' 
                ? "border-purple-500/30 text-purple-500 bg-purple-500/5" 
                : "border-ds-blue/30 text-ds-blue bg-ds-blue/5"
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", apiKeySource === 'custom' ? "bg-purple-500" : "bg-ds-blue")} />
              {apiKeySource === 'custom' ? 'Custom Key' : 'Lumina Key'}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {currentSession && (
              <button 
                onClick={() => exportChat(currentSession)}
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg border border-ds-border text-xs md:text-sm hover:bg-ds-hover transition-all"
                title="Export Chat"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            <button className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg border border-ds-border text-xs md:text-sm hover:bg-ds-hover transition-all" title="Share Chat">
              <Share2 size={16} />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6 md:space-y-8 px-4">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-ds-blue rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-ds-blue/20">
                <Zap size={32} className="md:size-[40px]" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-white">Hi, I'm Lumina AI</h2>
                <p className="text-ds-muted text-base md:text-lg">
                  How can I help you today?
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8 md:space-y-10 pb-40 px-2 md:px-0">
              {currentSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 md:gap-5",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0 border text-[10px] md:text-xs font-bold",
                    message.role === 'user' 
                      ? "bg-ds-input border-ds-border text-ds-blue" 
                      : "bg-ds-blue border-ds-blue text-white"
                  )}>
                    {message.role === 'user' ? (username?.slice(0, 2).toUpperCase() || <User size={16} />) : <Zap size={16} fill="currentColor" />}
                  </div>
                  <div className={cn(
                    "flex flex-col gap-1.5 max-w-[90%] md:max-w-[85%]",
                    message.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] font-bold text-ds-muted uppercase tracking-wider">
                        {message.role === 'user' ? username : 'Lumina AI'}
                      </span>
                      {message.apiKeySource && (
                        <span className={cn(
                          "text-[8px] px-1 rounded border font-bold uppercase tracking-tighter",
                          message.apiKeySource === 'custom' 
                            ? "border-purple-500/30 text-purple-500 bg-purple-500/5" 
                            : "border-ds-blue/30 text-ds-blue bg-ds-blue/5"
                        )}>
                          {message.apiKeySource === 'custom' ? 'Custom' : 'Lumina'}
                        </span>
                      )}
                    </div>
                    {message.imageData && (
                      <div className="rounded-xl overflow-hidden border border-ds-border max-w-full md:max-w-sm">
                        <img 
                          src={`data:${message.imageData.mimeType};base64,${message.imageData.data}`} 
                          alt="Uploaded" 
                          className="w-full h-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className={cn(
                      "text-ds-text leading-relaxed break-words w-full relative group/msg",
                      message.role === 'user' ? "bg-ds-hover px-3 py-2 md:px-4 md:py-2.5 rounded-2xl" : ""
                    )}>
                      <div className="markdown-body overflow-x-auto">
                        <Markdown>{message.content}</Markdown>
                      </div>
                      
                      {message.role === 'model' && message.content && (
                        <button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="absolute -right-2 top-0 p-1.5 bg-ds-sidebar border border-ds-border rounded-lg text-ds-muted hover:text-ds-blue hover:border-ds-blue transition-all opacity-0 group-hover/msg:opacity-100 shadow-sm"
                          title="Copy response"
                        >
                          {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                !currentSession?.messages.length || 
                currentSession.messages[currentSession.messages.length - 1]?.role === 'user' ||
                (currentSession.messages[currentSession.messages.length - 1]?.role === 'model' && !currentSession.messages[currentSession.messages.length - 1]?.content)
              ) && (
                <div className="flex gap-3 md:gap-5 animate-pulse">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-ds-blue flex items-center justify-center text-white shrink-0 shadow-lg shadow-ds-blue/20">
                    <Zap size={16} className="md:w-[18px] md:h-[18px]" fill="currentColor" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-ds-muted uppercase tracking-wider px-1">
                      Lumina AI
                    </span>
                    <div className="flex items-center gap-2 py-2 px-4 bg-ds-hover/30 rounded-2xl border border-ds-border/50">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-ds-blue rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-ds-blue rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-ds-blue rounded-full animate-bounce"></span>
                      </div>
                      <span className="text-xs font-medium text-ds-blue/80 italic">Lumina is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-6 bg-gradient-to-t from-ds-bg via-ds-bg to-transparent">
          <div className="max-w-3xl mx-auto">
            {selectedImage && (
              <div className="mb-2 flex items-center gap-2 p-2 bg-ds-input border border-ds-border rounded-xl w-fit">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden border border-ds-border">
                  <img 
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-1 hover:bg-ds-hover rounded-full text-ds-muted"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="relative bg-ds-input border border-ds-border rounded-[20px] md:rounded-[24px] shadow-xl focus-within:border-ds-blue focus-within:ring-4 focus-within:ring-ds-blue/5 transition-all">
              <div className="flex items-center gap-2 px-3 md:px-4 pt-2 md:pt-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 hover:bg-ds-hover rounded-lg text-ds-muted transition-all"
                  title="Upload Image"
                >
                  <ImageIcon size={16} className="md:size-[18px]" />
                </button>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Lumina AI..."
                className="w-full bg-transparent p-3 md:p-4 pb-10 md:pb-12 focus:outline-none resize-none min-h-[50px] md:min-h-[60px] max-h-32 md:max-h-40 text-sm md:text-[15px] text-ds-text"
                rows={1}
              />
              <div className="absolute right-2 md:right-3 bottom-2 md:bottom-3 flex items-center gap-2">
                {isLoading ? (
                  <button
                    onClick={handleStop}
                    className="p-1.5 md:p-2 rounded-full bg-ds-blue text-white shadow-lg shadow-ds-blue/20 hover:scale-105 active:scale-95 transition-all"
                    title="Stop Generating"
                  >
                    <Square size={16} className="md:size-[18px]" fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && !selectedImage) || isLoading}
                    className={cn(
                      "p-1.5 md:p-2 rounded-full transition-all",
                      (input.trim() || selectedImage) && !isLoading 
                        ? "bg-ds-blue text-white shadow-lg shadow-ds-blue/20 hover:scale-105 active:scale-95" 
                        : "bg-ds-hover text-ds-muted cursor-not-allowed"
                    )}
                  >
                    <Send size={16} className="md:size-[18px]" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 md:mt-3 text-[10px] md:text-[11px] text-ds-muted">
              {error ? (
                <span className="text-red-500 font-medium">{error}</span>
              ) : (
                <span className="text-center">Lumina AI can make mistakes. Check important info.</span>
              )}
            </div>
          </div>
        </div>
        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-ds-sidebar border border-ds-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-ds-border">
                  <h3 className="text-lg font-bold">Settings</h3>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 hover:bg-ds-hover rounded-lg text-ds-muted"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Appearance Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ds-muted uppercase tracking-wider">Appearance</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm",
                          theme === 'dark' ? "bg-ds-blue/10 border-ds-blue text-ds-blue" : "border-ds-border hover:bg-ds-hover text-ds-muted"
                        )}
                      >
                        Dark Mode
                      </button>
                      <button
                        onClick={() => setTheme('light')}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm",
                          theme === 'light' ? "bg-ds-blue/10 border-ds-blue text-ds-blue" : "border-ds-border hover:bg-ds-hover text-ds-muted"
                        )}
                      >
                        Light Mode
                      </button>
                    </div>
                  </div>

                  {/* Performance Info */}
                  <div className="p-4 bg-ds-blue/5 border border-ds-blue/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-ds-blue">
                      <Zap size={16} fill="currentColor" />
                      <span className="text-sm font-bold uppercase tracking-wider">Ultra-Lite Mode Active</span>
                    </div>
                    <p className="text-xs text-ds-muted leading-relaxed">
                      Lumina is currently optimized for free-tier usage with Gemini 3.1 Flash Lite. This model supports up to 1,500 requests per day and provides the fastest possible response times.
                    </p>
                  </div>

                  {/* API Key Settings */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ds-muted uppercase tracking-wider">API Keys</label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setApiKeySource('lumina')}
                        className={cn(
                          "flex items-center justify-between w-full p-3 rounded-xl border transition-all text-sm",
                          apiKeySource === 'lumina' ? "bg-ds-blue/10 border-ds-blue text-ds-blue" : "border-ds-border hover:bg-ds-hover text-ds-muted"
                        )}
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="font-bold">Lumina (Original)</span>
                          <span className="text-[11px] opacity-70">Use the built-in API key</span>
                        </div>
                        {apiKeySource === 'lumina' && <Check size={16} />}
                      </button>
                      
                      <div className="space-y-2">
                        <button
                          onClick={() => setApiKeySource('custom')}
                          className={cn(
                            "flex items-center justify-between w-full p-3 rounded-xl border transition-all text-sm",
                            apiKeySource === 'custom' ? "bg-ds-blue/10 border-ds-blue text-ds-blue" : "border-ds-border hover:bg-ds-hover text-ds-muted"
                          )}
                        >
                          <div className="flex flex-col items-start text-left">
                            <span className="font-bold">Custom Key</span>
                            <span className="text-[11px] opacity-70">Use your own Gemini API key</span>
                          </div>
                          {apiKeySource === 'custom' && <Check size={16} />}
                        </button>
                        
                        {apiKeySource === 'custom' && (
                          <div className="space-y-3">
                            <div className="relative">
                              <input
                                type="password"
                                value={customApiKey}
                                onChange={(e) => {
                                  setCustomApiKey(e.target.value);
                                  if (apiKeySource !== 'custom') setApiKeySource('custom');
                                  setTestResult(null);
                                }}
                                placeholder="Enter your API key..."
                                className="w-full bg-ds-input border border-ds-border rounded-xl p-3 text-sm focus:outline-none focus:border-ds-blue pr-24"
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <button
                                  onClick={handleTestApiKey}
                                  disabled={isTestingKey || !customApiKey.trim()}
                                  className="text-[10px] uppercase tracking-wider font-bold bg-ds-blue/20 text-ds-blue px-2 py-1 rounded-md hover:bg-ds-blue/30 disabled:opacity-50 transition-colors"
                                >
                                  {isTestingKey ? 'Testing...' : 'Test'}
                                </button>
                                {isTestingKey && (
                                  <button
                                    onClick={() => testAbortControllerRef.current?.abort()}
                                    className="text-[10px] uppercase tracking-wider font-bold bg-red-500/20 text-red-500 px-2 py-1 rounded-md hover:bg-red-500/30 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <Key size={14} className="text-ds-muted" />
                              </div>
                            </div>
                            
                            {testResult && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                  "text-xs p-2 rounded-lg flex items-center gap-2",
                                  testResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                )}
                              >
                                {testResult.success ? <Check size={14} /> : <Zap size={14} />}
                                <span>{testResult.message}</span>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ds-muted uppercase tracking-wider">System Prompt</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="w-full bg-ds-input border border-ds-border rounded-xl p-3 text-sm focus:outline-none focus:border-ds-blue min-h-[100px] resize-none"
                      placeholder="Enter system prompt..."
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-ds-hover/50 flex justify-end">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-6 py-2 bg-ds-blue text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-ds-blue/20"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
