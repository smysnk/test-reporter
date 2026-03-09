import { combineReducers, configureStore, createSlice } from '@reduxjs/toolkit';
import { createWrapper, HYDRATE } from 'next-redux-wrapper';

const runtimeSlice = createSlice({
  name: 'runtime',
  initialState: {
    config: {
      graphqlPath: '/graphql',
    },
    loaded: true,
  },
  reducers: {
    setRuntimeConfig(state, action) {
      state.config = {
        ...state.config,
        ...(action.payload || {}),
      };
      state.loaded = true;
    },
  },
});

const explorerSlice = createSlice({
  name: 'explorer',
  initialState: {
    selectedProjectSlug: null,
    selectedRunId: null,
    viewMode: 'project',
  },
  reducers: {
    setSelectedProjectSlug(state, action) {
      state.selectedProjectSlug = action.payload || null;
    },
    setSelectedRunId(state, action) {
      state.selectedRunId = action.payload || null;
    },
    setViewMode(state, action) {
      state.viewMode = action.payload || 'project';
    },
  },
});

export const {
  setRuntimeConfig,
} = runtimeSlice.actions;

export const {
  setSelectedProjectSlug,
  setSelectedRunId,
  setViewMode,
} = explorerSlice.actions;

const combinedReducer = combineReducers({
  runtime: runtimeSlice.reducer,
  explorer: explorerSlice.reducer,
});

function reducer(state, action) {
  if (action.type === HYDRATE) {
    return {
      ...state,
      ...action.payload,
      runtime: {
        ...(state?.runtime || {}),
        ...(action.payload?.runtime || {}),
      },
      explorer: {
        ...(state?.explorer || {}),
        ...(action.payload?.explorer || {}),
      },
    };
  }

  return combinedReducer(state, action);
}

export function makeStore() {
  return configureStore({
    reducer,
  });
}

export const wrapper = createWrapper(makeStore);
