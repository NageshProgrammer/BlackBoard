import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentRoom: {
    roomId: 'default-room',
    name: 'Collaborative Workspace',
    isPrivate: false
  },
  availableRooms: [],
  isRoomModalOpen: false,
  isAuthModalOpen: false,
  loading: false
};

export const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setCurrentRoom: (state, action) => {
      state.currentRoom = action.payload;
    },
    setAvailableRooms: (state, action) => {
      state.availableRooms = action.payload;
    },
    setRoomModalOpen: (state, action) => {
      state.isRoomModalOpen = action.payload;
    },
    setAuthModalOpen: (state, action) => {
      state.isAuthModalOpen = action.payload;
    }
  }
});

export const {
  setCurrentRoom,
  setAvailableRooms,
  setRoomModalOpen,
  setAuthModalOpen
} = roomSlice.actions;

export default roomSlice.reducer;
