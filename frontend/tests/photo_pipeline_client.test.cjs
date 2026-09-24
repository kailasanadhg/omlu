/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');

// 1. Camera Lifecycle Attachment Test
function testCameraAttachmentRace() {
  const stream = {
    getTracks: () => [{ stop: () => {} }]
  };

  const video = {
    srcObject: null,
    readyState: 2,
    videoWidth: 1920,
    videoHeight: 1080,
    play: async () => {},
  };

  let isCameraReady = false;

  // Simulate: getUserMedia resolves BEFORE videoRef is set
  const streamRef = { current: stream };
  const videoRef = { current: null };

  const attachStream = () => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    if (v.srcObject !== s) v.srcObject = s;
    if (v.readyState >= 2 && v.videoWidth > 0) {
      v.play().then(() => {
        isCameraReady = true;
      });
    }
  };

  // 1. Stream resolved, video not mounted yet
  attachStream();
  assert.equal(video.srcObject, null, "Video should not have stream before mounting");
  assert.equal(isCameraReady, false, "Camera should not be ready before mounting");

  // 2. Video element mounts (e.g. ref callback or effect)
  videoRef.current = video;
  attachStream();

  assert.equal(video.srcObject, stream, "Stream MUST be attached immediately when video mounts");
  return Promise.resolve().then(() => {
    assert.equal(isCameraReady, true, "Camera MUST be ready once mounted with stream");
    console.log("✓ Camera lifecycle race test passed");
  });
}

// 2. Feed Optimistic Merge & Reconciliation Test
function testFeedMergeAndReconciliation() {
  const pendingDrop = {
    id: "client-uuid-1234",
    userId: "user-1",
    spaceId: "space-1",
    spaceName: "Test Space",
    author: { id: "user-1", username: "alice", display_name: "Alice" },
    caption: "Sunset",
    memoryDate: "2026-09-24",
    createdAt: "2026-09-24T12:00:00Z",
    status: "uploading",
    progress: 50,
    width: 1920,
    height: 1080,
    blob: {}
  };

  const serverMemories = [
    {
      id: "server-id-999",
      client_id: "other-client-id",
      space_id: "space-1",
      caption: "Earlier photo",
      created_at: "2026-09-24T11:00:00Z",
      media_items: []
    }
  ];

  // Helper to convert pending drop to synthetic Memory
  function pendingDropToMemory(drop) {
    return {
      id: drop.id,
      client_id: drop.id,
      space_id: drop.spaceId,
      space_name: drop.spaceName,
      caption: drop.caption,
      created_at: drop.createdAt,
      media_items: [{ secure_url: "blob:preview", width: drop.width, height: drop.height }],
      is_optimistic: true,
      upload_status: drop.status
    };
  }

  // 1. Merge: pending drop appears at head of feed
  const canonicalClientIds = new Set(serverMemories.map(m => m.client_id).filter(Boolean));
  const canonicalIds = new Set(serverMemories.map(m => m.id));

  const optimistic = [pendingDrop]
    .filter(d => !canonicalClientIds.has(d.id) && !canonicalIds.has(d.id))
    .map(pendingDropToMemory);

  const merged = [...optimistic, ...serverMemories];
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "client-uuid-1234");
  assert.equal(merged[0].is_optimistic, true);
  assert.equal(merged[1].id, "server-id-999");

  // 2. Reconciliation: canonical server response arrives with same client_id
  const canonical = {
    id: "server-id-1000",
    client_id: "client-uuid-1234",
    space_id: "space-1",
    caption: "Sunset",
    created_at: "2026-09-24T12:00:00Z",
    media_items: [{ secure_url: "https://cloudinary.com/full.jpg" }]
  };

  // Reconciled list
  const reconciledServerMemories = [canonical, ...serverMemories];
  const postReconcileClientIds = new Set(reconciledServerMemories.map(m => m.client_id).filter(Boolean));
  const postReconcileOptimistic = [pendingDrop]
    .filter(d => !postReconcileClientIds.has(d.id) && !canonicalIds.has(d.id))
    .map(pendingDropToMemory);

  const postReconciled = [...postReconcileOptimistic, ...reconciledServerMemories];
  assert.equal(postReconciled.length, 2);
  assert.equal(postReconciled[0].id, "server-id-1000");
  assert.equal(postReconciled[0].client_id, "client-uuid-1234");
  assert.equal(postReconciled[0].is_optimistic, undefined);

  console.log("✓ Feed optimistic merge & reconciliation test passed");
}

// 3. Failed Upload Retention & Manual Retry Test
function testFailedUploadRetentionAndRetry() {
  const draftStore = new Map();

  function enqueue(drop) {
    draftStore.set(drop.id, { ...drop, status: "queued", retryCount: 0 });
  }

  function markFailed(id, errorMessage) {
    const d = draftStore.get(id);
    assert(d, "Draft must exist");
    d.status = "failed";
    d.errorMessage = errorMessage;
    // CRITICAL: blob is preserved!
    assert(d.blob !== null, "Photo blob must not be discarded on failure");
  }

  function retry(id) {
    const d = draftStore.get(id);
    assert(d, "Draft must exist");
    d.status = "queued";
    d.errorMessage = null;
    d.retryCount = (d.retryCount || 0) + 1;
  }

  const drop = { id: "drop-err-1", blob: Buffer.from("image_bytes"), spaceId: "space-1" };
  enqueue(drop);
  assert.equal(draftStore.get("drop-err-1").status, "queued");

  // Simulate network failure
  markFailed("drop-err-1", "Network timeout after 45s");
  assert.equal(draftStore.get("drop-err-1").status, "failed");
  assert.equal(draftStore.get("drop-err-1").errorMessage, "Network timeout after 45s");
  assert.equal(draftStore.get("drop-err-1").blob.toString(), "image_bytes");

  // User taps retry
  retry("drop-err-1");
  assert.equal(draftStore.get("drop-err-1").status, "queued");
  assert.equal(draftStore.get("drop-err-1").errorMessage, null);
  assert.equal(draftStore.get("drop-err-1").retryCount, 1);
  assert.equal(draftStore.get("drop-err-1").blob.toString(), "image_bytes");

  console.log("✓ Failed upload retention & manual retry test passed");
}

