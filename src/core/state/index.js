import { createStore } from 'redux';
import rootReducer from './reducers';

// Initial state of the application
const initialState = {
  applications: {
    mathApp: {
      isRunning: false,
      status: 'stopped',
    },
    englishApp: {
      isRunning: false,
      status: 'stopped',
    },
  },
  user: {
    preferences: {},
    currentSession: null,
  },
};

// Create the Redux store
const store = createStore(rootReducer, initialState);

// Export the store for use in the application
export default store;
