import { createSlice } from '@reduxjs/toolkit';

const storedToken = localStorage.getItem('boardcollab_token');
const storedUser = localStorage.getItem('boardcollab_user');

const initialState = {
  token: storedToken || null,
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: Boolean(storedToken),
  loading: false,
  error: null
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('boardcollab_token', action.payload.token);
      localStorage.setItem('boardcollab_user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('boardcollab_token');
      localStorage.removeItem('boardcollab_user');
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { loginSuccess, logout, setError } = authSlice.actions;
export default authSlice.reducer;
