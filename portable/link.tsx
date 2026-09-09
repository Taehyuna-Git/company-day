import React from 'react';
import {sitePath} from './site-path';
export default function Link({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>){return <a href={href?sitePath(href):href} {...props}>{children}</a>}
