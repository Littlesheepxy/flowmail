/**
 * Prisma Zod Generator - Single File (inlined)
 * Auto-generated. Do not edit.
 */

import * as z from 'zod';
// File: TransactionIsolationLevel.schema.ts

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted', 'ReadCommitted', 'RepeatableRead', 'Serializable'])

export type TransactionIsolationLevel = z.infer<typeof TransactionIsolationLevelSchema>;

// File: UserScalarFieldEnum.schema.ts

export const UserScalarFieldEnumSchema = z.enum(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'username', 'role', 'banned', 'banReason', 'banExpires', 'onboardingComplete', 'paymentsCustomerId', 'locale', 'displayUsername', 'twoFactorEnabled'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;

// File: SessionScalarFieldEnum.schema.ts

export const SessionScalarFieldEnumSchema = z.enum(['id', 'expiresAt', 'ipAddress', 'userAgent', 'userId', 'impersonatedBy', 'activeOrganizationId', 'token', 'createdAt', 'updatedAt'])

export type SessionScalarFieldEnum = z.infer<typeof SessionScalarFieldEnumSchema>;

// File: AccountScalarFieldEnum.schema.ts

export const AccountScalarFieldEnumSchema = z.enum(['id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'expiresAt', 'password', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;

// File: VerificationScalarFieldEnum.schema.ts

export const VerificationScalarFieldEnumSchema = z.enum(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'])

export type VerificationScalarFieldEnum = z.infer<typeof VerificationScalarFieldEnumSchema>;

// File: PasskeyScalarFieldEnum.schema.ts

export const PasskeyScalarFieldEnumSchema = z.enum(['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'aaguid', 'createdAt'])

export type PasskeyScalarFieldEnum = z.infer<typeof PasskeyScalarFieldEnumSchema>;

// File: TwoFactorScalarFieldEnum.schema.ts

export const TwoFactorScalarFieldEnumSchema = z.enum(['id', 'secret', 'backupCodes', 'userId'])

export type TwoFactorScalarFieldEnum = z.infer<typeof TwoFactorScalarFieldEnumSchema>;

// File: OrganizationScalarFieldEnum.schema.ts

export const OrganizationScalarFieldEnumSchema = z.enum(['id', 'name', 'slug', 'logo', 'createdAt', 'metadata', 'paymentsCustomerId', 'inboundEmailAddress', 'inboundEmailShortId'])

export type OrganizationScalarFieldEnum = z.infer<typeof OrganizationScalarFieldEnumSchema>;

// File: MemberScalarFieldEnum.schema.ts

export const MemberScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'createdAt'])

export type MemberScalarFieldEnum = z.infer<typeof MemberScalarFieldEnumSchema>;

// File: InvitationScalarFieldEnum.schema.ts

export const InvitationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'email', 'role', 'status', 'expiresAt', 'inviterId', 'createdAt'])

export type InvitationScalarFieldEnum = z.infer<typeof InvitationScalarFieldEnumSchema>;

// File: PurchaseScalarFieldEnum.schema.ts

export const PurchaseScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'customerId', 'subscriptionId', 'productId', 'status', 'createdAt', 'updatedAt'])

export type PurchaseScalarFieldEnum = z.infer<typeof PurchaseScalarFieldEnumSchema>;

// File: WaitlistEntryScalarFieldEnum.schema.ts

export const WaitlistEntryScalarFieldEnumSchema = z.enum(['id', 'email', 'createdAt'])

export type WaitlistEntryScalarFieldEnum = z.infer<typeof WaitlistEntryScalarFieldEnumSchema>;

// File: InboundEmailScalarFieldEnum.schema.ts

export const InboundEmailScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'fromEmail', 'subject', 'textBody', 'htmlBody', 'rawHeaders', 'rawPayload', 'contentHash', 'entityId', 'processedAt', 'createdAt'])

export type InboundEmailScalarFieldEnum = z.infer<typeof InboundEmailScalarFieldEnumSchema>;

// File: EmailConnectionScalarFieldEnum.schema.ts

