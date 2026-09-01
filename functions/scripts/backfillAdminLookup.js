// One-time backfill: mirrors every existing `admin` doc into
// `admin_lookup/{uid}` so isApprovedAdmin() in firestore.rules works
// immediately for pre-existing admins, without waiting for each admin doc
// to be touched again (the syncAdminLookup Cloud Function backfills any
// doc lazily on its next write, but this closes that "stale until
// touched" window in one shot).
//
// Run once, locally, with an Admin SDK service account that has access to
// the `petshelapp` Firebase project (this bypasses firestore.rules
// entirely, same as any Admin SDK script):
//
//   cd functions
//   node scripts/backfillAdminLookup.js /path/to/serviceAccountKey.json
//
// Safe to re-run — it's an idempotent overwrite of each admin_lookup doc.

const admin = require("firebase-admin");

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/backfillAdminLookup.js /path/to/serviceAccountKey.json"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

async function main() {
  const adminDocs = await db.collection("admin").get();
  console.log(`Found ${adminDocs.size} admin doc(s).`);

  let mirrored = 0;
  let skipped = 0;

  for (const doc of adminDocs.docs) {
    const data = doc.data();
    const uid = data.uid;
    if (!uid) {
      console.warn(`Skipping admin doc ${doc.id} — no uid field.`);
      skipped++;
      continue;
    }

    await db.doc(`admin_lookup/${uid}`).set({
      uid,
      accountStatus: data.accountStatus ?? null,
      adminRole: data.adminRole ?? "",
      sourceDocId: doc.id,
      updatedAt: new Date().toISOString(),
    });
    mirrored++;
    console.log(`Mirrored admin/${doc.id} -> admin_lookup/${uid}`);
  }

  console.log(`\nDone. Mirrored ${mirrored}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
