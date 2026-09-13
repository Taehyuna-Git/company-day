export function basePath(){return typeof document==='undefined'?'':document.getElementById('root')?.dataset.basePath||'';}
export function sitePath(path:string){return path.startsWith('/')&&!path.startsWith('//')?basePath()+path:path;}
export function calendarPath(id:string){return sitePath('/api/calendar/'+id)+(basePath()?'.ics':'');}