export const EmailConnectionScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'provider', 'authType', 'email', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'imapHost', 'imapPort', 'smtpHost', 'smtpPort', 'imapPassword', 'appId', 'appSecret', 'maxSyncCount', 'isActive', 'lastSyncAt', 'syncCursor', 'createdAt', 'updatedAt'])

export type EmailConnectionScalarFieldEnum = z.infer<typeof EmailConnectionScalarFieldEnumSchema>;

// File: EmailThreadScalarFieldEnum.schema.ts

export const EmailThreadScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'connectionId', 'externalThreadId', 'subject', 'sender', 'senderName', 'participants', 'toRecipients', 'ccRecipients', 'snippet', 'bodyHtml', 'bodyText', 'rawPayload', 'messageId', 'entityId', 'receivedAt', 'processedAt', 'createdAt'])

export type EmailThreadScalarFieldEnum = z.infer<typeof EmailThreadScalarFieldEnumSchema>;

// File: EmailAttachmentScalarFieldEnum.schema.ts

export const EmailAttachmentScalarFieldEnumSchema = z.enum(['id', 'threadId', 'filename', 'mimeType', 'size', 'externalId', 'contentId', 'storageKey', 'extractedText', 'extractedBy', 'extractedAt', 'extractError', 'createdAt'])

export type EmailAttachmentScalarFieldEnum = z.infer<typeof EmailAttachmentScalarFieldEnumSchema>;

// File: CategoryScalarFieldEnum.schema.ts

export const CategoryScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'name', 'slug', 'icon', 'color', 'aiPrompt', 'sortOrder', 'isDefault', 'createdAt', 'updatedAt'])

export type CategoryScalarFieldEnum = z.infer<typeof CategoryScalarFieldEnumSchema>;

// File: TagScalarFieldEnum.schema.ts

export const TagScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'name', 'color', 'source', 'createdAt'])

export type TagScalarFieldEnum = z.infer<typeof TagScalarFieldEnumSchema>;

// File: EntityTagScalarFieldEnum.schema.ts

export const EntityTagScalarFieldEnumSchema = z.enum(['id', 'entityId', 'tagId'])

export type EntityTagScalarFieldEnum = z.infer<typeof EntityTagScalarFieldEnumSchema>;

// File: FlowEntityScalarFieldEnum.schema.ts

export const FlowEntityScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'type', 'categoryId', 'title', 'status', 'extractedFields', 'aiSummary', 'aiConfidence', 'requiresReview', 'isFiltered', 'assigneeId', 'createdAt', 'updatedAt'])

export type FlowEntityScalarFieldEnum = z.infer<typeof FlowEntityScalarFieldEnumSchema>;

// File: EntityViewScalarFieldEnum.schema.ts

export const EntityViewScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'entityId', 'categoryId', 'title', 'icon', 'spec', 'isPinned', 'sortOrder', 'createdById', 'createdAt', 'updatedAt'])

export type EntityViewScalarFieldEnum = z.infer<typeof EntityViewScalarFieldEnumSchema>;

// File: TimelineEventScalarFieldEnum.schema.ts

export const TimelineEventScalarFieldEnumSchema = z.enum(['id', 'entityId', 'type', 'content', 'metadata', 'actorId', 'createdAt'])

export type TimelineEventScalarFieldEnum = z.infer<typeof TimelineEventScalarFieldEnumSchema>;

// File: NotificationScalarFieldEnum.schema.ts

export const NotificationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'title', 'body', 'entityId', 'isRead', 'sentViaEmail', 'createdAt'])

export type NotificationScalarFieldEnum = z.infer<typeof NotificationScalarFieldEnumSchema>;

// File: AuditLogScalarFieldEnum.schema.ts

export const AuditLogScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'action', 'targetType', 'targetId', 'metadata', 'ipAddress', 'userAgent', 'createdAt'])

export type AuditLogScalarFieldEnum = z.infer<typeof AuditLogScalarFieldEnumSchema>;

// File: ApiTokenScalarFieldEnum.schema.ts

