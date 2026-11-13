import { AppError } from '../domain/errors'
import { getSupabase } from './supabase-client'

// Hogar del usuario (US-02). Lo crea la base de datos al registrarse;
// las reglas RLS hacen que cada usuario solo vea el suyo.

export type Household = {
  id: string
  name: string
}

export async function getMyHousehold(): Promise<Household | null> {
  const { data, error } = await getSupabase()
    .from('households')
    .select('id, name')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw new AppError('householdLoad')
  return data
}
