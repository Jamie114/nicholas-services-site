import { ArrowRight, Home, KeyRound, RefreshCw, TrendingUp } from 'lucide-react';
import { PublicFooter, PublicHeader } from './PublicChrome';
import './public-site.css';

type Props = { page: 'services' | 'approach'; onBrokerSignIn: () => void; authReady: boolean };
const services = [
  {icon: Home, title: 'Buying your first home', text: 'Make sense of the steps, from understanding your budget to preparing for a loan application.'},
  {icon: KeyRound, title: 'Your next home', text: 'Explore your options when it’s time to move, whether you’re selling or holding on to your current property.'},
  {icon: RefreshCw, title: 'Refinancing', text: 'Take a fresh look at your existing home loan, including the costs and considerations of refinancing.'},
  {icon: TrendingUp, title: 'Investing in property', text: 'Talk through your property goals, available equity and the lending structures you may want to explore.'},
];

export default function BrokerInfoPage({page, onBrokerSignIn, authReady}: Props) {
  const isServices = page === 'services';
  return <div className="public-site">
    <PublicHeader onBrokerSignIn={onBrokerSignIn} authReady={authReady}/>
    <main id="top" tabIndex={-1}>
      <section className="calculator-intro public-wrap">
        <div>
          <div className="public-kicker"><span/> {isServices ? 'HOW WE CAN HELP' : 'OUR APPROACH'}</div>
          {isServices ? <><h1>Whatever comes next,<br/><em>start here.</em></h1><p>Every property journey is different. Whether you’re buying, refinancing or planning ahead, let’s explore the options around your goals.</p><a href="#services" className="public-btn dark">Explore how we can help <ArrowRight size={17}/></a></> : <><h1>Your goals first.<br/><em>The details together.</em></h1><p>A home loan is a big decision. We’ll start with a conversation about where you are and what you’re hoping to achieve, then work through the next steps together.</p><a href="/#consultation" className="public-btn dark">Start a conversation <ArrowRight size={17}/></a></>}
        </div>
        <div className="calculator-intro-note"><span>A GOOD PLACE TO START</span><strong>{isServices ? <>Your plans are<br/>personal.</> : <>Clarity for your<br/>next chapter.</>}</strong><p>{isServices ? 'You don’t need to have all the answers. Bring your questions and tell us what you have in mind.' : 'From your first questions to your next move, we’ll take the time to understand what matters to you.'}</p></div>
      </section>
      {isServices ? <section id="services" className="broker-services"><div className="public-wrap"><div className="public-tools-header"><div><div className="public-section-label">YOUR PROPERTY GOALS</div><h2>Let’s find your<br/><em>starting point.</em></h2></div><p>Choose the goal that sounds most like yours, or get in touch if you’re still figuring it out.</p></div><div className="broker-services-grid">{services.map(({icon: Icon, title, text})=><article className="broker-service" key={title}><span className="tool-icon"><Icon size={21} strokeWidth={1.6}/></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section> : <section className="calculator-steps"><div className="public-wrap"><div className="public-section-label">A CLEARER WAY FORWARD</div><div className="calculator-steps-grid"><div><strong>Tell us what matters to you</strong><p>Share your plans, questions and what you’d like to achieve.</p></div><div><strong>Explore your options</strong><p>Discuss your circumstances and the lending options that may be relevant.</p></div><div><strong>Take the next step</strong><p>Work through the information needed to move forward with your chosen path.</p></div></div></div></section>}
      <section className="calculator-help public-wrap"><div><div className="public-section-label">LET’S TALK</div><h2>Ready when<br/><em>you are.</em></h2><p>Tell us a little about what you’re planning and start with a free consultation.</p></div><a href="/#consultation" className="public-btn dark">Request a consultation <ArrowRight size={17}/></a></section>
    </main>
    <PublicFooter onBrokerSignIn={onBrokerSignIn} authReady={authReady}/>
  </div>;
}
