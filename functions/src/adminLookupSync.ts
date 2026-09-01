import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";

/**
 * The admin app's `admin` collection docs are NOT reliably keyed by the
 * user's Auth uid — invite-created docs get an auto-generated doc ID with
 * `uid` stored only as a field; only self-created/migrated docs use the uid
 * as the doc ID (see Admin-Rent2Reuse-website's teamMembers/page.tsx vs
 * admin/profile/page.tsx). Firestore security rules can only do a direct
 * get()/exists() by known path, not a where() query, so a rule checking
 * `admin/{request.auth.uid}` directly would silently fail for most real
 * admins.
 *
 * This mirrors every `admin` doc write into `admin_lookup/{uid}` (doc ID =
 * the `uid` *field*, correctly keyed regardless of the source doc's own
 * ID). firestore.rules' isApprovedAdmin() reads only this mirror.
 */
export const syncAdminLookup = onDocumentWritten(
  "admin/{adminDocId}",
  async (event) => {
    const db = getFirestore();
    const after = event.data?.after;

    if (!after?.exists) {
      // Doc deleted — clean up its mirror using the uid from the prior version.
      const uid = event.data?.before?.data()?.uid;
      if (uid) {
        await db
          .doc(`admin_lookup/${uid}`)
          .delete()
          .catch(() => {});
      }
      return;
    }

    const data = after.data();
    const uid = data?.uid;
    if (!uid) return; // malformed doc (no uid field) — nothing safe to mirror

    await db.doc(`admin_lookup/${uid}`).set({
      uid,
      accountStatus: data.accountStatus ?? null,
      adminRole: data.adminRole ?? "",
      sourceDocId: after.id,
      updatedAt: new Date().toISOString(),
    });
  }
);
