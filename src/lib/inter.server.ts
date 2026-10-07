import https from "node:https";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type InterConfig = {
  environment:string; client_id:string; client_secret:string; cert_pem:string;
  key_pem:string; pix_key:string; account_number?:string;
};
type Token={token:string;expiresAt:number};
const cache=new Map<string,Token>();
const pending=new Map<string,Promise<string>>();

async function config(id:string):Promise<InterConfig>{
  const {data,error}=await (supabaseAdmin as any).rpc("get_inter_integration_credentials",{p_integration_id:id});
  const c=data?.[0] as InterConfig|undefined;
  if(error||!c?.client_id||!c.client_secret||!c.cert_pem||!c.key_pem||!c.pix_key)
    throw new Error("Integração Banco Inter não configurada");
  return c;
}
function base(env:string){return env==="SANDBOX"?"https://cdpj-sandbox.partners.uatinter.co":"https://cdpj.partners.bancointer.com.br";}

function request(url:string, opts:{method?:string;headers?:Record<string,string>;body?:string|undefined;cert:string;key:string}):Promise<{status:number;body:string}>{
  return new Promise((resolve,reject)=>{
    const u=new URL(url);
    const req=https.request(u,{method:opts.method??"GET",cert:opts.cert,key:opts.key,headers:opts.headers??{}},res=>{
      let body=""; res.setEncoding("utf8"); res.on("data",d=>body+=d); res.on("end",()=>resolve({status:res.statusCode??0,body}));
    });
    req.on("error",reject); if(opts.body) req.write(opts.body); req.end();
  });
}

async function token(id:string){
  const c=await config(id); const hit=cache.get(id); if(hit&&hit.expiresAt>Date.now()) return hit.token;
  const p=pending.get(id); if(p)return p;
  const next=(async()=>{
    const body=new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,grant_type:"client_credentials",scope:"cob.read cob.write webhook.read webhook.write"}).toString();
    const res=await request(base(c.environment)+"/oauth/v2/token",{method:"POST",cert:c.cert_pem,key:c.key_pem,headers:{"content-type":"application/x-www-form-urlencoded"},body});
    if(res.status<200||res.status>=300) throw new Error("Falha na autenticação Banco Inter ("+res.status+")");
    const j=JSON.parse(res.body) as {access_token:string;expires_in?:number};
    cache.set(id,{token:j.access_token,expiresAt:Date.now()+((j.expires_in??3600)-60)*1000}); return j.access_token;
  })().finally(()=>pending.delete(id)); pending.set(id,next); return next;
}

async function call(id:string,path:string,method="GET",body?:unknown){
  const c=await config(id); const t=await token(id);
  const headers:Record<string,string>={Authorization:"Bearer "+t,Accept:"application/json"};
  if(body!==undefined) headers["Content-Type"]="application/json";
  if(c.account_number) headers["x-conta-corrente"]=c.account_number;
  const res=await request(base(c.environment)+path,{method,cert:c.cert_pem,key:c.key_pem,headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(res.status===401){cache.delete(id); const fresh=await token(id); headers["Authorization"]="Bearer "+fresh; return request(base(c.environment)+path,{method,cert:c.cert_pem,key:c.key_pem,headers,body:body===undefined?undefined:JSON.stringify(body)});}
  if(res.status<200||res.status>=300) throw new Error("Banco Inter respondeu "+res.status+": "+res.body.slice(0,300));
  return res.body?JSON.parse(res.body):{};
}

export async function createPixCharge(id:string,input:{amountCents:number;description?:string|undefined;expirationSeconds:number;externalReference:string}){
  const c=await config(id);
  const txid=input.externalReference.replace(/-/g,"").slice(0,35).padEnd(26,"0");
  const body={
    calendario:{expiracao:Math.min(Math.max(input.expirationSeconds,60),86400)},
    valor:{original:(input.amountCents/100).toFixed(2)},
    chave:c.pix_key,
    solicitacaoPagador:(input.description??"Pagamento").slice(0,140),
  };
  const result=await call(id,"/pix/v2/cob/"+txid,"PUT",body) as {txid?:string;pixCopiaECola?:string;loc?:{id?:number};status?:string};
  return {txid:result.txid??txid,pixCopiaECola:result.pixCopiaECola,paymentId:result.txid??txid,status:result.status};
}

export async function getCharge(id:string,txid:string){
  return call(id,"/pix/v2/cob/"+encodeURIComponent(txid));
}

export async function registerWebhook(id:string,url:string){
  const c=await config(id);
  return call(id,"/pix/v2/webhook/"+encodeURIComponent(c.pix_key),"PUT",{webhookUrl:url});
}

export function statusToLocal(status?:string){return status==="CONCLUIDA"?"PAID":status==="REMOVIDA_PELO_USUARIO_RECEBEDOR"?"CANCELED":"PENDING";}
