import { supabase } from '../lib/supabase';

export async function getVitalsByConsent(consentId: number) {
  const { data, error } = await supabase
    .from('vitals')
    .select('*')
    .eq('consent_id', consentId)
    .order('timelog', { ascending: false });

  if (error) throw error;
  return data;
}

export async function insertVitals(vitalsData: {
  consent_id: number;
  temperature: number;
  heart_rate: number;
  systolic: number;
  diastolic?: number | null;
}) {
  const { data, error } = await supabase
    .from('vitals')
    .insert([vitalsData])
    .select()
    .single();

  if (error) throw error;
  return data;
}