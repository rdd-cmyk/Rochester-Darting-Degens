import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RivalryPoster } from './RivalryPoster';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('exports the two portraits facing inward and restores the canvas transform for captions', async () => {
  const transforms: {x:number;scale:number}[] = [];
  const images: {source:string;left:number;right:number}[] = [];
  const captions: number[] = [];
  let x=0, scale=1;
  const ctx = {
    fillRect:vi.fn(), measureText:(text:string)=>({width:text.length*10}),
    fillText:()=>captions.push(scale),
    save:()=>transforms.push({x,scale}),
    restore:()=>{const saved=transforms.pop()!;x=saved.x;scale=saved.scale;},
    translate:(next:number)=>{x+=next*scale;}, scale:(next:number)=>{scale*=next;},
    drawImage:(image:{src:string},left:number,_top:number,width:number)=>images.push({source:image.src,left:x+left*scale,right:x+(left+width)*scale}),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,AA==');
  vi.stubGlobal('Image',class {src='';decode=async()=>{};});
  render(<RivalryPoster userId="a" names={['Alpha','Bravo']} avatars={['robot','lion']} headline="THE NEXT CHAPTER" score="3 : 2" terms="501 singles" href="/rivalries"/>);
  fireEvent.click(screen.getByRole('button',{name:'Preview poster'}));
  await screen.findByRole('img',{name:'Exact poster download preview'});
  expect(images).toEqual([
    {source:'/avatars/robot.webp',left:20,right:580},
    {source:'/avatars/lion.webp',left:1180,right:620},
  ]);
  expect(captions.every(value=>value===1)).toBe(true);
  expect(transforms).toEqual([]);
});
