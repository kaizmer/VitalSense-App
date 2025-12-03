export interface Vitals {
  vitals_id: number;
  consent_id: number;
  timelog: string;
  temperature: number;
  heart_rate: number;
  systolic: number;
  diastolic: number | null;
}

export interface Consent {
  consent_id: number;
  user_id: number;
  consented: boolean;
}

export interface User {
  user_id: number;
  name: string;
  email: string;
}