export const ApiTokenScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'name', 'tokenHash', 'tokenPrefix', 'scopes', 'lastUsedAt', 'expiresAt', 'isActive', 'createdAt'])

export type ApiTokenScalarFieldEnum = z.infer<typeof ApiTokenScalarFieldEnumSchema>;

// File: AgentMemoryScalarFieldEnum.schema.ts

export const AgentMemoryScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'category', 'scope', 'scopeId', 'content', 'metadata', 'importance', 'accessCount', 'lastAccessedAt', 'expiresAt', 'memoryObjectId', 'createdAt', 'updatedAt'])

export type AgentMemoryScalarFieldEnum = z.infer<typeof AgentMemoryScalarFieldEnumSchema>;

// File: MemoryObjectScalarFieldEnum.schema.ts

export const MemoryObjectScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'objectType', 'objectId', 'name', 'attributes', 'relations', 'lastUpdatedAt', 'createdAt', 'updatedAt'])

export type MemoryObjectScalarFieldEnum = z.infer<typeof MemoryObjectScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: NullableJsonNullValueInput.schema.ts

export const NullableJsonNullValueInputSchema = z.enum(['DbNull', 'JsonNull'])

export type NullableJsonNullValueInput = z.infer<typeof NullableJsonNullValueInputSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: QueryMode.schema.ts

export const QueryModeSchema = z.enum(['default', 'insensitive'])

export type QueryMode = z.infer<typeof QueryModeSchema>;

// File: NullsOrder.schema.ts

export const NullsOrderSchema = z.enum(['first', 'last'])

export type NullsOrder = z.infer<typeof NullsOrderSchema>;

// File: JsonNullValueFilter.schema.ts

export const JsonNullValueFilterSchema = z.enum(['DbNull', 'JsonNull', 'AnyNull'])

export type JsonNullValueFilter = z.infer<typeof JsonNullValueFilterSchema>;

// File: PurchaseType.schema.ts

export const PurchaseTypeSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME'])

export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// File: TagSource.schema.ts

export const TagSourceSchema = z.enum(['AI', 'USER'])

export type TagSource = z.infer<typeof TagSourceSchema>;

// File: EntityType.schema.ts

export const EntityTypeSchema = z.enum(['APPROVAL', 'REPORT', 'ISSUE', 'FEEDBACK', 'NOISE'])

export type EntityType = z.infer<typeof EntityTypeSchema>;

// File: NotificationType.schema.ts

export const NotificationTypeSchema = z.enum(['DEADLINE_WARNING', 'DEADLINE_OVERDUE', 'APPROVAL_TIMEOUT', 'NEW_ENTITY', 'STATUS_CHANGED', 'DAILY_DIGEST'])

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// File: AuditAction.schema.ts

export const AuditActionSchema = z.enum(['LOGIN', 'LOGOUT', 'SIGNUP', 'OTP_REQUEST', 'OTP_VERIFY', 'PASSWORD_RESET', 'EMAIL_CONNECTION_CREATE', 'EMAIL_CONNECTION_DELETE', 'EMAIL_SYNC', 'EMAIL_SEND', 'INBOUND_EMAIL_RECEIVED', 'ENTITY_STATUS_CHANGE', 'ENTITY_APPROVE', 'ENTITY_REJECT', 'API_TOKEN_CREATE', 'API_TOKEN_REVOKE', 'MEMBER_INVITE', 'MEMBER_REMOVE', 'ORGANIZATION_CREATE', 'ORGANIZATION_DELETE', 'SETTINGS_CHANGE', 'DATA_EXPORT'])

export type AuditAction = z.infer<typeof AuditActionSchema>;

// File: User.schema.ts

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  username: z.string().nullish(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: z.date().nullish(),
  onboardingComplete: z.boolean(),
  paymentsCustomerId: z.string().nullish(),
  locale: z.string().nullish(),
  displayUsername: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
});

export type UserType = z.infer<typeof UserSchema>;


// File: Session.schema.ts

