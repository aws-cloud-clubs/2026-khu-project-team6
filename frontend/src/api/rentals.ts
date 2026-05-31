/**
 * 대여 API 함수
 * Requirements: 7.x, 8.x, 9.x, 10.x
 */

import apiClient from './client';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type RentalStatus =
  | '예약요청'
  | '예약확정'
  | '대여중'
  | '반납완료'
  | '검수중'
  | '분쟁중'
  | '완료'
  | '취소'
  | '연체중'
  | '연체종료';

export interface Rental {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  trade_type: 'pickup_zone' | 'direct_trade';
  status: RentalStatus;
  deposit_amount: number;
  deposit_held: number;
  rental_start: string;
  rental_end: string;
  actual_return_date?: string;
  delay_days: number;
  created_at: string;
  updated_at: string;
  item?: {
    id: string;
    title: string;
    price_per_day: number;
    images?: string[];
  };
  buyer?: { nickname: string };
  seller?: { nickname: string };
  chat_room?: { id: string };
}

export interface CreateRentalRequest {
  item_id: string;
  rental_start: string;
  rental_end: string;
  trade_type: 'pickup_zone' | 'direct_trade';
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/** 대여 예약 요청 */
export async function createRental(data: CreateRentalRequest): Promise<Rental> {
  const res = await apiClient.post<{ rental: Rental }>('/rentals', data);
  return res.data.rental;
}

/** 내 대여 내역 조회 */
export async function getRentals(): Promise<Rental[]> {
  const res = await apiClient.get<{ rentals: Rental[] }>('/rentals');
  return res.data.rentals;
}

/** 대여 상세 조회 */
export async function getRental(id: string): Promise<Rental> {
  const res = await apiClient.get<{ rental: Rental }>(`/rentals/${id}`);
  return res.data.rental;
}

/** 예약 확정 (Seller) */
export async function confirmRental(id: string): Promise<Rental> {
  const res = await apiClient.patch<{ rental: Rental }>(`/rentals/${id}/confirm`);
  return res.data.rental;
}

/** 반납 처리 (Buyer) */
export async function returnRental(id: string): Promise<Rental> {
  const res = await apiClient.patch<{ rental: Rental }>(`/rentals/${id}/return`);
  return res.data.rental;
}

/** 파손 신고 (Seller) */
export async function reportDamage(id: string, description: string): Promise<Rental> {
  const res = await apiClient.patch<{ rental: Rental }>(`/rentals/${id}/damage`, {
    description,
  });
  return res.data.rental;
}

/** 수령 인증 사진 업로드 */
export async function uploadReceiptPhoto(id: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('photo', file);
  await apiClient.post(`/rentals/${id}/receipt-photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
