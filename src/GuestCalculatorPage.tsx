import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Calculator, Home, Layers2, RefreshCw, ShieldCheck } from 'lucide-react';
import { PublicFooter, PublicHeader } from './PublicChrome';
import './public-site.css';
import './guest-calculators.css';

export type GuestTool = 'one' | 'two' | 'refi' | 'borrow';
type Props = {
  tool: GuestTool;
  onSelectTool: (tool: GuestTool) => void;
  onBrokerSignIn: () => void;
  authReady: boolean;
  children: ReactNode;
};
const tools = [
  { key: 'one', label: 'Buying a home', icon: Home, intro: 'Explore the costs of a purchase or work backwards from your available funds.' },
  { key: 'borrow', label: 'Borrowing capacity', icon: Calculator, intro: 'Explore an indicative borrowing range based on your income, expenses and assumptions.' },
  { key: 'refi', label: 'Refinancing', icon: RefreshCw, intro: 'Compare a possible new loan with your current loan and the costs of switching.' },
  { key: 'two', label: 'Another property', icon: Layers2, intro: 'Explore buying another property alongside the one you already own.' },
] satisfies Array<{ key: GuestTool; label: string; icon: typeof Home; intro: string }>;

export default function GuestCalculatorPage({ tool, onSelectTool, onBrokerSignIn, authReady, children }: Props) {
  const current = tools.find(item => item.key === tool) ?? tools[0];
  return <div className="public-site guest-calculators">
    <PublicHeader onBrokerSignIn={onBrokerSignIn} authReady={authReady}/>
    <main id="top" tabIndex={-1}>
      <section className="guest-calc-intro public-wrap">
        <a href="/calculators/" className="guest-calc-back"><ArrowLeft size={15}/> All calculators</a>
        <div className="guest-calc-title-row"><div><div className="public-kicker"><span/> FREE HOME LOAN CALCULATORS</div><h1>{current.label}<em>.</em></h1><p>{current.intro}</p></div><div className="guest-calc-intro-note"><span className="guest-calc-intro-icon"><current.icon size={21} strokeWidth={1.6}/></span><div><strong>A clearer starting point</strong><p>Adjust the details and see how your estimate changes.</p></div></div></div>
      </section>
      <section className="guest-calc-main"><div className="public-wrap">
        <nav className="guest-calc-navigation" aria-label="Choose a calculator">{tools.map(({key,label,icon:Icon})=><a key={key} href={`/calculators/#calculator-${key}`} aria-current={tool===key?'page':undefined} onClick={event=>{if(event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;event.preventDefault();onSelectTool(key);}}><Icon size={17} strokeWidth={1.7}/><span>{label}</span></a>)}</nav>
        <aside className="guest-calc-disclaimer" aria-label="Important information about these calculators"><ShieldCheck size={21} aria-hidden="true"/><div><strong>Important: about your estimate</strong><p>These calculators provide general estimates to help you explore scenarios. Results depend on the information and assumptions used, can contain errors and do not consider all of your circumstances. They are not loan approval or personal financial advice. Rates, lender policies, taxes, fees and eligibility can change; actual outcomes may differ.</p><p>Do not rely on an estimate to make a financial product decision. Consider advice from an appropriately licensed professional and confirm the details with your lender and relevant authorities. Your rights under Australian law are not excluded.</p><p>Entries are stored in this browser on this device, so take care when using a shared computer.</p></div></aside>
        <div className="guest-calc-workspace">{children}</div>
      </div></section>
      <section className="guest-calc-next public-wrap"><div><div className="public-section-label">LET’S TALK</div><h2>Want to talk through<br/><em>the numbers?</em></h2><p>Every situation is different. Tell us a little about your plans to start a free consultation.</p></div><a className="public-btn dark" href="/#consultation">Request a consultation <ArrowRight size={17}/></a></section>
    </main>
    <PublicFooter onBrokerSignIn={onBrokerSignIn} authReady={authReady}/>
  </div>;
}
