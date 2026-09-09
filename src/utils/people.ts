import type { AppUser } from '../types';

/**
 * Resolving a person's name from their uid, rather than trusting the copy
 * stored on the record.
 *
 * Every record in this application denormalises the assignee's name next to
 * their id — `assignedEmployeeId` + `assignedEmployeeName`, `createdBy` +
 * `createdByName`, and so on. That is a reasonable thing to do: it keeps a
 * historical record readable even after somebody leaves, and it saves a join
 * on every row.
 *
 * The cost is drift. Two invoices in this dataset carry
 * `createdBy: 'user_mgr_03'` with `createdByName: 'Rohan Verma'`, while
 * user_mgr_03 is Rohit Kulkarni everywhere else — so the same manager appears
 * under two names depending on which screen you are looking at. Rename anyone
 * in Team & RBAC today and every record they ever touched keeps the old name
 * forever.
 *
 * The rule here: the uid is the truth, the stored name is the fallback. If the
 * person is still on the team, show their current name. If the uid resolves to
 * nobody — they left, or the record predates them — the stored name is all
 * there is, so show that. Nothing invented in either direction.
 */

export type NameResolver = (uid: string | undefined | null, storedName?: string | null) => string;

export function makeNameResolver(employees: AppUser[]): NameResolver {
  const byUid = new Map<string, string>();
  for (const employee of employees) {
    if (employee.uid && employee.displayName) byUid.set(employee.uid, employee.displayName);
  }

  return (uid, storedName) => {
    const current = uid ? byUid.get(uid) : undefined;
    if (current) return current;
    const stored = storedName?.trim();
    if (stored) return stored;
    return 'Unassigned';
  };
}
