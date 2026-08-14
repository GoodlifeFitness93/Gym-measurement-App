import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function validateEnvVar(name: string, value: string | undefined) {
  if (!value) {
    console.error(`${name} is missing`);
    return;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 255) {
      console.error(
        `${name} has invalid character at position ${i}: "${value[i]}" (code ${code}). ` +
        `Context: ...${value.slice(Math.max(0, i - 5), i + 5)}...`
      );
      return;
    }
  }
  console.log(`${name} is clean (${value.length} chars)`);
}

validateEnvVar('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
validateEnvVar('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

