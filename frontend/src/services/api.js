/**
 * API Service for IPL Auction Arena
 * Provides dynamic backend resolution for simultaneous PC and mobile access,
 * and strongly typed REST communication with token injection and diagnostic errors.
 */

import { MOCK_ROOMS } from '../data/mockRooms';

export const getBackendUrl = () => {
  // 1. Explicit environment variable takes precedence if provided
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location;
    if (protocol === 'file:') {
      return 'http://localhost:5000';
    }

    // 2. Vite dev server (e.g., port 5173, 5174, 3000)
    // Dev server runs separately from Node backend on port 5000
    if (port === '5173' || port === '5174' || port === '3000') {
      const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';
      return isLoopback ? 'http://localhost:5000' : `${protocol}//${hostname}:5000`;
    }

    // 3. Unified Production Deployment (Render, Railway, Fly.io, or production Express server)
    // Frontend is served by Express on standard HTTP/HTTPS ports (or reverse proxy)
    return window.location.origin;
  }

  return 'http://localhost:5000';
};

const getHeaders = (token = null, isJson = true) => {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ipl_auth_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { message: await response.text() };
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      // Token expired or invalid
      localStorage.removeItem('ipl_auth_token');
      localStorage.removeItem('ipl_auth_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorMsg = data?.message || data?.error || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function request(path, options = {}) {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}${path}`;
  try {
    const res = await fetch(url, options);
    return await handleResponse(res);
  } catch (err) {
    if (err.name === 'TypeError' && (err.message === 'Failed to fetch' || err.message?.includes('fetch') || err.message?.includes('NetworkError'))) {
      const friendlyErr = new Error(
        `Unable to reach backend server at ${backendUrl}. Please ensure the backend server is running on port 5000.`
      );
      friendlyErr.original = err;
      friendlyErr.status = 0;
      throw friendlyErr;
    }
    throw err;
  }
}

export const api = {
  getBackendUrl,

  // Health
  async getHealth() {
    return request('/api/health', {
      headers: getHeaders(null, false)
    });
  },

  // Direct Guest Session (play without login/signup)
  async getOrCreateGuestSession({ guestId, sessionSecret, displayName, favoriteTeam }) {
    return request('/api/auth/guest-session', {
      method: 'POST',
      headers: getHeaders(null, true),
      body: JSON.stringify({ guestId, sessionSecret, displayName, favoriteTeam })
    });
  },

  async getMe(token = null) {
    return request('/api/auth/me', {
      headers: getHeaders(token)
    });
  },

  // Rooms
  async listRooms() {
    try {
      return await request('/api/rooms', {
        headers: getHeaders()
      });
    } catch (err) {
      // Offline fallback for preview and demo testing
      const list = Object.values(MOCK_ROOMS).map((r) => ({
        roomCode: r.roomCode,
        roomName: r.roomName,
        hostName: r.hostName,
        isPrivate: r.isPrivate,
        status: r.status,
        participantCount: r.participants?.length || 0,
        claimedFranchisesCount: r.franchises?.filter((f) => f.claimedBy)?.length || 0,
        totalFranchises: 10,
        settings: r.settings
      }));
      return { success: true, count: list.length, data: list };
    }
  },

  async getRoom(roomCode) {
    const code = (roomCode || '').toUpperCase();
    try {
      return await request(`/api/rooms/${code}`, {
        headers: getHeaders()
      });
    } catch (err) {
      if (MOCK_ROOMS[code]) {
        return { success: true, data: MOCK_ROOMS[code] };
      }
      throw err;
    }
  },

  async createRoom(roomData) {
    return request('/api/rooms', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(roomData)
    });
  },

  async joinRoom(roomCode, passcode = null, displayName = null) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ passcode, displayName })
    });
  },

  async claimFranchise(roomCode, franchiseCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/claim`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ franchiseCode: franchiseCode.toUpperCase() })
    });
  },

  async releaseFranchise(roomCode, franchiseCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/release`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ franchiseCode: franchiseCode.toUpperCase() })
    });
  },

  async updateRoomSettings(roomCode, { settings, rebuildQueue = false }) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ settings, rebuildQueue })
    });
  },

  async startAuction(roomCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/start`, {
      method: 'POST',
      headers: getHeaders()
    });
  },

  async pauseAuction(roomCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/pause`, {
      method: 'POST',
      headers: getHeaders()
    });
  },

  async resumeAuction(roomCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/resume`, {
      method: 'POST',
      headers: getHeaders()
    });
  },

  async correctSale(roomCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/correct-sale`, {
      method: 'POST',
      headers: getHeaders()
    });
  },

  async endAuction(roomCode) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/end`, {
      method: 'POST',
      headers: getHeaders()
    });
  },

  async previewPlayerPool(settings = {}) {
    return request('/api/rooms/preview-pool', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ settings })
    });
  },

  async getRoomEligiblePlayers(roomCode, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `/api/rooms/${roomCode.toUpperCase()}/eligible-players${query ? `?${query}` : ''}`;
    return request(url, {
      headers: getHeaders()
    });
  },

  async updateRoomPlayerPool(roomCode, payload) {
    return request(`/api/rooms/${roomCode.toUpperCase()}/player-pool`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
  },

  // Teams & Players Master Data
  async getTeams() {
    return request('/api/teams', {
      headers: getHeaders()
    });
  },

  async getPlayers(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `/api/players${query ? `?${query}` : ''}`;
    return request(url, {
      headers: getHeaders()
    });
  }
};
