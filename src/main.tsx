import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './kid/kid.css';
import { doc } from './skin/document';
import { useApp } from './store';

// acesso para depuração no console
(window as unknown as Record<string, unknown>).__skinforja = { doc, useApp };

document.documentElement.lang = 'pt-BR';

createRoot(document.getElementById('root')!).render(<App />);
