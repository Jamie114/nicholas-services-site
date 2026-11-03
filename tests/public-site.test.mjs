import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const dir=mkdtempSync(resolve('node_modules/.tmp/public-site-test-'));
const require=createRequire(import.meta.url), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const fakeConfig=key=>({businessName:'Euystratios Brokers',consultationAccessKey:key,email:'',phone:'',bookingUrl:''});
const plugin=(key,mockAuth=false)=>({name:'fake-dependencies',setup(builder){
  builder.onResolve({filter:/^\.\/site-config$/},()=>({path:'config',namespace:'fake'}));
  if(mockAuth) builder.onResolve({filter:/^\.\/supabaseClient$/},()=>({path:'supabase',namespace:'fake'}));
  builder.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:args.path==='config'?`export const SITE_CONFIG = ${JSON.stringify(fakeConfig(key))};`:'export const supabaseEnabled = false; export const supabase = {};',loader:'js'}));
}});
const common={bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','lucide-react','jspdf'],loader:{'.css':'empty'}};
try {
  async function render(entry,key,authReady=true) {
    const out=join(dir,`${entry}-${key||'blank'}.cjs`);
    await build({...common,entryPoints:[`src/${entry}.tsx`],outfile:out,plugins:[plugin(key)]});
    const Component=require(out).default;
    return renderToStaticMarkup(React.createElement(Component,{authReady,onOpenCalculator:()=>{},onBrokerSignIn:()=>{}}));
  }
  const home=await render('PublicWebsite','');
  assert.ok(home.includes('Euystratios Brokers'),'business name is shown');
  assert.ok(home.includes('MORTGAGE BROKING, MADE PERSONAL'),'home introduces the brokerage');
  assert.ok(home.includes('id="services"'),'brokerage services are on the homepage');
  assert.ok(home.includes('href="/calculators/"'),'homepage links to the separate calculator guide');
  assert.ok(home.includes('Request a free consultation'),'consultation form is on the home page');
  assert.ok(home.includes('Online enquiries are not available yet.'),'unconfigured form is clearly unavailable');
  assert.ok(home.includes('<fieldset disabled='),'unconfigured form cannot collect details');
  assert.ok(home.includes('Web3Forms'),'form processor is disclosed');
  assert.ok(home.includes('Skip to main content'),'keyboard users can skip navigation');
  assert.ok(!home.includes('mailto:'),'no invented email address');
  assert.ok(!home.includes('tel:'),'no invented phone number');
  const configured=await render('PublicWebsite','test-key');
  assert.ok(!configured.includes('<fieldset disabled='),'configured form is enabled');
  const calculators=await render('CalculatorsPage','');
  for(const hash of ['one','two','refi','borrow']) assert.ok(calculators.includes(`href="/calculators/#calculator-${hash}"`),`missing tool link ${hash}`);
  assert.ok(calculators.includes('HOW TO USE THE TOOLS'),'calculator guide explains how to get started');
  assert.ok(calculators.includes('No account is needed'),'guest calculator access is explained');
  assert.ok(calculators.includes('href="/#consultation"'),'guide links back to the consultation form');
  const waiting=await render('CalculatorsPage','',false);
  assert.ok(waiting.includes('aria-disabled="true"'),'links wait for session check');
  const appOut=join(dir,'app.cjs');
  await build({...common,entryPoints:['src/App.tsx'],outfile:appOut,plugins:[plugin('',true)]});
  globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  const App=require(appOut).default;
  globalThis.window={location:{pathname:'/',hash:''}};
  const appHome=renderToStaticMarkup(React.createElement(App));
  assert.ok(appHome.includes('MORTGAGE BROKING, MADE PERSONAL'),'the app renders the broker home at /');
  globalThis.window.location.pathname='/calculators/';
  const appCalculators=renderToStaticMarkup(React.createElement(App));
  assert.ok(appCalculators.includes('HOW TO USE THE TOOLS'),'the app renders the guide at /calculators/');
  delete globalThis.window; delete globalThis.localStorage;
  console.log('Broker home, calculator guide, form states and routes passed.');
} finally {rmSync(dir,{recursive:true,force:true});}
