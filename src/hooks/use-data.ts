"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

/** Shared live queries. Dexie re-runs them automatically when the underlying tables change. */

export const useAllNotes = () => useLiveQuery(() => db.notes.toArray(), []);
export const useFolders = () => useLiveQuery(() => db.folders.orderBy("order").toArray(), []);
export const useCards = () => useLiveQuery(() => db.cards.toArray(), []);
export const useReviews = () => useLiveQuery(() => db.reviews.toArray(), []);
export const useQuizAttempts = () => useLiveQuery(() => db.quizAttempts.orderBy("finishedAt").reverse().toArray(), []);
