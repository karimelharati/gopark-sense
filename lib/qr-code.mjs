import QRCode from 'qrcode';
export async function renderPassQR(text){
  const modules=QRCode.create(text,{errorCorrectionLevel:'M'}).modules.size;
  const available=Math.min(360,Math.max(200,window.innerWidth-72));
  const scale=Math.max(1,Math.floor(available/(modules+8))),size=(modules+8)*scale;
  return {url:await QRCode.toDataURL(text,{scale,margin:4,errorCorrectionLevel:'M'}),size};
}
