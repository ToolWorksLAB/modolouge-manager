import {randomUUID} from 'node:crypto';
import {HeadObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {createPresignedPost} from '@aws-sdk/s3-presigned-post';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {SendMessageCommand} from '@aws-sdk/client-sqs';
import {get,put,update,transact,table,s3,sqs,bucket,queue} from './aws.js';
import {failure} from './auth.js';
import {limits} from './config.js';
const uuid=/^[a-f0-9-]{36}$/;
export function validId(id){if(typeof id!=='string'||!uuid.test(id))throw failure('Invalid identifier.');return id;}
export function cleanFilename(name){if(typeof name!=='string'||!/^.{1,120}\.(gh|ghx)$/i.test(name))throw failure('Choose a .gh or .ghx file.');return name.replace(/[\\/\x00-\x1f]/g,'_');}
export function location(req){let city='';try{city=decodeURIComponent(req.headers.get('x-vercel-ip-city')||'');}catch{}return{country:(req.headers.get('x-vercel-ip-country')||'Unknown').slice(0,60),city:city.slice(0,120),region:(req.headers.get('x-vercel-ip-country-region')||'').slice(0,60)};}
export async function serviceReady(){const s=await get('SERVICE');if(!s?.acceptingJobs)throw failure('Compute is shut down by the administrator.',503);if(!s.heartbeat||Date.now()-s.heartbeat>90000)throw failure('Compute is starting or unavailable. Try again shortly.',503);return s;}
export async function createUpload(user,body){await serviceReady();const filename=cleanFilename(body.filename);if(!Number.isInteger(body.size)||body.size<1||body.size>limits.fileBytes)throw failure('Maximum file size is 20 MB.');const id=randomUUID(),key=`uploads/${user.sk}/${id}/${filename.toLowerCase().endsWith('.ghx')?'definition.ghx':'definition.gh'}`;
 const ttl=Math.floor(Date.now()/1000)+86400;
 await put({pk:'DEF#'+id,sk:'STATE',id,owner:user.sk,filename,key,expectedSize:body.size,ttl,status:'uploaded'});
 const upload=await createPresignedPost(s3,{Bucket:bucket,Key:key,Expires:120,Conditions:[['content-length-range',body.size,body.size]],Fields:{'Content-Type':'application/octet-stream'}});return{id,upload};
}
export async function submit(user,body,req){await serviceReady();const type=body.type;if(!['prepare','solve','example'].includes(type))throw failure('Invalid job type.');let def;
 if(type!=='example'){def=await get('DEF#'+validId(body.definitionId));if(!def||def.owner!==user.sk||def.ttl<Date.now()/1000)throw failure('Definition not found or expired.',404);if(type==='prepare'){const h=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:def.key}));if(h.ContentLength!==def.expectedSize)throw failure('Upload size did not match.');}else if(def.status!=='ready')throw failure('Prepare the definition first.');}
 const values=body.values||{};if(typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>limits.controls||JSON.stringify(values).length>64000)throw failure('Invalid slider values.');
 const id=randomUUID(),now=Date.now(),day=new Date(now).toISOString().slice(0,10),geo=location(req);
 const job={pk:'JOB#'+id,sk:'STATE',id,owner:user.sk,email:user.email,type,definitionId:def?.id||randomUUID(),values,status:'queued',createdAt:new Date(now).toISOString(),createdMs:now,ttl:Math.floor(now/1000)+86400,location:geo};
 const quota=(sk,max)=>({Update:{TableName:table,Key:{pk:'QUOTA#'+day,sk},UpdateExpression:'ADD jobs :one SET #ttl=:ttl',ConditionExpression:'attribute_not_exists(jobs) OR jobs < :max',ExpressionAttributeNames:{'#ttl':'ttl'},ExpressionAttributeValues:{':one':1,':max':max,':ttl':Math.floor(now/1000)+2592000}}});
 try{await transact([
  {ConditionCheck:{TableName:table,Key:{pk:'SERVICE',sk:'STATE'},ConditionExpression:'acceptingJobs=:yes',ExpressionAttributeValues:{':yes':true}}},
  {Update:{TableName:table,Key:{pk:'USERS',sk:user.sk},UpdateExpression:'SET activeJob=:id, activeUntil=:until, lastSeen=:seen, #location=:geo',ConditionExpression:'blocked=:no AND (attribute_not_exists(activeUntil) OR activeUntil < :now)',ExpressionAttributeNames:{'#location':'location'},ExpressionAttributeValues:{':id':id,':until':now+240000,':seen':job.createdAt,':geo':geo,':no':false,':now':now}}},
  quota(user.sk,limits.dailyJobs),quota('GLOBAL',limits.globalDailyJobs),{Put:{TableName:table,Item:job}}
 ]);}catch(e){if(e.name==='TransactionCanceledException')throw failure('Another job is running, the daily limit is reached, or compute was shut down. Daily allowance: 60 jobs per account.',429);throw e;}
 try{await sqs.send(new SendMessageCommand({QueueUrl:queue,MessageBody:JSON.stringify({id})}));}catch(e){await update(job.pk,'STATE','SET #status=:status',{':status':'failed'},{ExpressionAttributeNames:{'#status':'status'}});await update('USERS',user.sk,'SET activeUntil=:zero',{':zero':0});throw e;}
 return{id,status:'queued'};
}
export async function readJob(user,id){const j=await get('JOB#'+validId(id));if(!j||j.owner!==user.sk)throw failure('Job not found.',404);let status=j.status;if(['queued','running'].includes(status)&&Date.now()-j.createdMs>240000)status='expired';return{id:j.id,status,error:j.error,...(j.resultKey&&status==='done'?{resultUrl:await getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:j.resultKey}),{expiresIn:120})}:{} )};}
