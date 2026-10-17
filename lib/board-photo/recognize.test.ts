import {beforeEach,it,expect,vi} from 'vitest';
import {recognizeBoard} from './recognize';
const mocks=vi.hoisted(()=>({create:vi.fn(),scan:vi.fn(),terminate:vi.fn()}));
vi.mock('tesseract.js',()=>({createWorker:mocks.create}));
vi.mock('./image',()=>({textMask:(canvas:HTMLCanvasElement)=>canvas}));
vi.mock('./scan',()=>({scanWithWorker:mocks.scan}));
beforeEach(()=>{
 vi.clearAllMocks();mocks.terminate.mockResolvedValue(undefined);mocks.create.mockResolvedValue({terminate:mocks.terminate});mocks.scan.mockResolvedValue({result:{columns:[],warnings:[]}});
});
it('uses only same-origin pinned assets and releases the worker after scanning',async()=>{
 const canvas=document.createElement('canvas');const signal=new AbortController().signal;
 await recognizeBoard(canvas,signal,vi.fn());const options=mocks.create.mock.calls[0][2];
 for(const name of ['workerPath','corePath','langPath'])expect(new URL(options[name]).origin).toBe(window.location.origin);
 expect(options.workerPath).toContain('/ocr/board-worker.js?channel=');expect(options.workerBlobURL).toBe(false);
 expect(mocks.scan).toHaveBeenCalledWith(expect.anything(),canvas,canvas,canvas.width,canvas.height,signal,expect.any(Function));expect(mocks.terminate).toHaveBeenCalledOnce();
});
it('terminates a worker even if cancellation happens while its model is loading',async()=>{
 let resolve!:(worker:{terminate:typeof mocks.terminate})=>void;
 mocks.create.mockImplementation(()=>new Promise(r=>{resolve=r;}));const control=new AbortController();
 const promise=recognizeBoard(document.createElement('canvas'),control.signal,vi.fn());
 await vi.waitFor(()=>expect(mocks.create).toHaveBeenCalled());control.abort();resolve({terminate:mocks.terminate});
 await expect(promise).rejects.toThrow();expect(mocks.scan).not.toHaveBeenCalled();expect(mocks.terminate).toHaveBeenCalledOnce();
});
it('releases the worker on recognition failure and ignores aborted progress',async()=>{
 mocks.scan.mockRejectedValue(new Error('failed'));const control=new AbortController(),progress=vi.fn();
 await expect(recognizeBoard(document.createElement('canvas'),control.signal,progress)).rejects.toThrow('failed');
 expect(mocks.terminate).toHaveBeenCalledOnce();control.abort();mocks.create.mock.calls[0][2].logger({status:'recognizing text',progress:1});expect(progress).not.toHaveBeenCalled();
});

it('reports an initialization failure even if upstream initialization never settles',async()=>{
 mocks.create.mockImplementation((_lang,_oem,options)=>{options.errorHandler('language load failed');return new Promise(()=>{});});
 await expect(recognizeBoard(document.createElement('canvas'),new AbortController().signal,vi.fn())).rejects.toThrow('could not load');
 expect(mocks.scan).not.toHaveBeenCalled();
});
