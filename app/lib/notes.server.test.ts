import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { getNote, listNotes, saveNote } from "./notes.server";
import { MAX_NOTE_LENGTH } from "./notes";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

function at(minute: number) {
  return new Date(2026, 9, 6, 12, minute, 0);
}

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("saving a Note", () => {
  it("creates the Note with the body trimmed", () => {
    expect(saveNote(db, base.user.id, lessonIds[0], "  # not a heading  ", at(0))).toEqual({
      ok: true,
      deleted: false,
    });

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "# not a heading",
      updatedAt: at(0).toISOString(),
    });
  });

  it("replaces the body and moves the last edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "first", at(0));
    saveNote(db, base.user.id, lessonIds[0], "second", at(5));

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "second",
      updatedAt: at(5).toISOString(),
    });
    expect(listNotes(db, base.user.id)).toHaveLength(1);
  });

  it("never leaves a Student with two Notes on one Lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "first", at(0));

    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "dup" })
        .run()
    ).toThrow();
  });

  it("accepts a Note of exactly the maximum length", () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);
    expect(saveNote(db, base.user.id, lessonIds[0], body, at(0)).ok).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe(body);
  });

  it("refuses a Note over the maximum length and keeps the old one", () => {
    saveNote(db, base.user.id, lessonIds[0], "keep me", at(0));

    const result = saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "a".repeat(MAX_NOTE_LENGTH + 1),
      at(5)
    );

    expect(result).toEqual({
      ok: false,
      error: "A note can be at most 2,000 characters.",
    });
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("keep me");
  });

  it("removes the Note when saved empty", () => {
    saveNote(db, base.user.id, lessonIds[0], "first", at(0));

    expect(saveNote(db, base.user.id, lessonIds[0], "   ", at(5))).toEqual({
      ok: true,
      deleted: true,
    });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });
});

describe("listing a Student's Notes", () => {
  it("lists only that Student's Notes, last edited first, with Lesson and Course", () => {
    const other = db
      .insert(schema.users)
      .values({ name: "Other", email: "other@example.com", role: UserRole.Student })
      .returning()
      .get();

    saveNote(db, base.user.id, lessonIds[0], "one", at(0));
    saveNote(db, base.user.id, lessonIds[1], "two", at(5));
    saveNote(db, other.id, lessonIds[0], "not mine", at(10));
    saveNote(db, base.user.id, lessonIds[0], "one, edited", at(15));

    expect(listNotes(db, base.user.id)).toMatchObject([
      {
        lessonId: lessonIds[0],
        body: "one, edited",
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      { lessonId: lessonIds[1], body: "two" },
    ]);
  });
});
