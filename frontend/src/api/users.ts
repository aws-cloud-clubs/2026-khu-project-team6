/**
 * 사용자 프로필 API 함수
 * Requirements: 10.x
 */

import apiClient from './client';

export interface UserProfile {
  id: string;
  real_name: string;
  email: string;
  phone: string;
  nickname: string;
  role: 'user' | 'admin';
  is_verified: boolean;
  created_at: string;
}

export interface UpdateProfileRequest {
  nickname?: string;
  password?: string;
  current_password?: string;
}

/** 내 프로필 조회 */
export async function getMyProfile(): Promise<UserProfile> {
  const res = await apiClient.get<{ user: UserProfile }>('/users/me');
  return res.data.user;
}

/** 프로필 수정 (nickname, password만 허용) */
export async function updateMyProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  const res = await apiClient.put<{ user: UserProfile }>('/users/me', data);
  return res.data.user;
}
