import { ArrowUpRight, Home, KeyRound, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { SITE_CONFIG } from './site-config';

type ChromeProps = { onBrokerSignIn: () => void; authReady: boolean };

export function PublicHeader({onBrokerSignIn,authReady}: ChromeProps) {
  const [menuOpen,setMenuOpen] = useState(false);
  return <><a className="skip-link" href="#top">Skip to main content</a>
    <header className="public-header" onKeyDown={(event)=>{if(event.key === 'Escape') setMenuOpen(false);}}><div className="public-wrap public-nav">
      <a className="public-logo" href="/"><span className="public-logo-mark"><Home size={20} strokeWidth={1.7}/></span><span>{SITE_CONFIG.businessName}<small>HOME LOANS &amp; FINANCE</small></span></a>
      <button className="public-menu-toggle" onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="public-navigation" aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
      <nav id="public-navigation" className={`public-links ${menuOpen?'open':''}`} aria-label="Main navigation">
        <a className="public-mobile-consult" href="/#consultation">Free consultation</a><a href="/how-we-can-help/">How we can help</a><a href="/our-approach/">Our approach</a><a href="/calculators/">Calculators</a>
        <button className="public-login" onClick={()=>{setMenuOpen(false);onBrokerSignIn();}} disabled={!authReady}><KeyRound size={15}/> Broker sign in</button>
        <a className="public-nav-cta" href="/#consultation">Free consultation <ArrowUpRight size={16}/></a>
      </nav>
    </div></header></>;
}

export function PublicFooter({onBrokerSignIn,authReady}: ChromeProps) {
  return <footer className="public-footer"><div className="public-wrap"><a className="public-footer-brand" href="/">{SITE_CONFIG.businessName}<span>HOME LOANS &amp; FINANCE</span></a><p>Information and calculators are general in nature. Results depend on the inputs and assumptions used.</p><button onClick={onBrokerSignIn} disabled={!authReady}>Broker sign in <ArrowUpRight size={15}/></button></div></footer>;
}
