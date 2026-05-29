-- 0017 — patient_documents.
--
-- Migrated from the patients/{id}/documents Firestore subcollection.
-- file_url points at object storage (Firebase Storage today; later a
-- pre-signed S3/GCS URL). The file bytes themselves are NOT migrated by the
-- loader — only the metadata row. Storage migration is a separate concern.

-- Up Migration

CREATE TABLE patient_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    name            varchar(256) NOT NULL,
    file_url        text NOT NULL,
    doc_type        varchar(64),
    size_bytes      bigint,
    uploaded_at     timestamptz NOT NULL DEFAULT now(),
    client_uuid     uuid,
    region_id       varchar(20) NOT NULL DEFAULT 'cd-kinshasa',
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT pd_size_nonneg CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE INDEX patient_documents_patient_idx
    ON patient_documents (patient_id, uploaded_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX patient_documents_client_uuid_uidx
    ON patient_documents (client_uuid)
    WHERE client_uuid IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE patient_documents IS
    'Metadata for patient-uploaded documents. file_url references object storage; the bytes are not migrated by the loader.';

-- Down Migration

DROP TABLE IF EXISTS patient_documents;
