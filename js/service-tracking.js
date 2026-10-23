// Whitelist service context. Never store or transmit personal form data.
document.addEventListener('DOMContentLoaded', () => {
 const names = {"aereo":"Fotografía y video aéreo","consultoria":"Consultoría estratégica","meta_ads":"Meta Ads","google_ads":"Google Ads","contenido":"Contenido para redes"};
 const main=document.querySelector('main[data-service]');
 const requested=new URLSearchParams(location.search).get('servicio');
 const service=main?.dataset.service || (Object.hasOwn(names,requested) ? requested : null);
 if(!service || !Object.hasOwn(names,service))return;
 window.dmService=service;
 const form=document.querySelector('#diagnostico-form');
 if(form){const input=document.createElement('input');input.type='hidden';input.name='servicio';input.value=names[service];form.append(input);}
 document.querySelectorAll('a[href]').forEach(link=>{
  const url=new URL(link.href,location.href);
  if(url.origin===location.origin && url.pathname.endsWith('/contacto.html')){url.searchParams.set('servicio',service);link.href=url.href;}
  if(url.hostname==='wa.me'){url.searchParams.set('text','Hola, quiero consultar por '+names[service]+'.');link.href=url.href;}
 });
 document.addEventListener('click',event=>{const a=event.target.closest('a');if(!a || typeof window.gtag!=='function')return;const url=new URL(a.href,location.href);if(url.origin===location.origin && url.pathname.endsWith('/contacto.html'))window.gtag('event','select_content',{content_type:'servicio_cta',item_id:service,service_id:service});});
});
