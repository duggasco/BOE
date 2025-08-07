import React from 'react';

const Debug: React.FC = () => {
  console.log('Debug component mounted');
  
  React.useEffect(() => {
    console.log('Debug effect ran');
    // Check if store is available
    try {
      const { store } = require('./store');
      console.log('Store loaded:', store);
    } catch (err) {
      console.error('Store error:', err);
    }
  }, []);
  
  return (
    <div style={{ padding: 20, background: 'red', color: 'white' }}>
      <h1>Debug Mode - App is Loading</h1>
      <p>If you see this, React is working!</p>
    </div>
  );
};

export default Debug;