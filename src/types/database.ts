export type UserRole = 'passenger' | 'driver' | 'admin';
export type VerificationStatus = 'new' | 'pending' | 'verified' | 'rejected';
export type OrderStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_telegram_verified: boolean;
  verification_status: VerificationStatus;
  car_model?: string;
  car_number?: string;
  car_color?: string;
  current_lat?: number;
  current_lon?: number;
  is_online: boolean;
  push_token?: string;
}

export interface Order {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  from_address: string;
  to_address: string;
  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  price: number;
  comment: string | null;
  status: OrderStatus;
  created_at: string;
}