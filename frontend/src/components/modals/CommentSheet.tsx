"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, Trash2, Send } from "lucide-react";
import { Comment } from "@/types";
import { apiRequest } from "@/lib/api";
import { Avatar } from "../ui/Avatar";
import { formatRelativeTime } from "@/lib/dates";

interface CommentSheetProps {
  memoryId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
}

export function CommentSheet({
  memoryId,
  isOpen,
  onClose,
  onCommentCountChange,
}: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const fetchComments = async () => {
      try {
        const data = await apiRequest<Comment[]>(`/memories/${memoryId}/comments`);
        if (isMounted) {
          setComments(data);
          onCommentCountChange?.(data.length);
        }
      } catch (err) {
        console.error("Failed to load comments", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchComments();
    return () => {
      isMounted = false;
    };
  }, [isOpen, memoryId, onCommentCountChange]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await apiRequest<Comment>(`/memories/${memoryId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment.trim() }),
      });
      const updated = [...comments, created];
      setComments(updated);
      setNewComment("");
      onCommentCountChange?.(updated.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to post comment";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiRequest(`/memories/${memoryId}/comments/${commentId}`, {
        method: "DELETE",
      });
      const updated = comments.filter((c) => c.id !== commentId);
      setComments(updated);
      onCommentCountChange?.(updated.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete comment";
      alert(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh] h-[550px] shadow-2xl overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200">
          <span className="text-sm font-bold text-neutral-900">Comments</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-neutral-600 text-sm">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-neutral-500">
              <p className="text-sm font-medium text-neutral-800 mb-1">No comments yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 group">
                <div className="flex items-start gap-3">
                  <Link href={`/u/${c.author_username}`} onClick={onClose}>
                    <Avatar
                      src={c.author_avatar_url}
                      name={c.author_display_name}
                      size="sm"
                    />
                  </Link>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/u/${c.author_username}`}
                        onClick={onClose}
                        className="text-xs font-bold text-neutral-900 hover:underline"
                      >
                        @{c.author_username}
                      </Link>
                      <span className="text-[11px] text-neutral-500">
                        {formatRelativeTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-900 break-words mt-0.5">{c.body}</p>
                  </div>
                </div>

                {c.can_delete && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                    title="Delete comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handlePostComment}
          className="border-t border-neutral-200 p-3 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 text-sm text-neutral-900 placeholder:text-neutral-400 bg-neutral-100 rounded-full px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-black"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-2.5 rounded-full bg-black text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-neutral-800 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
