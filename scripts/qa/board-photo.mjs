// Local opt-in evaluation. Original photos are never copied into public assets
// or committed. Pass their directory, plus an optional local output directory.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
import sharp from 'sharp';
import {createWorker} from 'tesseract.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('.')&&context.parentURL?.endsWith('.ts')){
    const url=new URL(`${specifier}.ts`,context.parentURL);
    if(existsSync(fileURLToPath(url)))return next(url.href,context);
  }
  return next(specifier,context);
}});
const {scanWithWorker}=await import(pathToFileURL(path.join(root,'lib/board-photo/scan.ts')).href);
const {maskPixels}=await import(pathToFileURL(path.join(root,'lib/board-photo/image.ts')).href);
const fixtures=JSON.parse(readFileSync(path.join(root,'lib/board-photo/fixtures/g3-photos.json'),'utf8')).filter((_,i)=>!process.env.RDD_OCR_PHOTO||i===Number(process.env.RDD_OCR_PHOTO));
const folder=process.argv[2];if(!folder)throw new Error('Pass the private photo directory.');
const output=path.resolve(process.argv[3]??path.join(root,'.local/board-photo'));
mkdirSync(output,{recursive:true});
const worker=await createWorker('eng',1,{langPath:path.join(root,'public/ocr/v7'),cachePath:output});
const report=[];
try{
for(const fixture of fixtures){
  const filename=path.join(folder,fixture.file);
  const size=Number(process.env.RDD_OCR_WIDTH??2600);
  const input=await sharp(filename).rotate().resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).raw().ensureAlpha().toBuffer({resolveWithObject:true});
  const crop={left:0,top:Math.round(input.info.height*.15),width:input.info.width,height:Math.round(input.info.height*.75)};
  const original=await sharp(input.data,{raw:input.info}).extract(crop).png().toBuffer();
  // Same white/green text mask as the browser, plus the manually selected
  // table crop used for this evaluation (top 15%, bottom 10% removed).
  maskPixels(input.data,input.info.width,input.info.height);
  const image=await sharp(input.data,{raw:input.info}).extract(crop).png().toBuffer();
  const dimensions=await sharp(image).metadata();
  writeFileSync(path.join(output,fixture.file+'.mask.png'),image);
  const {result,words}=await scanWithWorker(worker,image,original,dimensions.width,dimensions.height,new AbortController().signal,()=>{});
  writeFileSync(path.join(output,fixture.file+'.words.json'),JSON.stringify(words,null,2));
  const checks=Object.entries(fixture.rows).flatMap(([label,values])=>values.map((expected,i)=>{
    const cell=result.columns[i]?.cells.find(c=>c.label===label);
    return {column:fixture.labels[i],label,expected,actual:cell?.value??null,uncertain:cell?.uncertain??true,correct:cell?.value===expected};
  }));
  const row={file:fixture.file,correct:checks.filter(c=>c.correct).length,total:checks.length,confidentErrors:checks.filter(c=>!c.correct&&!c.uncertain),checks,result};report.push(row);
  console.log(fixture.file,`${row.correct}/${row.total}`,`confident errors: ${row.confidentErrors.length}`);
}
}finally{await worker.terminate();}
const summary={correct:report.reduce((s,r)=>s+r.correct,0),total:report.reduce((s,r)=>s+r.total,0),confidentErrors:report.reduce((s,r)=>s+r.confidentErrors.length,0),photos:report};
writeFileSync(path.join(output,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({correct:summary.correct,total:summary.total,accuracy:summary.correct/summary.total,confidentErrors:summary.confidentErrors}));
if(summary.correct/summary.total<.9||summary.confidentErrors)process.exitCode=1;
