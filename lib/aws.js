import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,UpdateCommand,QueryCommand,TransactWriteCommand,paginateQuery} from '@aws-sdk/lib-dynamodb';
import {S3Client} from '@aws-sdk/client-s3';
import {SQSClient} from '@aws-sdk/client-sqs';
import {EC2Client} from '@aws-sdk/client-ec2';
import {fromWebToken} from '@aws-sdk/credential-providers';
import {getVercelOidcToken} from '@vercel/oidc';
const region=process.env.AWS_REGION||'eu-north-1';
const credentials=process.env.AWS_ROLE_ARN ? async()=>fromWebToken({roleArn:process.env.AWS_ROLE_ARN,webIdentityToken:getVercelOidcToken(),clientConfig:{region},roleSessionName:'modolouge-'+(process.env.VERCEL_PROJECT_NAME||'app')})() : undefined;
const cfg={region,maxAttempts:3,...(credentials?{credentials}:{})};
export const db=DynamoDBDocumentClient.from(new DynamoDBClient(cfg),{marshallOptions:{removeUndefinedValues:true}});
export const s3=new S3Client(cfg), sqs=new SQSClient(cfg), ec2=new EC2Client(cfg);
export const table=process.env.DATA_TABLE||'modolouge-production',bucket=process.env.FILE_BUCKET||'modolouge-444115534902-eu-north-1',queue=process.env.JOB_QUEUE_URL;
export const get=async(pk,sk='STATE')=>(await db.send(new GetCommand({TableName:table,Key:{pk,sk},ConsistentRead:true}))).Item;
export const put=async(Item)=>db.send(new PutCommand({TableName:table,Item}));
export const update=async(pk,sk,UpdateExpression,ExpressionAttributeValues,extra={})=>db.send(new UpdateCommand({TableName:table,Key:{pk,sk},UpdateExpression,ExpressionAttributeValues,...extra}));
export async function all(pk){const items=[];for await(const page of paginateQuery({client:db},{TableName:table,KeyConditionExpression:'pk = :pk',ExpressionAttributeValues:{':pk':pk},ConsistentRead:true}))items.push(...page.Items||[]);return items;}
export async function recent(pk,limit=100){return(await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk = :pk',ExpressionAttributeValues:{':pk':pk},ScanIndexForward:false,Limit:limit}))).Items||[];}
export const transact=items=>db.send(new TransactWriteCommand({TransactItems:items}));
