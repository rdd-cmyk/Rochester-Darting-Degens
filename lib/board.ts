import { supabase } from '@/lib/supabaseClient';
import { formatPlayerName } from '@/lib/playerName';

export type BoardProfile = { display_name: string | null; first_name: string | null; include_first_name_in_display: boolean | null };
export type BoardMember = { user_id: string; status: 'pending' | 'approved' | 'revoked'; role: 'member' | 'organizer'; profile?: BoardProfile };
export type BoardReply = { id: string; post_id: string; author_id: string | null; body: string; created_at: string; updated_at: string; profile: BoardProfile | null };
export type BoardPost = Omit<BoardReply, 'post_id'> & { topic: string; last_activity: string; pinned: boolean; locked: boolean; reply_count: number; reaction_count: number; reacted: boolean };
export type BoardReport = { id: string; post_id: string; reply_id: string | null; reason: string; body: string; created_at: string };
export type BoardAdmin = { members: BoardMember[]; reports: BoardReport[]; hidden: { id: string; body: string; kind: 'post' | 'reply' }[] };
export type BoardAccessCandidates = { items: { user_id: string; status: 'none' | 'pending' | 'revoked'; profile: BoardProfile }[]; total: number };
export const BOARD_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 30;
export const boardTopics: Record<string, string> = { conversation: 'Conversation', sub: 'Sub needed', practice: 'Practice', highlight: 'Highlight', announcement: 'Announcement' };
export function boardName(profile: BoardProfile | null | undefined) {
  return profile ? formatPlayerName(profile.display_name, profile.first_name, profile.include_first_name_in_display) : 'Former player';
}
export function isBoardAccessError(error: unknown): boolean {
  const detail = error as { code?: string; status?: number };
  return ['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(detail?.code ?? '') || detail?.status === 401 || detail?.status === 403;
}
export function isBoardReadInvalidation(error: unknown): boolean {
  return isBoardAccessError(error) || (error as { code?: string })?.code === 'P0002';
}
export function boardError(error: unknown): string {
  const detail = error as { code?: string; message?: string };
  if (isBoardRetryConflict(error)) return 'Your earlier attempt was saved with different content. Your revised draft is kept. Open the saved conversation to edit it, or use this draft for a separate contribution.';
  if (['PGRST202', '42P01', 'PGRST205'].includes(detail?.code ?? '')) return 'The League Board is not ready yet. Please try again later.';
  if (isBoardAccessError(error)) return 'Your access changed or this conversation is closed. Refresh the board to continue.';
  if (detail?.code === 'P0002') return 'This conversation or contribution is no longer available.';
  if (detail?.code === '23505') return 'This action conflicts with a recent change. Refresh and try again.';
  if (['P0001', '22023'].includes(detail?.code ?? '')) return detail.message || 'Please check your post and try again.';
  return 'Could not reach the League Board. Your draft is kept in this tab. Please try again.';
}
export function isBoardRetryConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'PT409';
}
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error, status } = await supabase.rpc(name, args);
  if (error) throw { ...error, status };
  return data as T;
}
export async function getBoardMember(userId: string): Promise<BoardMember | null> {
  const { data, error } = await supabase.from('board_members').select('user_id,status,role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
export function boardFeed(options: { before?: BoardPost; limit?: number; id?: string; pinned?: boolean } = {}) {
  return rpc<BoardPost[]>('board_feed', { p_before: options.before?.last_activity ?? null, p_before_id: options.before?.id ?? null,
    p_limit: options.limit ?? BOARD_PAGE_SIZE, p_id: options.id ?? null, p_pinned: options.pinned ?? null });
}
export function boardThread(postId: string, after?: BoardReply) {
  return rpc<BoardReply[]>('board_thread', { p_post: postId, p_after: after?.created_at ?? null, p_after_id: after?.id ?? null, p_limit: REPLY_PAGE_SIZE });
}
export async function boardReply(id: string): Promise<BoardReply> {
  const { data, error, status } = await supabase.from('board_replies')
    .select('id,post_id,author_id,body,created_at,updated_at,profile:profiles(display_name,first_name,include_first_name_in_display)')
    .eq('id', id).eq('hidden', false).eq('deleted', false).single();
  if (error) throw { ...error, status };
  return { ...data, profile: Array.isArray(data.profile) ? data.profile[0] ?? null : data.profile };
}
export const boardAdmin = (offset = 0) => rpc<BoardAdmin>('board_admin', { p_offset: offset });
export const boardAccessCandidates = (offset = 0) => rpc<BoardAccessCandidates>('board_access_candidates', { p_offset: offset });
export const boardGrantAccess = (userId: string) => rpc<string>('board_grant_access', { p_target: userId });
export function boardWrite(action: string, target?: string, body?: string, topic?: string, id?: string) {
  return rpc<string>('board_write', { p_action: action, p_target: target ?? null, p_body: body ?? null, p_topic: topic ?? 'conversation', p_id: id ?? null });
}
export function mergeBoardRows<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const rows = new Map(existing.map(row => [row.id, row]));
  incoming.forEach(row => rows.set(row.id, row));
  return [...rows.values()];
}
