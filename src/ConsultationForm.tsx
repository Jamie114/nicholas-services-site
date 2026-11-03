import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { sendConsultation, type ConsultationDetails } from './consultation';
import { SITE_CONFIG } from './site-config';

const blank: ConsultationDetails = {firstName:'',lastName:'',email:'',phone:''};
export default function ConsultationForm() {
  const [details,setDetails] = useState<ConsultationDetails>(blank);
  const [status,setStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const [error,setError] = useState('');
  const submitting = useRef(false);
  const configured = !!SITE_CONFIG.consultationAccessKey.trim();
  const describedBy = error ? 'consultation-hint consultation-privacy consultation-error' : 'consultation-hint consultation-privacy';
  const update = (name: keyof ConsultationDetails, value: string | boolean) => {
    setDetails(prev=>({...prev,[name]:value}));
    if (status === 'error') {setError('');setStatus('idle');}
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || submitting.current) return;
    submitting.current = true;
    setStatus('sending'); setError('');
    try {
      const result = await sendConsultation(SITE_CONFIG.consultationAccessKey,details);
      if (result.ok) {setDetails(blank);setStatus('success');}
      else {setError(result.message);setStatus('error');}
    } finally { submitting.current = false; }
  };
  return <section className="consultation" id="consultation"><div className="public-wrap consultation-layout">
    <div className="consultation-copy"><div className="public-kicker"><span/> HERE WHEN YOU'RE READY</div><h2>Let’s talk about<br/><em>what’s next.</em></h2><p>Leave your details for a free consultation and we’ll get in touch to talk through your goals.</p><p className="consultation-small">No need to have all the answers. A first conversation is a great place to start.</p></div>
    <div className="consultation-card"><div className="consultation-card-heading"><div><span className="consultation-eyebrow">START A CONVERSATION</span><h3>Request a free consultation</h3><p>Tell us how we can reach you.</p></div><span className="consultation-arrow"><ArrowRight size={18}/></span></div>
      {status === 'success' ? <div className="consultation-success" role="status"><CheckCircle2 size={25}/><strong>Thanks for getting in touch.</strong><p>Your request has been sent. We’ll be in touch using the details you provided.</p><button type="button" onClick={()=>setStatus('idle')}>Send another request</button></div> : <form onSubmit={submit} noValidate>
        <fieldset disabled={!configured || status === 'sending'} className="consultation-fields"><div className="consultation-grid">
          <label><span>First name <b aria-hidden="true">*</b></span><input type="text" aria-describedby={describedBy} autoComplete="given-name" maxLength={80} required value={details.firstName} onChange={e=>update('firstName',e.target.value)} placeholder="First name"/></label>
          <label><span>Last name <b aria-hidden="true">*</b></span><input type="text" aria-describedby={describedBy} autoComplete="family-name" maxLength={80} required value={details.lastName} onChange={e=>update('lastName',e.target.value)} placeholder="Last name"/></label>
          <label>Phone number<input type="tel" aria-describedby={describedBy} autoComplete="tel" maxLength={30} value={details.phone} onChange={e=>update('phone',e.target.value)} placeholder="Your phone number"/></label>
          <label>Email address<input type="email" aria-describedby={describedBy} autoComplete="email" maxLength={254} value={details.email} onChange={e=>update('email',e.target.value)} placeholder="you@example.com"/></label>
        </div><div className="consultation-honey" aria-hidden="true"><label>Leave this unchecked<input type="checkbox" tabIndex={-1} autoComplete="off" checked={!!details.botcheck} onChange={e=>update('botcheck',e.target.checked)}/></label></div>
        <p className="consultation-hint" id="consultation-hint">Enter a phone number, an email address, or both. <span aria-hidden="true">*</span> Required.</p>
        <button className="consultation-submit" type="submit" disabled={!configured || status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Request consultation'} <ArrowRight size={17}/></button></fieldset>
        {!configured && <p className="consultation-unavailable" role="status">Online enquiries are not available yet.</p>}
        {error && <p id="consultation-error" className="consultation-error" role="alert">{error}</p>}
        <p className="consultation-privacy" id="consultation-privacy">We’ll use your details to contact you about your enquiry. Please don’t include sensitive financial information. Enquiries are processed by <a href="https://web3forms.com/privacy" target="_blank" rel="noreferrer">Web3Forms</a>.</p>
      </form>}
    </div>
  </div></section>;
}
