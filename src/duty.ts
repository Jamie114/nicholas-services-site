// Residential conveyance duty, indicative rules for current transactions as at 2 November 2026.
// Assumes full residential property, a single purchase, no foreign surcharge, and equal purchaser eligibility.
export type AustralianState = 'VIC' | 'NSW' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type HomeKind = 'Established' | 'New';
export const AUSTRALIAN_STATES: AustralianState[] = ['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'];
// Australian Government 5% Deposit Scheme; area must be verified by postcode.
const SCHEME_CAPS: Record<AustralianState, [number, number]> = {
  NSW: [1500000,800000], VIC: [950000,650000], QLD: [1000000,700000],
  WA: [850000,600000], SA: [900000,500000], TAS: [700000,550000],
  ACT: [1000000,1000000], NT: [750000,600000],
};
export const schemePriceCap = (state: AustralianState, area: 'Capital / eligible regional centre' | 'Other areas') =>
  SCHEME_CAPS[state][area === 'Other areas' ? 1 : 0];
type Band = [number, number, number];
const units = (n:number) => Math.ceil(Math.max(0,n) / 100 - 1e-10);
function bands(value:number, b:Band[], perHundred = false) {
  let selected = b[0];
  for (const band of b) { if (value > band[0]) selected = band; else break; }
  const [threshold, base, rate] = selected;
  return base + (perHundred ? units(value-threshold)*rate : (value-threshold)*rate);
}
export function residentialDuty(price:number, state:AustralianState, ownerOccupier:boolean, firstHomeEligible:boolean, kind:HomeKind):number {
  const v=Math.max(0,price); if (!v) return 0;
  let duty:number;
  switch(state) {
    case 'VIC': {
      const general:Band[]=[[0,0,.014],[25000,350,.024],[130000,2870,.06],[960000,52800,.055],[2000000,110000,.065]];
      duty = bands(v,general);
      if (ownerOccupier && v<=550000) duty=bands(v,[[0,0,.014],[25000,350,.024],[130000,2870,.05],[440000,18370,.06]]);
      if (ownerOccupier && firstHomeEligible && v<=600000) return 0;
      if (ownerOccupier && firstHomeEligible && v<750000) return duty*(v-600000)/150000;
      return duty;
    }
    case 'NSW': {
      if(v>3870000) duty=194137+(v-3870000)*.07;
      else duty=Math.max(20,bands(v,[[0,0,.0125],[18000,225,.015],[38000,525,.0175],[103000,1662,.035],[387000,11602,.045],[1290000,52237,.055]]));
      if (ownerOccupier && firstHomeEligible && v<=800000) return 0;
      // Published 2026/27 reduced-rate examples; linear reduction to duty at $1m.
      if (ownerOccupier && firstHomeEligible && v<1000000) return (v-800000)*.195935;
      return duty;
    }
    case 'QLD': {
      duty=bands(v,[[0,0,0],[5000,0,1.5],[75000,1050,3.5],[540000,17325,4.5],[1000000,38025,5.75]],true);
      if(ownerOccupier) duty=bands(v,[[0,0,1],[350000,3500,3.5],[540000,10150,4.5],[1000000,30850,5.75]],true);
      if(ownerOccupier && firstHomeEligible && kind==='New') return 0;
      if(ownerOccupier && firstHomeEligible && v<800000) {
        const discount=v<710000?17350:17350*(1-Math.floor((v-700000)/10000)/10);
        return Math.max(0,duty-discount);
      }
      return duty;
    }
    case 'WA': {
      duty=bands(v,[[0,0,1.9],[120000,2280,2.85],[150000,3135,3.8],[360000,11115,4.75],[725000,28453,5.15]],true);
      if(ownerOccupier && v<=200000) duty=bands(v,[[0,0,1.5],[120000,1800,4.04]],true);
      if(ownerOccupier && firstHomeEligible && v<=600000) return 0;
      if(ownerOccupier && firstHomeEligible && v<=800000) return units(v-600000)*16.15;
      return duty;
    }
    case 'SA': {
      duty=bands(v,[[0,0,1],[12000,120,2],[30000,480,3],[50000,1080,3.5],[100000,2830,4],[200000,6830,4.25],[250000,8955,4.75],[300000,11330,5],[500000,21330,5.5]],true);
      return ownerOccupier && firstHomeEligible && kind==='New'?0:duty;
    }
    case 'TAS': return v<=3000?50:bands(v,[[3000,50,1.75],[25000,435,2.25],[75000,1560,3.5],[200000,5935,4],[375000,12935,4.25],[725000,27810,4.5]],true);
    case 'ACT': {
      if(ownerOccupier && firstHomeEligible) return 0;
      if(v>1455000) return units(v)*4.54;
      const b:Band[]=ownerOccupier?[[0,0,.28],[260000,728,2.2],[300000,1608,3.4],[500000,8408,4.32],[750000,19208,5.9],[1000000,33958,6.4]]:[[0,0,1.2],[200000,2400,2.2],[300000,4600,3.4],[500000,11400,4.32],[750000,22200,5.9],[1000000,36950,6.4]];
      return bands(v,b,true);
    }
    case 'NT': {
      if(v<=525000) {const x=v/1000;return .06571441*x*x+15*x;}
      if(v<3000000) return v*.0495;
      if(v<5000000) return v*.0575;
      return v*.0595;
    }
  }
}
