
/*
  # Remove Economy pod

  Deletes the "Economy" pod and its associated member records.

  Pod removed:
  - Economy (id: a6bb2193-963b-4877-8168-20363260eef8)
*/

DELETE FROM pod_members
WHERE pod_id = 'a6bb2193-963b-4877-8168-20363260eef8';

DELETE FROM pods
WHERE id = 'a6bb2193-963b-4877-8168-20363260eef8';
