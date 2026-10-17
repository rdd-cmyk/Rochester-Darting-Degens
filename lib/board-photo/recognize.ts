import type {Worker} from 'tesseract.js';
import type {ScanResult} from './types';
import {textMask} from './image';
import {scanWithWorker} from './scan';

export async function recognizeBoard(canvas:HTMLCanvasElement,signal:AbortSignal,progress:(text:string)=>void):Promise<ScanResult>{
    const {createWorker}=await import('tesseract.js');
    signal.throwIfAborted();
    if(typeof BroadcastChannel==='undefined')throw new Error('This browser cannot start the local reader.');
    const base=new URL('/ocr/v7/',window.location.origin).href;
    const channel=new BroadcastChannel(`rdd-photo-${crypto.randomUUID()}`);
    let worker:Worker|undefined,finished=false,lastStatus='';
    let fail!:(error:Error)=>void;
    const stopped=new Promise<never>((_,reject)=>{fail=reject;});
    const abort=()=>fail(new DOMException('Reading cancelled.','AbortError'));
    const deadline=setTimeout(()=>fail(new Error('The reader took too long. Try a closer crop or a smaller photo.')),60_000);
    signal.addEventListener('abort',abort,{once:true});
    try{
        const starting=createWorker('eng',1,{
            workerPath:new URL(`/ocr/board-worker.js?channel=${encodeURIComponent(channel.name)}`,window.location.origin).href,
            corePath:base,langPath:base,workerBlobURL:false,
            // Only public language data is cached, never photos or OCR output.
            cachePath:'rdd-ocr-eng-v7',
            logger:event=>{
                const text=`${event.status==='recognizing text'?'Reading stats':'Preparing reader'}… ${Math.floor(event.progress*10)*10}%`;
                if(!signal.aborted&&!finished&&text!==lastStatus){lastStatus=text;progress(text);}
            },
            errorHandler:()=>fail(new Error('The local reader could not load or process this photo.')),
        });
        // If cancellation wins during initialization, dispose a late result too.
        void starting.then(value=>{worker=value;if(finished)void value.terminate();},()=>{});
        worker=await Promise.race([starting,stopped]);
        signal.throwIfAborted();
        const scanning=scanWithWorker(worker,textMask(canvas),canvas,canvas.width,canvas.height,signal,progress);
        return (await Promise.race([scanning,stopped])).result;
    }finally{
        finished=true;clearTimeout(deadline);signal.removeEventListener('abort',abort);
        channel.postMessage('stop');channel.close();
        if(worker)await worker.terminate();
    }
}
