import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({read:vi.fn()}));
vi.mock("@/lib/supabaseClient",()=>({supabase:{from:()=>({select:()=>({maybeSingle:mocks.read})})}}));
import { soloVisibility } from "./api";
beforeEach(()=>mocks.read.mockReset());
it.each([[null,true],[{share_summary:false},false],[{share_summary:true},true]])("uses default sharing only without a saved choice (%j)",async(data,expected)=>{
 mocks.read.mockResolvedValue({data,error:null}); expect(await soloVisibility()).toBe(expected);
});
it("does not treat a failed visibility read as permission to share",async()=>{
 mocks.read.mockResolvedValue({data:null,error:new Error("offline")}); await expect(soloVisibility()).rejects.toThrow("offline");
});
