import { configureStore } from '@reduxjs/toolkit';
import reportBuilderReducer from './slices/reportBuilderSlice';
import queryReducer from './slices/querySlice';
import exportReducer from './slices/exportSlice';

export const store = configureStore({
  reducer: {
    reportBuilder: reportBuilderReducer,
    query: queryReducer,
    export: exportReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;