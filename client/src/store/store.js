import { configureStore } from '@reduxjs/toolkit';
import canvasReducer from './canvasSlice';
import authReducer from './authSlice';
import roomReducer from './roomSlice';

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
    auth: authReducer,
    room: roomReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export default store;
