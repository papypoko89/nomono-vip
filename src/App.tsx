import {
  AlertTriangle,
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Image,
  ListChecks,
  MessageSquare,
  Package,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SUPABASE_PHOTO_BUCKET, isSupabaseConfigured, supabase } from './supabaseClient';

type Tab = 'vip' | 'checklist' | 'dashboard' | 'report' | 'issues' | 'master';
type RealtimeState = 'idle' | 'connected' | 'disconnected';
type TemplateType = 'opening' | 'closing' | 'custom';
type RunStatus = 'not_started' | 'in_progress' | 'completed' | 'has_issue';
type RunItemStatus = 'pending' | 'done' | 'issue' | 'skipped';
type PermissionLevel = 'Staff' | 'Supervisor' | 'Manager';
type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
type IssueSource = 'checklist' | 'vip_complimentary' | 'manual';

type VipItem = {
  id: string;
  name: string;
  category: string;
  hpp: number;
  defaultQty: number;
  active: boolean;
};

type VipSessionItem = {
  id: string;
  itemId: string;
  itemName: string;
  hpp: number;
  preparedQty: number;
  sealedLeftQty: number;
  usedQty: number;
  returnToStockQty: number;
  totalCost: number;
  majooInputDone: boolean;
};

type VipSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingName: string;
  room: string;
  staffName: string;
  status: 'draft' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: VipSessionItem[];
};

type VipForm = Omit<VipSession, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'items'> & {
  items: VipSessionItem[];
};

