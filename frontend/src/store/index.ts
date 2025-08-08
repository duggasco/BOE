import { configureStore } from '@reduxjs/toolkit';
import reportBuilderReducer from './slices/reportBuilderSlice';
import queryReducer from './slices/querySlice';
import exportReducer from './slices/exportSlice';
import authReducer from './slices/authSlice';
import reportReducer from './slices/reportSlice';

export const store = configureStore({
  reducer: {
    reportBuilder: reportBuilderReducer,
    query: queryReducer,
    export: exportReducer,
    auth: authReducer,
    reports: reportReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;