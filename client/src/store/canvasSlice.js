import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  elements: {}, // Keyed by element ID for fast O(1) lookup & updates
  elementOrder: [], // Array of element IDs for z-order rendering
  selectedElementId: null,
  activeTool: 'pencil', // 'select', 'pencil', 'eraser', 'rectangle', 'circle', 'text', 'line', 'arrow'
  toolSettings: {
    strokeColor: '#6366f1',
    fillColor: 'transparent',
    strokeWidth: 3,
    fontSize: 20
  },
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0
  },
  activeUsers: [],
  peerCursors: {}, // userId -> { x, y, username, color, lastMoved }
  latency: 0,
  isConnected: false,
  isOffline: !navigator.onLine,
  lastConflictResolved: null
};

export const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    setElements: (state, action) => {
      const elementsArray = action.payload || [];
      state.elements = {};
      state.elementOrder = [];
      elementsArray.forEach((el) => {
        if (el && el.id && !el.isDeleted) {
          state.elements[el.id] = el;
          state.elementOrder.push(el.id);
        }
      });
    },

    upsertElement: (state, action) => {
      const el = action.payload;
      if (!el || !el.id) return;

      if (el.isDeleted) {
        delete state.elements[el.id];
        state.elementOrder = state.elementOrder.filter((id) => id !== el.id);
        if (state.selectedElementId === el.id) state.selectedElementId = null;
        return;
      }

      const isNew = !state.elements[el.id];
      state.elements[el.id] = el;
      if (isNew) {
        state.elementOrder.push(el.id);
      }
    },

    removeElement: (state, action) => {
      const id = action.payload;
      delete state.elements[id];
      state.elementOrder = state.elementOrder.filter((item) => item !== id);
      if (state.selectedElementId === id) {
        state.selectedElementId = null;
      }
    },

    clearAllElements: (state) => {
      state.elements = {};
      state.elementOrder = [];
      state.selectedElementId = null;
    },

    setActiveTool: (state, action) => {
      state.activeTool = action.payload;
      if (action.payload !== 'select') {
        state.selectedElementId = null;
      }
    },

    updateToolSettings: (state, action) => {
      state.toolSettings = { ...state.toolSettings, ...action.payload };
    },

    setSelectedElementId: (state, action) => {
      state.selectedElementId = action.payload;
    },

    setViewport: (state, action) => {
      state.viewport = { ...state.viewport, ...action.payload };
    },

    zoomIn: (state) => {
      state.viewport.zoom = Math.min(state.viewport.zoom * 1.15, 3.0);
    },

    zoomOut: (state) => {
      state.viewport.zoom = Math.max(state.viewport.zoom / 1.15, 0.25);
    },

    resetZoom: (state) => {
      state.viewport.zoom = 1;
      state.viewport.panX = 0;
      state.viewport.panY = 0;
    },

    setActiveUsers: (state, action) => {
      state.activeUsers = action.payload || [];
    },

    updatePeerCursor: (state, action) => {
      const { userId, ...cursorData } = action.payload;
      if (userId) {
        state.peerCursors[userId] = {
          ...cursorData,
          lastMoved: Date.now()
        };
      }
    },

    removePeerCursor: (state, action) => {
      const userId = action.payload;
      delete state.peerCursors[userId];
    },

    setConnectionStatus: (state, action) => {
      state.isConnected = action.payload;
    },

    setLatency: (state, action) => {
      state.latency = action.payload;
    },

    setOfflineStatus: (state, action) => {
      state.isOffline = action.payload;
    },

    setConflictResolvedNotice: (state, action) => {
      state.lastConflictResolved = action.payload;
    }
  }
});

export const {
  setElements,
  upsertElement,
  removeElement,
  clearAllElements,
  setActiveTool,
  updateToolSettings,
  setSelectedElementId,
  setViewport,
  zoomIn,
  zoomOut,
  resetZoom,
  setActiveUsers,
  updatePeerCursor,
  removePeerCursor,
  setConnectionStatus,
  setLatency,
  setOfflineStatus,
  setConflictResolvedNotice
} = canvasSlice.actions;

export default canvasSlice.reducer;
