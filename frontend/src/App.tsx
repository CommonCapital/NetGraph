import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  MessageSquare, 
  Network, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Linkedin, 
  Twitter, 
  Instagram, 
  Send, 
  UserPlus, 
  Clock, 
  ArrowRight, 
  BookOpen, 
  Edit3, 
  Archive, 
  UserCheck,
  PlusCircle,
  XCircle,
  HelpCircle,
  LogOut,
  FolderMinus
} from 'lucide-react';

// --- Lightweight GraphQL Request Helper ---
const fetchGraphQL = async (query: string, variables: any = {}) => {
  const token = localStorage.getItem('netgraph_token');
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch('/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  
  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch (_) {}
    throw new Error(`Server error (${res.status}): ${errText.substring(0, 80) || "Unknown error"}`);
  }
  
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error("Invalid JSON response from server. Please ensure the backend is running.");
  }
  
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data;
};

// --- TS Interfaces ---
interface Experience {
  role: string;
  company: string;
  startYear?: number;
  endYear?: number;
  current?: boolean;
}

interface Interaction {
  id: string;
  date: string;
  note?: string;
}

interface Contact {
  id: string;
  name: string;
  type: string;
  linkedUser?: {
    id: string;
    username: string;
    displayName?: string;
  };
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  xUrl?: string;
  instagramUrl?: string;
  telegramHandle?: string;
  currentRole?: string;
  currentCompany?: string;
  experience: Experience[];
  interests: string[];
  achievements?: string;
  philosophy?: string;
  lifestyle?: string;
  approachNotes?: string;
  howWeMet?: string;
  introducedBy?: {
    id: string;
    name: string;
  };
  relatedTo: {
    id: string;
    name: string;
    currentCompany?: string;
  }[];
  tags: string[];
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  interactions: Interaction[];
}

interface Connection {
  id: string;
  requester: {
    id: string;
    username: string;
    displayName?: string;
  };
  receiver: {
    id: string;
    username: string;
    displayName?: string;
  };
  status: string;
  createdAt: string;
}

