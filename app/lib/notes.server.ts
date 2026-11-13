import { and, desc, eq } from "drizzle-orm";
import { courses, lessons, modules, notes } from "~/db/schema";
import type { Db } from "~/lib/comments.server";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

// ─── Notes ───
// A Student's own plain-text writing about a Lesson, private to them. See
// GLOSSARY.md. One per Student per Lesson, enforced by a unique index. Only
// the owning Student's Lesson page and Saved page may read a Note body.
// Every function takes the database first, so tests can hand in an in-memory
// one.

export function getNote(db: Db, studentId: number, lessonId: number) {
  return db
    .select({ body: notes.body, updatedAt: notes.updatedAt })
    .from(notes)
    .where(and(eq(notes.userId, studentId), eq(notes.lessonId, lessonId)))
    .get();
}

export type SaveNoteResult =
  | { ok: true; deleted: boolean }
  | { ok: false; error: string };

/**
 * Stores the Student's Note on a Lesson. The body is trimmed. Saving again
 * replaces the body and moves `updatedAt` on; `createdAt` is kept. An empty
 * body removes the Note. Over MAX_NOTE_LENGTH is refused, never truncated.
 */
export function saveNote(
  db: Db,
  studentId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const trimmed = body.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `A note can be at most ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters.`,
    };
  }

  if (trimmed.length === 0) {
    db.delete(notes)
      .where(and(eq(notes.userId, studentId), eq(notes.lessonId, lessonId)))
      .run();
    return { ok: true, deleted: true };
  }

  const stamp = now.toISOString();
  db.insert(notes)
    .values({
      userId: studentId,
      lessonId,
      body: trimmed,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: trimmed, updatedAt: stamp },
    })
    .run();
  return { ok: true, deleted: false };
}

/** The Student's Notes, last edited first, each with the Lesson and Course it belongs to. */
export function listNotes(db: Db, studentId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, studentId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
}
