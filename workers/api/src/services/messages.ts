import type { ParsedEnv } from "../env";
import { getSupabaseAdminClient, getSupabaseClient } from "../supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type {
  DirectMessage,
  DirectMessagePreview,
  DirectMessageThread,
  PaginationInfo,
  UserProfile,
} from "../types";
import { mapProfileRow } from "./mappers";

type ConversationRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  subject: string | null;
  body: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  username: string;
  bio: string | null;
  profile_pic_url: string | null;
  created_at?: string | null;
  is_verified?: boolean | null;
  verified_at?: string | null;
  verified_by?: string | null;
};

export type ConversationRecord = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeConversationUsers(
  userId: string,
  otherUserId: string
): [string, string] {
  return [userId, otherUserId].sort((left, right) => left.localeCompare(right));
}

function mapConversationRow(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapMessageRow(row: MessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    recipientUserId: row.recipient_user_id,
    subject: row.subject ?? undefined,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapMessagePreviewRow(row: MessageRow): DirectMessagePreview {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    subject: row.subject ?? undefined,
    body: row.body,
    createdAt: row.created_at,
  };
}

function buildFallbackProfile(userId: string): UserProfile {
  return {
    userId,
    username: "unknown",
    displayName: "unknown",
  };
}

async function fetchConversationByUsers(
  env: ParsedEnv,
  userAId: string,
  userBId: string
): Promise<ConversationRecord | null> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { data, error } = await supabase
    .from("direct_conversations")
    .select("id, user_a_id, user_b_id, created_at, updated_at")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapConversationRow(data as ConversationRow);
}

export async function fetchConversationById(
  env: ParsedEnv,
  conversationId: string
): Promise<ConversationRecord | null> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { data, error } = await supabase
    .from("direct_conversations")
    .select("id, user_a_id, user_b_id, created_at, updated_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapConversationRow(data as ConversationRow);
}

export async function getOrCreateConversation(
  env: ParsedEnv,
  userId: string,
  otherUserId: string
): Promise<ConversationRecord> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const [userAId, userBId] = normalizeConversationUsers(userId, otherUserId);

  const existing = await fetchConversationByUsers(env, userAId, userBId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("direct_conversations")
    .insert({
      user_a_id: userAId,
      user_b_id: userBId,
      updated_at: now,
    })
    .select("id, user_a_id, user_b_id, created_at, updated_at")
    .maybeSingle();

  if (error && String(error.code) !== "23505") {
    throw error;
  }

  if (data) {
    return mapConversationRow(data as ConversationRow);
  }

  const retry = await fetchConversationByUsers(env, userAId, userBId);
  if (!retry) {
    throw new Error("Conversation could not be created.");
  }
  return retry;
}

export async function createDirectMessage(
  env: ParsedEnv,
  payload: {
    conversationId: string;
    senderUserId: string;
    recipientUserId: string;
    subject?: string | null;
    body: string;
  }
): Promise<DirectMessage> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      conversation_id: payload.conversationId,
      sender_user_id: payload.senderUserId,
      recipient_user_id: payload.recipientUserId,
      subject: payload.subject ?? null,
      body: payload.body,
    })
    .select(
      "id, conversation_id, sender_user_id, recipient_user_id, subject, body, created_at"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Message could not be created.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("direct_conversations")
    .update({ updated_at: now })
    .eq("id", payload.conversationId);

  if (updateError) {
    console.error("Failed to update conversation timestamp", updateError);
  }

  return mapMessageRow(data as MessageRow);
}

export async function fetchMessageThreads(
  env: ParsedEnv,
  userId: string,
  options: { page: number; pageSize: number }
): Promise<{ items: DirectMessageThread[]; pageInfo: PaginationInfo }> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { page, pageSize } = options;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await supabase
    .from("direct_conversations")
    .select("id, user_a_id, user_b_id, created_at, updated_at", {
      count: "exact",
    })
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  const conversations = (data ?? []) as ConversationRow[];
  if (conversations.length === 0) {
    return {
      items: [],
      pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
    };
  }

  const conversationIds = conversations.map((row) => row.id);
  const participantIds = conversations
    .map((row) => (row.user_a_id === userId ? row.user_b_id : row.user_a_id))
    .filter((id): id is string => Boolean(id));

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(
      "user_id, username, bio, profile_pic_url, created_at, is_verified, verified_at, verified_by"
    )
    .in("user_id", participantIds);

  if (profileError) {
    throw profileError;
  }

  const profiles = (profileData ?? []) as ProfileRow[];
  const profileMap = new Map<string, UserProfile>();
  profiles.forEach((profile) => {
    profileMap.set(
      profile.user_id,
      mapProfileRow(profile, { r2BaseUrl: env.R2_PUBLIC_BASE_URL })
    );
  });

  const { data: messageData, error: messageError } = await supabase
    .from("direct_messages")
    .select("id, conversation_id, sender_user_id, subject, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  if (messageError) {
    throw messageError;
  }

  const lastMessageMap = new Map<string, DirectMessagePreview>();
  ((messageData ?? []) as MessageRow[]).forEach((row) => {
    if (!lastMessageMap.has(row.conversation_id)) {
      lastMessageMap.set(row.conversation_id, mapMessagePreviewRow(row));
    }
  });

  const items = conversations.map((row) => {
    const participantId =
      row.user_a_id === userId ? row.user_b_id : row.user_a_id;
    const fallbackId = participantId ?? "unknown";
    const participant =
      profileMap.get(fallbackId) ?? buildFallbackProfile(fallbackId);
    return {
      id: row.id,
      participant,
      lastMessage: lastMessageMap.get(row.id),
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  });

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? items.length),
  };
}

export async function fetchThreadMessages(
  env: ParsedEnv,
  conversationId: string,
  options: { page: number; pageSize: number }
): Promise<{ items: DirectMessage[]; pageInfo: PaginationInfo }> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { page, pageSize } = options;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await supabase
    .from("direct_messages")
    .select(
      "id, conversation_id, sender_user_id, recipient_user_id, subject, body, created_at",
      { count: "exact" }
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  const items = ((data ?? []) as MessageRow[]).map(mapMessageRow);
  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? items.length),
  };
}
