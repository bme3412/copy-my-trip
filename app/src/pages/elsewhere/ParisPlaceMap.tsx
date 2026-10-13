import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
export type ParisMapPlace = {id:string;name:string;lat:number;lon:number};
export function ParisPlaceMap({places,selected,onSelect}:{places:ParisMapPlace[];selected:string;onSelect:(id:string)=>void}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<MapboxMap|null>(null),markers=useRef(new Map<string,HTMLButtonElement>());
  const select=useRef(onSelect);select.current=onSelect;
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const token=import.meta.env?.VITE_MAPBOX_TOKEN as string|undefined;
  useEffect(()=>{
    if(!token)return;
    let cancelled=false;
    void import('mapbox-gl').then(({default:mapbox})=>{
      if(cancelled||!container.current)return;
      const instance=new mapbox.Map({container:container.current,accessToken:token,style:'mapbox://styles/mapbox/streets-v12',center:[2.34,48.85],zoom:13,scrollZoom:false});map.current=instance;
      instance.addControl(new mapbox.NavigationControl({showCompass:false}),'top-right');
      const bounds=new mapbox.LngLatBounds();
      for(const [index,place] of places.entries()){
        bounds.extend([place.lon,place.lat]);
        const button=document.createElement('button');button.type='button';button.className='ew-map-pin';button.textContent=String(index+1);button.setAttribute('aria-label',`Show ${place.name}`);button.addEventListener('click',()=>select.current(place.id));markers.current.set(place.id,button);
        new mapbox.Marker({element:button}).setLngLat([place.lon,place.lat]).addTo(instance);
      }
      instance.on('load',()=>{if(cancelled)return;instance.resize();instance.fitBounds(bounds,{padding:48,maxZoom:14,duration:0});setReady(true);});
      instance.on('error',()=>{if(!cancelled)setFailed(true);});
    }).catch(()=>{if(!cancelled)setFailed(true);});
    return()=>{cancelled=true;map.current?.remove();map.current=null;markers.current.clear();};
  },[token,places]);
  useEffect(()=>{for(const [id,button] of markers.current)button.setAttribute('aria-pressed',String(id===selected));},[selected,ready]);
  const lons=places.map(p=>p.lon),lats=places.map(p=>p.lat);
  const minLon=Math.min(...lons),maxLon=Math.max(...lons),minLat=Math.min(...lats),maxLat=Math.max(...lats);
  return <div className="ew-place-map" aria-label="Paris places map"><div ref={container} className="ew-map-canvas" style={{visibility:ready&&!failed?'visible':'hidden'}}/>{(!ready||failed)&&<div className="ew-map-schematic"><p>{token&&!failed?'Loading street map…':'Place positions · schematic'}</p><span className="ew-map-north">N ↑</span>{places.map((place,index)=><button type="button" key={place.id} className="ew-map-pin" style={{left:`${(maxLon===minLon?50:15+70*(place.lon-minLon)/(maxLon-minLon))}%`,top:`${(maxLat===minLat?50:20+60*(maxLat-place.lat)/(maxLat-minLat))}%`}} aria-label={`Show ${place.name}`} aria-pressed={selected===place.id} onClick={()=>onSelect(place.id)}>{index+1}</button>)}<small>Catalog coordinates · not a walking route</small></div>}</div>;
}
