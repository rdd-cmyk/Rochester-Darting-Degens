import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.warn(
    'SUPABASE_SERVICE_ROLE_KEY is missing. Account deletion will not work without it.'
  );
}

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server is not configured for account deletion.' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
    token
  );

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = userData.user.id;

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileError) {
    console.error('Error deleting profile:', profileError);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    userId
  );

  if (deleteError) {
    console.error('Error deleting user:', deleteError);
    return NextResponse.json(
      { error: 'Unable to delete account at this time.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: 'Account deleted' });
}
