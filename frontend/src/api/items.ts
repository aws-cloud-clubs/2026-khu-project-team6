/**
 * 아이템 API 함수
 * Requirements: 4.x, 5.x, 7.x
 */

import apiClient from './client';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  item_types: ItemType[];
}

export interface ItemType {
  id: string;
  name: string;
  is_custom: boolean;
}

export interface Item {
  id: string;
  seller_id: string;
  category_id: string;
  item_type_id: string;
  custom_item_name?: string;
  title: string;
  description: string;
  price_per_day: number;
  deposit_amount: number;
  trade_type: 'pickup_zone' | 'direct_trade';
  status: string;
  created_at: string;
  /** 이미지 URL 목록 (S3) */
  images?: string[];
  seller?: {
    nickname: string;
  };
  category?: Category;
  item_type?: ItemType;
}

export interface ItemsListResponse {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ItemsFilter {
  category_id?: string;
  item_type_ids?: string[];
  trade_type?: 'pickup_zone' | 'direct_trade';
  page?: number;
  pageSize?: number;
}

export interface CreateItemRequest {
  category_id: string;
  item_type_id: string;
  custom_item_name?: string;
  title: string;
  description: string;
  price_per_day: number;
  deposit_amount: number;
  trade_type: 'pickup_zone' | 'direct_trade';
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/** 카테고리 목록 조회 (Guest 허용) */
export async function getCategories(): Promise<Category[]> {
  const res = await apiClient.get<{ categories: Category[] }>('/categories');
  return res.data.categories;
}

/** 아이템 목록 조회 (Guest 허용) */
export async function getItems(filter?: ItemsFilter): Promise<ItemsListResponse> {
  const params: Record<string, unknown> = { ...filter };
  if (filter?.item_type_ids?.length) {
    params.item_type_ids = filter.item_type_ids.join(',');
  }
  const res = await apiClient.get<ItemsListResponse>('/items', { params });
  return res.data;
}

/** 아이템 상세 조회 (Guest 허용) */
export async function getItem(id: string): Promise<Item> {
  const res = await apiClient.get<{ item: Item }>(`/items/${id}`);
  return res.data.item;
}

/** 아이템 등록 (Seller) */
export async function createItem(data: CreateItemRequest): Promise<Item> {
  const res = await apiClient.post<{ item: Item }>('/items', data);
  return res.data.item;
}

/** 아이템 수정 (Seller) */
export async function updateItem(id: string, data: Partial<CreateItemRequest>): Promise<Item> {
  const res = await apiClient.put<{ item: Item }>(`/items/${id}`, data);
  return res.data.item;
}

/** 아이템 삭제 (Seller) */
export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/items/${id}`);
}

/** S3 presigned URL 요청 (이미지 업로드용) */
export async function getPresignedUrl(
  itemId: string,
  fileName: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string }> {
  const res = await apiClient.post<{ uploadUrl: string; key: string }>(
    `/items/${itemId}/presigned-url`,
    { fileName, contentType },
  );
  return res.data;
}
