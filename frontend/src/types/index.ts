export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  memories_count: number;
  spaces_count: number;
  is_self: boolean;
}

export interface Space {
  visibility: "public" | "private";
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  owner_id: string;
  invite_code: string;
  members_count: number;
  memories_count: number;
  is_owner: boolean;
  is_member: boolean;
  created_at: string;
}

export interface SpaceMember {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  role: "owner" | "member";
  joined_at: string;
}

export interface InvitePreview {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  members_count: number;
  memories_count: number;
  invite_code: string;
  is_member: boolean;
}

export interface MediaItem {
  id?: string;
  cloudinary_public_id: string;
  cloudinary_asset_id?: string | null;
  secure_url: string;
  resource_type?: string;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  position: number;
}

export type DisplayShape = "portrait_9_16" | "portrait_3_4" | "square" | "landscape_4_3" | "circle";

/** Normalized rectangle within the original, uncropped image. */
export interface MemoryPresentation {
  display_shape: DisplayShape;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
}

export interface Note {
  id: string;
  memory_id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  can_delete: boolean;
}

export interface Memory {
  can_contribute?: boolean;
  id: string;
  client_id?: string | null;
  space_id: string;
  space_name: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string | null;
  caption?: string | null;
  memory_date: string;
  created_at: string;
  media_items: MediaItem[];
  presentation?: MemoryPresentation | null;
  likes_count: number;
  is_liked_by_me: boolean;
  comments_count: number;
  notes: Note[];
  can_delete: boolean;
  // Optimistic & draft queue fields
  is_optimistic?: boolean;
  upload_status?: "queued" | "signing" | "uploading" | "creating" | "failed" | "confirmed";
  upload_progress?: number;
  error_message?: string | null;
}

export interface Comment {
  id: string;
  memory_id: string;
  user_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  can_delete: boolean;
}

export interface ActivityItem {
  id: string;
  type: "like" | "comment" | "joined_space" | "note";
  actor_id: string;
  actor_username: string;
  actor_display_name: string;
  actor_avatar_url?: string | null;
  memory_id?: string | null;
  space_id?: string | null;
  content?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CloudinarySignature {
  upload_session_id?: string | null;
  overwrite?: boolean | null;
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  public_id: string;
  upload_url: string;
}
