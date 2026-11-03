import { SITE_CONFIG } from './site-config';

export type ConsultationDetails = { firstName: string; lastName: string; email: string; phone: string; botcheck?: boolean };
export type ConsultationResult = { ok: true } | { ok: false; message: string };

export function validateConsultation(details: ConsultationDetails): string | null {
  if (!details.firstName.trim() || !details.lastName.trim()) return 'Please enter your first and last name.';
  if (!details.email.trim() && !details.phone.trim()) return 'Please enter a phone number, an email address, or both.';
  if (details.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) return 'Please enter a valid email address.';
  if (details.phone.trim() && (!/^[+\d\s().-]{6,30}$/.test(details.phone.trim()) || details.phone.replace(/\D/g, '').length < 6)) return 'Please enter a valid phone number.';
  return null;
}

export async function sendConsultation(accessKey: string, details: ConsultationDetails, send: typeof fetch = fetch): Promise<ConsultationResult> {
  const invalid = validateConsultation(details);
  if (invalid) return {ok:false,message:invalid};
  if (!accessKey.trim()) return {ok:false,message:'Consultation enquiries are not available yet.'};
  const payload: Record<string, string | boolean> = {
    access_key: accessKey.trim(),
    subject: `New consultation request — ${SITE_CONFIG.businessName}`,
    from_name: `${SITE_CONFIG.businessName} website`,
    first_name: details.firstName.trim(),
    last_name: details.lastName.trim(),
    botcheck: !!details.botcheck,
  };
  if (details.email.trim()) payload.email = details.email.trim();
  if (details.phone.trim()) payload.phone = details.phone.trim();
  try {
    const response = await send('https://api.web3forms.com/submit', {
      method: 'POST', headers: {'Content-Type':'application/json', 'Accept':'application/json'}, body: JSON.stringify(payload),
    });
    const result = await response.json() as {success?: boolean};
    if (!response.ok || result.success !== true) return {ok:false,message:'We couldn’t send your request. Please try again later.'};
    return {ok:true};
  } catch {
    return {ok:false,message:'We couldn’t confirm that your request was sent. Please check your connection and try again.'};
  }
}
