
/*
  # Remove Geopolitics and Politics & Governance pods

  Deletes the "Geopolitics" and "Politics & Governance" pods and their associated
  member records. Both pods have zero assumptions and zero decision threads,
  so no content data is lost.

  Pods removed:
  - Geopolitics (id: 4f6f69b0-cea5-43b2-963e-876ad2606870)
  - Politics & Governance (id: ee1d31b4-7e21-4762-896d-0f8c698f40c6)
*/

DELETE FROM pod_members
WHERE pod_id IN (
  '4f6f69b0-cea5-43b2-963e-876ad2606870',
  'ee1d31b4-7e21-4762-896d-0f8c698f40c6'
);

DELETE FROM pods
WHERE id IN (
  '4f6f69b0-cea5-43b2-963e-876ad2606870',
  'ee1d31b4-7e21-4762-896d-0f8c698f40c6'
);
