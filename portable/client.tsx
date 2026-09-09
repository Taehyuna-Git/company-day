import React from 'react';
import {hydrateRoot,createRoot} from 'react-dom/client';
import {createDiscovery} from '../lib/discovery';
import {Surface} from './surface';
const root=document.getElementById('root')!;
const base=root.dataset.basePath||'';
const path=(base&&location.pathname.startsWith(base+'/')?location.pathname.slice(base.length):location.pathname).replace(/\/$/,'')||'/';
if(root.dataset.deployment==='cloudflare') {
  // Refresh date-sensitive UI and random discovery even when HTML is cached.
  createRoot(root).render(<Surface path={path} discovery={path==='/'?createDiscovery():{}}/>);
} else {
  hydrateRoot(root,<Surface path={location.pathname} discovery={JSON.parse(root.dataset.discovery||'{}')}/>);
}
