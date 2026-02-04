function countCal(s,e){return Math.round((new Date(e+'T00:00:00Z')-new Date(s+'T00:00:00Z'))/86400000)+1;}
function isWE(iso){const d=new Date(iso+'T00:00:00Z').getUTCDay();return d===0||d===6;}
function addD(iso,n){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function cWD(s,e){let c=0,cur=s;while(cur<=e){if(!isWE(cur))c++;cur=addD(cur,1);}return c;}
function derived(g,tp,pp){const fp=g*tp;const pen=g*(1+tp)*pp;return{fp,pen,samlet:g+fp+pen};}
const TP=0.125, PP=0.10;

console.log('=== COLUMN-INDEX VERIFICATION ===');
const sampleLine='Mandag;03-07-2023;x;;;x;Ja;-;;1.494,80;9,96;1.494,80;384,16;187,90;2.076,82;-;;1.190,48;1.190,48;148,81;133,93;1.473,21;;322,58';
const labels=['Ugedag','Dato','Hverdag','S/H dag','Feriedag','Arbejdsdag','S/S dag','TAF dag(1)','TAF-reg(1)','Grundloen(1)','ATP(1)','Ferieberet(1)','FP/FV(1)','Pension(1)','Samlet(1)','TAF dag(2)','TAF-reg(2)','Grundloen(2)','Ferieberet(2)','FP/FV(2)','Pension(2)','Samlet(2)','Sygedagpenge','Dagpenge'];
sampleLine.split(';').forEach((v,i)=>{if(v.trim())console.log('  ['+i+'] '+(labels[i]||'?')+' = '+v.trim());});
console.log('');
console.log('  KEY: TAF dag(2)[15]="-" : within TAF period, not TAF working-day');
console.log('  KEY: S/S dag[6]="Ja"    : sygedagpenge day');
console.log('  KEY: Grundloen(2) shown : salary in table regardless of TAF-dag');
console.log('');

console.log('=== DATE ANALYSIS ===');
function ar(label,s,e){
  const cal=countCal(s,e),wd=cWD(s,e);
  console.log('  '+label+': '+s+' to '+e+'  cal='+cal+' wd='+wd);
  return{cal,wd};}
console.log('July 2023:');  const jul_full=ar('full','2023-07-01','2023-07-31');
console.log('  (Jul 1=Sat, Jul 2=Sun -- all workdays fall Jul 3-31)');
console.log('Aug 2023:');   const aug=ar('full','2023-08-01','2023-08-31');
console.log('Sep 2023:');   const sep=ar('full','2023-09-01','2023-09-30');
console.log('Oct 2023:');
  const oct_full=ar('full','2023-10-01','2023-10-31');
  const oct_1_6 =ar('Oct 1-6','2023-10-01','2023-10-06');
  const oct_1_8 =ar('Oct 1-8','2023-10-01','2023-10-08');
console.log('Jul 2024:');   ar('full','2024-07-01','2024-07-31');
console.log('');

function analyze(label,ms,me,dailyG,tafS,tafE){
  const tCal=countCal(ms,me), tWd=cWD(ms,me);
  const col2=dailyG*tWd, der=derived(col2,TP,PP);
  const os=ms>tafS?ms:tafS, oe=me<tafE?me:tafE;
  let oCal=0,oWd=0;
  if(os<=oe){oCal=countCal(os,oe);oWd=cWD(os,oe);}
  const cF=oCal/tCal, wF=oWd/tWd;
  const cA=der.samlet*cF, wA=der.samlet*wF, diff=cA-wA;
  console.log('  '+label);
  console.log('    Row:         '+ms+' to '+me+' ('+tCal+' cal, '+tWd+' wd)');
  console.log('    TAF overlap: '+os+' to '+oe+' ('+oCal+' cal, '+oWd+' wd)');
  console.log('    col2='+col2.toFixed(2)+'  samlet='+der.samlet.toFixed(2));
  console.log('    CODE:    '+der.samlet.toFixed(2)+' * '+oCal+'/'+tCal+' = '+cA.toFixed(2)+'  frac='+cF.toFixed(4));
  console.log('    CORRECT: '+der.samlet.toFixed(2)+' * '+oWd+'/'+tWd+' = '+wA.toFixed(2)+'  frac='+wF.toFixed(4));
  console.log('    DIFF:    '+diff.toFixed(2)+' kr  '+(Math.abs(diff)<0.005?'(none)':diff>0?'(code OVER-counts)':'(code UNDER-counts)'));
  console.log('');
  return{cA,wA,diff};
}

console.log('=== SCENARIO A: loenperiode=maaned, TAF 2023-06-22 to 2023-10-08 ===');
console.log('');
const A1=analyze('Jul 2023 (1190.48/day)','2023-07-01','2023-07-31',1190.48,'2023-06-22','2023-10-08');
const A2=analyze('Aug 2023  (418.41/day)','2023-08-01','2023-08-31', 418.41,'2023-06-22','2023-10-08');
const A3=analyze('Sep 2023  (418.41/day)','2023-09-01','2023-09-30', 418.41,'2023-06-22','2023-10-08');
const A4=analyze('Oct 2023  (418.41/day)','2023-10-01','2023-10-31', 418.41,'2023-06-22','2023-10-08');
{const tc=A1.cA+A2.cA+A3.cA+A4.cA, tw=A1.wA+A2.wA+A3.wA+A4.wA;
console.log('  === TOTALS (Scenario A) ===');
console.log('  CODE:    '+tc.toFixed(2));
console.log('  CORRECT: '+tw.toFixed(2));
console.log('  DIFF:    '+(tc-tw).toFixed(2)+' kr');}
console.log('');

console.log('=== SCENARIO B: same but TAF ends 2023-10-06 (Friday) ===');
console.log('');
const B1=analyze('Jul 2023','2023-07-01','2023-07-31',1190.48,'2023-06-22','2023-10-06');
const B2=analyze('Aug 2023','2023-08-01','2023-08-31', 418.41,'2023-06-22','2023-10-06');
const B3=analyze('Sep 2023','2023-09-01','2023-09-30', 418.41,'2023-06-22','2023-10-06');
const B4=analyze('Oct 2023','2023-10-01','2023-10-31', 418.41,'2023-06-22','2023-10-06');
{const tc=B1.cA+B2.cA+B3.cA+B4.cA, tw=B1.wA+B2.wA+B3.wA+B4.wA;
console.log('  === TOTALS (Scenario B) ===');
console.log('  CODE:    '+tc.toFixed(2));
console.log('  CORRECT: '+tw.toFixed(2));
console.log('  DIFF:    '+(tc-tw).toFixed(2)+' kr');}
console.log('');

console.log('=== SCENARIO C: loenperiode=dag, row 2023-08-01 to 2023-10-06 ===');
console.log('');
{const rs='2023-08-01',re='2023-10-06';
const tCal=countCal(rs,re),tWd=cWD(rs,re);
const col2=418.41*tWd, der=derived(col2,TP,PP);
console.log('  Row: '+rs+' to '+re+' ('+tCal+' cal, '+tWd+' wd)');
console.log('  col2='+col2.toFixed(2)+' samlet='+der.samlet.toFixed(2));
console.log('');
console.log('  C1: TAF covers full row => frac=1.0 => no discrepancy');
console.log('');
console.log('  C2: TAF ends 2023-09-30 (row continues into Oct):');
const oCal=countCal(rs,'2023-09-30'),oWd=cWD(rs,'2023-09-30');
console.log('      overlapCal='+oCal+' overlapWd='+oWd);
console.log('      CODE:    '+(der.samlet*oCal/tCal).toFixed(2)+'  frac='+(oCal/tCal).toFixed(4));
console.log('      CORRECT: '+(der.samlet*oWd/tWd).toFixed(2)+'  frac='+(oWd/tWd).toFixed(4));
console.log('      DIFF:    '+(der.samlet*oCal/tCal-der.samlet*oWd/tWd).toFixed(2)+' kr');
console.log('');
console.log('  C3: TAF ends Oct 8, row ends Oct 6 => full row in TAF => no discrepancy');
}
console.log('');

console.log('==========================================================');
console.log(' ROOT CAUSE & FIX SUMMARY');
console.log('==========================================================');
console.log('');
console.log('FILE:     src/domain/erstatningsopgoerelse/indtaegtPerioder.ts');
console.log('FUNCTION: buildIncomeForRanges');
console.log('');
console.log('WHAT CODE DOES:');
console.log('  totalDays  = countInclusiveUtcDays(start, end)   // CALENDAR days');
console.log('  overlapDays = getOverlapDays(interval, ranges)   // CALENDAR days');
console.log('  sum += derived.samlet * (overlapDays / totalDays)');
console.log('');
console.log('WHAT TABLE DOES (eoDebugLoenColumns.ts):');
console.log('  arbejdsdage = working days (Mon-Fri) in row interval');
console.log('  per-day = amounts / arbejdsdage  (spread across workdays only)');
console.log('  table sum per row = derived.samlet (always the full row amount)');
console.log('');
console.log('DISCREPANCY:');
console.log('  When TAF does NOT fully cover a row interval:');
console.log('    code:    calOverlapDays / calTotalDays');
console.log('    correct: wdOverlapDays  / wdTotalDays');
console.log('  These differ because weekends cluster unevenly at boundaries.');
console.log('');
console.log('  Oct 2023 example (TAF ends Oct 8):');
console.log('    calendar: 8/31 = 0.2581');
console.log('    workdays: 5/22 = 0.2273');
console.log('    => code OVER-counts Oct salary by ~31% relative');
console.log('');
console.log('FIX: Replace countInclusiveUtcDays and getOverlapDays');
console.log('with working-day-aware variants in buildIncomeForRanges.');
console.log('Match the logic in eoDebugLoenColumns.ts:');
console.log('  array[idx] += amounts[key] / arbejdsdage');