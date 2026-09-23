"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { Memory, Note } from "@/types";
import { apiRequest } from "@/lib/api";
import { Avatar } from "../ui/Avatar";
import { Carousel } from "./Carousel";
import { CommentSheet } from "../modals/CommentSheet";
import { formatMemoryDate } from "@/lib/dates";

interface MemoryCardProps {
  memory: Memory;
  onDelete?: (memoryId: string) => void;
}

export function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const [isLiked, setIsLiked] = useState(memory.is_liked_by_me);
  const [likesCount, setLikesCount] = useState(memory.likes_count);
  const [commentsCount, setCommentsCount] = useState(memory.comments_count);
  const [notes, setNotes] = useState<Note[]>(memory.notes || []);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notes state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const handleLikeToggle = async () => {
    // Optimistic toggle
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await apiRequest<{ is_liked: boolean; likes_count: number }>(
        `/memories/${memory.id}/like`,
        { method: "POST" }
      );
      setIsLiked(res.is_liked);
      setLikesCount(res.likes_count);
    } catch {
      // Revert on error
      setIsLiked(!nextState);
      setLikesCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    try {
      const newNote = await apiRequest<Note>(`/memories/${memory.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      setNotes((prev) => [...prev, newNote]);
      setNoteBody("");
      setIsAddingNote(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add note";
      alert(message);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiRequest(`/memories/${memory.id}/notes/${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete note";
      alert(message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/memories/${memory.id}`, { method: "DELETE" });
      onDelete?.(memory.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete memory";
      alert(message);
      setIsDeleting(false);
    }
  };

  return (
    <article className="w-full bg-white border-b border-neutral-200 mb-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Link href={`/u/${memory.author_username}`} className="shrink-0">
            <Avatar
              src={memory.author_avatar_url}
              name={memory.author_display_name}
              size="sm"
            />
          </Link>
          <div className="flex items-center gap-1.5 truncate text-xs">
            <Link
              href={`/u/${memory.author_username}`}
              className="font-bold text-neutral-900 hover:underline truncate"
            >
              @{memory.author_username}
            </Link>
            <span className="text-neutral-400">·</span>
            <Link
              href={`/spaces/${memory.space_id}`}
              className="font-semibold text-neutral-600 hover:text-black truncate"
            >
              {memory.space_name}
            </Link>
          </div>
        </div>

        {/* Options Menu */}
        {memory.can_delete && (
          <div className="relative">
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1 rounded-full text-neutral-500 hover:text-black transition-colors"
              aria-label="Post options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-neutral-200 py-1.5 z-40">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Photo Carousel */}
      <Carousel
        items={memory.media_items}
        onDoubleTap={!isLiked ? handleLikeToggle : undefined}
      />

      {/* Interactions Bar */}
      <div className="px-3.5 pt-3 pb-1">
        <div className="flex items-center gap-4 mb-2">
          {/* Like */}
          <button
            onClick={handleLikeToggle}
            className="flex items-center gap-1.5 text-neutral-800 hover:text-black active:scale-90 transition-transform"
            aria-label={isLiked ? "Unlike" : "Like"}
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                isLiked
                  ? "fill-red-600 text-red-600"
                  : "text-neutral-900 stroke-[1.8]"
              }`}
            />
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 text-neutral-900 hover:text-black active:scale-90 transition-transform"
            aria-label="Comment"
          >
            <MessageCircle className="w-6 h-6 stroke-[1.8]" />
          </button>
        </div>

        {/* Likes Count */}
        {likesCount > 0 && (
          <p className="text-xs font-bold text-neutral-900 mb-1.5">
            {likesCount} {likesCount === 1 ? "like" : "likes"}
          </p>
        )}

        {/* Caption */}
        {memory.caption && (
          <div className="text-xs text-neutral-900 leading-snug mb-1">
            <Link
              href={`/u/${memory.author_username}`}
              className="font-bold mr-1.5 hover:underline"
            >
              @{memory.author_username}
            </Link>
            <span className="whitespace-pre-line">{memory.caption}</span>
          </div>
        )}

        {/* Notes ("Capture now. Remember together later.") */}
        <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1.5">
          {notes.map((note) => (
            <div key={note.id} className="group flex items-start justify-between gap-2 text-xs">
              <div className="flex items-start gap-1.5 leading-snug">
                <Link
                  href={`/u/${note.author_username}`}
                  className="font-semibold text-neutral-800 hover:underline shrink-0"
                >
                  @{note.author_username}:
                </Link>
                <span className="text-neutral-700 whitespace-pre-line">{note.body}</span>
              </div>
              {note.can_delete && (
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-neutral-400 hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                  title="Delete note"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {isAddingNote ? (
            <form onSubmit={handleAddNote} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note or memory context..."
                maxLength={500}
                className="flex-1 bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black"
                autoFocus
              />
              <button
                type="submit"
                disabled={!noteBody.trim() || isSubmittingNote}
                className="text-xs font-semibold px-2.5 py-1.5 bg-black text-white rounded-lg disabled:opacity-40"
              >
                {isSubmittingNote ? "..." : "Post"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingNote(false);
                  setNoteBody("");
                }}
                className="text-xs text-neutral-500 hover:text-black px-1"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingNote(true)}
              className="text-[11px] font-semibold text-neutral-500 hover:text-black flex items-center gap-1 transition-colors pt-0.5"
            >
              <span>+ Add a note</span>
            </button>
          )}
        </div>

        {/* View all comments */}
        {commentsCount > 0 && (
          <button
            onClick={() => setShowComments(true)}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800 block mt-1 transition-colors"
          >
            View all {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
          </button>
        )}

        {/* Memory Date */}
        <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mt-1.5 pb-2">
          {formatMemoryDate(memory.memory_date)}
        </p>
      </div>

      {/* Comment Drawer Sheet */}
      <CommentSheet
        memoryId={memory.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        onCommentCountChange={(newCount) => setCommentsCount(newCount)}
      />
    </article>
  );
}
