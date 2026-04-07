---
title: Data Processing Agreement
---

**Last updated: April 2, 2026**

This Data Processing Agreement ("DPA") forms part of the agreement between Flowmail ("Processor") and the customer ("Controller") for the provision of the Flowmail service.

## 1. Definitions

- **Personal Data**: Any information relating to an identified or identifiable natural person, as defined under GDPR Article 4(1).
- **Processing**: Any operation performed on Personal Data, including collection, storage, use, disclosure, and deletion.
- **Sub-processor**: A third party engaged by the Processor to process Personal Data on behalf of the Controller.

## 2. Scope of Processing

The Processor processes Personal Data solely to provide the Flowmail service, specifically:

| Processing Activity | Data Categories | Purpose | Legal Basis |
|---------------------|----------------|---------|-------------|
| Email synchronization | Email headers, body content, metadata | Ingest emails for classification | Contract performance / Consent |
| AI classification | Email content (transient) | Categorize emails into business entities | Legitimate interest / Consent |
| Structured extraction | Email content (transient) | Extract fields, summaries, and action items | Legitimate interest / Consent |
| Entity storage | Extracted fields, summaries, statuses | Provide Smart Inbox and entity management | Contract performance |
| Notification delivery | User email, entity summaries | Send transactional notifications | Contract performance |

## 3. Sub-processors

The Processor uses the following sub-processors:

| Sub-processor | Purpose | Location | DPA Status |
|--------------|---------|----------|------------|
| OpenAI | AI inference (classification, extraction, summarization) | USA | DPA available |
| Anthropic | AI inference (alternative provider) | USA | DPA available |
| Vercel | Application hosting, serverless compute | Global (edge) | DPA available |
| Neon / PostgreSQL provider | Database storage | Configurable region | DPA available |
| Resend | Transactional email delivery | USA | DPA available |

The Controller will be notified of any changes to sub-processors at least 30 days in advance.

## 4. Data Security Measures

The Processor implements the following technical and organizational measures:

- **Encryption at rest**: AES-256-GCM for email body content, OAuth tokens, and sensitive credentials
- **Encryption in transit**: TLS 1.3 for all network communications
- **Access control**: Organization-level data isolation with server-side authorization checks
- **Data minimization**: Email content is processed transiently for AI classification; structured data is retained
- **Data retention**: Unclassified email threads expire after 90 days; business entities are retained while the account is active
- **Audit logging**: Sensitive operations (data export, account deletion, email sync) are logged with user ID, timestamp, and IP address
- **Rate limiting**: Per-connection rate limits on email synchronization to prevent abuse

## 5. Data Subject Rights

The Processor supports the Controller in fulfilling data subject requests:

- **Right of Access**: Users can view all extracted data in the Flowmail dashboard
- **Right to Data Portability**: Users can export all data via Settings > Privacy > Export Data (JSON format)
- **Right to Erasure**: Users can delete their account via Settings > Danger Zone, or disconnect email accounts to stop processing
- **Right to Restriction**: Users can deactivate email connections to pause processing without deletion

## 6. Data Breach Notification

The Processor will notify the Controller of any Personal Data breach without undue delay and within 72 hours of becoming aware of the breach, in compliance with GDPR Article 33.

## 7. Data Return and Deletion

Upon termination of the agreement:
- The Controller may export all data via the data export feature
- The Processor will delete all Personal Data within 30 days of account deletion
- Audit logs are retained for 12 months for compliance purposes

## 8. International Data Transfers

Where Personal Data is transferred outside the EEA, the Processor ensures adequate safeguards through:
- Standard Contractual Clauses (SCCs) with sub-processors
- Sub-processor DPAs and certifications
- Technical measures (encryption, pseudonymization) during transfer

## 9. Contact

For DPA inquiries:
- Email: dpa@flowmail.ai
- To request a signed DPA for your organization, please contact your Flowmail account representative.