type Role = {
  roleId: string;
  roleName: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Staff = {
  staffId: string;
  staffName: string;
  roleId: string;
  openingTemplateId: string;
  closingTemplateId: string;
  isActive: boolean;
  permissionLevel: PermissionLevel;
  createdAt: string;
  updatedAt: string;
};

type ChecklistTemplate = {
  templateId: string;
  templateName: string;
  templateType: TemplateType;
  roleId: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChecklistTemplateItem = {
  templateItemId: string;
  templateId: string;
  itemName: string;
  itemDescription: string;
  sortOrder: number;
  photoRequired: boolean;
  noteRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChecklistRun = {
  runId: string;
  date: string;
  staffId: string;
  staffName: string;
  roleId: string;
  roleName: string;
  templateId: string;
  templateName: string;
  templateType: TemplateType;
  status: RunStatus;
  startedAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

type ChecklistRunItem = {
  runItemId: string;
  runId: string;
  templateItemId: string;
  issueId?: string;
  itemName: string;
  itemDescription: string;
  status: RunItemStatus;
  note: string;
  photoUrl: string;
  photoThumbnailUrl: string;
  photoDataUrl?: string;
  photoFileName?: string;
  photoRequired: boolean;
  noteRequired: boolean;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

type PhotoUpload = {
  photoId: string;
  runId: string;
  runItemId: string;
  staffId: string;
  staffName: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string;
  uploadedAt: string;
};

type Issue = {
  issueId: string;
  source: IssueSource;
  sourceId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  area: string;
  relatedChecklistRunId: string;
  relatedChecklistRunItemId: string;
  createdByName: string;
  assignedToName: string;
  photoUrl: string;
  photoThumbnailUrl: string;
  resolvedAt: string;
  resolvedByName: string;
  closedAt: string;
  closedByName: string;
  createdAt: string;
  updatedAt: string;
};

type IssueComment = {
  commentId: string;
  issueId: string;
  comment: string;
  createdByName: string;
  createdAt: string;
};

type SyncSettings = {
  autoSync: boolean;
  lastSyncedAt?: string;
};

type ToastMessage = {
  id: string;
  title: string;
  body?: string;
  tone: 'success' | 'info' | 'warning';
};

type PhotoViewer = {
  title: string;
  src: string;
  href: string;
  note?: string;
};

type AppStore = {
  items: VipItem[];
  staff: Staff[];
  sessions: VipSession[];
  roles: Role[];
  checklistTemplates: ChecklistTemplate[];
  checklistTemplateItems: ChecklistTemplateItem[];
  checklistRuns: ChecklistRun[];
  checklistRunItems: ChecklistRunItem[];
  photoUploads: PhotoUpload[];
  issues: Issue[];
  issueComments: IssueComment[];
  sync: SyncSettings;
};

const STORAGE_KEY = 'nomono.vip-complimentary-log.v2';
const LEGACY_STORAGE_KEY = 'nomono.vip-complimentary-log.v1';
const RELATIONAL_TABLES = [
  'nomono_roles',
  'nomono_vip_items',
  'nomono_staff',
  'nomono_checklist_templates',
  'nomono_checklist_template_items',
  'nomono_vip_sessions',
  'nomono_vip_session_items',
  'nomono_checklist_runs',
  'nomono_checklist_run_items',
  'nomono_photo_uploads',
  'nomono_issues',
  'nomono_issue_comments',
  'nomono_settings',
] as const;
const REALTIME_TABLES = ['nomono_app_state', ...RELATIONAL_TABLES] as const;

const DEFAULT_ITEMS: VipItem[] = [
  { id: 'item-aqua-600', name: 'Aqua 600ml', category: 'Minuman', hpp: 2500, defaultQty: 6, active: true },
  { id: 'item-pocari-500', name: 'Pocari Sweat 500ml', category: 'Minuman', hpp: 6000, defaultQty: 2, active: true },
  { id: 'item-mizone-500', name: 'Mizone 500ml', category: 'Minuman', hpp: 5000, defaultQty: 2, active: true },
  { id: 'item-coconut-rtd', name: 'Coconut RTD', category: 'Minuman', hpp: 8000, defaultQty: 2, active: true },
];

const seedTime = '2026-05-20T00:00:00.000Z';

const DEFAULT_ROLES: Role[] = [
  {
    roleId: 'role-kasir',
    roleName: 'Kasir / Resepsionis',
    description: 'Front desk, POS, booking, QRIS, dan tamu.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    roleId: 'role-runner',
    roleName: 'Runner / All Around',
    description: 'Support operasional venue, lobby, dan court.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    roleId: 'role-manager',
    roleName: 'Manager',
    description: 'Monitoring opening, closing, dan issue harian.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
];

const DEFAULT_TEMPLATES: ChecklistTemplate[] = [
  {
    templateId: 'tpl-opening-kasir-1',
    templateName: 'Opening Kasir 1',
    templateType: 'opening',
    roleId: 'role-kasir',
    description: 'Checklist opening untuk kasir utama.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    templateId: 'tpl-closing-kasir-1',
    templateName: 'Closing Kasir 1',
    templateType: 'closing',
    roleId: 'role-kasir',
    description: 'Checklist closing kasir.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    templateId: 'tpl-opening-runner',
    templateName: 'Opening Runner',
    templateType: 'opening',
    roleId: 'role-runner',
    description: 'Checklist opening runner/all around.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    templateId: 'tpl-closing-runner',
    templateName: 'Closing Runner',
    templateType: 'closing',
    roleId: 'role-runner',
    description: 'Checklist closing runner/all around.',
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
];

const DEFAULT_TEMPLATE_ITEMS: ChecklistTemplateItem[] = [
  templateItem('tpl-opening-kasir-1', 'Nyalakan POS', 'Pastikan POS menyala dan bisa dipakai transaksi.', 1, false, false),
  templateItem('tpl-opening-kasir-1', 'Cek uang modal kasir', 'Hitung uang modal awal dan cocokkan dengan nominal standar.', 2, true, true),
  templateItem('tpl-opening-kasir-1', 'Cek printer struk', 'Pastikan kertas tersedia dan test print berhasil.', 3, false, false),
  templateItem('tpl-opening-kasir-1', 'Cek QRIS', 'Pastikan QRIS/EDC siap dipakai.', 4, false, false),
  templateItem('tpl-opening-kasir-1', 'Cek booking hari ini', 'Review jadwal court dan VIP room hari ini.', 5, false, false),
  templateItem('tpl-closing-kasir-1', 'Rekap transaksi kasir', 'Cocokkan POS, QRIS, dan catatan manual.', 1, false, true),
  templateItem('tpl-closing-kasir-1', 'Simpan uang kasir', 'Pastikan uang disimpan sesuai SOP closing.', 2, true, true),
  templateItem('tpl-closing-kasir-1', 'Matikan POS dan printer', 'Matikan perangkat setelah closing selesai.', 3, false, false),
  templateItem('tpl-opening-runner', 'Cek area lobby', 'Pastikan lobby bersih dan siap menerima tamu.', 1, true, false),
  templateItem('tpl-opening-runner', 'Cek area court', 'Pastikan court bersih dan tidak ada barang tertinggal.', 2, true, false),
  templateItem('tpl-opening-runner', 'Cek stok minuman display', 'Rapikan display dan catat stok yang kurang.', 3, true, true),
  templateItem('tpl-closing-runner', 'Bersihkan area lobby', 'Pastikan lobby kembali rapi setelah operasional.', 1, true, false),
  templateItem('tpl-closing-runner', 'Cek lost and found', 'Kumpulkan dan catat barang tertinggal.', 2, false, true),
  templateItem('tpl-closing-runner', 'Foto kondisi court closing', 'Ambil foto kondisi court setelah dibersihkan.', 3, true, false),
];

const DEFAULT_STAFF: Staff[] = [
  staffSeed('staff-1', 'Staff 1', 'role-kasir', 'tpl-opening-kasir-1', 'tpl-closing-kasir-1', 'Staff'),
  staffSeed('staff-2', 'Staff 2', 'role-runner', 'tpl-opening-runner', 'tpl-closing-runner', 'Staff'),
  staffSeed('staff-supervisor', 'Supervisor', 'role-manager', '', '', 'Manager'),
];

function templateItem(
  templateId: string,
  itemName: string,
  itemDescription: string,
  sortOrder: number,
  photoRequired: boolean,
  noteRequired: boolean,
): ChecklistTemplateItem {
  return {
    templateItemId: `${templateId}-${sortOrder}`,
    templateId,
    itemName,
    itemDescription,
    sortOrder,
    photoRequired,
    noteRequired,
    isActive: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  };
}

function staffSeed(
  staffId: string,
  staffName: string,
  roleId: string,
  openingTemplateId: string,
  closingTemplateId: string,
  permissionLevel: PermissionLevel,
): Staff {
  return {
    staffId,
    staffName,
    roleId,
    openingTemplateId,
    closingTemplateId,
    isActive: true,
    permissionLevel,
    createdAt: seedTime,
    updatedAt: seedTime,
  };
}

const uid = () => {
  if ('crypto' in window && 'randomUUID' in window.crypto) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const nowIso = () => new Date().toISOString();

const todayISO = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const timeNow = () =>
  new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const niceDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

const isManagerLevel = (permissionLevel?: PermissionLevel) => permissionLevel === 'Manager' || permissionLevel === 'Supervisor';

const emptyStore = (): AppStore => ({
  items: DEFAULT_ITEMS,
  staff: DEFAULT_STAFF,
  sessions: [],
  roles: DEFAULT_ROLES,
  checklistTemplates: DEFAULT_TEMPLATES,
  checklistTemplateItems: DEFAULT_TEMPLATE_ITEMS,
  checklistRuns: [],
  checklistRunItems: [],
  photoUploads: [],
  issues: [],
  issueComments: [],
  sync: {
    autoSync: true,
  },
});

function normalizeStore(value: unknown): AppStore {
  const parsed = (value && typeof value === 'object' ? value : {}) as Partial<AppStore> & {
    staff?: Array<Partial<Staff> & { id?: string; name?: string; active?: boolean }>;
  };
  const roles = Array.isArray(parsed.roles) && parsed.roles.length ? parsed.roles.map(normalizeRole) : DEFAULT_ROLES;
  const templates =
    Array.isArray(parsed.checklistTemplates) && parsed.checklistTemplates.length
      ? parsed.checklistTemplates.map(normalizeTemplate)
      : DEFAULT_TEMPLATES;

  return {
    items: Array.isArray(parsed.items) && parsed.items.length ? parsed.items.map(normalizeVipItem) : DEFAULT_ITEMS,
    staff: Array.isArray(parsed.staff) && parsed.staff.length ? parsed.staff.map((person) => normalizeStaff(person, roles, templates)) : DEFAULT_STAFF,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeSession) : [],
    roles,
    checklistTemplates: templates,
    checklistTemplateItems:
      Array.isArray(parsed.checklistTemplateItems) && parsed.checklistTemplateItems.length
        ? parsed.checklistTemplateItems.map(normalizeTemplateItem)
        : DEFAULT_TEMPLATE_ITEMS,
    checklistRuns: Array.isArray(parsed.checklistRuns) ? parsed.checklistRuns.map(normalizeRun) : [],
    checklistRunItems: Array.isArray(parsed.checklistRunItems) ? parsed.checklistRunItems.map(normalizeRunItem) : [],
    photoUploads: Array.isArray(parsed.photoUploads) ? parsed.photoUploads.map(normalizePhotoUpload) : [],
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(normalizeIssue) : [],
    issueComments: Array.isArray(parsed.issueComments) ? parsed.issueComments.map(normalizeIssueComment) : [],
    sync: {
      autoSync: true,
      lastSyncedAt: parsed.sync?.lastSyncedAt,
    },
  };
}

function normalizeVipItem(item: Partial<VipItem>): VipItem {
  return {
    id: String(item.id || uid()),
    name: String(item.name || ''),
    category: String(item.category || 'Minuman'),
    hpp: Math.max(0, Number(item.hpp) || 0),
    defaultQty: Math.max(0, Math.trunc(Number(item.defaultQty) || 0)),
    active: item.active !== false,
  };
}

function normalizeSession(session: Partial<VipSession>): VipSession {
  return {
    id: String(session.id || uid()),
    date: normalizeDate(session.date),
    startTime: String(session.startTime || '08:00'),
    endTime: String(session.endTime || '09:00'),
    bookingName: String(session.bookingName || ''),
    room: String(session.room || 'VIP Room'),
    staffName: String(session.staffName || ''),
    status: session.status === 'draft' ? 'draft' : 'completed',
    notes: String(session.notes || ''),
    createdAt: String(session.createdAt || nowIso()),
    updatedAt: String(session.updatedAt || nowIso()),
    items: Array.isArray(session.items) ? session.items.map((item) => calculateLine(item as VipSessionItem)) : [],
  };
}

function normalizeRole(role: Partial<Role>): Role {
  return {
    roleId: String(role.roleId || uid()),
    roleName: String(role.roleName || ''),
    description: String(role.description || ''),
    isActive: role.isActive !== false,
    createdAt: String(role.createdAt || nowIso()),
    updatedAt: String(role.updatedAt || nowIso()),
  };
}

function normalizeStaff(
  person: Partial<Staff> & { id?: string; name?: string; active?: boolean },
  roles: Role[],
  templates: ChecklistTemplate[],
): Staff {
  const roleId = String(person.roleId || roles[0]?.roleId || '');
  const openingTemplateId = String(
    person.openingTemplateId || templates.find((template) => template.templateType === 'opening' && template.roleId === roleId)?.templateId || '',
  );
  const closingTemplateId = String(
    person.closingTemplateId || templates.find((template) => template.templateType === 'closing' && template.roleId === roleId)?.templateId || '',
  );
  return {
    staffId: String(person.staffId || person.id || uid()),
    staffName: String(person.staffName || person.name || ''),
    roleId,
    openingTemplateId,
    closingTemplateId,
    isActive: person.isActive ?? person.active ?? true,
    permissionLevel: normalizePermission(person.permissionLevel),
    createdAt: String(person.createdAt || nowIso()),
    updatedAt: String(person.updatedAt || nowIso()),
  };
}

function normalizePermission(value: unknown): PermissionLevel {
  if (value === 'Manager' || value === 'Supervisor') return value;
  return 'Staff';
}

function normalizeTemplate(template: Partial<ChecklistTemplate>): ChecklistTemplate {
  return {
    templateId: String(template.templateId || uid()),
    templateName: String(template.templateName || ''),
    templateType: normalizeTemplateType(template.templateType),
    roleId: String(template.roleId || ''),
    description: String(template.description || ''),
    isActive: template.isActive !== false,
    createdAt: String(template.createdAt || nowIso()),
    updatedAt: String(template.updatedAt || nowIso()),
  };
}

function normalizeTemplateType(value: unknown): TemplateType {
  if (value === 'closing' || value === 'custom') return value;
  return 'opening';
}

function normalizeTemplateItem(item: Partial<ChecklistTemplateItem>): ChecklistTemplateItem {
  return {
    templateItemId: String(item.templateItemId || uid()),
    templateId: String(item.templateId || ''),
    itemName: String(item.itemName || ''),
    itemDescription: String(item.itemDescription || ''),
    sortOrder: Math.max(1, Number(item.sortOrder) || 1),
    photoRequired: item.photoRequired === true,
    noteRequired: item.noteRequired === true,
    isActive: item.isActive !== false,
    createdAt: String(item.createdAt || nowIso()),
    updatedAt: String(item.updatedAt || nowIso()),
  };
}

function normalizeRun(run: Partial<ChecklistRun>): ChecklistRun {
  return {
    runId: String(run.runId || uid()),
    date: normalizeDate(run.date),
    staffId: String(run.staffId || ''),
    staffName: String(run.staffName || ''),
    roleId: String(run.roleId || ''),
    roleName: String(run.roleName || ''),
    templateId: String(run.templateId || ''),
    templateName: String(run.templateName || ''),
    templateType: normalizeTemplateType(run.templateType),
    status: normalizeRunStatus(run.status),
    startedAt: String(run.startedAt || ''),
    completedAt: String(run.completedAt || ''),
    createdAt: String(run.createdAt || nowIso()),
    updatedAt: String(run.updatedAt || nowIso()),
  };
}

function normalizeRunStatus(value: unknown): RunStatus {
  if (value === 'not_started' || value === 'completed' || value === 'has_issue') return value;
  return 'in_progress';
}

function normalizeRunItem(item: Partial<ChecklistRunItem>): ChecklistRunItem {
  return {
    runItemId: String(item.runItemId || uid()),
    runId: String(item.runId || ''),
    templateItemId: String(item.templateItemId || ''),
    issueId: item.issueId ? String(item.issueId) : undefined,
    itemName: String(item.itemName || ''),
    itemDescription: String(item.itemDescription || ''),
    status: normalizeRunItemStatus(item.status),
    note: String(item.note || ''),
    photoUrl: String(item.photoUrl || ''),
    photoThumbnailUrl: String(item.photoThumbnailUrl || item.photoUrl || ''),
    photoDataUrl: item.photoDataUrl ? String(item.photoDataUrl) : undefined,
    photoFileName: item.photoFileName ? String(item.photoFileName) : undefined,
    photoRequired: item.photoRequired === true,
    noteRequired: item.noteRequired === true,
    completedAt: String(item.completedAt || ''),
    createdAt: String(item.createdAt || nowIso()),
    updatedAt: String(item.updatedAt || nowIso()),
  };
}

function normalizeRunItemStatus(value: unknown): RunItemStatus {
  if (value === 'done' || value === 'issue' || value === 'skipped') return value;
  return 'pending';
}

function normalizeIssue(issue: Partial<Issue>): Issue {
  return {
    issueId: String(issue.issueId || uid()),
    source: normalizeIssueSource(issue.source),
    sourceId: String(issue.sourceId || ''),
    title: String(issue.title || 'Issue operasional'),
    description: String(issue.description || ''),
    status: normalizeIssueStatus(issue.status),
    priority: normalizeIssuePriority(issue.priority),
    area: String(issue.area || ''),
    relatedChecklistRunId: String(issue.relatedChecklistRunId || ''),
    relatedChecklistRunItemId: String(issue.relatedChecklistRunItemId || ''),
    createdByName: String(issue.createdByName || ''),
    assignedToName: String(issue.assignedToName || ''),
    photoUrl: String(issue.photoUrl || ''),
    photoThumbnailUrl: String(issue.photoThumbnailUrl || issue.photoUrl || ''),
    resolvedAt: String(issue.resolvedAt || ''),
    resolvedByName: String(issue.resolvedByName || ''),
    closedAt: String(issue.closedAt || ''),
    closedByName: String(issue.closedByName || ''),
    createdAt: String(issue.createdAt || nowIso()),
    updatedAt: String(issue.updatedAt || nowIso()),
  };
}

function normalizeIssueComment(comment: Partial<IssueComment>): IssueComment {
  return {
    commentId: String(comment.commentId || uid()),
    issueId: String(comment.issueId || ''),
    comment: String(comment.comment || ''),
    createdByName: String(comment.createdByName || ''),
    createdAt: String(comment.createdAt || nowIso()),
  };
}

function normalizeIssueSource(value: unknown): IssueSource {
  if (value === 'checklist' || value === 'vip_complimentary') return value;
  return 'manual';
}

function normalizeIssueStatus(value: unknown): IssueStatus {
  if (value === 'in_progress' || value === 'resolved' || value === 'closed') return value;
  return 'open';
}

function normalizeIssuePriority(value: unknown): IssuePriority {
  if (value === 'low' || value === 'high' || value === 'urgent') return value;
  return 'medium';
}

function normalizePhotoUpload(photo: Partial<PhotoUpload>): PhotoUpload {
  return {
    photoId: String(photo.photoId || uid()),
    runId: String(photo.runId || ''),
    runItemId: String(photo.runItemId || ''),
    staffId: String(photo.staffId || ''),
    staffName: String(photo.staffName || ''),
    fileName: String(photo.fileName || ''),
    fileUrl: String(photo.fileUrl || ''),
    thumbnailUrl: String(photo.thumbnailUrl || photo.fileUrl || ''),
    uploadedAt: String(photo.uploadedAt || nowIso()),
  };
}

function normalizeDate(value: unknown) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(String(value || ''));
  if (!Number.isNaN(parsed.getTime())) {
    parsed.setMinutes(parsed.getMinutes() - parsed.getTimezoneOffset());
    return parsed.toISOString().slice(0, 10);
  }
  return todayISO();
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function storePayload(store: AppStore) {
  return {
    items: store.items,
    staff: store.staff,
    sessions: store.sessions,
    roles: store.roles,
    checklistTemplates: store.checklistTemplates,
    checklistTemplateItems: store.checklistTemplateItems,
    checklistRuns: store.checklistRuns,
    checklistRunItems: store.checklistRunItems,
    photoUploads: store.photoUploads,
    issues: store.issues,
    issueComments: store.issueComments,
  };
}

async function readSupabaseStore(): Promise<AppStore> {
  return (await readSupabaseStoreResult()).store;
}

async function readSupabaseStoreResult(): Promise<{ store: AppStore; isEmpty: boolean }> {
  if (!isSupabaseConfigured) throw new Error('Supabase env belum dikonfigurasi.');
  try {
    const relational = await readRelationalStoreResult();
    if (!relational.isEmpty) return relational;

    const legacy = await readLegacySupabaseStoreResult();
    if (!legacy.isEmpty) {
      await writeRelationalStore(legacy.store);
      return legacy;
    }

    return relational;
  } catch (error) {
    if (!isMissingRelationalSchema(error)) throw error;
    return readLegacySupabaseStoreResult();
  }
}

async function readLegacySupabaseStoreResult(): Promise<{ store: AppStore; isEmpty: boolean }> {
  const { data, error } = await supabase.from('nomono_app_state').select('data').eq('id', 'main').maybeSingle();
  if (error) throw new Error(error.message);
  const isEmpty = !data?.data || !Object.keys(data.data as Record<string, unknown>).length;
  return {
    store: isEmpty ? emptyStore() : normalizeStore(data.data),
    isEmpty,
  };
}

async function writeSupabaseStore(store: AppStore) {
  if (!isSupabaseConfigured) throw new Error('Supabase env belum dikonfigurasi.');
  try {
    await writeRelationalStore(store);
  } catch (error) {
    if (!isMissingRelationalSchema(error)) throw error;
  }
  await writeLegacySupabaseStore(store);
}

async function writeLegacySupabaseStore(store: AppStore) {
  const { error } = await supabase.from('nomono_app_state').upsert({
    id: 'main',
    data: storePayload(store),
  });
  if (error) throw new Error(error.message);
}

async function readRelationalStoreResult(): Promise<{ store: AppStore; isEmpty: boolean }> {
  const [
    items,
    staff,
    roles,
    templates,
    templateItems,
    sessions,
    sessionItems,
    runs,
    runItems,
    photoUploads,
    issues,
    issueComments,
    settings,
  ] = await Promise.all([
    readRows('nomono_vip_items', 'name'),
    readRows('nomono_staff', 'staff_name'),
    readRows('nomono_roles', 'role_name'),
    readRows('nomono_checklist_templates', 'template_name'),
    readRows('nomono_checklist_template_items', 'sort_order'),
    readRows('nomono_vip_sessions', 'date'),
    readRows('nomono_vip_session_items', 'item_name'),
    readRows('nomono_checklist_runs', 'date'),
    readRows('nomono_checklist_run_items', 'item_name'),
    readRows('nomono_photo_uploads', 'uploaded_at'),
    readRows('nomono_issues', 'updated_at'),
    readRows('nomono_issue_comments', 'created_at'),
    readRows('nomono_settings'),
  ]);

  const isEmpty =
    !items.length &&
    !staff.length &&
    !roles.length &&
    !templates.length &&
    !templateItems.length &&
    !sessions.length &&
    !runs.length &&
    !runItems.length &&
    !issues.length;

  const sessionItemsBySession = groupRows(sessionItems, 'session_id');
  const store = normalizeStore({
    items: items.map((row) => ({
      id: stringCell(row.id),
      name: stringCell(row.name),
      category: stringCell(row.category, 'Minuman'),
      hpp: numberCell(row.hpp),
      defaultQty: numberCell(row.default_qty),
      active: boolCell(row.active, true),
    })),
    staff: staff.map((row) => ({
      staffId: stringCell(row.staff_id),
      staffName: stringCell(row.staff_name),
      roleId: stringCell(row.role_id),
      openingTemplateId: stringCell(row.opening_template_id),
      closingTemplateId: stringCell(row.closing_template_id),
      isActive: boolCell(row.is_active, true),
      permissionLevel: stringCell(row.permission_level, 'Staff'),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    roles: roles.map((row) => ({
      roleId: stringCell(row.role_id),
      roleName: stringCell(row.role_name),
      description: stringCell(row.description),
      isActive: boolCell(row.is_active, true),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    checklistTemplates: templates.map((row) => ({
      templateId: stringCell(row.template_id),
      templateName: stringCell(row.template_name),
      templateType: stringCell(row.template_type, 'opening'),
      roleId: stringCell(row.role_id),
      description: stringCell(row.description),
      isActive: boolCell(row.is_active, true),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    checklistTemplateItems: templateItems.map((row) => ({
      templateItemId: stringCell(row.template_item_id),
      templateId: stringCell(row.template_id),
      itemName: stringCell(row.item_name),
      itemDescription: stringCell(row.item_description),
      sortOrder: numberCell(row.sort_order, 1),
      photoRequired: boolCell(row.photo_required),
      noteRequired: boolCell(row.note_required),
      isActive: boolCell(row.is_active, true),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    sessions: sessions.map((row) => ({
      id: stringCell(row.id),
      date: stringCell(row.date, todayISO()),
      startTime: stringCell(row.start_time, '08:00'),
      endTime: stringCell(row.end_time, '09:00'),
      bookingName: stringCell(row.booking_name),
      room: stringCell(row.room, 'VIP Room'),
      staffName: stringCell(row.staff_name),
      status: stringCell(row.status, 'completed'),
      notes: stringCell(row.notes),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
      items: (sessionItemsBySession.get(stringCell(row.id)) || []).map((item) => ({
        id: stringCell(item.id),
        itemId: stringCell(item.item_id),
        itemName: stringCell(item.item_name),
        hpp: numberCell(item.hpp),
        preparedQty: numberCell(item.prepared_qty),
        sealedLeftQty: numberCell(item.sealed_left_qty),
        usedQty: numberCell(item.used_qty),
        returnToStockQty: numberCell(item.return_to_stock_qty),
        totalCost: numberCell(item.total_cost),
        majooInputDone: boolCell(item.majoo_input_done),
      })),
    })),
    checklistRuns: runs.map((row) => ({
      runId: stringCell(row.run_id),
      date: stringCell(row.date, todayISO()),
      staffId: stringCell(row.staff_id),
      staffName: stringCell(row.staff_name),
      roleId: stringCell(row.role_id),
      roleName: stringCell(row.role_name),
      templateId: stringCell(row.template_id),
      templateName: stringCell(row.template_name),
      templateType: stringCell(row.template_type, 'opening'),
      status: stringCell(row.status, 'in_progress'),
      startedAt: stringCell(row.started_at),
      completedAt: stringCell(row.completed_at),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    checklistRunItems: runItems.map((row) => ({
      runItemId: stringCell(row.run_item_id),
      runId: stringCell(row.run_id),
      templateItemId: stringCell(row.template_item_id),
      issueId: stringCell(row.issue_id) || undefined,
      itemName: stringCell(row.item_name),
      itemDescription: stringCell(row.item_description),
      status: stringCell(row.status, 'pending'),
      note: stringCell(row.note),
      photoUrl: stringCell(row.photo_url),
      photoThumbnailUrl: stringCell(row.photo_thumbnail_url),
      photoFileName: stringCell(row.photo_file_name) || undefined,
      photoRequired: boolCell(row.photo_required),
      noteRequired: boolCell(row.note_required),
      completedAt: stringCell(row.completed_at),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    photoUploads: photoUploads.map((row) => ({
      photoId: stringCell(row.photo_id),
      runId: stringCell(row.run_id),
      runItemId: stringCell(row.run_item_id),
      staffId: stringCell(row.staff_id),
      staffName: stringCell(row.staff_name),
      fileName: stringCell(row.file_name),
      fileUrl: stringCell(row.file_url),
      thumbnailUrl: stringCell(row.thumbnail_url),
      uploadedAt: stringCell(row.uploaded_at, nowIso()),
    })),
    issues: issues.map((row) => ({
      issueId: stringCell(row.issue_id),
      source: stringCell(row.source, 'manual'),
      sourceId: stringCell(row.source_id),
      title: stringCell(row.title, 'Issue operasional'),
      description: stringCell(row.description),
      status: stringCell(row.status, 'open'),
      priority: stringCell(row.priority, 'medium'),
      area: stringCell(row.area),
      relatedChecklistRunId: stringCell(row.related_checklist_run_id),
      relatedChecklistRunItemId: stringCell(row.related_checklist_run_item_id),
      createdByName: stringCell(row.created_by_name),
      assignedToName: stringCell(row.assigned_to_name),
      photoUrl: stringCell(row.photo_url),
      photoThumbnailUrl: stringCell(row.photo_thumbnail_url),
      resolvedAt: stringCell(row.resolved_at),
      resolvedByName: stringCell(row.resolved_by_name),
      closedAt: stringCell(row.closed_at),
      closedByName: stringCell(row.closed_by_name),
      createdAt: stringCell(row.created_at, nowIso()),
      updatedAt: stringCell(row.updated_at, nowIso()),
    })),
    issueComments: issueComments.map((row) => ({
      commentId: stringCell(row.comment_id),
      issueId: stringCell(row.issue_id),
      comment: stringCell(row.comment),
      createdByName: stringCell(row.created_by_name),
      createdAt: stringCell(row.created_at, nowIso()),
    })),
    sync: {
      autoSync: boolCell(settings[0]?.auto_sync, true),
      lastSyncedAt: stringCell(settings[0]?.last_synced_at),
    },
  });

  return { store, isEmpty };
}

async function writeRelationalStore(store: AppStore) {
  const payload = storePayload(store);
  const sessionItems = store.sessions.flatMap((session) =>
    session.items.map((item) => ({
      id: item.id,
      session_id: session.id,
      item_id: item.itemId,
      item_name: item.itemName,
      hpp: item.hpp,
      prepared_qty: item.preparedQty,
      sealed_left_qty: item.sealedLeftQty,
      used_qty: item.usedQty,
      return_to_stock_qty: item.returnToStockQty,
      total_cost: item.totalCost,
      majoo_input_done: item.majooInputDone,
    })),
  );

  await Promise.all([
    replaceRows(
      'nomono_roles',
      'role_id',
      payload.roles.map((role) => ({
        role_id: role.roleId,
        role_name: role.roleName,
        description: role.description,
        is_active: role.isActive,
        created_at: isoOrNull(role.createdAt),
        updated_at: isoOrNull(role.updatedAt),
      })),
    ),
    replaceRows(
      'nomono_vip_items',
      'id',
      payload.items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        hpp: item.hpp,
        default_qty: item.defaultQty,
        active: item.active,
      })),
    ),
    replaceRows(
      'nomono_staff',
      'staff_id',
      payload.staff.map((person) => ({
        staff_id: person.staffId,
        staff_name: person.staffName,
        role_id: person.roleId,
        opening_template_id: person.openingTemplateId,
        closing_template_id: person.closingTemplateId,
        is_active: person.isActive,
        permission_level: person.permissionLevel,
        created_at: isoOrNull(person.createdAt),
        updated_at: isoOrNull(person.updatedAt),
      })),
    ),
    replaceRows(
      'nomono_checklist_templates',
      'template_id',
      payload.checklistTemplates.map((template) => ({
        template_id: template.templateId,
        template_name: template.templateName,
        template_type: template.templateType,
        role_id: template.roleId,
        description: template.description,
        is_active: template.isActive,
        created_at: isoOrNull(template.createdAt),
        updated_at: isoOrNull(template.updatedAt),
      })),
    ),
    replaceRows(
      'nomono_vip_sessions',
      'id',
      payload.sessions.map((session) => ({
        id: session.id,
        date: session.date,
        start_time: session.startTime,
        end_time: session.endTime,
        booking_name: session.bookingName,
        room: session.room,
        staff_name: session.staffName,
        status: session.status,
        notes: session.notes || '',
        created_at: isoOrNull(session.createdAt),
        updated_at: isoOrNull(session.updatedAt),
      })),
    ),
    replaceRows(
      'nomono_checklist_runs',
      'run_id',
      payload.checklistRuns.map((run) => ({
        run_id: run.runId,
        date: run.date,
        staff_id: run.staffId,
        staff_name: run.staffName,
        role_id: run.roleId,
        role_name: run.roleName,
        template_id: run.templateId,
        template_name: run.templateName,
        template_type: run.templateType,
        status: run.status,
        started_at: isoOrNull(run.startedAt),
        completed_at: isoOrNull(run.completedAt),
        created_at: isoOrNull(run.createdAt),
        updated_at: isoOrNull(run.updatedAt),
      })),
    ),
    replaceRows(
      'nomono_issues',
      'issue_id',
      payload.issues.map((issue) => ({
        issue_id: issue.issueId,
        source: issue.source,
        source_id: issue.sourceId,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        area: issue.area,
        related_checklist_run_id: issue.relatedChecklistRunId,
        related_checklist_run_item_id: issue.relatedChecklistRunItemId,
        created_by_name: issue.createdByName,
        assigned_to_name: issue.assignedToName,
        photo_url: issue.photoUrl,
        photo_thumbnail_url: issue.photoThumbnailUrl,
        resolved_at: isoOrNull(issue.resolvedAt),
        resolved_by_name: issue.resolvedByName,
        closed_at: isoOrNull(issue.closedAt),
        closed_by_name: issue.closedByName,
        created_at: isoOrNull(issue.createdAt),
        updated_at: isoOrNull(issue.updatedAt),
      })),
    ),
  ]);

  await Promise.all([
    replaceRows(
      'nomono_checklist_template_items',
      'template_item_id',
      payload.checklistTemplateItems.map((item) => ({
        template_item_id: item.templateItemId,
        template_id: item.templateId,
        item_name: item.itemName,
        item_description: item.itemDescription,
        sort_order: item.sortOrder,
        photo_required: item.photoRequired,
        note_required: item.noteRequired,
        is_active: item.isActive,
        created_at: isoOrNull(item.createdAt),
        updated_at: isoOrNull(item.updatedAt),
      })),
    ),
    replaceRows('nomono_vip_session_items', 'id', sessionItems),
    replaceRows(
      'nomono_checklist_run_items',
      'run_item_id',
      payload.checklistRunItems.map((item) => ({
        run_item_id: item.runItemId,
        run_id: item.runId,
        template_item_id: item.templateItemId,
        issue_id: item.issueId || null,
        item_name: item.itemName,
        item_description: item.itemDescription,
        status: item.status,
        note: item.note,
        photo_url: item.photoUrl,
        photo_thumbnail_url: item.photoThumbnailUrl,
        photo_file_name: item.photoFileName || null,
        photo_required: item.photoRequired,
        note_required: item.noteRequired,
        completed_at: isoOrNull(item.completedAt),
        created_at: isoOrNull(item.createdAt),
        updated_at: isoOrNull(item.updatedAt),
      })),
    ),
    replaceRows(
      'nomono_photo_uploads',
      'photo_id',
      payload.photoUploads.map((photo) => ({
        photo_id: photo.photoId,
        run_id: photo.runId,
        run_item_id: photo.runItemId,
        staff_id: photo.staffId,
        staff_name: photo.staffName,
        file_name: photo.fileName,
        file_url: photo.fileUrl,
        thumbnail_url: photo.thumbnailUrl,
        uploaded_at: isoOrNull(photo.uploadedAt),
      })),
    ),
    replaceRows(
      'nomono_issue_comments',
      'comment_id',
      payload.issueComments.map((comment) => ({
        comment_id: comment.commentId,
        issue_id: comment.issueId,
        comment: comment.comment,
        created_by_name: comment.createdByName,
        created_at: isoOrNull(comment.createdAt),
      })),
    ),
    writeRelationalSettings(store.sync),
  ]);
}

async function writeRelationalSettings(sync: SyncSettings) {
  const { error } = await supabase.from('nomono_settings').upsert({
    id: 'main',
    auto_sync: sync.autoSync,
    last_synced_at: isoOrNull(sync.lastSyncedAt),
  });
  if (error) throw new Error(error.message);
}

async function readRows(table: string, orderColumn?: string) {
  const query = supabase.from(table).select('*');
  const { data, error } = orderColumn ? await query.order(orderColumn, { ascending: true }) : await query;
  if (error) throw new Error(error.message);
  return (data || []) as Record<string, unknown>[];
}

async function replaceRows(table: string, primaryKey: string, rows: Record<string, unknown>[]) {
  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw new Error(error.message);
  }

  const ids = rows.map((row) => String(row[primaryKey] || '')).filter(Boolean);
  const deleteQuery = supabase.from(table).delete();
  const { error } = ids.length
    ? await deleteQuery.not(primaryKey, 'in', `(${ids.map(postgrestListValue).join(',')})`)
    : await deleteQuery.neq(primaryKey, '__nomono_keep_none__');
  if (error) throw new Error(error.message);
}

function groupRows(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((map, row) => {
    const value = stringCell(row[key]);
    const list = map.get(value) || [];
    list.push(row);
    map.set(value, list);
    return map;
  }, new Map<string, Record<string, unknown>[]>());
}

function stringCell(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function numberCell(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolCell(value: unknown, fallback = false) {
  if (value === null || value === undefined) return fallback;
  return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
}

function isoOrNull(value?: string) {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function postgrestListValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function isMissingRelationalSchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /relation .* does not exist|could not find the table|schema cache/i.test(message);
}

async function uploadPhotoToSupabase(dataUrl: string, fileName: string, pathPrefix: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase env belum dikonfigurasi.');
  const blob = await (await fetch(dataUrl)).blob();
  const cleanPath = [pathPrefix, fileName]
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/[^a-zA-Z0-9./_-]+/g, '-');
  const { error } = await supabase.storage.from(SUPABASE_PHOTO_BUCKET).upload(cleanPath, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(SUPABASE_PHOTO_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}

function syncIssueForRunItem(store: AppStore, runItem: ChecklistRunItem, timestamp = nowIso()): AppStore {
  if (runItem.status !== 'issue') return store;
  const run = store.checklistRuns.find((item) => item.runId === runItem.runId);
  if (!run) return store;

  const existingIssue = store.issues.find(
    (issue) => issue.issueId === runItem.issueId || issue.relatedChecklistRunItemId === runItem.runItemId,
  );
  const issueId = existingIssue?.issueId || runItem.issueId || uid();
  const nextRunItems = store.checklistRunItems.map((item) => (item.runItemId === runItem.runItemId ? { ...item, issueId } : item));

  if (existingIssue) {
    if (existingIssue.status === 'resolved' || existingIssue.status === 'closed') {
      return { ...store, checklistRunItems: nextRunItems };
    }
    return {
      ...store,
      checklistRunItems: nextRunItems,
      issues: store.issues.map((issue) =>
        issue.issueId === existingIssue.issueId
          ? {
              ...issue,
              title: `Issue: ${runItem.itemName}`,
              description: runItem.note,
              area: issue.area || run.roleName || run.templateType,
              photoUrl: runItem.photoUrl || issue.photoUrl,
              photoThumbnailUrl: runItem.photoThumbnailUrl || runItem.photoUrl || issue.photoThumbnailUrl,
              updatedAt: timestamp,
            }
          : issue,
      ),
    };
  }

  const issue: Issue = {
    issueId,
    source: 'checklist',
    sourceId: runItem.runItemId,
    title: `Issue: ${runItem.itemName}`,
    description: runItem.note,
    status: 'open',
    priority: 'medium',
    area: run.roleName || run.templateType,
    relatedChecklistRunId: run.runId,
    relatedChecklistRunItemId: runItem.runItemId,
    createdByName: run.staffName,
    assignedToName: '',
    photoUrl: runItem.photoUrl,
    photoThumbnailUrl: runItem.photoThumbnailUrl || runItem.photoUrl,
    resolvedAt: '',
    resolvedByName: '',
    closedAt: '',
    closedByName: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...store,
    checklistRunItems: nextRunItems,
    issues: [issue, ...store.issues],
  };
}

function calculateLine(line: VipSessionItem): VipSessionItem {
  const preparedQty = Math.max(0, Math.trunc(Number(line.preparedQty) || 0));
  const sealedLeftQty = Math.max(0, Math.trunc(Number(line.sealedLeftQty) || 0));
  const usedQty = Math.max(0, preparedQty - sealedLeftQty);
  return {
    ...line,
    preparedQty,
    sealedLeftQty,
    usedQty,
    returnToStockQty: sealedLeftQty,
    totalCost: usedQty * (Number(line.hpp) || 0),
  };
}

function createVipLine(item: VipItem): VipSessionItem {
  return calculateLine({
    id: uid(),
    itemId: item.id,
    itemName: item.name,
    hpp: item.hpp,
    preparedQty: item.defaultQty,
    sealedLeftQty: 0,
    usedQty: item.defaultQty,
    returnToStockQty: 0,
    totalCost: item.defaultQty * item.hpp,
    majooInputDone: false,
  });
}

function makeVipForm(items: VipItem[], staff: Staff[]): VipForm {
  return {
    date: todayISO(),
    startTime: '08:00',
    endTime: '09:00',
    bookingName: '',
    room: 'VIP Room',
    staffName: staff.find((person) => person.isActive)?.staffName || '',
    notes: '',
    items: items.filter((item) => item.active).map(createVipLine),
  };
}

function App() {
  const [tab, setTab] = useState<Tab>('vip');
  const [store, setStore] = useState<AppStore>(loadStore);
  const [vipForm, setVipForm] = useState<VipForm>(() => makeVipForm(DEFAULT_ITEMS, DEFAULT_STAFF));
  const [vipEditingId, setVipEditingId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState(() => localStorage.getItem('nomono.selectedStaffId') || '');
  const [syncStatus, setSyncStatus] = useState(
    isSupabaseConfigured ? 'Supabase siap disambungkan.' : 'Supabase env belum dikonfigurasi.',
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeState>(isSupabaseConfigured ? 'idle' : 'disconnected');
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewer | null>(null);
  const skipAutoSyncRef = useRef(false);
  const pendingLocalSyncRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const realtimeDebounceRef = useRef<number | null>(null);

  const notify = (title: string, body?: string, tone: ToastMessage['tone'] = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: uid(), title, body, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    localStorage.setItem('nomono.selectedStaffId', selectedStaffId);
  }, [selectedStaffId]);

  useEffect(() => {
    setVipForm((current) => ({
      ...current,
      staffName: current.staffName || store.staff.find((person) => person.isActive)?.staffName || '',
      items: current.items.length ? current.items : store.items.filter((item) => item.active).map(createVipLine),
    }));
  }, [store.items, store.staff]);

  useEffect(() => {
    remoteReadyRef.current = false;
    if (!isSupabaseConfigured) {
      setSyncStatus('Supabase env belum dikonfigurasi. Mode lokal tetap aktif.');
      return;
    }

    let cancelled = false;
    setSyncStatus('Memuat database dari Supabase...');
    readSupabaseStoreResult()
      .then(async ({ store: remote, isEmpty }) => {
        if (cancelled) return;
        remoteReadyRef.current = true;
        pendingLocalSyncRef.current = false;
        if (isEmpty) {
          await writeSupabaseStore(store);
          if (cancelled) return;
          setSyncStatus('Database Supabase kosong, data lokal sudah dikirim sebagai awal.');
          return;
        }
        skipAutoSyncRef.current = true;
        setStore((current) => ({ ...remote, sync: { ...current.sync, lastSyncedAt: nowIso() } }));
        setSyncStatus('Database Supabase sudah dimuat.');
      })
      .catch((error) => {
        if (cancelled) return;
        setSyncStatus(error instanceof Error ? error.message : 'Gagal memuat Supabase. Mode lokal tetap aktif.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipAutoSyncRef.current) {
      skipAutoSyncRef.current = false;
      return;
    }
    if (!store.sync.autoSync || !isSupabaseConfigured) return;
    if (!pendingLocalSyncRef.current) return;
    if (!remoteReadyRef.current) {
      setSyncStatus('Auto-sync menunggu database Supabase dimuat.');
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        await writeSupabaseStore(store);
        pendingLocalSyncRef.current = false;
        setSyncStatus(`Auto-sync Supabase tersimpan ${timeNow()}`);
      } catch (error) {
        setSyncStatus(error instanceof Error ? error.message : 'Auto-sync gagal.');
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRealtimeStatus('disconnected');
      return;
    }

    const handleRealtimeChange = () => {
        if (pendingLocalSyncRef.current) return;
        if (realtimeDebounceRef.current) window.clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = window.setTimeout(async () => {
          try {
            const remote = await readSupabaseStore();
            skipAutoSyncRef.current = true;
            setStore((current) => ({ ...remote, sync: { ...current.sync, lastSyncedAt: nowIso() } }));
            setLastRealtimeUpdate(nowIso());
            setRealtimeStatus('connected');
          } catch {
            setRealtimeStatus('disconnected');
          }
        }, 500);
    };
    const channel = REALTIME_TABLES.reduce(
      (currentChannel, table) => currentChannel.on('postgres_changes', { event: '*', schema: 'public', table }, handleRealtimeChange),
      supabase.channel('nomono-manager-dashboard'),
    ).subscribe((status) => {
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    return () => {
      if (realtimeDebounceRef.current) window.clearTimeout(realtimeDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, []);

  const updateStore = (updater: React.SetStateAction<AppStore>) => {
    pendingLocalSyncRef.current = true;
    setStore(updater);
  };

  const selectedStaff = store.staff.find((person) => person.staffId === selectedStaffId) || store.staff.find((person) => person.isActive);
  const hasManagerStaff = store.staff.some((person) => isManagerLevel(person.permissionLevel));
  const managerMode = hasManagerStaff ? isManagerLevel(selectedStaff?.permissionLevel) : true;

  useEffect(() => {
    if (!managerMode && (tab === 'dashboard' || tab === 'report' || tab === 'master')) {
      setTab('checklist');
    }
  }, [managerMode, tab]);

  const saveVipSession = () => {
    const errors = validateVipForm(vipForm);
    if (errors.length) {
      window.alert(errors.join('\n'));
      return;
    }
    const timestamp = nowIso();
    const payload: VipSession = {
      ...vipForm,
      id: vipEditingId || uid(),
      status: 'completed',
      createdAt: vipEditingId ? store.sessions.find((session) => session.id === vipEditingId)?.createdAt || timestamp : timestamp,
      updatedAt: timestamp,
      items: vipForm.items.map(calculateLine),
    };
    updateStore((current) => ({
      ...current,
      sessions: vipEditingId
        ? current.sessions.map((session) => (session.id === vipEditingId ? payload : session))
        : [payload, ...current.sessions],
    }));
    notify(vipEditingId ? 'VIP log diperbarui' : 'VIP log tersimpan', 'Data complimentary masuk ke penyimpanan lokal dan akan ikut sync.');
    setVipEditingId(null);
    setVipForm(makeVipForm(store.items, store.staff));
  };

  const patchVipLine = (lineId: string, patch: Partial<VipSessionItem>) => {
    setVipForm((current) => ({
      ...current,
      items: current.items.map((line) => calculateLine(line.id === lineId ? { ...line, ...patch } : line)),
    }));
  };

  const startChecklistRun = (staffId: string, type: 'opening' | 'closing') => {
    const staff = store.staff.find((person) => person.staffId === staffId);
    if (!staff) return;
    if (type === 'closing') {
      const opening = store.checklistRuns.find(
        (run) => run.date === todayISO() && run.staffId === staffId && run.templateType === 'opening',
      );
      if (!opening || !isRunSubmitted(opening)) {
        window.alert('Closing baru bisa dimulai setelah checklist opening disubmit.');
        return;
      }
    }
    const templateId = type === 'opening' ? staff.openingTemplateId : staff.closingTemplateId;
    const template = store.checklistTemplates.find((item) => item.templateId === templateId && item.isActive);
    if (!template) {
      notify('Template belum siap', `Template ${type} belum di-assign untuk ${staff.staffName}.`, 'warning');
      window.alert(`Template ${type} belum di-assign untuk ${staff.staffName}.`);
      return;
    }
    const existing = store.checklistRuns.find(
      (run) => run.date === todayISO() && run.staffId === staffId && run.templateType === type,
    );
    if (existing) return;

    const role = store.roles.find((item) => item.roleId === staff.roleId);
    const timestamp = nowIso();
    const runId = uid();
    const templateItems = getTemplateItems(store, template.templateId);
    updateStore((current) => ({
      ...current,
      checklistRuns: [
        {
          runId,
          date: todayISO(),
          staffId: staff.staffId,
          staffName: staff.staffName,
          roleId: staff.roleId,
          roleName: role?.roleName || '',
          templateId: template.templateId,
          templateName: template.templateName,
          templateType: type,
          status: 'in_progress',
          startedAt: timestamp,
          completedAt: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...current.checklistRuns,
      ],
      checklistRunItems: [
        ...templateItems.map((item) => ({
          runItemId: uid(),
          runId,
          templateItemId: item.templateItemId,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          status: 'pending' as RunItemStatus,
          note: '',
          photoUrl: '',
          photoThumbnailUrl: '',
          photoRequired: item.photoRequired,
          noteRequired: item.noteRequired,
          completedAt: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
        ...current.checklistRunItems,
      ],
    }));
    notify(`${type === 'opening' ? 'Opening' : 'Closing'} dimulai`, `${template.templateName} siap dikerjakan.`);
  };

  const patchRunItem = (runItemId: string, patch: Partial<ChecklistRunItem>) => {
    updateStore((current) => {
      const timestamp = nowIso();
      let updatedItem: ChecklistRunItem | undefined;
      const checklistRunItems = current.checklistRunItems.map((item) => {
        if (item.runItemId !== runItemId) return item;
        updatedItem = { ...item, ...patch, updatedAt: timestamp };
        return updatedItem;
      });
      const next = { ...current, checklistRunItems };
      return updatedItem?.status === 'issue' ? syncIssueForRunItem(next, updatedItem, timestamp) : next;
    });
  };

  const markRunItem = (runItemId: string, status: 'done' | 'issue') => {
    const item = store.checklistRunItems.find((row) => row.runItemId === runItemId);
    if (!item) return;
    if (status === 'done' && item.photoRequired && !item.photoUrl && !item.photoDataUrl) {
      notify('Foto wajib diupload', 'Item ini belum bisa Done sebelum ada foto.', 'warning');
      window.alert('Item ini wajib foto sebelum bisa ditandai Done.');
      return;
    }
    if ((status === 'issue' || item.noteRequired) && !item.note.trim()) {
      notify('Catatan wajib diisi', status === 'issue' ? 'Issue harus punya catatan.' : 'Item ini wajib catatan.', 'warning');
      window.alert(status === 'issue' ? 'Issue wajib isi catatan.' : 'Item ini wajib catatan.');
      return;
    }
    patchRunItem(runItemId, { status, completedAt: nowIso() });
    notify(status === 'done' ? 'Item ditandai Done' : 'Issue tercatat', item.itemName);
  };

  const submitRun = (runId: string) => {
    const runItems = store.checklistRunItems.filter((item) => item.runId === runId);
    const errors = validateRunItems(runItems);
    if (errors.length) {
      notify('Checklist belum lengkap', 'Lengkapi item wajib sebelum submit.', 'warning');
      window.alert(errors.join('\n'));
      return;
    }
    const hasIssue = runItems.some((item) => item.status === 'issue');
    updateStore((current) => ({
      ...current,
      checklistRuns: current.checklistRuns.map((run) =>
        run.runId === runId
          ? {
              ...run,
              status: hasIssue ? 'has_issue' : 'completed',
              completedAt: nowIso(),
              updatedAt: nowIso(),
            }
          : run,
      ),
    }));
    const run = store.checklistRuns.find((item) => item.runId === runId);
    notify(
      `${run?.templateType === 'closing' ? 'Closing' : 'Opening'} tersubmit`,
      hasIssue ? 'Data tersubmit dengan issue untuk manager.' : 'Data checklist sudah tersubmit.',
    );
  };

  const handlePhoto = async (run: ChecklistRun, item: ChecklistRunItem, file: File) => {
    const dataUrl = await resizeImage(file);
    const safeName = `${run.date}_${run.staffName}_${run.templateType}_${item.itemName}`.replace(/[^a-z0-9-_]+/gi, '-');
    const fileName = `${safeName}.jpg`;
    let photoUrl = item.photoUrl;
    let thumbnailUrl = dataUrl;

    if (isSupabaseConfigured) {
      try {
        const publicUrl = await uploadPhotoToSupabase(dataUrl, fileName, `${run.date}/${run.templateType}/${run.staffId}`);
        photoUrl = publicUrl;
        thumbnailUrl = publicUrl;
        setSyncStatus('Foto tersimpan ke Supabase Storage.');
        notify('Foto tersimpan', 'Foto bukti masuk ke Supabase Storage dan tampil di report.');
      } catch {
        setSyncStatus('Foto tampil lokal dulu. Upload Supabase gagal.');
        notify('Foto tersimpan lokal', 'Cek koneksi atau policy Supabase Storage.', 'warning');
      }
    } else {
      notify('Foto tersimpan lokal', 'Konfigurasi Supabase env agar foto tersimpan ke storage.', 'info');
    }

    const uploadedAt = nowIso();
    updateStore((current) => {
      let updatedItem: ChecklistRunItem | undefined;
      const checklistRunItems = current.checklistRunItems.map((row) => {
        if (row.runItemId !== item.runItemId) return row;
        updatedItem = {
          ...row,
          photoUrl,
          photoThumbnailUrl: thumbnailUrl,
          photoDataUrl: photoUrl ? undefined : dataUrl,
          photoFileName: fileName,
          updatedAt: uploadedAt,
        };
        return updatedItem;
      });
      const next = {
        ...current,
        checklistRunItems,
        photoUploads: [
          {
            photoId: uid(),
            runId: run.runId,
            runItemId: item.runItemId,
            staffId: run.staffId,
            staffName: run.staffName,
            fileName,
            fileUrl: photoUrl || dataUrl,
            thumbnailUrl,
            uploadedAt,
          },
          ...current.photoUploads.filter((photo) => photo.runItemId !== item.runItemId),
        ],
      };
      return updatedItem?.status === 'issue' ? syncIssueForRunItem(next, updatedItem, uploadedAt) : next;
    });
  };

  const updateIssue = (issueId: string, patch: Partial<Issue>) => {
    updateStore((current) => {
      const timestamp = nowIso();
      return {
        ...current,
        issues: current.issues.map((issue) => {
          if (issue.issueId !== issueId) return issue;
          const nextStatus = patch.status || issue.status;
          return {
            ...issue,
            ...patch,
            resolvedAt: nextStatus === 'resolved' && !issue.resolvedAt ? timestamp : patch.resolvedAt ?? issue.resolvedAt,
            resolvedByName:
              nextStatus === 'resolved' && !issue.resolvedByName ? selectedStaff?.staffName || 'Manager' : patch.resolvedByName ?? issue.resolvedByName,
            closedAt: nextStatus === 'closed' && !issue.closedAt ? timestamp : patch.closedAt ?? issue.closedAt,
            closedByName: nextStatus === 'closed' && !issue.closedByName ? selectedStaff?.staffName || 'Manager' : patch.closedByName ?? issue.closedByName,
            updatedAt: timestamp,
          };
        }),
      };
    });
    notify('Issue diperbarui', 'Status atau detail issue sudah disimpan.');
  };

  const addIssueComment = (issueId: string, comment: string) => {
    const trimmed = comment.trim();
    if (!trimmed) {
      notify('Komentar kosong', 'Isi catatan follow up dulu.', 'warning');
      return;
    }
    updateStore((current) => ({
      ...current,
      issueComments: [
        {
          commentId: uid(),
          issueId,
          comment: trimmed,
          createdByName: selectedStaff?.staffName || 'Manager',
          createdAt: nowIso(),
        },
        ...current.issueComments,
      ],
      issues: current.issues.map((issue) => (issue.issueId === issueId ? { ...issue, updatedAt: nowIso() } : issue)),
    }));
    notify('Komentar ditambahkan', 'Follow up issue sudah tercatat.');
  };

  const pushToRemote = async () => {
    if (!isSupabaseConfigured) {
      setSyncStatus('Supabase env belum dikonfigurasi.');
      return;
    }
    setSyncStatus('Mengirim data lokal ke Supabase...');
    try {
      await writeSupabaseStore(store);
      pendingLocalSyncRef.current = false;
      remoteReadyRef.current = true;
      skipAutoSyncRef.current = true;
      setStore((current) => ({ ...current, sync: { ...current.sync, lastSyncedAt: nowIso() } }));
      setSyncStatus('Data lokal sudah dikirim ke Supabase.');
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Gagal kirim ke Supabase.');
    }
  };

  const pullFromRemote = async () => {
    if (!isSupabaseConfigured) {
      setSyncStatus('Supabase env belum dikonfigurasi.');
      return;
    }
    setSyncStatus('Menarik data dari Supabase...');
    try {
      const remote = await readSupabaseStore();
      pendingLocalSyncRef.current = false;
      remoteReadyRef.current = true;
      skipAutoSyncRef.current = true;
      setStore((current) => ({ ...remote, sync: { ...current.sync, lastSyncedAt: nowIso() } }));
      setSyncStatus('Data Supabase sudah dimuat.');
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Gagal tarik dari Supabase.');
    }
  };

  return (
    <div className="appShell">
      <header className="topbar">
        <div>
          <div className="brand">NOMONO</div>
          <div className="brandSub">VIP Log + Staff SOP Checklist</div>
        </div>
        <div className="topbarStatus">
          <ModePill managerMode={managerMode} />
          <StatusPill store={store} />
        </div>
      </header>

      <main className="content">
        {tab === 'vip' && (
          <VipLogScreen
            form={vipForm}
            setForm={setVipForm}
            editing={Boolean(vipEditingId)}
            store={store}
            canSeeFinancials={managerMode}
            onSave={saveVipSession}
            onLineChange={patchVipLine}
            onEdit={(session) => {
              setVipEditingId(session.id);
              setVipForm({
                date: session.date,
                startTime: session.startTime,
                endTime: session.endTime,
                bookingName: session.bookingName,
                room: session.room,
                staffName: session.staffName,
                notes: session.notes || '',
                items: session.items.map(calculateLine),
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDelete={(sessionId) => updateStore((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== sessionId) }))}
            onReset={() => {
              setVipEditingId(null);
              setVipForm(makeVipForm(store.items, store.staff));
            }}
          />
        )}

        {tab === 'checklist' && (
          <ChecklistScreen
            store={store}
            selectedStaff={selectedStaff}
            selectedStaffId={selectedStaffId}
            setSelectedStaffId={setSelectedStaffId}
            onStart={startChecklistRun}
            onPatchItem={patchRunItem}
            onMarkItem={markRunItem}
            onSubmitRun={submitRun}
            onPhoto={handlePhoto}
            onOpenPhoto={setPhotoViewer}
          />
        )}

        {tab === 'dashboard' && managerMode && (
          <DashboardScreen
            store={store}
            realtimeStatus={realtimeStatus}
            lastRealtimeUpdate={lastRealtimeUpdate}
            onOpenIssues={() => setTab('issues')}
            onOpenReport={() => setTab('report')}
          />
        )}

        {tab === 'report' && managerMode && <ReportScreen store={store} onOpenPhoto={setPhotoViewer} />}

        {tab === 'issues' && (
          <IssuesScreen
            store={store}
            selectedStaff={selectedStaff}
            canManageIssues={managerMode}
            onUpdateIssue={updateIssue}
            onAddComment={addIssueComment}
            onOpenPhoto={setPhotoViewer}
          />
        )}

        {tab === 'master' && managerMode && (
          <MasterScreen
            store={store}
            syncStatus={syncStatus}
            setStore={updateStore}
            notify={notify}
            onPushToRemote={pushToRemote}
            onPullFromRemote={pullFromRemote}
          />
        )}
      </main>

      <nav className="bottomNav">
        <NavButton icon={<ClipboardList />} label="VIP Log" active={tab === 'vip'} onClick={() => setTab('vip')} />
        <NavButton icon={<ClipboardCheck />} label="Checklist" active={tab === 'checklist'} onClick={() => setTab('checklist')} />
        {managerMode && <NavButton icon={<BarChart3 />} label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />}
        {managerMode && <NavButton icon={<FileText />} label="Report" active={tab === 'report'} onClick={() => setTab('report')} />}
        <NavButton icon={<MessageSquare />} label="Issues" active={tab === 'issues'} onClick={() => setTab('issues')} />
        {managerMode && <NavButton icon={<Settings2 />} label="Master" active={tab === 'master'} onClick={() => setTab('master')} />}
      </nav>
      <Toast toast={toast} />
      <PhotoLightbox photo={photoViewer} onClose={() => setPhotoViewer(null)} />
    </div>
  );
}

function VipLogScreen({
  form,
  setForm,
  editing,
  store,
  canSeeFinancials,
  onSave,
  onLineChange,
  onEdit,
  onDelete,
  onReset,
}: {
  form: VipForm;
  setForm: React.Dispatch<React.SetStateAction<VipForm>>;
  editing: boolean;
  store: AppStore;
  canSeeFinancials: boolean;
  onSave: () => void;
  onLineChange: (lineId: string, patch: Partial<VipSessionItem>) => void;
  onEdit: (session: VipSession) => void;
  onDelete: (sessionId: string) => void;
  onReset: () => void;
}) {
  const activeStaff = store.staff.filter((person) => person.isActive);
  const totals = getVipTotals(form.items);
  const todaySessions = store.sessions.filter((session) => session.date === todayISO());
  const majooPending = form.items.filter((item) => item.usedQty > 0 && !item.majooInputDone).length;

  return (
    <section className="stack">
      <ScreenTitle
        title={editing ? 'Edit VIP Log' : 'VIP Complimentary Log'}
        subtitle="Catat item complimentary dan status input Majoo dari satu halaman."
        action={
          editing ? (
            <button className="secondaryBtn" onClick={onReset}>
              <X size={16} /> Batal
            </button>
          ) : null
        }
      />

      <div className="panel formGrid">
        <Field label="Tanggal">
          <input type="date" value={form.date} onChange={(event) => setFormValue(setForm, 'date', event.target.value)} />
        </Field>
        <Field label="Mulai">
          <input type="time" value={form.startTime} onChange={(event) => setFormValue(setForm, 'startTime', event.target.value)} />
        </Field>
        <Field label="Selesai">
          <input type="time" value={form.endTime} onChange={(event) => setFormValue(setForm, 'endTime', event.target.value)} />
        </Field>
        <Field label="Booking">
          <input value={form.bookingName} placeholder="Nama booking" onChange={(event) => setFormValue(setForm, 'bookingName', event.target.value)} />
        </Field>
        <Field label="Ruangan">
          <input value={form.room} onChange={(event) => setFormValue(setForm, 'room', event.target.value)} />
        </Field>
        <Field label="Staff">
          <select value={form.staffName} onChange={(event) => setFormValue(setForm, 'staffName', event.target.value)}>
            <option value="">Pilih staff</option>
            {activeStaff.map((person) => (
              <option value={person.staffName} key={person.staffId}>
                {person.staffName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Catatan">
          <textarea value={form.notes || ''} rows={2} onChange={(event) => setFormValue(setForm, 'notes', event.target.value)} />
        </Field>
      </div>

      <div className="metricGrid">
        <Metric label="Item Terpakai" value={String(totals.usedQty)} tone="green" />
        <Metric label="Return Stock" value={String(totals.returnQty)} tone="gold" />
        {canSeeFinancials ? (
          <Metric label="Total HPP" value={rupiah(totals.totalCost)} tone="green" />
        ) : (
          <Metric label="Majoo Pending" value={String(majooPending)} tone="red" />
        )}
        <Metric label="Log Hari Ini" value={String(todaySessions.length)} tone="red" />
      </div>

      <div className="sectionHeader">
        <h2>Item Complimentary</h2>
      </div>
      <div className="stack tight">
        {form.items.map((line, index) => (
          <article className="itemCard" key={line.id}>
            <div className="itemTop">
              <div className="itemNumber">{index + 1}</div>
              <div>
                <strong>{line.itemName}</strong>
                <span>{canSeeFinancials ? `${rupiah(line.hpp)} / item` : 'Item complimentary'}</span>
              </div>
            </div>
            <div className="qtyGrid">
              <Field label="Disiapkan">
                <input
                  inputMode="numeric"
                  value={line.preparedQty}
                  onChange={(event) => onLineChange(line.id, { preparedQty: Number(event.target.value) })}
                />
              </Field>
              <Field label="Sisa Segel">
                <input
                  inputMode="numeric"
                  value={line.sealedLeftQty}
                  onChange={(event) => onLineChange(line.id, { sealedLeftQty: Number(event.target.value) })}
                />
              </Field>
            </div>
            <div className="calcRow">
              <div>
                <span>Terpakai</span>
                <strong>{line.usedQty}</strong>
              </div>
              {canSeeFinancials && (
                <div>
                  <span>HPP</span>
                  <strong>{rupiah(line.totalCost)}</strong>
                </div>
              )}
              <label className="checkLine">
                <input
                  type="checkbox"
                  checked={line.majooInputDone}
                  onChange={(event) => onLineChange(line.id, { majooInputDone: event.target.checked })}
                />
                Majoo OK
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="stickyActions">
        <button className="primaryBtn" onClick={onSave}>
          <Save size={16} /> {editing ? 'Update VIP Log' : 'Simpan VIP Log'}
        </button>
      </div>

      <div className="sectionHeader">
        <h2>Log Terbaru</h2>
        {canSeeFinancials && (
          <button className="accentBtn" onClick={() => exportVipCsv(store.sessions, true)} disabled={!store.sessions.length}>
            <Download size={15} /> CSV
          </button>
        )}
      </div>
      <div className="stack tight">
        {store.sessions.slice(0, 12).map((session) => (
          <article className="logCard" key={session.id}>
            <div className="logHead">
              <div>
                <span className="eyebrow">{niceDate(session.date)}</span>
                <h3>{session.bookingName}</h3>
                <p>
                  {session.staffName} · {session.room} · {session.startTime}-{session.endTime}
                </p>
              </div>
              <div className="cardActions">
                <button className="iconBtn" onClick={() => onEdit(session)} aria-label="Edit VIP log">
                  <FileText size={15} />
                </button>
                <button className="iconBtn danger" onClick={() => onDelete(session.id)} aria-label="Hapus VIP log">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="logTotals">
              <span>{getVipTotals(session.items).usedQty} item terpakai</span>
              {canSeeFinancials && <strong>{rupiah(getVipTotals(session.items).totalCost)}</strong>}
            </div>
          </article>
        ))}
        {!store.sessions.length && <EmptyState title="Belum ada VIP log" body="Sesi complimentary yang disimpan akan muncul di sini." />}
      </div>
    </section>
  );
}

function ChecklistScreen({
  store,
  selectedStaff,
  selectedStaffId,
  setSelectedStaffId,
  onStart,
  onPatchItem,
  onMarkItem,
  onSubmitRun,
  onPhoto,
  onOpenPhoto,
}: {
  store: AppStore;
  selectedStaff?: Staff;
  selectedStaffId: string;
  setSelectedStaffId: (staffId: string) => void;
  onStart: (staffId: string, type: 'opening' | 'closing') => void;
  onPatchItem: (runItemId: string, patch: Partial<ChecklistRunItem>) => void;
  onMarkItem: (runItemId: string, status: 'done' | 'issue') => void;
  onSubmitRun: (runId: string) => void;
  onPhoto: (run: ChecklistRun, item: ChecklistRunItem, file: File) => void;
  onOpenPhoto: (photo: PhotoViewer) => void;
}) {
  const [activeRunType, setActiveRunType] = useState<'opening' | 'closing'>('opening');
  const today = todayISO();
  const role = store.roles.find((item) => item.roleId === selectedStaff?.roleId);
  const openingRun = selectedStaff
    ? store.checklistRuns.find((run) => run.date === today && run.staffId === selectedStaff.staffId && run.templateType === 'opening')
    : undefined;
  const closingRun = selectedStaff
    ? store.checklistRuns.find((run) => run.date === today && run.staffId === selectedStaff.staffId && run.templateType === 'closing')
    : undefined;
  const openingSubmitted = openingRun ? isRunSubmitted(openingRun) : false;
  const activeRun = activeRunType === 'closing' ? closingRun : openingRun;
  const activeRunSubmitted = activeRun ? isRunSubmitted(activeRun) : false;

  useEffect(() => {
    if (!selectedStaff) return;
    if (!openingSubmitted) {
      setActiveRunType('opening');
      return;
    }
    if (closingRun) setActiveRunType('closing');
  }, [closingRun?.runId, openingSubmitted, selectedStaff?.staffId]);

  return (
    <section className="stack">
      <ScreenTitle title="Staff SOP Checklist" subtitle={`${niceDate(today)} · opening dan closing harian.`} />

      <div className="panel staffPicker">
        <Field label="Staff">
          <select value={selectedStaffId || selectedStaff?.staffId || ''} onChange={(event) => setSelectedStaffId(event.target.value)}>
            <option value="">Pilih staff</option>
            {store.staff
              .filter((person) => person.isActive)
              .map((person) => (
                <option value={person.staffId} key={person.staffId}>
                  {person.staffName}
                </option>
              ))}
          </select>
        </Field>
        <div className="staffBadge">
          <UserRound size={17} />
          <div>
            <strong>{selectedStaff?.staffName || 'Belum pilih staff'}</strong>
            <span>{role?.roleName || 'Role belum diset'}</span>
          </div>
        </div>
      </div>

      {selectedStaff ? (
        <>
          <div className="runGrid">
            <RunSummaryCard
              type="opening"
              run={openingRun}
              store={store}
              templateId={selectedStaff.openingTemplateId}
              active={activeRunType === 'opening'}
              onSelect={() => setActiveRunType('opening')}
              onStart={() => {
                onStart(selectedStaff.staffId, 'opening');
                setActiveRunType('opening');
              }}
            />
            <RunSummaryCard
              type="closing"
              run={closingRun}
              store={store}
              templateId={selectedStaff.closingTemplateId}
              active={activeRunType === 'closing'}
              disabled={!openingSubmitted}
              disabledReason="Submit opening dulu"
              onSelect={() => {
                if (!openingSubmitted) {
                  window.alert('Closing baru bisa dipilih setelah checklist opening disubmit.');
                  return;
                }
                setActiveRunType('closing');
              }}
              onStart={() => {
                if (!openingSubmitted) {
                  window.alert('Closing baru bisa dimulai setelah checklist opening disubmit.');
                  return;
                }
                onStart(selectedStaff.staffId, 'closing');
                setActiveRunType('closing');
              }}
            />
          </div>

          {activeRun && !activeRunSubmitted ? (
            <RunDetail
              key={activeRun.runId}
              run={activeRun}
              items={store.checklistRunItems.filter((item) => item.runId === activeRun.runId)}
              onPatchItem={onPatchItem}
              onMarkItem={onMarkItem}
              onSubmitRun={onSubmitRun}
              onPhoto={onPhoto}
              onOpenPhoto={onOpenPhoto}
            />
          ) : (
            <EmptyState
              title={
                activeRunSubmitted
                  ? `${activeRunType === 'closing' ? 'Closing' : 'Opening'} sudah tersubmit`
                  : activeRunType === 'closing'
                    ? 'Closing belum dimulai'
                    : 'Opening belum dimulai'
              }
              body={
                activeRunSubmitted
                  ? activeRunType === 'opening'
                    ? 'Daftar opening sudah dibersihkan. Staff bisa lanjut mulai closing.'
                    : 'Daftar closing sudah dibersihkan. Data bisa dicek manager di Report.'
                  : activeRunType === 'closing'
                    ? 'Closing akan tersedia setelah opening disubmit.'
                    : 'Mulai opening untuk melihat item checklist hari ini.'
              }
            />
          )}
        </>
      ) : (
        <EmptyState title="Pilih staff" body="Checklist opening dan closing akan tampil sesuai template yang di-assign ke staff." />
      )}
    </section>
  );
}

function RunSummaryCard({
  type,
  run,
  store,
  templateId,
  active = false,
  disabled = false,
  disabledReason,
  onSelect,
  onStart,
}: {
  type: 'opening' | 'closing';
  run?: ChecklistRun;
  store: AppStore;
  templateId: string;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
  onStart: () => void;
}) {
  const template = store.checklistTemplates.find((item) => item.templateId === templateId);
  const runItems = run ? store.checklistRunItems.filter((item) => item.runId === run.runId) : [];
  const done = runItems.filter((item) => item.status === 'done' || item.status === 'issue').length;
  const label = type === 'opening' ? 'Opening' : 'Closing';

  return (
    <article className={`runCard ${active ? 'active' : ''}`}>
      <div>
        <span className="eyebrow">{label}</span>
        <h3>{template?.templateName || `${label} belum di-assign`}</h3>
        <p>{disabled && !run ? disabledReason || 'Terkunci' : run ? `${done}/${runItems.length} selesai` : 'Not Started'}</p>
      </div>
      <StatusBadge status={run?.status || 'not_started'} />
      {run ? (
        <>
          <div className="progressTrack">
            <span style={{ width: `${runItems.length ? (done / runItems.length) * 100 : 0}%` }} />
          </div>
          <button className={active ? 'primaryBtn' : 'secondaryBtn'} onClick={onSelect}>
            <Eye size={16} /> Lihat {label}
          </button>
        </>
      ) : (
        <button className="primaryBtn" onClick={onStart} disabled={!template || disabled}>
          <Check size={16} /> Mulai {label}
        </button>
      )}
    </article>
  );
}

function RunDetail({
  run,
  items,
  onPatchItem,
  onMarkItem,
  onSubmitRun,
  onPhoto,
  onOpenPhoto,
}: {
  run: ChecklistRun;
  items: ChecklistRunItem[];
  onPatchItem: (runItemId: string, patch: Partial<ChecklistRunItem>) => void;
  onMarkItem: (runItemId: string, status: 'done' | 'issue') => void;
  onSubmitRun: (runId: string) => void;
  onPhoto: (run: ChecklistRun, item: ChecklistRunItem, file: File) => void;
  onOpenPhoto: (photo: PhotoViewer) => void;
}) {
  const completed = items.filter((item) => item.status === 'done' || item.status === 'issue').length;
  const canSubmit = items.length > 0 && completed === items.length && run.status === 'in_progress';

  return (
    <section className="stack">
      <div className="sectionHeader">
        <h2>{run.templateName}</h2>
        <StatusBadge status={run.status} />
      </div>
      <div className="stack tight">
        {items.map((item) => (
          <article className={`checkItem ${item.status}`} key={item.runItemId}>
            <div className="checkItemHead">
              <div>
                <strong>{item.itemName}</strong>
                <p>{item.itemDescription}</p>
              </div>
              <ItemStatus status={item.status} />
            </div>
            <div className="requirementRow">
              {item.photoRequired && (
                <span>
                  <Camera size={13} /> Wajib foto
                </span>
              )}
              {item.noteRequired && (
                <span>
                  <FileText size={13} /> Wajib catatan
                </span>
              )}
              {!item.photoRequired && !item.noteRequired && <span>Standar</span>}
            </div>

            {(item.photoRequired || item.photoThumbnailUrl || item.photoDataUrl) && (
              <div className="photoBox">
                {item.photoThumbnailUrl || item.photoDataUrl ? (
                  <button
                    className="photoPreviewButton"
                    onClick={() =>
                      onOpenPhoto({
                        title: item.itemName,
                        src: photoPreviewSrc(item),
                        href: photoFullUrl(item),
                        note: item.note,
                      })
                    }
                  >
                    <img src={photoPreviewSrc(item)} alt={`Foto ${item.itemName}`} />
                  </button>
                ) : (
                  <div className="photoPlaceholder">
                    <Image size={20} />
                    <span>Belum ada foto</span>
                  </div>
                )}
                <label className="uploadBtn">
                  <Upload size={15} />
                  Upload Foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onPhoto(run, item, file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            )}

            <Field label={item.status === 'issue' || item.noteRequired ? 'Catatan' : 'Catatan opsional'}>
              <textarea
                value={item.note}
                rows={2}
                placeholder={item.status === 'issue' ? 'Jelaskan issue yang ditemukan' : 'Tambahkan catatan bila perlu'}
                onChange={(event) => onPatchItem(item.runItemId, { note: event.target.value })}
              />
            </Field>

            <div className="itemActions">
              <button className="secondaryBtn" onClick={() => onMarkItem(item.runItemId, 'issue')}>
                <AlertTriangle size={16} /> Issue
              </button>
              <button className="primaryBtn" onClick={() => onMarkItem(item.runItemId, 'done')}>
                <Check size={16} /> Done
              </button>
            </div>
          </article>
        ))}
      </div>
      {run.status === 'in_progress' && (
        <div className="stickyActions">
          <button className="primaryBtn" onClick={() => onSubmitRun(run.runId)} disabled={!canSubmit}>
            <ClipboardCheck size={16} /> Submit {run.templateType}
          </button>
        </div>
      )}
    </section>
  );
}

function DashboardScreen({
  store,
  realtimeStatus,
  lastRealtimeUpdate,
  onOpenIssues,
  onOpenReport,
}: {
  store: AppStore;
  realtimeStatus: RealtimeState;
  lastRealtimeUpdate: string;
  onOpenIssues: () => void;
  onOpenReport: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const activeStaff = store.staff.filter((person) => person.isActive);
  const dayRuns = store.checklistRuns.filter((run) => run.date === date);
  const dayItems = store.checklistRunItems.filter((item) => dayRuns.some((run) => run.runId === item.runId));
  const daySessions = store.sessions.filter((session) => session.date === date);
  const openIssues = store.issues
    .filter((issue) => issue.status === 'open' || issue.status === 'in_progress')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const dayIssues = openIssues.filter((issue) => issue.createdAt.slice(0, 10) === date);
  const vipTotals = getVipTotals(daySessions.flatMap((session) => session.items));
  const majooPending = daySessions.reduce(
    (sum, session) => sum + session.items.filter((item) => item.usedQty > 0 && !item.majooInputDone).length,
    0,
  );

  const runCount = (type: TemplateType, status: RunStatus) => dayRuns.filter((run) => run.templateType === type && run.status === status).length;
  const runStarted = (type: TemplateType) => new Set(dayRuns.filter((run) => run.templateType === type).map((run) => run.staffId)).size;
  const progressFor = (run?: ChecklistRun) => {
    const items = run ? store.checklistRunItems.filter((item) => item.runId === run.runId) : [];
    const done = items.filter((item) => item.status === 'done' || item.status === 'issue').length;
    return `${done}/${items.length}`;
  };
  const issueCountForStaff = (staff: Staff) => openIssues.filter((issue) => issue.createdByName === staff.staffName).length;
  const liveLabel =
    realtimeStatus === 'connected'
      ? 'Realtime connected'
      : realtimeStatus === 'idle'
        ? 'Connecting realtime'
        : 'Showing latest saved data';

  return (
    <section className="stack">
      <ScreenTitle
        title="Dashboard"
        subtitle="Monitor opening, closing, issue, dan VIP complimentary hari ini."
        action={<input className="monthInput" type="date" value={date} onChange={(event) => setDate(event.target.value)} />}
      />

      <div className={`panel livePanel ${realtimeStatus === 'connected' ? 'connected' : ''}`}>
        <div>
          <span className="eyebrow">Live</span>
          <strong>{liveLabel}</strong>
        </div>
        <p>{lastRealtimeUpdate ? `Last updated ${new Date(lastRealtimeUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Menunggu update realtime.'}</p>
      </div>

      <div className="sectionHeader">
        <h2>Today Overview</h2>
      </div>
      <div className="metricGrid">
        <Metric label="Opening Done" value={String(runCount('opening', 'completed') + runCount('opening', 'has_issue'))} tone="green" />
        <Metric label="Opening Run" value={String(runCount('opening', 'in_progress'))} tone="gold" />
        <Metric label="Opening Belum" value={String(Math.max(0, activeStaff.length - runStarted('opening')))} tone="red" />
        <Metric label="Opening Issue" value={String(runCount('opening', 'has_issue'))} tone="red" />
        <Metric label="Closing Done" value={String(runCount('closing', 'completed') + runCount('closing', 'has_issue'))} tone="green" />
        <Metric label="Closing Run" value={String(runCount('closing', 'in_progress'))} tone="gold" />
        <Metric label="Closing Belum" value={String(Math.max(0, activeStaff.length - runStarted('closing')))} tone="red" />
        <Metric label="Closing Issue" value={String(runCount('closing', 'has_issue'))} tone="red" />
      </div>

      <div className="sectionHeader">
        <h2>Staff Progress</h2>
      </div>
      <div className="dashboardList">
        {activeStaff.map((staff) => {
          const role = store.roles.find((item) => item.roleId === staff.roleId);
          const opening = dayRuns.find((run) => run.staffId === staff.staffId && run.templateType === 'opening');
          const closing = dayRuns.find((run) => run.staffId === staff.staffId && run.templateType === 'closing');
          return (
            <article className="dashboardRow" key={staff.staffId}>
              <div>
                <strong>{staff.staffName}</strong>
                <span>{role?.roleName || 'Role belum diset'}</span>
              </div>
              <div>
                <span>Opening</span>
                <strong>{opening ? progressFor(opening) : 'Not Started'}</strong>
              </div>
              <div>
                <span>Closing</span>
                <strong>{closing ? progressFor(closing) : 'Not Started'}</strong>
              </div>
              <div>
                <span>Open Issue</span>
                <strong className={issueCountForStaff(staff) ? 'dangerText' : ''}>{issueCountForStaff(staff)}</strong>
              </div>
            </article>
          );
        })}
      </div>

      <div className="sectionHeader">
        <h2>Open Issues</h2>
        <button className="secondaryBtn" onClick={onOpenIssues}>
          <MessageSquare size={15} /> Issues
        </button>
      </div>
      <div className="metricGrid">
        <Metric label="Open Today" value={String(dayIssues.length)} tone="red" />
        <Metric label="Urgent" value={String(openIssues.filter((issue) => issue.priority === 'urgent').length)} tone="red" />
        <Metric label="High" value={String(openIssues.filter((issue) => issue.priority === 'high').length)} tone="gold" />
        <Metric label="Medium" value={String(openIssues.filter((issue) => issue.priority === 'medium').length)} tone="gold" />
      </div>
      <div className="dashboardList">
        {openIssues.slice(0, 4).map((issue) => (
          <button className="dashboardIssue" key={issue.issueId} onClick={onOpenIssues}>
            <PriorityBadge priority={issue.priority} />
            <strong>{issue.title}</strong>
            <span>{issue.createdByName || '-'} - {issue.area || '-'}</span>
          </button>
        ))}
        {!openIssues.length && <EmptyState title="Tidak ada open issue" body="Issue operasional yang masih open akan muncul di sini." />}
      </div>

      <div className="sectionHeader">
        <h2>VIP Complimentary</h2>
        <button className="secondaryBtn" onClick={onOpenReport}>
          <FileText size={15} /> Report
        </button>
      </div>
      <div className="metricGrid">
        <Metric label="VIP Sessions" value={String(daySessions.length)} tone="green" />
        <Metric label="Item Terpakai" value={String(vipTotals.usedQty)} tone="green" />
        <Metric label="Est. Cost" value={rupiah(vipTotals.totalCost)} tone="gold" />
        <Metric label="Majoo Pending" value={String(majooPending)} tone="red" />
      </div>

      <p className="syncStatus muted">{dayItems.length} checklist item tercatat pada tanggal ini.</p>
    </section>
  );
}

function ReportScreen({ store, onOpenPhoto }: { store: AppStore; onOpenPhoto: (photo: PhotoViewer) => void }) {
  const [reportMode, setReportMode] = useState<'checklist' | 'vip'>('checklist');
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [staffId, setStaffId] = useState('all');
  const [templateType, setTemplateType] = useState<'all' | TemplateType>('all');
  const [status, setStatus] = useState<'all' | RunStatus>('all');

  const filteredRuns = useMemo(
    () =>
      store.checklistRuns
        .filter((run) => run.date === date)
        .filter((run) => (staffId === 'all' ? true : run.staffId === staffId))
        .filter((run) => (templateType === 'all' ? true : run.templateType === templateType))
        .filter((run) => (status === 'all' ? true : run.status === status))
        .sort((a, b) => a.staffName.localeCompare(b.staffName)),
    [date, staffId, status, store.checklistRuns, templateType],
  );

  const issues = store.checklistRunItems.filter((item) => {
    const run = store.checklistRuns.find((row) => row.runId === item.runId);
    return run?.date === date && item.status === 'issue';
  });

  const rows = filteredRuns.flatMap((run) =>
    store.checklistRunItems
      .filter((item) => item.runId === run.runId)
      .map((item) => ({
        date: run.date,
        staff: run.staffName,
        role: run.roleName,
        template: run.templateName,
        type: run.templateType,
        item: item.itemName,
        status: item.status,
        note: item.note,
        photoUrl: item.photoUrl,
        submittedAt: run.completedAt,
      })),
  );

  if (reportMode === 'vip') {
    return (
      <section className="stack">
        <ScreenTitle
          title="Report"
          subtitle="Pilih report checklist staff atau rekap biaya complimentary."
          action={
            <input
              className="monthInput"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          }
        />
        <div className="filterBar">
          <button onClick={() => setReportMode('checklist')}>
            Checklist
          </button>
          <button className="active" onClick={() => setReportMode('vip')}>
            VIP Rekap
          </button>
        </div>
        <VipRecapPanel sessions={store.sessions} selectedMonth={selectedMonth} />
      </section>
    );
  }

  return (
    <section className="stack">
      <ScreenTitle
        title="Report"
        subtitle="Pilih report checklist staff atau rekap biaya complimentary."
        action={
          <button className="accentBtn" onClick={() => exportChecklistCsv(rows)} disabled={!rows.length}>
            <Download size={15} /> CSV
          </button>
        }
      />

      <div className="filterBar">
        <button className="active" onClick={() => setReportMode('checklist')}>
          Checklist
        </button>
        <button onClick={() => setReportMode('vip')}>
          VIP Rekap
        </button>
      </div>

      <div className="panel filterGrid">
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Staff">
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="all">Semua</option>
            {store.staff.map((person) => (
              <option value={person.staffId} key={person.staffId}>
                {person.staffName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jenis">
          <select value={templateType} onChange={(event) => setTemplateType(event.target.value as 'all' | TemplateType)}>
            <option value="all">Semua</option>
            <option value="opening">Opening</option>
            <option value="closing">Closing</option>
            <option value="custom">Custom</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | RunStatus)}>
            <option value="all">Semua</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="has_issue">Has Issue</option>
          </select>
        </Field>
      </div>

      <div className="metricGrid">
        <Metric label="Run" value={String(filteredRuns.length)} tone="green" />
        <Metric label="Issue" value={String(issues.length)} tone="red" />
        <Metric label="Completed" value={String(filteredRuns.filter((run) => run.status === 'completed').length)} tone="green" />
        <Metric label="In Progress" value={String(filteredRuns.filter((run) => run.status === 'in_progress').length)} tone="gold" />
      </div>

      <div className="sectionHeader">
        <h2>Dashboard Harian</h2>
      </div>
      <div className="stack tight">
        {filteredRuns.map((run) => (
          <RunReportCard
            key={run.runId}
            run={run}
            items={store.checklistRunItems.filter((item) => item.runId === run.runId)}
            onOpenPhoto={onOpenPhoto}
          />
        ))}
        {!filteredRuns.length && <EmptyState title="Belum ada checklist" body="Run yang sesuai filter akan muncul di sini." />}
      </div>

      <div className="sectionHeader">
        <h2>Issue Today</h2>
      </div>
      <div className="stack tight">
        {issues.map((item) => {
          const run = store.checklistRuns.find((row) => row.runId === item.runId);
          return (
            <article className="issueCard" key={item.runItemId}>
              <div>
                <strong>{item.itemName}</strong>
                <span>
                  {run?.staffName} · {run?.templateName}
                </span>
                <p>{item.note || 'Belum ada catatan.'}</p>
              </div>
              {(item.photoThumbnailUrl || item.photoUrl) && (
                <button
                  className="thumbLink"
                  onClick={() =>
                    onOpenPhoto({
                      title: item.itemName,
                      src: photoPreviewSrc(item),
                      href: photoFullUrl(item),
                      note: item.note,
                    })
                  }
                >
                  <img src={photoPreviewSrc(item)} alt={`Foto ${item.itemName}`} />
                </button>
              )}
            </article>
          );
        })}
        {!issues.length && <EmptyState title="Tidak ada issue" body="Issue checklist pada tanggal terpilih akan muncul di sini." />}
      </div>
    </section>
  );
}

function IssuesScreen({
  store,
  selectedStaff,
  canManageIssues,
  onUpdateIssue,
  onAddComment,
  onOpenPhoto,
}: {
  store: AppStore;
  selectedStaff?: Staff;
  canManageIssues: boolean;
  onUpdateIssue: (issueId: string, patch: Partial<Issue>) => void;
  onAddComment: (issueId: string, comment: string) => void;
  onOpenPhoto: (photo: PhotoViewer) => void;
}) {
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('open');
  const [priority, setPriority] = useState<'all' | 'critical' | IssuePriority>('all');
  const [date, setDate] = useState(todayISO());
  const [staffName, setStaffName] = useState('all');
  const [openIssueId, setOpenIssueId] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const isManagerView = canManageIssues;

  const visibleIssues = useMemo(() => store.issues.filter((issue) => issue.status !== 'closed'), [store.issues]);
  const filteredIssues = useMemo(
    () =>
      visibleIssues
        .filter((issue) => {
          const currentStatus = issue.status === 'in_progress' ? 'open' : issue.status;
          return status === 'all' ? true : currentStatus === status;
        })
        .filter((issue) =>
          priority === 'all' ? true : priority === 'critical' ? issue.priority === 'urgent' || issue.priority === 'high' : issue.priority === priority,
        )
        .filter((issue) => issue.createdAt.slice(0, 10) === date)
        .filter((issue) => (staffName === 'all' ? true : issue.createdByName === staffName))
        .filter((issue) => (isManagerView ? true : issue.createdByName === selectedStaff?.staffName))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [date, isManagerView, priority, selectedStaff?.staffName, staffName, status, visibleIssues],
  );

  const openIssues = visibleIssues.filter((issue) => issue.status === 'open' || issue.status === 'in_progress');
  const resolvedIssues = visibleIssues.filter((issue) => issue.status === 'resolved');

  const quickFilter = (mode: 'open' | 'high' | 'today' | 'resolved') => {
    setOpenIssueId('');
    if (mode === 'open') {
      setStatus('open');
      setPriority('all');
      setDate(todayISO());
    }
    if (mode === 'high') {
      setStatus('open');
      setPriority('critical');
      setDate(todayISO());
    }
    if (mode === 'today') {
      setStatus('all');
      setPriority('all');
      setDate(todayISO());
    }
    if (mode === 'resolved') {
      setStatus('resolved');
      setPriority('all');
      setDate(todayISO());
    }
  };

  const submitComment = (issueId: string) => {
    onAddComment(issueId, commentDraft);
    setCommentDraft('');
  };

  return (
    <section className="stack">
      <ScreenTitle
        title="Issues"
        subtitle="Pantau masalah operasional dari checklist dan follow up manager."
        action={<IssueStatusBadge status="open" label={isManagerView ? 'Manager View' : 'Staff View'} />}
      />

      <div className="metricGrid">
        <Metric label="Open" value={String(openIssues.length)} tone="red" />
        <Metric label="Resolved" value={String(resolvedIssues.length)} tone="green" />
        <Metric label="Urgent" value={String(openIssues.filter((issue) => issue.priority === 'urgent').length)} tone="red" />
        <Metric label="High" value={String(openIssues.filter((issue) => issue.priority === 'high').length)} tone="gold" />
      </div>

      <div className="filterBar">
        <button className={status === 'open' && priority === 'all' ? 'active' : ''} onClick={() => quickFilter('open')}>
          Open Issues
        </button>
        <button className={priority === 'critical' ? 'active' : ''} onClick={() => quickFilter('high')}>
          Urgent / High
        </button>
        <button className={status === 'all' && priority === 'all' && date === todayISO() ? 'active' : ''} onClick={() => quickFilter('today')}>
          Today
        </button>
        <button className={status === 'resolved' ? 'active' : ''} onClick={() => quickFilter('resolved')}>
          Resolved
        </button>
      </div>

      <div className="panel filterGrid">
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'all' | 'open' | 'resolved');
              setOpenIssueId('');
            }}
          >
            <option value="all">Semua</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(event) => setPriority(event.target.value as 'all' | 'critical' | IssuePriority)}>
            <option value="all">Semua</option>
            <option value="critical">Urgent / High</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Staff">
          <select value={staffName} onChange={(event) => setStaffName(event.target.value)}>
            <option value="all">Semua</option>
            {Array.from(new Set(visibleIssues.map((issue) => issue.createdByName).filter(Boolean))).map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="stack tight">
        {filteredIssues.map((issue) => {
          const expanded = openIssueId === issue.issueId;
          const selectedRun = store.checklistRuns.find((run) => run.runId === issue.relatedChecklistRunId);
          const selectedItem = store.checklistRunItems.find((item) => item.runItemId === issue.relatedChecklistRunItemId);
          const comments = store.issueComments.filter((comment) => comment.issueId === issue.issueId);
          return (
            <article className={expanded ? 'issueAccordion active' : 'issueAccordion'} key={issue.issueId}>
              <button className="issueAccordionSummary" onClick={() => setOpenIssueId(expanded ? '' : issue.issueId)}>
                <div className="issueListHead">
                  <PriorityBadge priority={issue.priority} />
                  <IssueStatusBadge status={issue.status === 'in_progress' ? 'open' : issue.status} />
                </div>
                <strong>{issue.title}</strong>
                <span>{issue.createdByName || '-'} - {niceDate(issue.createdAt.slice(0, 10))}</span>
                <p>{issue.description || 'Belum ada catatan.'}</p>
                <ChevronDown className={expanded ? 'flip' : ''} size={17} />
              </button>

              {expanded && (
                <div className="issueAccordionBody">
                  <div className="issueMetaGrid">
                    <div>
                      <span>Priority</span>
                      <strong>{issuePriorityLabel(issue.priority)}</strong>
                    </div>
                    <div>
                      <span>Area</span>
                      <strong>{issue.area || '-'}</strong>
                    </div>
                    <div>
                      <span>Dibuat oleh</span>
                      <strong>{issue.createdByName || '-'}</strong>
                    </div>
                    <div>
                      <span>Assigned</span>
                      <strong>{issue.assignedToName || '-'}</strong>
                    </div>
                  </div>

                  {issue.photoUrl && (
                    <button
                      className="issuePhotoButton"
                      onClick={() =>
                        onOpenPhoto({
                          title: issue.title,
                          src: issue.photoThumbnailUrl || issue.photoUrl,
                          href: issue.photoUrl,
                          note: issue.description,
                        })
                      }
                    >
                      <img src={issue.photoThumbnailUrl || issue.photoUrl} alt={`Foto ${issue.title}`} />
                      <span>Lihat foto bukti</span>
                    </button>
                  )}

                  {selectedRun && (
                    <div className="syncInfoBox">
                      <span>Related Checklist</span>
                      <strong>{selectedRun.templateName}</strong>
                      <p>{selectedRun.staffName} - {selectedRun.templateType} - {selectedItem?.itemName || '-'}</p>
                    </div>
                  )}

                  {isManagerView && (
                    <div className="issueControls">
                      <Field label="Priority">
                        <select value={issue.priority} onChange={(event) => onUpdateIssue(issue.issueId, { priority: event.target.value as IssuePriority })}>
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </Field>
                      <Field label="Assign">
                        <select value={issue.assignedToName} onChange={(event) => onUpdateIssue(issue.issueId, { assignedToName: event.target.value })}>
                          <option value="">Belum assign</option>
                          {store.staff
                            .filter((person) => person.isActive)
                            .map((person) => (
                              <option value={person.staffName} key={person.staffId}>
                                {person.staffName}
                              </option>
                            ))}
                        </select>
                      </Field>
                      {issue.status !== 'resolved' && (
                        <button className="primaryBtn" onClick={() => onUpdateIssue(issue.issueId, { status: 'resolved' })}>
                          <Check size={16} /> Resolve Issue
                        </button>
                      )}
                    </div>
                  )}

                  <div className="commentBox">
                    <Field label="Follow up comment">
                      <textarea
                        value={commentDraft}
                        rows={3}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="Tambahkan catatan follow up"
                      />
                    </Field>
                    <button className="accentBtn" onClick={() => submitComment(issue.issueId)}>
                      <Plus size={15} /> Comment
                    </button>
                  </div>

                  <div className="commentList">
                    {comments.map((comment) => (
                      <div className="commentItem" key={comment.commentId}>
                        <strong>{comment.createdByName || 'Manager'}</strong>
                        <span>{new Date(comment.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        <p>{comment.comment}</p>
                      </div>
                    ))}
                    {!comments.length && <p className="syncStatus muted">Belum ada follow up comment.</p>}
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {!filteredIssues.length && <EmptyState title="Tidak ada issue" body="Issue yang sesuai filter akan muncul di sini." />}
      </div>
    </section>
  );
}
function VipRecapPanel({ sessions, selectedMonth }: { sessions: VipSession[]; selectedMonth: string }) {
  const monthlySessions = useMemo(
    () => sessions.filter((session) => session.date.slice(0, 7) === selectedMonth),
    [sessions, selectedMonth],
  );
  const recap = useMemo(() => buildVipRecap(monthlySessions), [monthlySessions]);

  return (
    <>
      <div className="metricGrid">
        <Metric label="Sesi VIP" value={recap.sessionCount.toLocaleString('id-ID')} tone="green" />
        <Metric label="Total Biaya" value={rupiah(recap.totalCost)} tone="gold" />
        <Metric label="Qty Terpakai" value={recap.totalUsed.toLocaleString('id-ID')} tone="green" />
        <Metric label="Belum Majoo" value={recap.notMajoo.toLocaleString('id-ID')} tone="red" />
      </div>

      <div className="panel highlightPanel">
        <div>
          <span className="eyebrow">Paling Sering Terpakai</span>
          <strong>{recap.mostUsedItem || '-'}</strong>
        </div>
        <div>
          <span className="eyebrow">Rata-rata Aqua / Sesi</span>
          <strong>{recap.avgAqua.toFixed(1)}</strong>
        </div>
      </div>

      <div className="sectionHeader">
        <h2>Rekap Per Item</h2>
      </div>

      <div className="stack tight">
        {recap.itemRows.map((row) => (
          <div className="itemSummary" key={row.itemName}>
            <div>
              <strong>{row.itemName}</strong>
              <span>{row.totalUsed} terpakai</span>
            </div>
            <div className="right">
              <strong>{rupiah(row.totalCost)}</strong>
              <span>{row.avgPerSession.toFixed(1)} / sesi</span>
            </div>
          </div>
        ))}
        {!recap.itemRows.length && <EmptyState title="Belum ada rekap" body="Simpan sesi VIP untuk melihat ringkasan bulanan." />}
      </div>
    </>
  );
}

function RunReportCard({
  run,
  items,
  onOpenPhoto,
}: {
  run: ChecklistRun;
  items: ChecklistRunItem[];
  onOpenPhoto: (photo: PhotoViewer) => void;
}) {
  const done = items.filter((item) => item.status === 'done' || item.status === 'issue').length;
  const issue = items.filter((item) => item.status === 'issue').length;
  return (
    <article className="reportCard">
      <div className="logHead">
        <div>
          <span className="eyebrow">{run.templateType}</span>
          <h3>{run.staffName}</h3>
          <p>
            {run.roleName} · {run.templateName}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>
      <div className="summaryStrip">
        <div>
          <span>Progress</span>
          <strong>
            {done}/{items.length}
          </strong>
        </div>
        <div>
          <span>Issue</span>
          <strong className={issue ? 'dangerText' : ''}>{issue}</strong>
        </div>
        <div>
          <span>Jam selesai</span>
          <strong>{run.completedAt ? new Date(run.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>
        </div>
        <div>
          <span>Foto bukti</span>
          <strong>{items.filter((item) => item.photoUrl || item.photoThumbnailUrl).length}</strong>
        </div>
      </div>
      <details className="detailsBlock">
        <summary>
          <Eye size={15} /> Detail item
        </summary>
        <div className="lineList">
          {items.map((item) => (
            <div className="lineRow" key={item.runItemId}>
              <div>
                <strong>{item.itemName}</strong>
                <span>{item.note || item.itemDescription}</span>
                {(item.photoThumbnailUrl || item.photoUrl || item.photoDataUrl) && (
                  <button
                    className="reportPhotoProof"
                    onClick={() =>
                      onOpenPhoto({
                        title: item.itemName,
                        src: photoPreviewSrc(item),
                        href: photoFullUrl(item),
                        note: item.note,
                      })
                    }
                  >
                    <img src={photoPreviewSrc(item)} alt={`Foto bukti ${item.itemName}`} />
                    <em>Lihat foto bukti</em>
                  </button>
                )}
              </div>
              <ItemStatus status={item.status} />
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}

function MasterScreen({
  store,
  syncStatus,
  setStore,
  notify,
  onPushToRemote,
  onPullFromRemote,
}: {
  store: AppStore;
  syncStatus: string;
  setStore: (updater: React.SetStateAction<AppStore>) => void;
  notify: (title: string, body?: string, tone?: ToastMessage['tone']) => void;
  onPushToRemote: () => void;
  onPullFromRemote: () => void;
}) {
  const [section, setSection] = useState<'staff' | 'roles' | 'templates' | 'vip' | 'sync'>('staff');
  const [draft, setDraft] = useState<AppStore>(() => store);
  const [masterDirty, setMasterDirty] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(store.checklistTemplates[0]?.templateId || '');
  const selectedTemplate = draft.checklistTemplates.find((template) => template.templateId === selectedTemplateId);

  useEffect(() => {
    if (masterDirty) return;
    setDraft(store);
    if (!store.checklistTemplates.some((template) => template.templateId === selectedTemplateId)) {
      setSelectedTemplateId(store.checklistTemplates[0]?.templateId || '');
    }
  }, [masterDirty, selectedTemplateId, store]);

  useEffect(() => {
    if (draft.checklistTemplates.some((template) => template.templateId === selectedTemplateId)) return;
    setSelectedTemplateId(draft.checklistTemplates[0]?.templateId || '');
  }, [draft.checklistTemplates, selectedTemplateId]);

  const updateDraft = (updater: React.SetStateAction<AppStore>) => {
    setMasterDirty(true);
    setDraft(updater);
  };

  const saveMaster = () => {
    setStore(draft);
    setMasterDirty(false);
    notify('Master data tersimpan', 'Perubahan master data sudah aktif.');
  };

  const cancelMaster = () => {
    setDraft(store);
    setSelectedTemplateId(store.checklistTemplates[0]?.templateId || '');
    setMasterDirty(false);
    notify('Perubahan dibatalkan', 'Master data kembali ke versi terakhir.', 'info');
  };

  const addRole = () => {
    const timestamp = nowIso();
    updateDraft((current) => ({
      ...current,
      roles: [
        ...current.roles,
        {
          roleId: uid(),
          roleName: 'Role Baru',
          description: '',
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }));
  };

  const addStaff = () => {
    const timestamp = nowIso();
    const roleId = draft.roles[0]?.roleId || '';
    updateDraft((current) => ({
      ...current,
      staff: [
        ...current.staff,
        {
          staffId: uid(),
          staffName: 'Staff Baru',
          roleId,
          openingTemplateId: current.checklistTemplates.find((template) => template.roleId === roleId && template.templateType === 'opening')?.templateId || '',
          closingTemplateId: current.checklistTemplates.find((template) => template.roleId === roleId && template.templateType === 'closing')?.templateId || '',
          isActive: true,
          permissionLevel: 'Staff',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }));
  };

  const addTemplate = () => {
    const timestamp = nowIso();
    const templateId = uid();
    setSelectedTemplateId(templateId);
    updateDraft((current) => ({
      ...current,
      checklistTemplates: [
        ...current.checklistTemplates,
        {
          templateId,
          templateName: 'Template Baru',
          templateType: 'opening',
          roleId: current.roles[0]?.roleId || '',
          description: '',
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }));
  };

  const addTemplateItem = () => {
    if (!selectedTemplate) return;
    const timestamp = nowIso();
    const existing = getTemplateItems(draft, selectedTemplate.templateId);
    updateDraft((current) => ({
      ...current,
      checklistTemplateItems: [
        ...current.checklistTemplateItems,
        {
          templateItemId: uid(),
          templateId: selectedTemplate.templateId,
          itemName: 'Item checklist baru',
          itemDescription: '',
          sortOrder: existing.length + 1,
          photoRequired: false,
          noteRequired: false,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }));
  };

  return (
    <section className="stack">
      <ScreenTitle
        title="Master Data"
        subtitle="Kelola staff, role, template checklist, VIP item, dan Supabase sync."
        action={
          <div className="cardActions">
            <button className="secondaryBtn" onClick={cancelMaster} disabled={!masterDirty}>
              <X size={16} /> Batal
            </button>
            <button className="primaryBtn" onClick={saveMaster} disabled={!masterDirty}>
              <Save size={16} /> Simpan
            </button>
          </div>
        }
      />

      <div className="filterBar">
        {[
          ['staff', 'Staff'],
          ['roles', 'Roles'],
          ['templates', 'Templates'],
          ['vip', 'VIP Items'],
          ['sync', 'Sync'],
        ].map(([key, label]) => (
          <button className={section === key ? 'active' : ''} onClick={() => setSection(key as typeof section)} key={key}>
            {label}
          </button>
        ))}
      </div>

      {section === 'sync' && (
        <div className="panel syncPanel">
          <div className="syncInfoBox">
            <span>Database</span>
            <strong>Supabase</strong>
            <p>{isSupabaseConfigured ? 'Project Supabase sudah terhubung dari environment Vercel/Vite.' : 'Environment Supabase belum lengkap.'}</p>
          </div>
          <div className="syncControls">
            <div className="syncAlwaysOn">Auto-sync aktif</div>
            <div className="syncButtons">
              <button className="secondaryBtn" onClick={onPullFromRemote} disabled={masterDirty}>
                <Download size={16} /> Tarik
              </button>
              <button className="primaryBtn" onClick={onPushToRemote} disabled={masterDirty}>
                <Save size={16} /> Kirim
              </button>
            </div>
          </div>
          <p className="syncStatus">{syncStatus}</p>
          {masterDirty && <p className="syncStatus muted">Simpan atau batal dulu sebelum tarik/kirim Supabase.</p>}
          {draft.sync.lastSyncedAt && (
            <p className="syncStatus muted">
              Sync terakhir: {new Date(draft.sync.lastSyncedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
      )}

      {section === 'roles' && (
        <>
          <div className="sectionHeader">
            <h2>Roles</h2>
            <button className="accentBtn" onClick={addRole}>
              <Plus size={15} /> Role
            </button>
          </div>
          <div className="stack tight">
            {draft.roles.map((role) => (
              <article className="masterRow" key={role.roleId}>
                <div className="rowIcon">
                  <UsersRound size={17} />
                </div>
                <div className="masterFields">
                  <input value={role.roleName} onChange={(event) => patchRole(updateDraft, role.roleId, { roleName: event.target.value })} />
                  <input
                    value={role.description}
                    placeholder="Deskripsi"
                    onChange={(event) => patchRole(updateDraft, role.roleId, { description: event.target.value })}
                  />
                </div>
                <div className="cardActions">
                  <Toggle checked={role.isActive} onChange={() => patchRole(updateDraft, role.roleId, { isActive: !role.isActive })} />
                  <button className="iconBtn danger" onClick={() => deleteRole(updateDraft, role.roleId, role.roleName)} aria-label="Hapus role">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {section === 'staff' && (
        <>
          <div className="sectionHeader">
            <h2>Staff Assignment</h2>
            <button className="accentBtn" onClick={addStaff}>
              <Plus size={15} /> Staff
            </button>
          </div>
          <div className="stack tight">
            {draft.staff.map((person) => (
              <article className="staffMasterCard" key={person.staffId}>
                <div className="masterTitle">
                  <UserRound size={17} />
                  <input value={person.staffName} onChange={(event) => patchStaff(updateDraft, person.staffId, { staffName: event.target.value })} />
                  <div className="cardActions">
                    <Toggle checked={person.isActive} onChange={() => patchStaff(updateDraft, person.staffId, { isActive: !person.isActive })} />
                    <button
                      className="iconBtn danger"
                      onClick={() => deleteStaff(updateDraft, person.staffId, person.staffName)}
                      aria-label="Hapus staff"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="assignmentGrid">
                  <Field label="Role">
                    <select value={person.roleId} onChange={(event) => patchStaff(updateDraft, person.staffId, { roleId: event.target.value })}>
                      {draft.roles.map((role) => (
                        <option value={role.roleId} key={role.roleId}>
                          {role.roleName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Permission">
                    <select
                      value={person.permissionLevel}
                      onChange={(event) => patchStaff(updateDraft, person.staffId, { permissionLevel: event.target.value as PermissionLevel })}
                    >
                      <option value="Staff">Staff</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                    </select>
                  </Field>
                  <Field label="Opening Template">
                    <select
                      value={person.openingTemplateId}
                      onChange={(event) => patchStaff(updateDraft, person.staffId, { openingTemplateId: event.target.value })}
                    >
                      <option value="">Belum assign</option>
                      {draft.checklistTemplates
                        .filter((template) => template.templateType === 'opening' && template.isActive)
                        .map((template) => (
                          <option value={template.templateId} key={template.templateId}>
                            {template.templateName}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Closing Template">
                    <select
                      value={person.closingTemplateId}
                      onChange={(event) => patchStaff(updateDraft, person.staffId, { closingTemplateId: event.target.value })}
                    >
                      <option value="">Belum assign</option>
                      {draft.checklistTemplates
                        .filter((template) => template.templateType === 'closing' && template.isActive)
                        .map((template) => (
                          <option value={template.templateId} key={template.templateId}>
                            {template.templateName}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {section === 'templates' && (
        <>
          <div className="sectionHeader">
            <h2>Checklist Templates</h2>
            <button className="accentBtn" onClick={addTemplate}>
              <Plus size={15} /> Template
            </button>
          </div>
          <div className="templateLayout">
            <div className="templateList">
              {draft.checklistTemplates.map((template) => (
                <button
                  className={template.templateId === selectedTemplateId ? 'templatePick active' : 'templatePick'}
                  onClick={() => setSelectedTemplateId(template.templateId)}
                  key={template.templateId}
                >
                  <strong>{template.templateName}</strong>
                  <span>{template.templateType}</span>
                </button>
              ))}
            </div>
            {selectedTemplate ? (
              <div className="stack tight">
                <div className="panel formGrid">
                  <Field label="Nama Template">
                    <input
                      value={selectedTemplate.templateName}
                      onChange={(event) => patchTemplate(updateDraft, selectedTemplate.templateId, { templateName: event.target.value })}
                    />
                  </Field>
                  <Field label="Jenis">
                    <select
                      value={selectedTemplate.templateType}
                      onChange={(event) => patchTemplate(updateDraft, selectedTemplate.templateId, { templateType: event.target.value as TemplateType })}
                    >
                      <option value="opening">Opening</option>
                      <option value="closing">Closing</option>
                      <option value="custom">Custom</option>
                    </select>
                  </Field>
                  <Field label="Untuk Role">
                    <select
                      value={selectedTemplate.roleId}
                      onChange={(event) => patchTemplate(updateDraft, selectedTemplate.templateId, { roleId: event.target.value })}
                    >
                      {draft.roles.map((role) => (
                        <option value={role.roleId} key={role.roleId}>
                          {role.roleName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Deskripsi">
                    <textarea
                      value={selectedTemplate.description}
                      rows={2}
                      onChange={(event) => patchTemplate(updateDraft, selectedTemplate.templateId, { description: event.target.value })}
                    />
                  </Field>
                  <label className="checkLine masterCheck">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.isActive}
                      onChange={(event) => patchTemplate(updateDraft, selectedTemplate.templateId, { isActive: event.target.checked })}
                    />
                    Template aktif
                  </label>
                  <button
                    className="secondaryBtn"
                    onClick={() => {
                      const duplicatedId = duplicateTemplate(updateDraft, draft, selectedTemplate.templateId);
                      if (duplicatedId) setSelectedTemplateId(duplicatedId);
                    }}
                  >
                    <RotateCcw size={16} /> Duplikat Template
                  </button>
                  <button
                    className="secondaryBtn dangerSoft"
                    onClick={() => {
                      const nextTemplate = draft.checklistTemplates.find((template) => template.templateId !== selectedTemplate.templateId);
                      deleteTemplate(updateDraft, selectedTemplate.templateId, selectedTemplate.templateName);
                      setSelectedTemplateId(nextTemplate?.templateId || '');
                    }}
                  >
                    <Trash2 size={16} /> Hapus Template
                  </button>
                </div>
                <div className="sectionHeader">
                  <h2>Template Items</h2>
                  <button className="accentBtn" onClick={addTemplateItem}>
                    <Plus size={15} /> Item
                  </button>
                </div>
                {getTemplateItems(draft, selectedTemplate.templateId).map((item, index) => (
                  <article className="templateItemRow" key={item.templateItemId}>
                    <div className="itemNumber">{index + 1}</div>
                    <div className="masterFields">
                      <input
                        value={item.itemName}
                        onChange={(event) => patchTemplateItem(updateDraft, item.templateItemId, { itemName: event.target.value })}
                      />
                      <input
                        value={item.itemDescription}
                        placeholder="Instruksi singkat"
                        onChange={(event) => patchTemplateItem(updateDraft, item.templateItemId, { itemDescription: event.target.value })}
                      />
                      <div className="templateItemControls">
                        <label className="checkLine">
                          <input
                            type="checkbox"
                            checked={item.photoRequired}
                            onChange={(event) => patchTemplateItem(updateDraft, item.templateItemId, { photoRequired: event.target.checked })}
                          />
                          Foto
                        </label>
                        <label className="checkLine">
                          <input
                            type="checkbox"
                            checked={item.noteRequired}
                            onChange={(event) => patchTemplateItem(updateDraft, item.templateItemId, { noteRequired: event.target.checked })}
                          />
                          Catatan
                        </label>
                        <button
                          className="iconBtn"
                          onClick={() => moveTemplateItem(updateDraft, selectedTemplate.templateId, item.templateItemId, -1)}
                          aria-label="Naik"
                        >
                          <ChevronDown className="flip" size={15} />
                        </button>
                        <button
                          className="iconBtn"
                          onClick={() => moveTemplateItem(updateDraft, selectedTemplate.templateId, item.templateItemId, 1)}
                          aria-label="Turun"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="cardActions">
                      <Toggle checked={item.isActive} onChange={() => patchTemplateItem(updateDraft, item.templateItemId, { isActive: !item.isActive })} />
                      <button
                        className="iconBtn danger"
                        onClick={() => deleteTemplateItem(updateDraft, item.templateItemId, item.itemName)}
                        aria-label="Hapus item template"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Pilih template" body="Detail template dan item akan tampil di sini." />
            )}
          </div>
        </>
      )}

      {section === 'vip' && (
        <>
          <div className="sectionHeader">
            <h2>VIP Complimentary Items</h2>
            <button
              className="accentBtn"
              onClick={() =>
                updateDraft((current) => ({
                  ...current,
                  items: [...current.items, { id: uid(), name: 'Item Baru', category: 'Minuman', hpp: 0, defaultQty: 1, active: true }],
                }))
              }
            >
              <Plus size={15} /> Item
            </button>
          </div>
          <div className="stack tight">
            {draft.items.map((item) => (
              <article className="masterRow" key={item.id}>
                <div className="rowIcon">
                  <Package size={17} />
                </div>
                <div className="masterFields">
                  <input value={item.name} onChange={(event) => patchVipItem(updateDraft, item.id, { name: event.target.value })} />
                  <div className="triple">
                    <input value={item.category} onChange={(event) => patchVipItem(updateDraft, item.id, { category: event.target.value })} />
                    <input inputMode="numeric" value={item.hpp} onChange={(event) => patchVipItem(updateDraft, item.id, { hpp: Number(event.target.value) })} />
                    <input
                      inputMode="numeric"
                      value={item.defaultQty}
                      onChange={(event) => patchVipItem(updateDraft, item.id, { defaultQty: Number(event.target.value) })}
                    />
                  </div>
                </div>
                <div className="cardActions">
                  <Toggle checked={item.active} onChange={() => patchVipItem(updateDraft, item.id, { active: !item.active })} />
                  <button className="iconBtn danger" onClick={() => deleteVipItem(updateDraft, item.id, item.name)} aria-label="Hapus item VIP">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ScreenTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="screenTitle">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'gold' | 'red' }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  const labels: Record<RunStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    has_issue: 'Has Issue',
  };
  return <div className={`statusBadge ${status}`}>{labels[status]}</div>;
}

function ItemStatus({ status }: { status: RunItemStatus }) {
  const labels: Record<RunItemStatus, string> = {
    pending: 'Pending',
    done: 'Done',
    issue: 'Issue',
    skipped: 'Skipped',
  };
  return <span className={`itemStatus ${status}`}>{labels[status]}</span>;
}

function IssueStatusBadge({ status, label }: { status: IssueStatus; label?: string }) {
  return <span className={`issueStatus ${status}`}>{label || issueStatusLabel(status)}</span>;
}

function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return <span className={`priorityBadge ${priority}`}>{issuePriorityLabel(priority)}</span>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button className={`toggle ${checked ? 'on' : ''}`} onClick={onChange} aria-label="Toggle status">
      <span />
    </button>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? 'navActive' : ''} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ModePill({ managerMode }: { managerMode: boolean }) {
  return <div className={`modePill ${managerMode ? 'manager' : ''}`}>{managerMode ? 'Manager' : 'Staff'}</div>;
}

function StatusPill({ store }: { store: AppStore }) {
  const todayRuns = store.checklistRuns.filter((run) => run.date === todayISO());
  const issues = todayRuns.filter((run) => run.status === 'has_issue').length;
  return <div className={`statusPill ${issues ? 'warn' : ''}`}>{issues ? `${issues} Issue` : `${todayRuns.length} Run`}</div>;
}

function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  return (
    <div className={`toastPopup ${toast.tone}`} role="status" aria-live="polite">
      <div className="toastIcon">
        {toast.tone === 'warning' ? <AlertTriangle size={18} /> : <Check size={18} />}
      </div>
      <div>
        <strong>{toast.title}</strong>
        {toast.body && <span>{toast.body}</span>}
      </div>
    </div>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: PhotoViewer | null; onClose: () => void }) {
  if (!photo) return null;
  return (
    <div className="lightboxBackdrop" role="dialog" aria-modal="true" aria-label="Foto bukti">
      <button className="lightboxScrim" onClick={onClose} aria-label="Tutup foto" />
      <div className="lightboxPanel">
        <div className="lightboxHead">
          <div>
            <span className="eyebrow">Foto Bukti</span>
            <strong>{photo.title}</strong>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="Tutup foto">
            <X size={16} />
          </button>
        </div>
        <img className="lightboxImage" src={photo.src} alt={`Foto bukti ${photo.title}`} />
        {photo.note && <p className="lightboxNote">{photo.note}</p>}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="emptyState">
      <ListChecks size={22} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function setFormValue<K extends keyof VipForm>(setter: React.Dispatch<React.SetStateAction<VipForm>>, key: K, value: VipForm[K]) {
  setter((current) => ({ ...current, [key]: value }));
}

function getVipTotals(items: VipSessionItem[]) {
  return items.reduce(
    (sum, item) => ({
      usedQty: sum.usedQty + item.usedQty,
      returnQty: sum.returnQty + item.returnToStockQty,
      totalCost: sum.totalCost + item.totalCost,
    }),
    { usedQty: 0, returnQty: 0, totalCost: 0 },
  );
}

function isRunSubmitted(run: ChecklistRun) {
  return run.status === 'completed' || run.status === 'has_issue';
}

function photoPreviewSrc(item: Pick<ChecklistRunItem, 'photoDataUrl' | 'photoThumbnailUrl' | 'photoUrl'>) {
  if (item.photoDataUrl) return item.photoDataUrl;
  const source = item.photoThumbnailUrl || item.photoUrl;
  return driveThumbnailUrl(source) || source || '';
}

function photoFullUrl(item: Pick<ChecklistRunItem, 'photoDataUrl' | 'photoThumbnailUrl' | 'photoUrl'>) {
  if (item.photoDataUrl) return item.photoDataUrl;
  return driveViewUrl(item.photoUrl || item.photoThumbnailUrl) || item.photoUrl || item.photoThumbnailUrl || '';
}

function driveFileId(url?: string) {
  if (!url) return '';
  const byPath = url.match(/\/file\/d\/([^/?]+)/);
  if (byPath?.[1]) return byPath[1];
  const byQuery = url.match(/[?&]id=([^&]+)/);
  if (byQuery?.[1]) return byQuery[1];
  return '';
}

function driveThumbnailUrl(url?: string) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` : '';
}

function driveViewUrl(url?: string) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : '';
}

function issueStatusLabel(status: IssueStatus) {
  const labels: Record<IssueStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status];
}

function issuePriorityLabel(priority: IssuePriority) {
  const labels: Record<IssuePriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  };
  return labels[priority];
}

function buildVipRecap(sessions: VipSession[]) {
  const itemMap = new Map<string, { itemName: string; totalUsed: number; totalCost: number }>();
  let totalUsed = 0;
  let totalCost = 0;
  let notMajoo = 0;

  sessions.forEach((session) => {
    session.items.forEach((item) => {
      totalUsed += item.usedQty;
      totalCost += item.totalCost;
      if (!item.majooInputDone && item.usedQty > 0) notMajoo += 1;
      const row = itemMap.get(item.itemName) ?? { itemName: item.itemName, totalUsed: 0, totalCost: 0 };
      row.totalUsed += item.usedQty;
      row.totalCost += item.totalCost;
      itemMap.set(item.itemName, row);
    });
  });

  const itemRows = Array.from(itemMap.values())
    .map((row) => ({
      ...row,
      avgPerSession: sessions.length ? row.totalUsed / sessions.length : 0,
    }))
    .sort((a, b) => b.totalUsed - a.totalUsed);

  const aqua = itemRows.find((row) => row.itemName.toLowerCase().includes('aqua'));

  return {
    sessionCount: sessions.length,
    totalUsed,
    totalCost,
    notMajoo,
    mostUsedItem: itemRows[0]?.itemName ?? '',
    avgAqua: sessions.length && aqua ? aqua.totalUsed / sessions.length : 0,
    itemRows,
  };
}

function getTemplateItems(store: AppStore, templateId: string) {
  return store.checklistTemplateItems
    .filter((item) => item.templateId === templateId && item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function validateVipForm(form: VipForm) {
  const errors: string[] = [];
  if (!form.date) errors.push('Tanggal wajib diisi.');
  if (!form.bookingName.trim()) errors.push('Nama booking wajib diisi.');
  if (!form.staffName.trim()) errors.push('Staff wajib dipilih.');
  if (!form.items.length) errors.push('Minimal satu item complimentary.');
  return errors;
}

function validateRunItems(items: ChecklistRunItem[]) {
  const errors: string[] = [];
  items.forEach((item) => {
    if (item.status === 'pending') errors.push(`${item.itemName}: belum dikerjakan.`);
    if (item.status === 'issue' && !item.note.trim()) errors.push(`${item.itemName}: issue wajib catatan.`);
    if (item.noteRequired && !item.note.trim()) errors.push(`${item.itemName}: wajib catatan.`);
    if (item.photoRequired && !item.photoUrl && !item.photoDataUrl) errors.push(`${item.itemName}: wajib upload foto.`);
  });
  return errors;
}

function patchVipItem(setStore: (updater: React.SetStateAction<AppStore>) => void, itemId: string, patch: Partial<VipItem>) {
  setStore((current) => ({
    ...current,
    items: current.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...patch,
            hpp: patch.hpp === undefined ? item.hpp : Math.max(0, Number(patch.hpp) || 0),
            defaultQty: patch.defaultQty === undefined ? item.defaultQty : Math.max(0, Math.trunc(Number(patch.defaultQty) || 0)),
          }
        : item,
    ),
  }));
}

function deleteVipItem(setStore: (updater: React.SetStateAction<AppStore>) => void, itemId: string, itemName: string) {
  if (!window.confirm(`Hapus item VIP "${itemName}" dari master data? Riwayat VIP log lama tetap tersimpan.`)) return;
  setStore((current) => ({
    ...current,
    items: current.items.filter((item) => item.id !== itemId),
  }));
}

function patchRole(setStore: (updater: React.SetStateAction<AppStore>) => void, roleId: string, patch: Partial<Role>) {
  setStore((current) => ({
    ...current,
    roles: current.roles.map((role) => (role.roleId === roleId ? { ...role, ...patch, updatedAt: nowIso() } : role)),
  }));
}

function deleteRole(setStore: (updater: React.SetStateAction<AppStore>) => void, roleId: string, roleName: string) {
  if (!window.confirm(`Hapus role "${roleName}"? Staff dan template yang memakai role ini akan dikosongkan role-nya.`)) return;
  setStore((current) => ({
    ...current,
    roles: current.roles.filter((role) => role.roleId !== roleId),
    staff: current.staff.map((person) => (person.roleId === roleId ? { ...person, roleId: '', updatedAt: nowIso() } : person)),
    checklistTemplates: current.checklistTemplates.map((template) =>
      template.roleId === roleId ? { ...template, roleId: '', updatedAt: nowIso() } : template,
    ),
  }));
}

function patchStaff(setStore: (updater: React.SetStateAction<AppStore>) => void, staffId: string, patch: Partial<Staff>) {
  setStore((current) => ({
    ...current,
    staff: current.staff.map((person) => (person.staffId === staffId ? { ...person, ...patch, updatedAt: nowIso() } : person)),
  }));
}

function deleteStaff(setStore: (updater: React.SetStateAction<AppStore>) => void, staffId: string, staffName: string) {
  if (!window.confirm(`Hapus staff "${staffName}" dari master data? Riwayat checklist dan VIP log lama tetap tersimpan.`)) return;
  setStore((current) => ({
    ...current,
    staff: current.staff.filter((person) => person.staffId !== staffId),
  }));
}

function patchTemplate(setStore: (updater: React.SetStateAction<AppStore>) => void, templateId: string, patch: Partial<ChecklistTemplate>) {
  setStore((current) => ({
    ...current,
    checklistTemplates: current.checklistTemplates.map((template) =>
      template.templateId === templateId ? { ...template, ...patch, updatedAt: nowIso() } : template,
    ),
  }));
}

function deleteTemplate(setStore: (updater: React.SetStateAction<AppStore>) => void, templateId: string, templateName: string) {
  if (!window.confirm(`Hapus template "${templateName}" beserta item master di dalamnya? Riwayat checklist yang sudah berjalan tetap tersimpan.`)) return;
  setStore((current) => ({
    ...current,
    checklistTemplates: current.checklistTemplates.filter((template) => template.templateId !== templateId),
    checklistTemplateItems: current.checklistTemplateItems.filter((item) => item.templateId !== templateId),
    staff: current.staff.map((person) => ({
      ...person,
      openingTemplateId: person.openingTemplateId === templateId ? '' : person.openingTemplateId,
      closingTemplateId: person.closingTemplateId === templateId ? '' : person.closingTemplateId,
      updatedAt:
        person.openingTemplateId === templateId || person.closingTemplateId === templateId ? nowIso() : person.updatedAt,
    })),
  }));
}

function duplicateTemplate(
  setStore: (updater: React.SetStateAction<AppStore>) => void,
  store: AppStore,
  templateId: string,
) {
  const source = store.checklistTemplates.find((template) => template.templateId === templateId);
  if (!source) return '';
  const timestamp = nowIso();
  const nextTemplateId = uid();
  const sourceItems = getTemplateItems(store, templateId);

  setStore((current) => ({
    ...current,
    checklistTemplates: [
      ...current.checklistTemplates,
      {
        ...source,
        templateId: nextTemplateId,
        templateName: `${source.templateName} Copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    checklistTemplateItems: [
      ...current.checklistTemplateItems,
      ...sourceItems.map((item, index) => ({
        ...item,
        templateItemId: uid(),
        templateId: nextTemplateId,
        sortOrder: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    ],
  }));

  return nextTemplateId;
}

function patchTemplateItem(setStore: (updater: React.SetStateAction<AppStore>) => void, templateItemId: string, patch: Partial<ChecklistTemplateItem>) {
  setStore((current) => ({
    ...current,
    checklistTemplateItems: current.checklistTemplateItems.map((item) =>
      item.templateItemId === templateItemId ? { ...item, ...patch, updatedAt: nowIso() } : item,
    ),
  }));
}

function deleteTemplateItem(setStore: (updater: React.SetStateAction<AppStore>) => void, templateItemId: string, itemName: string) {
  if (!window.confirm(`Hapus item checklist "${itemName}" dari template? Riwayat checklist lama tetap tersimpan.`)) return;
  setStore((current) => {
    const deleted = current.checklistTemplateItems.find((item) => item.templateItemId === templateItemId);
    const remaining = current.checklistTemplateItems.filter((item) => item.templateItemId !== templateItemId);
    if (!deleted) return current;
    const reindexed = remaining
      .filter((item) => item.templateId === deleted.templateId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item, index) => ({ ...item, sortOrder: index + 1 }));
    const reindexMap = new Map(reindexed.map((item) => [item.templateItemId, item]));
    return {
      ...current,
      checklistTemplateItems: remaining.map((item) => reindexMap.get(item.templateItemId) || item),
    };
  });
}

function moveTemplateItem(
  setStore: (updater: React.SetStateAction<AppStore>) => void,
  templateId: string,
  templateItemId: string,
  direction: -1 | 1,
) {
  setStore((current) => {
    const activeItems = current.checklistTemplateItems
      .filter((item) => item.templateId === templateId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = activeItems.findIndex((item) => item.templateItemId === templateItemId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= activeItems.length) return current;
    const currentItem = activeItems[index];
    const swapItem = activeItems[nextIndex];
    return {
      ...current,
      checklistTemplateItems: current.checklistTemplateItems.map((item) => {
        if (item.templateItemId === currentItem.templateItemId) return { ...item, sortOrder: swapItem.sortOrder, updatedAt: nowIso() };
        if (item.templateItemId === swapItem.templateItemId) return { ...item, sortOrder: currentItem.sortOrder, updatedAt: nowIso() };
        return item;
      }),
    };
  });
}

async function resizeImage(file: File) {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca foto.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal memproses foto.'));
    image.src = src;
  });
}

function exportVipCsv(sessions: VipSession[], includeFinancials = false) {
  const rows = sessions.flatMap((session) =>
    session.items.map((item) => ({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      bookingName: session.bookingName,
      room: session.room,
      staffName: session.staffName,
      itemName: item.itemName,
      preparedQty: item.preparedQty,
      sealedLeftQty: item.sealedLeftQty,
      usedQty: item.usedQty,
      ...(includeFinancials ? { totalCost: item.totalCost } : {}),
      majooInputDone: item.majooInputDone ? 'Yes' : 'No',
      notes: session.notes || '',
    })),
  );
  exportRows(rows, `vip-complimentary-log-${todayISO()}.csv`);
}

function exportChecklistCsv(rows: Record<string, string | number>[]) {
  exportRows(rows, `checklist-report-${todayISO()}.csv`);
}

function exportRows(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default App;
