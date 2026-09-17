import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { AppHeader } from './src/components/app-header';
import './src/styles.css';

function Preview() {
  const [setup, setSetup] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const open = () => setSetup(true);
    window.addEventListener('monad-design:setup', open);
    return () => window.removeEventListener('monad-design:setup', open);
  }, []);
  useEffect(() => {
    if (setup) heading.current?.focus();
  }, [setup]);
  return (
    <>
      <AppHeader />
      {setup && (
        <h1
          ref={heading}
          tabIndex={-1}
        >
          Agent setup
        </h1>
      )}
    </>
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Preview root is missing.');
createRoot(root).render(<Preview />);
