'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, X, ArrowRight } from 'lucide-react';
import { normalizePlate } from '../lib/parking.mjs';

export default function CameraScanner({ lotId, direction, send, close }) {
  const video=useRef(null), stream=useRef(null), worker=useRef(null), stopped=useRef(false);
  const [status,setStatus]=useState('Starting your camera…'), [plate,setPlate]=useState(''), [confidence,setConfidence]=useState(0), [busy,setBusy]=useState(false), [photo,setPhoto]=useState(''), [cameraOK,setCameraOK]=useState(false);
  useEffect(()=>{
    stopped.current=false;
    if(!navigator.mediaDevices){setStatus('Camera needs HTTPS. Upload a photo instead.');return;}
    navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false}).then(s=>{
      if(stopped.current){s.getTracks().forEach(t=>t.stop());return;}
      stream.current=s;if(video.current){video.current.srcObject=s;video.current.play().catch(()=>{});}setCameraOK(true);setStatus('Center a clear plate in the frame.');
    }).catch(()=>setStatus('Camera unavailable. Allow camera access, or upload a plate photo.'));
    return()=>{stopped.current=true;stream.current?.getTracks().forEach(t=>t.stop());worker.current?.terminate();};
  },[]);
  async function recognize(source){
    setBusy(true);setStatus('Loading local OCR… First use downloads the recognition model.');
    try{
      if(!worker.current){
        if(!window.Tesseract)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('OCR download failed. Check your connection.'));document.head.appendChild(s);});
        const created=await window.Tesseract.createWorker('eng',1);if(stopped.current){await created.terminate();return;}worker.current=created;
        await worker.current.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',tessedit_pageseg_mode:'7'});
      }
      if(stopped.current)return;setStatus('Reading plate on this device…');
      const result=await worker.current.recognize(source);const candidate=normalizePlate(result.data.text),score=Math.round(result.data.confidence);
      if(stopped.current)return;setPlate(candidate);setConfidence(score);setStatus(candidate?`OCR score ${score}/100. ${score>=85?'Check the plate before submitting.':'Needs staff verification.'}`:'No readable plate. Try a closer, sharper image.');
    }catch(e){if(!stopped.current)setStatus(e.message);}finally{if(!stopped.current)setBusy(false);}
  }
  function capture(){const v=video.current;if(!v?.videoWidth)return;const c=document.createElement('canvas');c.width=Math.round(v.videoWidth*.85);c.height=Math.round(v.videoHeight*.27);const ctx=c.getContext('2d');ctx.filter='grayscale(1) contrast(1.4)';ctx.drawImage(v,v.videoWidth*.075,v.videoHeight*.365,c.width,c.height,0,0,c.width,c.height);const src=c.toDataURL('image/jpeg');setPhoto(src);recognize(src);}
  return <div className="modal-backdrop" onClick={close}><section role="dialog" aria-modal="true" aria-labelledby="camera-title" className="modal camera-modal" onClick={e=>e.stopPropagation()}><div className="sheet-head"><div><span className="eyebrow">GATE CAMERA · {direction.toUpperCase()}</span><h2 id="camera-title">Let the plate do the talking.</h2></div><button className="icon-button" aria-label="Close camera" onClick={close}><X /></button></div><div className="camera-feed"><video ref={video} autoPlay playsInline muted /><div className="scan-frame"><i/><i/><i/><i/></div><span>Align plate inside the guide</span></div><p className="scanner-status" role="status">{status}</p><div className="button-row"><button className="button primary" disabled={!cameraOK||busy} onClick={capture}><Camera size={17}/>{busy?'Reading…':'Capture & read plate'}</button><label className="button secondary upload">Upload photo<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{setPhoto(reader.result);recognize(reader.result);};reader.readAsDataURL(f);}}/></label></div>{photo&&<img className="plate-crop" src={photo} alt="Captured plate crop"/>}<label className="field">Recognized plate<input value={plate} onChange={e=>{setPlate(normalizePlate(e.target.value));setConfidence(0);}} placeholder="Plate appears here"/></label><p className="fine-print">Images stay on your device. Latin plate OCR is experimental. Edited plates require staff verification. A separate vehicle-crossing observation is required.</p><button className="button primary wide" disabled={!plate||busy} onClick={async()=>{if(await send('scan',{lotId,direction,plate,confidence,source:'camera'},'Plate recorded. Confirm the vehicle crossing in the gate console.'))close();}}>Submit plate observation <ArrowRight size={17}/></button></section></div>;
}
