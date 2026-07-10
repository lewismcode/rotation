import { query } from "../client.js";
import type { User, UserRole, ThemePreference } from "@rotation/shared";

export async function getUserByClerkId(clerkUserId: string): Promise<User | null> {
  const { rows } = await query<User>(
    "SELECT * FROM users WHERE clerk_user_id = $1",
    [clerkUserId]
  );
  return rows[0] ?? null;
}

/** Upsert a user into a label. Role defaults to artist for invited users. */
export async function upsertUser(input: {
  clerkUserId: string;
  labelId: string;
  role?: UserRole;
}): Promise<User> {
  const { rows } = await query<User>(
    `INSERT INTO users (clerk_user_id, label_id, role)
     VALUES ($1, $2, COALESCE($3, 'artist'))
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET label_id = EXCLUDED.label_id
     RETURNING *`,
    [input.clerkUserId, input.labelId, input.role ?? null]
  );
  return rows[0]!;
}

export async function setThemePreference(
  userId: string,
  theme: ThemePreference
): Promise<void> {
  await query("UPDATE users SET theme_preference = $2 WHERE id = $1", [
    userId,
    theme,
  ]);
}