export const SessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  userId: z.string(),
  impersonatedBy: z.string().nullish(),
  activeOrganizationId: z.string().nullish(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SessionType = z.infer<typeof SessionSchema>;


// File: Account.schema.ts

export const AccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  expiresAt: z.date().nullish(),
  password: z.string().nullish(),
  accessTokenExpiresAt: z.date().nullish(),
  refreshTokenExpiresAt: z.date().nullish(),
  scope: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccountType = z.infer<typeof AccountSchema>;


// File: Verification.schema.ts

export const VerificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type VerificationType = z.infer<typeof VerificationSchema>;


// File: Passkey.schema.ts

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  publicKey: z.string(),
  userId: z.string(),
  credentialID: z.string(),
  counter: z.number().int(),
  deviceType: z.string(),
  backedUp: z.boolean(),
  transports: z.string().nullish(),
  aaguid: z.string().nullish(),
  createdAt: z.date().nullish(),
});

export type PasskeyType = z.infer<typeof PasskeySchema>;


// File: TwoFactor.schema.ts

export const TwoFactorSchema = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  userId: z.string(),
});

export type TwoFactorType = z.infer<typeof TwoFactorSchema>;


// File: Organization.schema.ts

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  createdAt: z.date(),
  metadata: z.string().nullish(),
  paymentsCustomerId: z.string().nullish(),
  inboundEmailAddress: z.string().nullish(),
  inboundEmailShortId: z.string().nullish(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;


// File: Member.schema.ts

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

export type MemberType = z.infer<typeof MemberSchema>;


// File: Invitation.schema.ts

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
  createdAt: z.date(),
});

export type InvitationType = z.infer<typeof InvitationSchema>;


// File: Purchase.schema.ts

export const PurchaseSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  type: PurchaseTypeSchema,
  customerId: z.string(),
  subscriptionId: z.string().nullish(),
  productId: z.string(),
  status: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PurchaseModel = z.infer<typeof PurchaseSchema>;

// File: WaitlistEntry.schema.ts

export const WaitlistEntrySchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.date(),
});

export type WaitlistEntryType = z.infer<typeof WaitlistEntrySchema>;


// File: InboundEmail.schema.ts

export const InboundEmailSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  textBody: z.string().nullish(),
  htmlBody: z.string().nullish(),
  rawHeaders: z.string().nullish(),
  rawPayload: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  contentHash: z.string().nullish(),
  entityId: z.string().nullish(),
  processedAt: z.date().nullish(),
  createdAt: z.date(),
});

export type InboundEmailType = z.infer<typeof InboundEmailSchema>;


// File: EmailConnection.schema.ts

export const EmailConnectionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  provider: z.string(),
  authType: z.string().default("oauth2"),
  email: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  tokenExpiresAt: z.date().nullish(),
  imapHost: z.string().nullish(),
  imapPort: z.number().int().nullish(),
  smtpHost: z.string().nullish(),
  smtpPort: z.number().int().nullish(),
  imapPassword: z.string().nullish(),
  appId: z.string().nullish(),
  appSecret: z.string().nullish(),
  maxSyncCount: z.number().int().default(500),
  isActive: z.boolean().default(true),
  lastSyncAt: z.date().nullish(),
  syncCursor: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EmailConnectionType = z.infer<typeof EmailConnectionSchema>;


// File: EmailThread.schema.ts

export const EmailThreadSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  connectionId: z.string().nullish(),
  externalThreadId: z.string(),
  subject: z.string(),
  sender: z.string(),
  senderName: z.string().nullish(),
  participants: z.string(),
  toRecipients: z.string().nullish(),
  ccRecipients: z.string().nullish(),
  snippet: z.string().nullish(),
  bodyHtml: z.string().nullish(),
  bodyText: z.string().nullish(),
  rawPayload: z.string().nullish(),
  messageId: z.string().nullish(),
  entityId: z.string().nullish(),
  receivedAt: z.date(),
  processedAt: z.date().nullish(),
  createdAt: z.date(),
});

export type EmailThreadType = z.infer<typeof EmailThreadSchema>;


// File: EmailAttachment.schema.ts

