import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

// Generate a random stable guest identity if not already present
const getOrCreateLocalGuestId = () => {
  if (typeof window === 'undefined') return 'guest_default';
  let gid = localStorage.getItem('ipl_guest_id');
  if (!gid) {
    gid = `guest_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    localStorage.setItem('ipl_guest_id', gid);
  }
  return gid;
};

const getLocalGuestSecret = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ipl_guest_secret') || null;
};

export const AuthProvider = ({ children }) => {
  const [guestId, setGuestId] = useState(getOrCreateLocalGuestId);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ipl_auth_user');
      if (saved) return JSON.parse(saved);
      const name = localStorage.getItem('ipl_manager_name') || 'Manager';
      const team = localStorage.getItem('ipl_favorite_team') || 'CSK';
      return { _id: null, guestId: getOrCreateLocalGuestId(), name, favoriteTeam: team, isGuest: true };
    } catch (e) {
      return { _id: null, guestId: getOrCreateLocalGuestId(), name: 'Manager', favoriteTeam: 'CSK', isGuest: true };
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('ipl_auth_token') || null;
    } catch (e) {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // Initialize or restore guest session with server
  const initSession = useCallback(async (customName = null, customTeam = null) => {
    let gid = getOrCreateLocalGuestId();
    let secret = getLocalGuestSecret();
    const displayName = customName || localStorage.getItem('ipl_manager_name') || user?.name || 'Manager';
    const favoriteTeam = customTeam || localStorage.getItem('ipl_favorite_team') || user?.favoriteTeam || 'CSK';

    try {
      const res = await api.getOrCreateGuestSession({
        guestId: gid,
        sessionSecret: secret,
        displayName,
        favoriteTeam
      });

      if (res.success && res.data && res.data.token) {
        const u = res.data.user || res.data;
        setToken(res.data.token);
        setUser(u);
        if (res.data.guestId) {
          setGuestId(res.data.guestId);
          localStorage.setItem('ipl_guest_id', res.data.guestId);
        }
        if (res.data.sessionSecret) {
          localStorage.setItem('ipl_guest_secret', res.data.sessionSecret);
        }
        localStorage.setItem('ipl_auth_token', res.data.token);
        localStorage.setItem('ipl_auth_user', JSON.stringify(u));
        localStorage.setItem('ipl_manager_name', u.name);
        localStorage.setItem('ipl_favorite_team', u.favoriteTeam);
        return { token: res.data.token, user: u };
      }
    } catch (err) {
      // If unauthorized due to stale/invalid guestId, clear stale identity and generate fresh session
      if (err.message && (err.message.includes('Unauthorized') || err.message.includes('UNAUTHORIZED_GUEST_ACCESS'))) {
        console.warn('Stale guest session detected; provisioning fresh secure identity...');
        localStorage.removeItem('ipl_guest_id');
        localStorage.removeItem('ipl_guest_secret');
        localStorage.removeItem('ipl_auth_token');
        const freshGid = getOrCreateLocalGuestId();
        try {
          const freshRes = await api.getOrCreateGuestSession({
            guestId: freshGid,
            displayName,
            favoriteTeam
          });
          if (freshRes.success && freshRes.data) {
            const u = freshRes.data.user || freshRes.data;
            setToken(freshRes.data.token);
            setUser(u);
            if (freshRes.data.sessionSecret) {
              localStorage.setItem('ipl_guest_secret', freshRes.data.sessionSecret);
            }
            localStorage.setItem('ipl_auth_token', freshRes.data.token);
            localStorage.setItem('ipl_auth_user', JSON.stringify(u));
            return { token: freshRes.data.token, user: u };
          }
        } catch (_) {}
      }
      console.warn('Guest session init offline fallback:', err.message);
    } finally {
      setIsLoading(false);
    }

    return null;
  }, [user]);

  useEffect(() => {
    initSession();
  }, []);

  // Update manager display name across session and localStorage
  const updateDisplayName = async (newName) => {
    const clean = (newName || '').trim().slice(0, 50);
    if (!clean) return;
    localStorage.setItem('ipl_manager_name', clean);
    setUser((prev) => ({ ...prev, name: clean }));
    await initSession(clean);
  };

  // Update favorite franchise
  const updateFavoriteTeam = async (newTeam) => {
    if (!newTeam) return;
    localStorage.setItem('ipl_favorite_team', newTeam);
    setUser((prev) => ({ ...prev, favoriteTeam: newTeam }));
    await initSession(null, newTeam);
  };

  // Ensure session has desired display name before room creation/joining
  const ensureSession = async (desiredName, desiredTeam) => {
    const name = (desiredName || '').trim();
    if (name && name !== user?.name) {
      return await initSession(name, desiredTeam);
    }
    if (!token) {
      return await initSession(desiredName, desiredTeam);
    }
    return { token, user };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        guestId,
        isAuthenticated: true, // Always directly authenticated as guest manager
        isLoading,
        setUser,
        initSession,
        updateDisplayName,
        updateFavoriteTeam,
        ensureSession,
        login: async () => {},
        register: async () => {},
        logout: () => {
          localStorage.removeItem('ipl_manager_name');
          initSession('Manager');
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
