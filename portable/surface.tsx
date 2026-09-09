import {AccountProvider} from '../app/account';
import type {Discovery} from '../lib/discovery';
import React from 'react';
import Explorer from '../app/explorer';
import Detail from '../app/companies/[id]/detail';
import Anniversaries from '../app/anniversaries/page';
import NotFound from '../app/not-found';
import {companies} from '../lib/companies';
function Content({path,discovery={}}:{path:string;discovery?:Discovery}){if(path==='/')return <Explorer discovery={discovery}/>;if(path==='/anniversaries')return <Anniversaries/>;const c=companies.find(c=>path==='/companies/'+c.id);return c?<Detail c={c}/>:<NotFound/>}


export function Surface(props:Parameters<typeof Content>[0]){return <AccountProvider><Content {...props}/></AccountProvider>}