export const EmailAttachmentSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  filename: z.string(),
  mimeType: z.string().nullish(),
  size: z.number().int().nullish(),
  externalId: z.string(),
  contentId: z.string().nullish(),
  storageKey: z.string().nullish(),
  extractedText: z.string().nullish(),
  extractedBy: z.string().nullish(),
  extractedAt: z.date().nullish(),
  extractError: z.string().nullish(),
  createdAt: z.date(),
});

export type EmailAttachmentType = z.infer<typeof EmailAttachmentSchema>;


// File: Category.schema.ts

export const CategorySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: z.string().default("InboxIcon"),
  color: z.string().default("#6366f1"),
  aiPrompt: z.string(),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CategoryType = z.infer<typeof CategorySchema>;


// File: Tag.schema.ts

export const TagSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  color: z.string().default("#6366f1"),
  source: TagSourceSchema.default("AI"),
  createdAt: z.date(),
});

export type TagType = z.infer<typeof TagSchema>;


// File: EntityTag.schema.ts

export const EntityTagSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  tagId: z.string(),
});

export type EntityTagType = z.infer<typeof EntityTagSchema>;


// File: FlowEntity.schema.ts

export const FlowEntitySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: EntityTypeSchema,
  categoryId: z.string().nullish(),
  title: z.string(),
  status: z.string().default("pending"),
  extractedFields: z.string().default("{}"),
  aiSummary: z.string().nullish(),
  aiConfidence: z.number().nullish(),
  requiresReview: z.boolean(),
  isFiltered: z.boolean(),
  assigneeId: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FlowEntityType = z.infer<typeof FlowEntitySchema>;


// File: EntityView.schema.ts

export const EntityViewSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  entityId: z.string().nullish(),
  categoryId: z.string().nullish(),
  title: z.string(),
  icon: z.string().default("LayoutDashboardIcon"),
  spec: z.string().default("{\"blocks\":[]}"),
  isPinned: z.boolean(),
  sortOrder: z.number().int(),
  createdById: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EntityViewType = z.infer<typeof EntityViewSchema>;


// File: TimelineEvent.schema.ts

export const TimelineEventSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  type: z.string(),
  content: z.string(),
  metadata: z.string().nullish(),
  actorId: z.string().nullish(),
  createdAt: z.date(),
});

export type TimelineEventType = z.infer<typeof TimelineEventSchema>;


// File: Notification.schema.ts

export const NotificationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  entityId: z.string().nullish(),
  isRead: z.boolean(),
  sentViaEmail: z.boolean(),
  createdAt: z.date(),
});

export type NotificationModel = z.infer<typeof NotificationSchema>;

// File: AuditLog.schema.ts

export const AuditLogSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  action: AuditActionSchema,
  targetType: z.string().nullish(),
  targetId: z.string().nullish(),
  metadata: z.string().nullish(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  createdAt: z.date(),
});

export type AuditLogType = z.infer<typeof AuditLogSchema>;


// File: ApiToken.schema.ts

export const ApiTokenSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  tokenHash: z.string(),
  tokenPrefix: z.string(),
  scopes: z.string().default("mcp:full"),
  lastUsedAt: z.date().nullish(),
  expiresAt: z.date().nullish(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
});

export type ApiTokenType = z.infer<typeof ApiTokenSchema>;


// File: AgentMemory.schema.ts

export const AgentMemorySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  category: z.string(),
  scope: z.string().default("org"),
  scopeId: z.string().nullish(),
  content: z.string(),
  metadata: z.string().nullish(),
  importance: z.number().int().default(5),
  accessCount: z.number().int(),
  lastAccessedAt: z.date().nullish(),
  expiresAt: z.date().nullish(),
  memoryObjectId: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AgentMemoryType = z.infer<typeof AgentMemorySchema>;


// File: MemoryObject.schema.ts

export const MemoryObjectSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  objectType: z.string(),
  objectId: z.string(),
  name: z.string(),
  attributes: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("{}"),
  relations: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  lastUpdatedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MemoryObjectType = z.infer<typeof MemoryObjectSchema>;

