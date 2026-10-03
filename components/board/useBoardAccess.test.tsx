import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useBoardAccess } from './useBoardAccess';
const mocks=vi.hoisted(()=>({ getUser:vi.fn(), member:vi.fn(), callback:null as null|((event:string,session:unknown)=>void), unsubscribe:vi.fn() }));
vi.mock('@/lib/supabaseClient',()=>({supabase:{auth:{getUser:mocks.getUser,onAuthStateChange:vi.fn((callback)=>{mocks.callback=callback;return{data:{subscription:{unsubscribe:mocks.unsubscribe}}};})}}}));
vi.mock('@/lib/board',()=>({getBoardMember:mocks.member,boardError:()=> 'Cannot load access'}));
beforeEach(()=>vi.clearAllMocks());
it('treats a missing auth session as signed out',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null},error:{name:'AuthSessionMissingError'}});
  const {result}=renderHook(()=>useBoardAccess());
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.user).toBeNull();expect(result.current.error).toBeNull();
});
it('ignores an old membership response after sign-out',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:'one'}},error:null});
  let complete!:(value:unknown)=>void;
  mocks.member.mockReturnValue(new Promise(resolve=>{complete=resolve;}));
  const {result}=renderHook(()=>useBoardAccess());
  await waitFor(()=>expect(mocks.member).toHaveBeenCalledWith('one'));
  act(()=>mocks.callback?.('SIGNED_OUT',null));
  await act(async()=>complete({status:'approved',role:'organizer'}));
  expect(result.current.user).toBeNull();expect(result.current.member).toBeNull();
});
