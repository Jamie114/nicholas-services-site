import { ArrowRight, ArrowUpRight, Compass } from 'lucide-react';
import ConsultationForm from './ConsultationForm';
import { PublicFooter, PublicHeader } from './PublicChrome';
import { SITE_CONFIG } from './site-config';
import './public-site.css';

type Props = { onBrokerSignIn: () => void; authReady: boolean };
export default function PublicWebsite({onBrokerSignIn,authReady}: Props) {
  const email=SITE_CONFIG.email.trim();
  const phone=SITE_CONFIG.phone.trim();
  const hasContact=!!(email || phone || SITE_CONFIG.bookingUrl.trim());
  return <div className="public-site">
    <PublicHeader onBrokerSignIn={onBrokerSignIn} authReady={authReady}/>
    <main id="top" tabIndex={-1}>
      <section className="public-hero public-wrap"><div className="public-hero-content"><div className="public-kicker"><span/> MORTGAGE BROKING, MADE PERSONAL</div><h1>Home loans for<br/><em>your next chapter.</em></h1><p>Buying your first home, planning your next move or reviewing your loan? Let’s make sense of the options together.</p><div className="public-hero-actions"><a href="#consultation" className="public-btn primary">Free consultation <ArrowRight size={17}/></a><a href="/how-we-can-help/" className="public-text-link">How we can help <ArrowUpRight size={16}/></a></div><div className="public-hero-note"><span className="public-note-dot"/> START WITH A CONVERSATION</div></div>
      <div className="public-hero-visual" aria-hidden="true"><div className="visual-grid"/><div className="visual-sun"/><div className="visual-ring one"/><div className="visual-ring two"/><svg className="visual-house" viewBox="0 0 520 420" fill="none"><path d="M58 244 260 82l204 162"/><path d="M104 222v150h311V223"/><path d="M218 372V268h84v104M145 260h46v48h-46zM327 260h46v48h-46z"/><path d="M47 373h428M73 395h371"/></svg><div className="visual-card"><span className="visual-card-icon"><Compass size={19}/></span><div><strong>Your goals come first.</strong><small>Let’s talk about what’s next.</small></div><ArrowUpRight size={19}/></div><span className="visual-caption">A LITTLE MORE CLARITY, AT EVERY STEP</span></div></section>
      <ConsultationForm />
      <section className="broker-tools"><div className="public-wrap broker-tools-inner"><div><div className="public-section-label">EXPLORE AT YOUR OWN PACE</div><h2>Curious about<br/><em>the numbers?</em></h2><p>Our free calculators can help you explore a few “what if” scenarios before we talk.</p></div><a href="/calculators/" className="public-btn dark">Explore calculators <ArrowRight size={17}/></a></div></section>
      {hasContact && <section id="contact" className="public-contact"><div className="public-wrap public-contact-inner"><div><div className="public-section-label">GET IN TOUCH</div><h2>Let’s talk about<br/><em>what’s next.</em></h2><p>Have a question? Reach out using the details below.</p></div><div className="public-contact-links">{email&&<a href={`mailto:${email}`}>{email} <ArrowUpRight size={18}/></a>}{phone&&<a href={`tel:${phone.replace(/[^+\d]/g,'')}`}>{phone} <ArrowUpRight size={18}/></a>}{SITE_CONFIG.bookingUrl.trim()&&<a href={SITE_CONFIG.bookingUrl.trim()}>Book a conversation <ArrowUpRight size={18}/></a>}</div></div></section>}
      <div className="public-strip"><div className="public-wrap"><span>FIRST HOME</span><span className="strip-star">✳</span><span>NEXT HOME</span><span className="strip-star">✳</span><span>REFINANCING</span><span className="strip-star">✳</span><span>INVESTING</span></div></div>
    </main>
    <PublicFooter onBrokerSignIn={onBrokerSignIn} authReady={authReady}/>
  </div>;
}