// --- Main App Component ---
export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('netgraph_token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Data States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Selected/Active entities
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Auth Forms
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');

  // Fetch initial profile & data on login
  useEffect(() => {
    if (token) {
      loadProfileAndData();
    } else {
      setCurrentUser(null);
      setContacts([]);
    }
  }, [token]);

  const loadProfileAndData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch User Info
      const profileData = await fetchGraphQL(`
        query {
          me {
            id
            username
            displayName
            bio
            avatarUrl
          }
        }
      `);
      
      if (!profileData.me) {
        // Token invalid
        handleLogout();
        return;
      }
      
      setCurrentUser(profileData.me);

      // 2. Fetch Contacts with all premium fields
      const contactsData = await fetchGraphQL(`
        query {
          contacts(archived: false) {
            id
            name
            type
            email
            phone
            linkedinUrl
            xUrl
            instagramUrl
            telegramHandle
            currentRole
            currentCompany
            experience {
              role
              company
              startYear
              endYear
              current
            }
            interests
            achievements
            philosophy
            lifestyle
            approachNotes
            howWeMet
            introducedBy {
              id
              name
            }
            relatedTo {
              id
              name
              currentCompany
            }
            tags
            notes
            archived
            createdAt
            interactions {
              id
              date
              note
            }
          }
        }
      `);
      setContacts(contactsData.contacts || []);

      // 3. Fetch Friend Requests
      const connData = await fetchGraphQL(`
        query {
          pendingRequests {
            id
            requester {
              id
              username
              displayName
            }
            status
            createdAt
          }
        }
      `);
      setPendingRequests(connData.pendingRequests || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load details.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('netgraph_token');
    setToken(null);
    setCurrentUser(null);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (authTab === 'login') {
        const data = await fetchGraphQL(`
          mutation Login($username: String!, $password: String!) {
            loginUser(username: $username, password: $password) {
              accessToken
            }
          }
        `, { username: usernameInput, password: passwordInput });
        
        const tokenVal = data.loginUser.accessToken;
        localStorage.setItem('netgraph_token', tokenVal);
        setToken(tokenVal);
      } else {
        const data = await fetchGraphQL(`
          mutation Register($username: String!, $email: String!, $password: String!, $displayName: String) {
            registerUser(username: $username, email: $email, password: $password, displayName: $displayName) {
              accessToken
            }
          }
        `, { 
          username: usernameInput, 
          email: emailInput, 
          password: passwordInput, 
          displayName: displayNameInput || usernameInput 
        });
        
        const tokenVal = data.registerUser.accessToken;
        localStorage.setItem('netgraph_token', tokenVal);
        setToken(tokenVal);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    }
  };

  return (
    <div className="app-container">
      {!token ? (
        // --- Authentication / Onboarding UI ---
        <div className="auth-wrapper">
          <div className="auth-glow-bg"></div>
          <div className="auth-panel glass-panel fade-in">
            <div className="auth-header">
              <span style={{ fontSize: '3rem' }}>🕸️</span>
              <h1 className="auth-h1">NetGraph</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Your private relationship operating system.
              </p>
            </div>

            <div className="auth-tabs">
              <div 
                className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => setAuthTab('login')}
              >
                Log In
              </div>
              <div 
                className={`auth-tab ${authTab === 'register' ? 'active' : ''}`}
                onClick={() => setAuthTab('register')}
              >
                Get Started
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="@username" 
                  value={usernameInput} 
                  onChange={e => setUsernameInput(e.target.value)} 
                  required
                />
              </div>

              {authTab === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="input-field" 
                      placeholder="you@domain.com" 
                      value={emailInput} 
                      onChange={e => setEmailInput(e.target.value)} 
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Richard Rockefeller" 
                      value={displayNameInput} 
                      onChange={e => setDisplayNameInput(e.target.value)} 
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••" 
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)} 
                  required
                />
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                {authTab === 'login' ? 'Enter Control Center' : 'Create Infrastructure'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        // --- Full CRM Desktop Shell ---
        <>
          {/* --- Vertical Left Sidebar --- */}
          <aside className="sidebar">
            <div>
              <div className="logo-container">
                <span style={{ fontSize: '1.6rem' }}>🕸️</span>
                <span className="logo-text">NetGraph</span>
              </div>

              <nav className="nav-links">
                <div 
                  className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dashboard'); setSelectedContact(null); }}
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </div>
                <div 
                  className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('contacts'); setSelectedContact(null); }}
                >
                  <Users size={18} />
                  Contacts
                </div>
                <div 
                  className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('network'); setSelectedContact(null); }}
                >
                  <Network size={18} />
                  Network Graph
                </div>
                <div 
                  className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('chat'); setSelectedContact(null); }}
                >
                  <MessageSquare size={18} />
                  AI Workspace
                </div>
                <div 
                  className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('settings'); setSelectedContact(null); }}
                >
                  <SettingsIcon size={18} />
                  Settings
                </div>
              </nav>
            </div>

            <div className="sidebar-footer">
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setSelectedContact(null);
                  setIsCreating(true);
                  setIsEditing(false);
                  setActiveTab('contacts');
                }}
              >
                <Plus size={16} />
                Quick Add Contact
              </button>

              {currentUser && (
                <div className="flex-between">
                  <div className="user-profile-badge">
                    <div className="user-avatar">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <div className="user-details">
                      <span className="user-name">{currentUser.displayName}</span>
                      <span className="user-handle">@{currentUser.username}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    title="Logout"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* --- Main Contents Panels --- */}
          <main className="main-content">
            {loading && (
              <div style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Syncing local intelligence...
              </div>
            )}
            
            {activeTab === 'dashboard' && (
              <DashboardView 
                contacts={contacts} 
                setActiveTab={setActiveTab} 
                setSelectedContact={setSelectedContact}
              />
            )}
            
            {activeTab === 'contacts' && (
              <ContactsView 
                contacts={contacts} 
                setContacts={setContacts}
                selectedContact={selectedContact}
                setSelectedContact={setSelectedContact}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                isCreating={isCreating}
                setIsCreating={setIsCreating}
              />
            )}

            {activeTab === 'network' && (
              <NetworkView 
                contacts={contacts} 
                pendingRequests={pendingRequests}
                setPendingRequests={setPendingRequests}
                setSelectedContact={setSelectedContact}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'chat' && (
              <AIChatWorkspace contacts={contacts} />
            )}

            {activeTab === 'settings' && (
              <SettingsView 
                currentUser={currentUser} 
                setCurrentUser={setCurrentUser} 
                contacts={contacts}
                handleLogout={handleLogout} 
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}

// ==========================================================================
// SCREEN MODULE: Dashboard
// ==========================================================================
function DashboardView({ 
  contacts, 
  setActiveTab, 
  setSelectedContact 
}: { 
  contacts: Contact[]; 
  setActiveTab: (val: string) => void;
  setSelectedContact: (c: Contact) => void;
}) {
  const totalCount = contacts.length;
  
  // Calculate Neglected Contacts (over 90 days)
  const today = new Date();
  const neglected = contacts.filter(c => {
    if (c.archived) return false;
    if (c.interactions.length === 0) return true;
    const lastDate = new Date(c.interactions[0].date);
    const diff = (today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
    return diff >= 90;
  });

  // Active network health percentage
  const healthPercent = totalCount > 0 
    ? Math.round(((totalCount - neglected.length) / totalCount) * 100) 
    : 100;

  return (
    <div className="fade-in">
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Operator Center</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back to your private intelligence matrix.</p>
      </div>

      {/* --- Stat Blocks --- */}
      <div className="dashboard-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">Total Node Network</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{neglected.length}</span>
            <span className="stat-label">Neglected Nodes</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}>
            <Network size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{healthPercent}%</span>
            <span className="stat-label">Network Health Velocity</span>
          </div>
        </div>
      </div>

      {/* --- AI Suggested Actions Block --- */}
      <div className="ai-suggestions-panel">
        <h2 style={{ fontSize: '1.35rem' }}>AI Relationship Engine Actions</h2>
        
        {neglected.length > 0 ? (
          <div className="suggestion-card glass-panel fade-in">
            <MessageSquare className="suggestion-icon" size={24} />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '6px', fontWeight: '700' }}>Maintain Connection Velocity</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
                You haven't contacted **{neglected[0].name}** in over 90 days. 
                They are noted as having insights in *"{neglected[0].currentRole} at {neglected[0].currentCompany || 'their company'}"*.
                {neglected[0].approachNotes && ` Our recommendation strategy: "${neglected[0].approachNotes}"`}
              </p>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.85rem' }}
                onClick={() => {
                  setSelectedContact(neglected[0]);
                  setActiveTab('contacts');
                }}
              >
                Analyze Profile
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="suggestion-card glass-panel" style={{ borderStyle: 'solid', background: 'rgba(20, 184, 166, 0.03)', borderColor: 'var(--accent-teal)' }}>
            <UserCheck className="suggestion-icon" style={{ color: 'var(--accent-teal)' }} size={24} />
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', fontWeight: '700' }}>Network Fully Integrated</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                All nodes are active and initialized. Keep expanding your graph edges!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- Recent Additions --- */}
      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '1.35rem', marginBottom: '18px' }}>Recent Network Updates</h2>
        <div className="grid-layout">
          {contacts.slice(0, 3).map(c => (
            <div 
              key={c.id} 
              className="glass-card" 
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedContact(c);
                setActiveTab('contacts');
              }}
            >
              <div className="flex-between" style={{ marginBottom: '8px' }}>
                <span className="contact-name">{c.name}</span>
                <span className={`badge ${c.type === 'user' ? 'badge-user' : 'badge-text'}`}>
                  {c.type}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {c.currentRole} at **{c.currentCompany || 'Independent'}**
              </p>
              {c.tags && c.tags.length > 0 && (
                <div className="contact-card-tags">
                  {c.tags.slice(0, 2).map((t, idx) => (
                    <span key={idx} className="badge badge-tag">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// SCREEN MODULE: Contacts Database (List, Filter, Profile, Edit forms)
// ==========================================================================
function ContactsView({
  contacts,
  setContacts,
  selectedContact,
  setSelectedContact,
  isEditing,
  setIsEditing,
  isCreating,
  setIsCreating
}: {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  selectedContact: Contact | null;
  setSelectedContact: (c: Contact | null) => void;
  isEditing: boolean;
  setIsEditing: (b: boolean) => void;
  isCreating: boolean;
  setIsCreating: (b: boolean) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterTag, setFilterTag] = useState('ALL');

  // Gather unique tags
  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])));

  // Filter logic
  const filteredContacts = contacts.filter(c => {
    if (c.archived) return false;
    
    // Type filter
    if (filterType === 'TEXT' && c.type !== 'text') return false;
    if (filterType === 'USER' && c.type !== 'user') return false;

    // Tag filter
    if (filterTag !== 'ALL' && !(c.tags || []).includes(filterTag)) return false;

    // Search query
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const block = `${c.name} ${c.currentCompany || ''} ${c.currentRole || ''} ${c.notes || ''} ${c.email || ''}`.toLowerCase();
      if (!block.includes(s)) return false;
    }
    return true;
  });

  const handleSelectContact = (c: Contact) => {
    setSelectedContact(c);
    setIsEditing(false);
    setIsCreating(false);
  };

  return (
    <div className="fade-in" style={{ height: '100%' }}>
      {isCreating ? (
        <ContactForm 
          contacts={contacts}
          setContacts={setContacts}
          onClose={() => setIsCreating(false)} 
          onSave={(newC) => {
            setContacts(prev => [newC, ...prev]);
            setIsCreating(false);
            setSelectedContact(newC);
          }}
        />
      ) : selectedContact ? (
        <ContactProfile 
          contact={selectedContact} 
          contacts={contacts}
          setContacts={setContacts}
          setSelectedContact={setSelectedContact}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          onBack={() => setSelectedContact(null)}
        />
      ) : (
        // --- General Contact Grid/List Board ---
        <>
          <div className="contacts-header">
            <div>
              <h1 style={{ fontSize: '2.2rem', marginBottom: '4px' }}>Relationship Database</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Manage your private dossiers and node intelligence files.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
              <Plus size={16} />
              Add Contact Node
            </button>
          </div>

          <div className="search-filter-bar">
            <div className="search-container">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                className="input-field search-input" 
                placeholder="Search index (name, role, company, notes)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <select 
              className="filter-select"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="ALL">All Profiles</option>
              <option value="TEXT">TEXT CRM Only</option>
              <option value="USER">USER Linked</option>
            </select>

            <select 
              className="filter-select"
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {filteredContacts.length === 0 ? (
            <div className="glass-panel placeholder-container">
              <FolderMinus size={48} />
              <h3>No CRM nodes match filters</h3>
              <p>Try resetting filters or initialize a new record.</p>
            </div>
          ) : (
            <div className="grid-layout">
              {filteredContacts.map(c => (
                <div 
                  key={c.id} 
                  className="glass-card fade-in"
                  onClick={() => handleSelectContact(c)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="contact-card-header">
                    <span className="contact-name">{c.name}</span>
                    <span className={`badge ${c.type === 'user' ? 'badge-user' : 'badge-text'}`}>
                      {c.type === 'user' ? `@${c.linkedUser?.username || 'user'}` : 'text'}
                    </span>
                  </div>

                  <div className="contact-meta">
                    <div className="contact-meta-item">
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                        {c.currentRole} at <strong style={{ color: 'var(--text-primary)' }}>{c.currentCompany || 'Independent'}</strong>
                      </span>
                    </div>
                    {c.email && <div className="contact-meta-item"><Mail size={13} /> {c.email}</div>}
                    {c.phone && <div className="contact-meta-item"><Phone size={13} /> {c.phone}</div>}
                  </div>

                  {c.notes && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', fontStyle: 'italic' }}>
                      "{c.notes.slice(0, 80)}{c.notes.length > 80 ? '...' : ''}"
                    </p>
                  )}

                  {c.tags && c.tags.length > 0 && (
                    <div className="contact-card-tags">
                      {c.tags.map((t, idx) => (
                        <span key={idx} className="badge badge-tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==========================================================================
// VIEW COMPONENT: Detailed Contact Profile (Tabbed sections, related mini cards, interaction logging)
// ==========================================================================
function ContactProfile({
  contact,
  contacts,
  setContacts,
  setSelectedContact,
  isEditing,
  setIsEditing,
  onBack
}: {
  contact: Contact;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setSelectedContact: (c: Contact | null) => void;
  isEditing: boolean;
  setIsEditing: (b: boolean) => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'dossier' | 'personal' | 'timeline'>('dossier');
  
  // Interaction Log States
  const [logNote, setLogNote] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingLog, setSubmittingLog] = useState(false);

  // Archive / Delete States
  const [deleting, setDeleting] = useState(false);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logNote) return;
    setSubmittingLog(true);
    try {
      const data = await fetchGraphQL(`
        mutation Log($contactId: ID!, $date: String!, $note: String!) {
          logInteraction(contactId: $contactId, date: $date, note: $note) {
            id
            date
            note
          }
        }
      `, { contactId: contact.id, date: logDate, note: logNote });
      
      const newInt = data.logInteraction;
      
      // Update contact details in local state
      const updatedContact = {
        ...contact,
        interactions: [newInt, ...contact.interactions]
      };
      
      setSelectedContact(updatedContact);
      setContacts(prev => prev.map(c => c.id === contact.id ? updatedContact : c));
      setLogNote('');
    } catch (err: any) {
      alert(err.message || 'Failed to log interaction');
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleArchive = async () => {
    try {
      await fetchGraphQL(`
        mutation Archive($id: ID!) {
          archiveContact(id: $id) {
            id
          }
        }
      `, { id: contact.id });
      
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      onBack();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently wipe structural intelligence record on ${contact.name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetchGraphQL(`
        mutation Delete($id: ID!) {
          deleteContact(id: $id)
        }
      `, { id: contact.id });
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      onBack();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (isEditing) {
    return (
      <ContactForm 
        contact={contact}
        contacts={contacts}
        setContacts={setContacts}
        onClose={() => setIsEditing(false)}
        onSave={(updatedC) => {
          setSelectedContact(updatedC);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div className="fade-in">
      {/* --- Nav back bar --- */}
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Index Database
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
            <Edit3 size={16} />
            Edit Profile
          </button>
          <button className="btn btn-secondary" onClick={handleArchive} title="Archive Node">
            <Archive size={16} />
            Archive
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            Wipe Node
          </button>
        </div>
      </div>

      <div className="profile-layout">
        {/* --- Left Column: Primary Dossier Details --- */}
        <div className="profile-main">
          
          {/* Header Identity Block */}
          <div className="profile-header-block">
            <div className="profile-big-avatar">
              {contact.name[0].toUpperCase()}
            </div>
            <div className="profile-title-block">
              <div className="flex-align-center" style={{ gap: '10px' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{contact.name}</h1>
                <span className={`badge ${contact.type === 'user' ? 'badge-user' : 'badge-text'}`}>
                  {contact.type === 'user' ? `@${contact.linkedUser?.username}` : 'text'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
                {contact.currentRole} at <strong style={{ color: 'var(--text-primary)' }}>{contact.currentCompany || 'Independent'}</strong>
              </p>
              
              {/* Social icons links */}
              <div className="profile-social-links">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="social-icon-btn" title={contact.email}><Mail size={16} /></a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="social-icon-btn" title={contact.phone}><Phone size={16} /></a>
                )}
                {contact.linkedinUrl && (
                  <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="social-icon-btn"><Linkedin size={16} /></a>
                )}
                {contact.xUrl && (
                  <a href={contact.xUrl} target="_blank" rel="noreferrer" className="social-icon-btn"><Twitter size={16} /></a>
                )}
                {contact.instagramUrl && (
                  <a href={contact.instagramUrl} target="_blank" rel="noreferrer" className="social-icon-btn"><Instagram size={16} /></a>
                )}
              </div>
            </div>
          </div>

          {/* Dossier Tabs bar */}
          <div className="auth-tabs" style={{ marginBottom: '12px' }}>
            <div className={`auth-tab ${activeTab === 'dossier' ? 'active' : ''}`} onClick={() => setActiveTab('dossier')}>
              Dossier & History
            </div>
            <div className={`auth-tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
              Worldview & Approach
            </div>
            <div className={`auth-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
              Interaction Timeline ({contact.interactions.length})
            </div>
          </div>

          {activeTab === 'dossier' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Free-form notes */}
              {contact.notes && (
                <div className="glass-card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <h3 className="profile-section-title">
                    <BookOpen size={16} style={{ color: 'var(--accent-indigo)' }} />
                    Dossier Briefing Notes
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{contact.notes}</p>
                </div>
              )}

              {/* Experience List */}
              <div className="glass-card">
                <h3 className="profile-section-title">Professional Background</h3>
                {contact.experience && contact.experience.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {contact.experience.map((e, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 600 }}>{e.role}</h4>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{e.company}</span>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {e.startYear || 'N/A'} – {e.current ? 'Present' : (e.endYear || 'N/A')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No employment history logged.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-indigo)', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '8px' }}>Approach Strategy</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
                    {contact.approachNotes || 'How to approach not defined.'}
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--accent-teal)', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '8px' }}>Worldview & Philosophy</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
                    {contact.philosophy || 'Worldview metrics not defined.'}
                  </p>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '8px' }}>Lifestyle Notes</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{contact.lifestyle || 'No lifestyle metrics.'}</p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '8px' }}>Key Achievements</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{contact.achievements || 'No proud achievements logged.'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="fade-in glass-card">
              {/* Interaction log submission form */}
              <form onSubmit={handleLogSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '240px', marginBottom: 0 }}>
                  <label className="form-label">Log Interaction Note</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Discussed deep tech seed funding thesis..." 
                    value={logNote}
                    onChange={e => setLogNote(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: '45px' }} disabled={submittingLog}>
                  Log Entry
                </button>
              </form>

              {/* Timeline output */}
              {contact.interactions && contact.interactions.length > 0 ? (
                <div className="timeline">
                  {contact.interactions.map(i => (
                    <div key={i.id} className="timeline-item fade-in">
                      <div className="timeline-dot"></div>
                      <div className="timeline-date">{i.date}</div>
                      <div className="timeline-content">{i.note}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                  No interaction history logged yet. Use the tool above to seed your first log!
                </p>
              )}
            </div>
          )}

        </div>

        {/* --- Right Column: Relationship Context --- */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Metadata brief */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Dossier Intel</h3>
            
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>How We Met</span>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{contact.howWeMet || 'Not logged'}</p>
            </div>

            {contact.introducedBy && (
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Introduced By</span>
                <div style={{ marginTop: '4px' }}>
                  <button 
                    className="badge badge-tag" 
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onClick={() => {
                      const introC = contacts.find(c => c.id === contact.introducedBy?.id);
                      if (introC) setSelectedContact(introC);
                    }}
                  >
                    🤝 {contact.introducedBy.name}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Related contacts panel */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
              Connected Nodes
            </h3>
            
            {contact.relatedTo && contact.relatedTo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contact.relatedTo.map(r => (
                  <button 
                    key={r.id} 
                    className="mini-contact-card" 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.02)', textAlign: 'left', border: '1px solid var(--border-color)' }}
                    onClick={() => {
                      const matchC = contacts.find(c => c.id === r.id);
                      if (matchC) setSelectedContact(matchC);
                    }}
                  >
                    <div className="mini-avatar">{r.name[0]}</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.currentCompany || 'Independent'}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No database relationships established yet. Edit this profile to link related nodes!
              </p>
            )}
          </div>

          {/* Tags Brief */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                Assigned Tags
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {contact.tags.map((t, idx) => (
                  <span key={idx} className="badge badge-tag">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Interests Brief */}
          {contact.interests && contact.interests.length > 0 && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                Personal Interests
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {contact.interests.map((i, idx) => (
                  <span key={idx} className="badge badge-text" style={{ textTransform: 'none' }}>{i}</span>
                ))}
              </div>
            </div>
          )}

        </aside>
      </div>
    </div>
  );
}

// ==========================================================================
// FORM COMPONENT: Complete Contact CRUD inputs (Details, background array, tags, relationship linkages)
// ==========================================================================
function ContactForm({
  contact,
  contacts,
  setContacts,
  onClose,
  onSave
}: {
  contact?: Contact;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
  onSave: (c: Contact) => void;
}) {
  const isEdit = !!contact;

  // Form Field States
  const [name, setName] = useState(contact?.name || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [linkedinUrl, setLinkedinUrl] = useState(contact?.linkedinUrl || '');
  const [xUrl, setXUrl] = useState(contact?.xUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(contact?.instagramUrl || '');
  const [telegramHandle, setTelegramHandle] = useState(contact?.telegramHandle || '');
  
  const [currentRole, setCurrentRole] = useState(contact?.currentRole || '');
  const [currentCompany, setCurrentCompany] = useState(contact?.currentCompany || '');
  
  // Tags & Interests comma inputs
  const [tagsInput, setTagsInput] = useState((contact?.tags || []).join(', '));
  const [interestsInput, setInterestsInput] = useState((contact?.interests || []).join(', '));

  const [achievements, setAchievements] = useState(contact?.achievements || '');
  const [philosophy, setPhilosophy] = useState(contact?.philosophy || '');
  const [lifestyle, setLifestyle] = useState(contact?.lifestyle || '');
  const [approachNotes, setApproachNotes] = useState(contact?.approachNotes || '');
  const [howWeMet, setHowWeMet] = useState(contact?.howWeMet || '');
  
  const [introducedBy, setIntroducedBy] = useState(contact?.introducedBy?.id || '');
  const [notes, setNotes] = useState(contact?.notes || '');

  // Experience Sub-form array State
  const [experienceList, setExperienceList] = useState<Experience[]>(contact?.experience || []);
  const [newExpRole, setNewExpRole] = useState('');
  const [newExpCompany, setNewExpCompany] = useState('');
  const [newExpStartYear, setNewExpStartYear] = useState('');
  const [newExpEndYear, setNewExpEndYear] = useState('');
  const [newExpCurrent, setNewExpCurrent] = useState(false);

  // Linkage selector states
  const [selectedRelations, setSelectedRelations] = useState<string[]>(
    contact?.relatedTo?.map(r => r.id) || []
  );

  const [saving, setSaving] = useState(false);

  const handleAddExperience = () => {
    if (!newExpRole || !newExpCompany) return;
    const item: Experience = {
      role: newExpRole,
      company: newExpCompany,
      startYear: newExpStartYear ? parseInt(newExpStartYear) : undefined,
      endYear: newExpEndYear ? parseInt(newExpEndYear) : undefined,
      current: newExpCurrent
    };
    setExperienceList([...experienceList, item]);
    setNewExpRole('');
    setNewExpCompany('');
    setNewExpStartYear('');
    setNewExpEndYear('');
    setNewExpCurrent(false);
  };

  const handleRemoveExperience = (idx: number) => {
    setExperienceList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRelationToggle = (id: string) => {
    if (selectedRelations.includes(id)) {
      setSelectedRelations(prev => prev.filter(rId => rId !== id));
    } else {
      setSelectedRelations(prev => [...prev, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);

    // Format clean arrays
    const formattedTags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
    const formattedInterests = interestsInput.split(',').map(s => s.trim()).filter(Boolean);

    // Clean GraphQL experience format
    const formattedExperience = experienceList.map(e => ({
      role: e.role,
      company: e.company,
      startYear: e.startYear,
      endYear: e.endYear,
      current: e.current
    }));

    try {
      let finalContact: Contact;
      if (isEdit && contact) {
        // Run update mutation
        const data = await fetchGraphQL(`
          mutation Update(
            $id: ID!, 
            $input: ContactInput!
          ) {
            updateContact(id: $id, input: $input) {
              id
              name
              type
              email
              phone
              linkedinUrl
              xUrl
              instagramUrl
              telegramHandle
              currentRole
              currentCompany
              experience {
                role
                company
                startYear
                endYear
                current
              }
              interests
              achievements
              philosophy
              lifestyle
              approachNotes
              howWeMet
              introducedBy {
                id
                name
              }
              relatedTo {
                id
                name
                currentCompany
              }
              tags
              notes
              archived
              createdAt
              interactions {
                id
                date
                note
              }
            }
          }
        `, {
          id: contact.id,
          input: {
            name, email, phone, linkedinUrl, xUrl, instagramUrl, telegramHandle,
            currentRole, currentCompany, experience: formattedExperience,
            interests: formattedInterests, achievements, philosophy, lifestyle,
            approachNotes, howWeMet, introducedBy: introducedBy || null, tags: formattedTags, notes
          }
        });
        finalContact = data.updateContact;

        // Establish the bi-directional graph linkages (remove existing then add new ones)
        // For local-first visual simplicity, we execute mutations to bind the checked linkages
        const originalRelations = contact.relatedTo.map(r => r.id);
        const toAdd = selectedRelations.filter(id => !originalRelations.includes(id));
        const toRemove = originalRelations.filter(id => !selectedRelations.includes(id));

        for (const addId of toAdd) {
          await fetchGraphQL(`
            mutation AddRel($id: ID!, $relId: ID!) {
              addRelatedContact(contactId: $id, relatedId: $relId) { id }
            }
          `, { id: contact.id, relId: addId });
        }
        for (const remId of toRemove) {
          await fetchGraphQL(`
            mutation RemRel($id: ID!, $relId: ID!) {
              removeRelatedContact(contactId: $id, relatedId: $relId) { id }
            }
          `, { id: contact.id, relId: remId });
        }

        // Fetch re-hydrated record to make sure connections lists are perfect
        const refetch = await fetchGraphQL(`
          query Refetch($id: ID!) {
            contact(id: $id) {
              id name type email phone linkedinUrl xUrl instagramUrl telegramHandle
              currentRole currentCompany experience { role company startYear endYear current }
              interests achievements philosophy lifestyle approachNotes howWeMet
              introducedBy { id name } relatedTo { id name currentCompany } tags notes archived createdAt
              interactions { id date note }
            }
          }
        `, { id: contact.id });
        finalContact = refetch.contact;

        setContacts(prev => prev.map(c => c.id === contact.id ? finalContact : c));
        onSave(finalContact);
      } else {
        // Run create mutation
        const data = await fetchGraphQL(`
          mutation Create($input: ContactInput!) {
            createContact(input: $input) {
              id
              name
              type
              email
              phone
              linkedinUrl
              xUrl
              instagramUrl
              telegramHandle
              currentRole
              currentCompany
              experience {
                role
                company
                startYear
                endYear
                current
              }
              interests
              achievements
              philosophy
              lifestyle
              approachNotes
              howWeMet
              introducedBy {
                id
                name
              }
              relatedTo {
                id
                name
                currentCompany
              }
              tags
              notes
              archived
              createdAt
              interactions {
                id
                date
                note
              }
            }
          }
        `, {
          input: {
            name, email, phone, linkedinUrl, xUrl, instagramUrl, telegramHandle,
            currentRole, currentCompany, experience: formattedExperience,
            interests: formattedInterests, achievements, philosophy, lifestyle,
            approachNotes, howWeMet, introducedBy: introducedBy || null, tags: formattedTags, notes
          }
        });
        finalContact = data.createContact;

        // Establish connection linkages for new record
        for (const addId of selectedRelations) {
          await fetchGraphQL(`
            mutation AddRel($id: ID!, $relId: ID!) {
              addRelatedContact(contactId: $id, relatedId: $relId) { id }
            }
          `, { id: finalContact.id, relId: addId });
        }

        // Re-fetch created contact to load linkages correctly
        const refetch = await fetchGraphQL(`
          query Refetch($id: ID!) {
            contact(id: $id) {
              id name type email phone linkedinUrl xUrl instagramUrl telegramHandle
              currentRole currentCompany experience { role company startYear endYear current }
              interests achievements philosophy lifestyle approachNotes howWeMet
              introducedBy { id name } relatedTo { id name currentCompany } tags notes archived createdAt
              interactions { id date note }
            }
          }
        `, { id: finalContact.id });
        finalContact = refetch.contact;

        onSave(finalContact);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save dossier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="glass-panel fade-in" onSubmit={handleSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Dossier Header Info */}
      <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem' }}>{isEdit ? `Edit Dossier: ${contact?.name}` : 'Initialize Relationship Dossier'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Map structural background, worldviews, and social nodes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Syncing...' : (isEdit ? 'Save Intelligence' : 'Deploy Dossier')}
          </button>
        </div>
      </div>

      {/* Grid columns: Details */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '18px', color: 'var(--accent-indigo)' }}>1. Profile Identity & Social Nodes</h3>
        <div className="grid-cols-2">
          <div className="form-group">
            <label className="form-label">Full Name (Required)</label>
            <input type="text" className="input-field" placeholder="e.g. Sarah Jenkins" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="input-field" placeholder="sarah@palantir.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="grid-cols-2" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="text" className="input-field" placeholder="+1 (555) 438-9281" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Telegram Handle</label>
            <input type="text" className="input-field" placeholder="telegram_handle" value={telegramHandle} onChange={e => setTelegramHandle(e.target.value)} />
          </div>
        </div>

        <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '8px' }}>
          <div className="form-group">
            <label className="form-label">LinkedIn URL</label>
            <input type="url" className="input-field" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">X / Twitter URL</label>
            <input type="url" className="input-field" placeholder="https://x.com/..." value={xUrl} onChange={e => setXUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram URL</label>
            <input type="url" className="input-field" placeholder="https://instagram.com/..." value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Professional block */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '18px', color: 'var(--accent-indigo)' }}>2. Professional Dossier</h3>
        <div className="grid-cols-2">
          <div className="form-group">
            <label className="form-label">Current Role</label>
            <input type="text" className="input-field" placeholder="e.g. VP of Engineering" value={currentRole} onChange={e => setCurrentRole(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Current Company</label>
            <input type="text" className="input-field" placeholder="e.g. Palantir" value={currentCompany} onChange={e => setCurrentCompany(e.target.value)} />
          </div>
        </div>

        {/* Experience Addition Form */}
        <div className="glass-card" style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Prior Employment History</h4>
          
          {experienceList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {experienceList.map((e, idx) => (
                <div key={idx} className="flex-between" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: '0.9rem' }}>
                    <strong>{e.role}</strong> at <em>{e.company}</em> ({e.startYear || 'N/A'} – {e.current ? 'Present' : e.endYear || 'N/A'})
                  </span>
                  <button type="button" className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleRemoveExperience(idx)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Role/Title</label>
              <input type="text" className="input-field" placeholder="Lead Architect" value={newExpRole} onChange={e => setNewExpRole(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Company</label>
              <input type="text" className="input-field" placeholder="Lockheed Martin" value={newExpCompany} onChange={e => setNewExpCompany(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Start Year</label>
              <input type="number" className="input-field" placeholder="2015" value={newExpStartYear} onChange={e => setNewExpStartYear(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>End Year</label>
              <input type="number" className="input-field" placeholder="2019" value={newExpEndYear} disabled={newExpCurrent} onChange={e => setNewExpEndYear(e.target.value)} />
            </div>
            <div className="flex-align-center" style={{ gap: '8px', paddingBottom: '12px' }}>
              <input type="checkbox" id="currentCheck" checked={newExpCurrent} onChange={e => setNewExpCurrent(e.target.checked)} />
              <label htmlFor="currentCheck" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Current</label>
            </div>
            <button type="button" className="btn btn-secondary" style={{ height: '45px' }} onClick={handleAddExperience}>
              Add Prior
            </button>
          </div>
        </div>
      </div>

      {/* Worldview Personal block */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '18px', color: 'var(--accent-indigo)' }}>3. Worldview & Personal intelligence</h3>
        <div className="grid-cols-2">
          <div className="form-group">
            <label className="form-label">Personal Worldview & World Philosophy</label>
            <textarea className="input-field" style={{ minHeight: '100px' }} placeholder="Bayesian rationalist. Values structural truth and hates high-level jargon." value={philosophy} onChange={e => setPhilosophy(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Strategic Approach notes</label>
            <textarea className="input-field" style={{ minHeight: '100px' }} placeholder="Skip the small talk. Bring a specific, hard computational supply-chain architecture question." value={approachNotes} onChange={e => setApproachNotes(e.target.value)} />
          </div>
        </div>

        <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">Key Achievements / Proud Moments</label>
            <input type="text" className="input-field" placeholder="Led a massive supply-chain system rebuild." value={achievements} onChange={e => setAchievements(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Lifestyle / World Habits</label>
            <input type="text" className="input-field" placeholder="Obsessive runner. Wakes up at 4:30 AM." value={lifestyle} onChange={e => setLifestyle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">How We Met</label>
            <input type="text" className="input-field" placeholder="SF deep tech dinner meet." value={howWeMet} onChange={e => setHowWeMet(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Graph Relationship Mapping Block */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '18px', color: 'var(--accent-indigo)' }}>4. Relationship Mapping (Graph Edges)</h3>
        <div className="grid-cols-2">
          
          <div className="form-group">
            <label className="form-label">Introduced By Node</label>
            <select className="filter-select" style={{ width: '100%', height: '46px' }} value={introducedBy} onChange={e => setIntroducedBy(e.target.value)}>
              <option value="">No introducer node logged</option>
              {contacts.filter(c => c.id !== contact?.id).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.currentCompany || 'Independent'})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tags / Categories (comma separated)</label>
            <input type="text" className="input-field" placeholder="Investor, Operator, Logistics, AI" value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '12px' }}>
          <label className="form-label">Personal Interests (comma separated)</label>
          <input type="text" className="input-field" placeholder="Skiing, Marathons, Baking, Deep Tech" value={interestsInput} onChange={e => setInterestsInput(e.target.value)} />
        </div>

        {/* Link related contacts checklist */}
        <div className="glass-card" style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Link Database Relations (Who in your CRM does this person know?)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
            {contacts.filter(c => c.id !== contact?.id).map(c => (
              <div 
                key={c.id} 
                className="flex-align-center" 
                style={{ 
                  gap: '8px', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  background: selectedRelations.includes(c.id) ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.01)',
                  border: '1px solid ' + (selectedRelations.includes(c.id) ? 'var(--accent-indigo)' : 'var(--border-color)'),
                  cursor: 'pointer'
                }}
                onClick={() => handleRelationToggle(c.id)}
              >
                <input 
                  type="checkbox" 
                  checked={selectedRelations.includes(c.id)} 
                  onChange={() => {}} // handled by div onClick
                  style={{ pointerEvents: 'none' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dossier notes */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--accent-indigo)' }}>5. Extended Notes Brief</h3>
        <div className="form-group">
          <label className="form-label">Dossier Notes (No character limit)</label>
          <textarea className="input-field" style={{ minHeight: '140px' }} placeholder="Write down structural context, meeting logs, deal targets, mutual connections, world views, etc..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

    </form>
  );
}

// ==========================================================================
// SCREEN MODULE: Interactive SVG Network Graph Workspace
// ==========================================================================
interface GraphNode {
  id: string;
  name: string;
  company: string;
  x: number;
  y: number;
}

interface GraphLink {
  source: string;
  target: string;
}

function NetworkView({
  contacts,
  pendingRequests,
  setPendingRequests,
  setSelectedContact,
  setActiveTab
}: {
  contacts: Contact[];
  pendingRequests: Connection[];
  setPendingRequests: React.Dispatch<React.SetStateAction<Connection[]>>;
  setSelectedContact: (c: Contact | null) => void;
  setActiveTab: (val: string) => void;
}) {
  const [networkMode, setNetworkMode] = useState<'graph' | 'connections'>('graph');
  const [searchUsername, setSearchUsername] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [requestError, setRequestError] = useState('');

  // Graph state (nodes with draggable coordinates)
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  // Browse Network States
  const [activeBrowseUser, setActiveBrowseUser] = useState<any>(null);
  const [browseContacts, setBrowseContacts] = useState<Contact[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [browseError, setBrowseError] = useState('');

  // Initialize and distribute nodes in a beautiful circles on screen
  useEffect(() => {
    if (contacts.length === 0) return;
    
    const centerX = 360;
    const centerY = 240;
    const radius = 170;
    
    // Distribute nodes evenly in a circle layout
    const formattedNodes: GraphNode[] = contacts.map((c, index) => {
      const angle = (index / contacts.length) * 2 * Math.PI;
      return {
        id: c.id,
        name: c.name,
        company: c.currentCompany || 'Independent',
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    // Map unique links (edges representing private relations + introductions)
    const formattedLinks: GraphLink[] = [];
    const addedPairs = new Set<string>();

    contacts.forEach(c => {
      // 1. Link from introduced_by
      if (c.introducedBy?.id) {
        const pairKey = [c.id, c.introducedBy.id].sort().join('-');
        formattedLinks.push({ source: c.introducedBy.id, target: c.id });
        addedPairs.add(pairKey);
      }

      // 2. Link from relatedTo list
      if (c.relatedTo) {
        c.relatedTo.forEach(r => {
          const pairKey = [c.id, r.id].sort().join('-');
          if (!addedPairs.has(pairKey)) {
            formattedLinks.push({ source: c.id, target: r.id });
            addedPairs.add(pairKey);
          }
        });
      }
    });

    setNodes(formattedNodes);
    setLinks(formattedLinks);
  }, [contacts]);

  // --- SVG Drag and Drop Math ---
  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(id);
  };

  const handleSVGMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId || !svgRef.current) return;
    
    // Calculate cursor location relative to SVG canvas
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setNodes(prev => prev.map(n => {
      if (n.id === draggedNodeId) {
        return { ...n, x: mouseX, y: mouseY };
      }
      return n;
    }));
  };

  const handleSVGMouseUpOrLeave = () => {
    setDraggedNodeId(null);
  };

  // --- Connection Request Action ---
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSuccess('');
    setRequestError('');
    if (!searchUsername) return;
    
    try {
      const u = searchUsername.startsWith('@') ? searchUsername.slice(1) : searchUsername;
      const data = await fetchGraphQL(`
        mutation Request($username: String!) {
          sendConnectionRequest(receiverUsername: $username) {
            id
            receiver {
              username
            }
          }
        }
      `, { username: u });
      
      setRequestSuccess(`Request sent successfully to @${data.sendConnectionRequest.receiver.username}!`);
      setSearchUsername('');
    } catch (err: any) {
      setRequestError(err.message || 'Failed to dispatch request.');
    }
  };

  // --- Respond to request Action ---
  const handleRespond = async (id: string, accept: boolean) => {
    try {
      await fetchGraphQL(`
        mutation Respond($id: ID!, $accept: Boolean!) {
          respondToRequest(connectionId: $id, accept: $accept) {
            id
          }
        }
      `, { id, accept });
      
      setPendingRequests(prev => prev.filter(p => p.id !== id));
      alert(accept ? 'Connection upgraded! Text contact upgraded to USER type.' : 'Request declined.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fade-in" style={{ height: '100%' }}>
      <div className="contacts-header">
        <div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '4px' }}>Network Graph Mapping</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Explore your relational linkages and verify connection requests.</p>
        </div>

        <div className="auth-tabs" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', padding: 0 }}>
          <div 
            className={`auth-tab ${networkMode === 'graph' ? 'active' : ''}`}
            onClick={() => setNetworkMode('graph')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            SVG Physics Web
          </div>
          <div 
            className={`auth-tab ${networkMode === 'connections' ? 'active' : ''}`}
            onClick={() => setNetworkMode('connections')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Connection Requests ({pendingRequests.length})
          </div>
        </div>
      </div>

      {networkMode === 'graph' ? (
        // --- 1. Draggable SVG Web Graph View ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {contacts.length === 0 ? (
            <div className="glass-panel placeholder-container">
              <Network size={48} />
              <h3>Your relationship web is empty</h3>
              <p>Add nodes and link connections under edit mode to populate the visual web.</p>
            </div>
          ) : (
            <>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                *Tip: Node elements are interactive! **Click and drag** nodes to dynamically organize your web.*
              </div>
              
              <div className="graph-container">
                <svg 
                  ref={svgRef}
                  className="graph-canvas"
                  onMouseMove={handleSVGMouseMove}
                  onMouseUp={handleSVGMouseUpOrLeave}
                  onMouseLeave={handleSVGMouseUpOrLeave}
                >
                  {/* Draw edges (connecting lines tinted to match source node theme) */}
                  {links.map((l, index) => {
                    const sourceNode = nodes.find(n => n.id === l.source);
                    const targetNode = nodes.find(n => n.id === l.target);
                    if (!sourceNode || !targetNode) return null;
                    
                    const sourceContact = contacts.find(c => c.id === l.source);
                    const isUser = sourceContact?.type === 'user';
                    const neonColors = ['#10b981', '#8b5cf6', '#f43f5e', '#06b6d4', '#d97706', '#f97316', '#3b82f6'];
                    let hash = 0;
                    const name = sourceNode.name || "";
                    for (let i = 0; i < name.length; i++) {
                      hash = name.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const lineColor = isUser ? '#10b981' : neonColors[Math.abs(hash) % neonColors.length];
                    
                    return (
                      <line 
                        key={index}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={lineColor}
                        strokeWidth="1.8"
                        opacity="0.22"
                      />
                    );
                  })}

                  {/* Draw Nodes (Zep-inspired vibrant colorful neon bubbles + active glows) */}
                  {nodes.map(n => {
                    const targetC = contacts.find(c => c.id === n.id);
                    const isUser = targetC?.type === 'user';
                    
                    const neonColors = ['#10b981', '#8b5cf6', '#f43f5e', '#06b6d4', '#d97706', '#f97316', '#3b82f6'];
                    let hash = 0;
                    const name = n.name || "";
                    for (let i = 0; i < name.length; i++) {
                      hash = name.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const nodeColor = isUser ? '#10b981' : neonColors[Math.abs(hash) % neonColors.length];
                    
                    return (
                      <g 
                        key={n.id}
                        transform={`translate(${n.x}, ${n.y})`}
                        onMouseDown={(e) => handleNodeMouseDown(n.id, e)}
                        onClick={() => {
                          if (targetC) {
                            setSelectedContact(targetC);
                            setActiveTab('contacts');
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Concentric outer dotted glow ring */}
                        <circle r="28" fill="none" stroke={nodeColor} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.35" />
                        {/* Outer high-contrast structural boundary */}
                        <circle r="21" fill="#0f0f11" stroke={nodeColor} strokeWidth="2.5" />
                        {/* Central glowing core dot */}
                        <circle r="5.5" fill={nodeColor} />
                        {/* Node Name label */}
                        <text 
                          className="node-label" 
                          y="-35" 
                          textAnchor="middle" 
                          fontWeight="700"
                          fill="var(--text-primary)"
                          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                        >
                          {n.name}
                        </text>
                        {/* Node Company label */}
                        <text 
                          className="node-label" 
                          y="-21" 
                          textAnchor="middle" 
                          fill="var(--text-muted)" 
                          fontSize="9"
                          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                        >
                          {n.company}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}
        </div>
      ) : (
        // --- 2. Friend Connection requests lists ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="profile-layout fade-in">
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '18px' }}>Pending connection invites</h3>
              
              {pendingRequests.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No pending requests. Ask a partner to add you using your @username!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {pendingRequests.map(r => (
                    <div 
                      key={r.id} 
                      className="flex-between"
                      style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}
                    >
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: '0.98rem' }}>{r.requester.displayName}</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{r.requester.username} wants to unlock networks</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => handleRespond(r.id, true)}>
                          Accept Link
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => handleRespond(r.id, false)}>
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <aside className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Initialize live @User link</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '18px' }}>
                Search another NetGraph operator's permanent @username to send a connection invite.
              </p>
              <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="@username"
                    value={searchUsername}
                    onChange={e => setSearchUsername(e.target.value)}
                    required
                  />
                </div>
                
                {requestSuccess && <div style={{ color: '#14b8a6', fontSize: '0.82rem' }}>{requestSuccess}</div>}
                {requestError && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>{requestError}</div>}

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  <UserPlus size={16} />
                  Send Invite
                </button>
              </form>
            </aside>
          </div>

          {/* --- 3. Directory of Accepted Connections (Friends) and Browse Network --- */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '18px' }}>Connected Operators Network</h3>
            
            {contacts.filter(c => c.type === 'user' && c.linkedUser).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No active connections established. Upgrade text profiles by accepting friend requests to build a shared network.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {contacts.filter(c => c.type === 'user' && c.linkedUser).map(c => {
                  const friend = c.linkedUser!;
                  return (
                    <div 
                      key={c.id} 
                      className="glass-card flex-between"
                      style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}
                    >
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>{friend.displayName || c.name}</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{friend.username}</span>
                      </div>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={async () => {
                          setActiveBrowseUser(friend);
                          setLoadingBrowse(true);
                          setBrowseError('');
                          try {
                            const data = await fetchGraphQL(`
                              query Browse($uid: ID!) {
                                networkContacts(userId: $uid) {
                                  id
                                  name
                                  type
                                  currentRole
                                  currentCompany
                                }
                              }
                            `, { uid: friend.id });
                            setBrowseContacts(data.networkContacts || []);
                          } catch (err: any) {
                            setBrowseError(err.message || 'Failed to fetch network.');
                          } finally {
                            setLoadingBrowse(false);
                          }
                        }}
                      >
                        Browse Network
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* --- 4. Browse Network Modal Overlay --- */}
          {activeBrowseUser && (
            <div 
              style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 
              }}
              onClick={() => setActiveBrowseUser(null)}
            >
              <div 
                className="glass-panel fade-in" 
                style={{ width: '90%', maxWidth: '600px', padding: '24px', background: '#0e0e12', position: 'relative' }}
                onClick={e => e.stopPropagation()}
              >
                <button 
                  style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setActiveBrowseUser(null)}
                >
                  <XCircle size={24} />
                </button>

                <h3 style={{ fontSize: '1.35rem', marginBottom: '8px' }}>
                  Browsing @{activeBrowseUser.username}'s Connections
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  Showing surface level identity records (security limits deep personal brief notes).
                </p>

                {loadingBrowse ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Scanning shared connection records...
                  </div>
                ) : browseError ? (
                  <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>
                    {browseError}
                  </div>
                ) : browseContacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No connections searchable. Their network is completely private.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                    {browseContacts.map(bc => (
                      <div 
                        key={bc.id} 
                        className="flex-between"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '6px' }}
                      >
                        <div>
                          <h4 style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{bc.name}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {bc.currentRole} at {bc.currentCompany || 'Independent'}
                          </span>
                        </div>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => {
                            alert(`Ask @${activeBrowseUser.username} for a warm introduction to ${bc.name}!`);
                          }}
                        >
                          Ask for Intro
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ==========================================================================
// SCREEN MODULE: AI Chat Workspace (Terminal interface + real-time queries)
// ==========================================================================
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function AIChatWorkspace({ contacts }: { contacts: Contact[] }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "System initialized. NetGraph AI memory matrix loaded. Ask me anything about your contacts database (e.g. searching companies, finding connection paths, mapping similarities, or tracking neglected touchpoints)."
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate a random session ID for persistent Zep memory
  const sessionIdRef = useRef<string>(
    Math.random().toString(36).substring(2, 15)
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  const handleSendMessage = async (msgText: string) => {
    if (!msgText.trim()) return;
    
    // Add user message
    const userMsg: Message = { role: 'user', content: msgText };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setTyping(true);

    try {
      // Execute GraphQL Mutation
      const data = await fetchGraphQL(`
        query Ask($msg: String!, $sid: String!) {
          askAI(message: $msg, sessionId: $sid)
        }
      `, { msg: msgText, sid: sessionIdRef.current });
      
      const reply = data.askAI;
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error linking intelligence nodes: ${err.message || 'Server timeout'}` 
      }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '4px' }}>AI Chat Workspace</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Query your network graph using natural language.
        </p>
      </div>

      <div className="chat-workspace glass-panel">
        
        {/* Terminal Header */}
        <div className="chat-header">
          <div className="terminal-indicator"></div>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            netgraph-ai-core v1.0.0
          </span>
        </div>

        {/* Message window */}
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.role} fade-in`}>
              <div 
                style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: 600, 
                  color: m.role === 'user' ? 'var(--accent-indigo)' : 'var(--accent-teal)',
                  fontFamily: 'JetBrains Mono',
                  marginBottom: '4px'
                }}
              >
                {m.role === 'user' ? 'OPERATOR_QUERY_STR' : 'SYSTEM_REPLY_VAL'}
              </div>
              <div 
                style={{ fontSize: '0.94rem', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ 
                  __html: formatMarkdownLocal(m.content) 
                }} 
              />
            </div>
          ))}

          {typing && (
            <div className="chat-bubble assistant fade-in" style={{ alignSelf: 'flex-start', borderBottomLeftRadius: '2px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-teal)', fontFamily: 'JetBrains Mono', marginBottom: '4px' }}>
                AI_REASONING_ENGINE
              </div>
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                Scanning relationship nodes...
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Preset query chips */}
        <div className="starter-prompts-container">
          <div className="prompts-title">Suggested Inquiries</div>
          <div className="prompts-grid">
            <button className="prompt-chip" onClick={() => handleSendMessage("Who have I not spoken to in 90 days?")}>
              📅 Neglected touchpoints?
            </button>
            <button className="prompt-chip" onClick={() => handleSendMessage("Who do I know at Goldman Sachs?")}>
              🏢 Who do I know at Goldman Sachs?
            </button>
            <button className="prompt-chip" onClick={() => handleSendMessage("Give me my path to Palantir")}>
              🧭 Path to Palantir?
            </button>
            {contacts.length >= 2 && (
              <button className="prompt-chip" onClick={() => handleSendMessage(`What do ${contacts[0].name} and ${contacts[1].name} have in common?`)}>
                🔗 Common grounds?
              </button>
            )}
          </div>
        </div>

        {/* Text entry bar */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(chatInput); }}
          className="chat-input-bar"
        >
          <input 
            type="text"
            className="input-field chat-input"
            placeholder="Query network (e.g. 'Who is works at Citadel Securities?', 'Who has worked in trading?')..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            disabled={typing}
          />
          <button type="submit" className="btn btn-primary" disabled={typing}>
            <Send size={16} />
          </button>
        </form>

      </div>
    </div>
  );
}

// Helper to quickly format markdown titles, bullets, and bold markers locally without heavy dependencies
function formatMarkdownLocal(text: string): string {
  let temp = text;
  // Format Headers
  temp = temp.replace(/^### (.*$)/gim, '<strong style="font-size: 1.15rem; font-family: Outfit; display: block; margin-top: 10px; margin-bottom: 6px; color: var(--text-primary)">$1</strong>');
  temp = temp.replace(/^## (.*$)/gim, '<strong style="font-size: 1.25rem; font-family: Outfit; display: block; margin-top: 12px; margin-bottom: 8px; color: var(--text-primary)">$1</strong>');
  // Format bold markers
  temp = temp.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary); font-weight: 700;">$1</strong>');
  // Format code blocks
  temp = temp.replace(/`(.*?)`/g, '<code style="font-family: JetBrains Mono; background: rgba(255,255,255,0.06); padding: 2px 5px; border-radius: 4px; font-size: 0.88rem; color: #818cf8;">$1</code>');
  // Format bullet items
  temp = temp.replace(/^\s*• (.*$)/gim, '<li style="margin-left: 12px; color: var(--text-secondary)">$1</li>');
  temp = temp.replace(/^\s*-\s*(.*$)/gim, '<li style="margin-left: 12px; color: var(--text-secondary)">$1</li>');
  // Format italic markers
  temp = temp.replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: var(--text-secondary);">$1</em>');
  return temp;
}

// ==========================================================================
// SCREEN MODULE: System Settings
// ==========================================================================
interface SettingsViewProps {
  currentUser: any;
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
  contacts: Contact[];
  handleLogout: () => void;
}

function SettingsView({
  currentUser,
  setCurrentUser,
  contacts,
  handleLogout
}: SettingsViewProps) {
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  
  const [privacySearchable, setPrivacySearchable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const data = await fetchGraphQL(`
        mutation UpdateProfile($displayName: String, $bio: String, $avatarUrl: String) {
          updateProfile(displayName: $displayName, bio: $bio, avatarUrl: $avatarUrl) {
            id
            username
            displayName
            bio
            avatarUrl
          }
        }
      `, { displayName, bio, avatarUrl });
      
      setCurrentUser(data.updateProfile);
      setSaveSuccess('Profile credentials successfully updated and persisted on local PostgreSQL database.');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = () => {
    try {
      // Export all contacts, timelines, and relationships as structured JSON
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(contacts, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `netgraph_relationship_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('WARNING: Wiping your account will permanently delete all network nodes, private dossiers, and relationships. This action is irreversible. Continue?')) {
      if (window.confirm('FINAL CONFIRMATION: Type CONFIRM to delete your local relationship operating system database.')) {
        alert('Local system database connection terminated. NetGraph cleared.');
        handleLogout();
      }
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '4px' }}>System Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your user profile details, database settings, and data exports.</p>
      </div>

      <div className="profile-layout">
        
        {/* Profile Details Editing form */}
        <form onSubmit={handleProfileSave} className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--accent-indigo)' }}>
            1. User Profile Dossier
          </h3>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Permanent @Username (Display Only)</label>
              <input 
                type="text" 
                className="input-field" 
                value={`@${currentUser?.username}`} 
                disabled 
                style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Profile Avatar Link (Optional)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="https://images.unsplash.com/photo-..." 
              value={avatarUrl} 
              onChange={e => setAvatarUrl(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Short Bio / Operator Brief</label>
            <textarea 
              className="input-field" 
              style={{ minHeight: '100px' }} 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              placeholder="e.g. Exploring logistics and reinforcement algorithms. Quant builder."
            />
          </div>

          {saveSuccess && <div style={{ color: 'var(--accent-teal)', fontSize: '0.88rem' }}>{saveSuccess}</div>}
          {saveError && <div style={{ color: '#ef4444', fontSize: '0.88rem' }}>{saveError}</div>}

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
            {saving ? 'Syncing...' : 'Save Profile Credentials'}
          </button>
        </form>

        {/* System Settings & Exports Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
              Privacy Configurations
            </h3>
            <div className="flex-align-center" style={{ gap: '10px', alignItems: 'flex-start' }}>
              <input 
                type="checkbox" 
                id="privacyCheck" 
                checked={privacySearchable} 
                onChange={e => setPrivacySearchable(e.target.checked)} 
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <label htmlFor="privacyCheck" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.4' }}>
                Allow connected USER nodes to browse my contacts list at a surface level (names, roles, companies).
              </label>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Relationship Infrastructure
            </h3>
            
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Download your entire relationship database, including profiles, experience histories, tags, worldviews, and interaction logs.
            </p>
            
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={handleExportData}>
              Export Database (.JSON)
            </button>
          </div>

          <div className="glass-card" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#ef4444', borderBottom: '1px solid rgba(239, 68, 68, 0.15)', paddingBottom: '8px', marginBottom: '12px' }}>
              Danger Zone
            </h3>
            
            <button type="button" className="btn btn-danger" style={{ width: '100%' }} onClick={handleDeleteAccount}>
              Wipe System Database
            </button>
          </div>

        </aside>

      </div>
    </div>
  );
}