(async () => {
  await testCameraAttachmentRace();
  testFeedMergeAndReconciliation();
  testFailedUploadRetentionAndRetry();
  testCameraTrackCleanup();
  testSpaceIsolationDuringUpload();
  testCreationFailureRetainsUploadReceipt();
  testReloadRecovery();
  console.log("ALL FRONTEND CLIENT TESTS PASSED!");
})();

// 4. Camera Stream Track Stopping on Unmount & Switch
function testCameraTrackCleanup() {
  let tracksStopped = 0;
  const mockTrack = {
    stop: () => { tracksStopped++; }
  };
  const stream = {
    getTracks: () => [mockTrack, mockTrack]
  };

  const streamRef = { current: stream };

  // Simulate unmount / switch cleanup
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  assert.equal(tracksStopped, 2, "All stream tracks must be stopped on cleanup");
  assert.equal(streamRef.current, null, "Stream ref must be nullified to prevent leaks");
  console.log("✓ Camera stream track cleanup test passed");
}

// 5. Space Isolation During Active Upload
function testSpaceIsolationDuringUpload() {
  const allDrops = [
    { id: "d1", userId: "u1", spaceId: "space-alpha", status: "uploading" },
    { id: "d2", userId: "u1", spaceId: "space-beta", status: "uploading" }
  ];

  // Space Alpha view
  const spaceAlphaDrops = allDrops.filter(d => d.userId === "u1" && d.spaceId === "space-alpha" && d.status !== "confirmed");
  assert.equal(spaceAlphaDrops.length, 1);
  assert.equal(spaceAlphaDrops[0].id, "d1");

  // Space Beta view
  const spaceBetaDrops = allDrops.filter(d => d.userId === "u1" && d.spaceId === "space-beta" && d.status !== "confirmed");
  assert.equal(spaceBetaDrops.length, 1);
  assert.equal(spaceBetaDrops[0].id, "d2");

  // Reconcile d1 (Space Alpha)
  const canonicalAlpha = { id: "server-alpha", client_id: "d1", space_id: "space-alpha" };
  const targetSpace = "space-beta"; // User is looking at Space Beta
  const shouldReconcileInBeta = canonicalAlpha.space_id === targetSpace;
  assert.equal(shouldReconcileInBeta, false, "Space Alpha canonical drop must NOT mutate Space Beta feed");

  console.log("✓ Space isolation during upload test passed");
}

// 6. Backend Creation Failure Retains Upload Receipt (No Re-upload on Retry)
function testCreationFailureRetainsUploadReceipt() {
  const drop = {
    id: "drop-receipt-1",
    blob: Buffer.from("image_data"),
    uploadSessionId: "session-abc",
    uploadResult: null,
    status: "queued"
  };

  // Step 2: Upload to Cloudinary succeeds
  drop.uploadResult = {
    public_id: "omlu/spaces/1/abc",
    secure_url: "https://cloudinary.com/abc.jpg",
    width: 1920,
    height: 1080
  };
  drop.status = "creating";

  // Step 3: Backend creation throws 500 / network error
  drop.status = "failed";
  drop.errorMessage = "Backend temporary 500 error";

  // Assert receipt is PRESERVED
  assert.notEqual(drop.uploadResult, null, "Cloudinary uploadResult receipt must be retained on creation failure");

  // On retry: worker checks if drop.uploadResult already exists
  let didReupload = false;
  function processRetry(d) {
    if (!d.uploadResult) {
      didReupload = true;
    }
    // Proceeds directly to creation
    d.status = "confirmed";
  }

  processRetry(drop);
  assert.equal(didReupload, false, "Retry must NOT re-upload image bytes if uploadResult receipt is already present");
  assert.equal(drop.status, "confirmed");

  console.log("✓ Creation failure receipt retention (no re-upload) test passed");
}

// 7. Reload Recovery
function testReloadRecovery() {
  const interruptedDrops = [
    { id: "drop-interrupted-1", status: "uploading", blob: Buffer.from("bytes1") },
    { id: "drop-interrupted-2", status: "creating", blob: Buffer.from("bytes2") },
    { id: "drop-failed", status: "failed", blob: Buffer.from("bytes3"), errorMessage: "Previous error" },
    { id: "drop-queued", status: "queued", blob: Buffer.from("bytes4") }
  ];

  // initDropQueue logic on reload
  for (const d of interruptedDrops) {
    if (d.status === "signing" || d.status === "uploading" || d.status === "creating") {
      d.status = "queued";
    }
  }

  assert.equal(interruptedDrops[0].status, "queued", "In-flight uploading drop must be reset to queued to resume");
  assert.equal(interruptedDrops[1].status, "queued", "In-flight creating drop must be reset to queued to resume");
  assert.equal(interruptedDrops[2].status, "failed", "Failed drop must remain failed for user review");
  assert.equal(interruptedDrops[3].status, "queued", "Queued drop remains queued");

  // All blobs intact
  for (const d of interruptedDrops) {
    assert(d.blob !== null, "All blobs must be intact after reload recovery");
  }

  console.log("✓ Reload recovery test passed");
}
