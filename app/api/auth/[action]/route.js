import {login,callback,logout,safeError} from '../../../../lib/auth.js';
export const runtime='nodejs';
export async function GET(req,{params}){try{const {action}=await params;if(action==='login')return await login(req);if(action==='callback')return await callback(req);return new Response('Not found',{status:404});}catch(e){return safeError(e);}}
export async function POST(req,{params}){try{if((await params).action==='logout')return await logout(req);return new Response('Not found',{status:404});}catch(e){return safeError(e);}}
