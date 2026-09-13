// Only public values are injected by the build. Accounts stay disabled until setup is complete.
declare const __ACCOUNT_CONFIG__: {siteUrl:string;url:string;key:string;enabled:boolean};
export const accountConfig=typeof __ACCOUNT_CONFIG__==='undefined'?{siteUrl:'',url:'',key:'',enabled:false}:__ACCOUNT_CONFIG__;
