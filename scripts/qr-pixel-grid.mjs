import fs from 'node:fs';
let ui=fs.readFileSync('app/booking-features.jsx','utf8').replace("import QRCode from 'qrcode';","import {renderPassQR} from '../lib/qr-code.mjs';");
ui=ui.replace("const [qr,setQr]=useState(''),[error", "const [qr,setQr]=useState(''),[qrSize,setQrSize]=useState(0),[error");
ui=ui.replace("const image=await QRCode.toDataURL(text,{width:420,margin:4,errorCorrectionLevel:'M'});", "const {url:image,size}=await renderPassQR(text);");
ui=ui.replace('setQr(image);','setQr(image);setQrSize(size);');
ui=ui.replace('<img className="booking-qr" src={qr}', '<img className="booking-qr" style={{width:qrSize,height:qrSize,border:0,borderRadius:0,maxWidth:\'100%\'}} src={qr}');fs.writeFileSync('app/booking-features.jsx',ui);
let wallet=fs.readFileSync('lib/offline-wallet-entry.mjs','utf8').replace("import QRCode from 'qrcode';","import {renderPassQR} from './qr-code.mjs';");
wallet=wallet.replace("$('#qr').src=await QRCode.toDataURL(encoded,{width:420,margin:4,errorCorrectionLevel:'M'});", "const rendered=await renderPassQR(encoded);$('#qr').src=rendered.url;$('#qr').style.width=rendered.size+'px';$('#qr').style.height=rendered.size+'px';");fs.writeFileSync('lib/offline-wallet-entry.mjs',wallet);
