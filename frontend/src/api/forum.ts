import { api } from './client';

// HU25: Cliente API del foro

export interface ForumThread {
  id: string;
  title: string;
  topic?: string;
  author: string;
  createdAt: string;
  replyCount: number;
}

export interface ForumThreadDetail {
  id: string;
  title: string;
  body: string;
  topic: string;
  author: string;
  createdAt: string;
  canDelete: boolean;
  posts: ForumPost[];
}

export interface ForumPost {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  canDelete?: boolean;
}

export interface CreateThreadPayload {
  topicId: string;
  title: string;
  body: string;
}

export interface CreatePostPayload {
  body: string;
}

export interface ForumThreadsResponse {
  data: ForumThread[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function getThreads(
  courseId: string,
  page: number = 1,
  topicId?: string,
): Promise<ForumThreadsResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  if (topicId) {
    params.append('topicId', topicId);
  }

  const { data } = await api.get<ForumThreadsResponse>(
    `/courses/${courseId}/forum/threads?${params.toString()}`,
  );
  return data;
}

export async function createThread(
  courseId: string,
  payload: CreateThreadPayload,
): Promise<ForumThread> {
  const { data } = await api.post<ForumThread>(
    `/courses/${courseId}/forum/threads`,
    payload,
  );
  return data;
}

export async function getThread(threadId: string): Promise<ForumThreadDetail> {
  const { data } = await api.get<ForumThreadDetail>(`/courses/forum/threads/${threadId}`);
  return data;
}

export async function createPost(
  threadId: string,
  payload: CreatePostPayload,
): Promise<ForumPost> {
  const { data } = await api.post<ForumPost>(
    `/courses/forum/threads/${threadId}/posts`,
    payload,
  );
  return data;
}

export async function deleteThread(threadId: string): Promise<void> {
  await api.delete(`/courses/forum/threads/${threadId}`);
}

export async function deletePost(postId: string): Promise<void> {
  await api.delete(`/courses/forum/posts/${postId}`);
}
