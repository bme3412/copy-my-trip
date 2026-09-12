import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCloud } from '../state/CloudContext';
import { useCity } from '../state/CityContext';
import { Page } from '../components/Layout';
import { CloudSavePanel } from '../components/CloudSavePanel';
import { BriefingBody } from '../components/BriefingBody';
import { notificationRequest } from '../lib/cloud/notifications';
import type { NotificationState, SentBriefing } from '../lib/briefings/notifications';
function AccountBriefing({ id }: { id: string }) {
  const {session} = useCloud();
  const token=session!.access_token;
  const [mail,setMail]=useState<{briefing:SentBriefing;state:string;kind:string;newerVersion:boolean}>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{const abort=new AbortController();notificationRequest<typeof mail>(token,`?mail=${encodeURIComponent(id)}`,undefined,abort.signal).then(setMail).catch(e=>{if(!abort.signal.aborted)setMessage(e.message);});return()=>abort.abort();},[id,token]);
  return <>{message && <p role="status">{message}</p>}{mail ? <>
    <p>{mail.kind==='test'?'Test briefing':'Evening briefing'} · {mail.state} · {mail.briefing.serviceDate} in {mail.briefing.zone}</p>
    {mail.newerVersion && <p className="companion-notice">A newer accepted cloud version exists. This page preserves the exact briefing submitted with this email.</p>}
    <button disabled={busy} onClick={async()=>{setBusy(true);try{const current=await notificationRequest<NotificationState>(token,`?id=${encodeURIComponent(mail.briefing.tripId)}`);const p=current.preference;if(p)await notificationRequest(token,'',{action:'set',tripId:p.tripId,expectedRevision:p.revision,enabled:false,zone:p.zone,time:p.time});setMessage('Itinerary emails paused. A message already submitted may still arrive.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to pause.');}finally{setBusy(false);}}}>Pause itinerary emails for this trip</button>
    <p>Opening this link does not change your itinerary or email preferences.</p>
    {mail.briefing.items.map(item=><BriefingBody key={`${item.planId}-${item.date}`} briefing={item} storage="account"/>)}
  </> : !message ? <p>Loading your private briefing…</p> : <p>The briefing may belong to another account, have expired after 90 days, or have been removed with its trip.</p>}</>;
}
export function MailBriefingPage(){const {mailId}=useParams();const cloud=useCloud();const city=useCity();const [params]=useSearchParams();return <Page kicker="Your companion" title={params.has('pause')?'Manage itinerary emails':'Your emailed itinerary'} sub="The accepted schedule preserved when this briefing was submitted."><Link to={`/${city.id}/saved`}>Saved trips</Link>{cloud.session?<AccountBriefing key={`${cloud.session.user.id}-${mailId}`} id={mailId || ''}/>:<><p>Sign in to the account that received this email. Your briefing will open here.</p><CloudSavePanel/></>}</Page>;}
