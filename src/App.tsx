import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  Edit3,
  History,
  Package,
  Plus,
  Save,
  Settings2,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Tab = 'input' | 'log' | 'recap' | 'master';
type SessionStatus = 'draft' | 'completed';
type LogFilter = 'today' | 'month' | 'custom' | 'notMajoo';

type Item = {
  id: string;
  name: string;
  category: string;
  hpp: number;
  defaultQty: number;
  active: boolean;
};

type Staff = {
  id: string;
  name: string;
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
  status: SessionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: VipSessionItem[];
};

type SessionForm = Omit<VipSession, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'items'> & {
  items: VipSessionItem[];
};

type SyncSettings = {
  sheetEndpoint: string;
  autoSync: boolean;
  lastSyncedAt?: string;
};

type AppStore = {
  items: Item[];
  staff: Staff[];
  sessions: VipSession[];
  sync: SyncSettings;
};

const DEFAULT_ITEMS: Item[] = [
  { id: 'item-aqua-600', name: 'Aqua 600ml', category: 'Minuman', hpp: 2500, defaultQty: 6, active: true },
  { id: 'item-pocari-500', name: 'Pocari Sweat 500ml', category: 'Minuman', hpp: 6000, defaultQty: 2, active: true },
  { id: 'item-mizone-500', name: 'Mizone 500ml', category: 'Minuman', hpp: 5000, defaultQty: 2, active: true },
  { id: 'item-coconut-rtd', name: 'Coconut RTD', category: 'Minuman', hpp: 8000, defaultQty: 2, active: true },
];

const DEFAULT_STAFF: Staff[] = [
  { id: 'staff-1', name: 'Staff 1', active: true },
  { id: 'staff-2', name: 'Staff 2', active: true },
  { id: 'staff-supervisor', name: 'Supervisor', active: true },
];

const STORAGE_KEY = 'nomono.vip-complimentary-log.v1';
const DEFAULT_SHEET_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzCWhlBw9OFcUjhcqHj0_A5LgW15cdGk4ss4C3KCl6v0CGHSM_RQP_gv7mlzo5IBAwkgA/exec';
const DEFAULT_SYNC: SyncSettings = {
  sheetEndpoint: DEFAULT_SHEET_ENDPOINT,
  autoSync: false,
};
const BOOKING_TIME_OPTIONS = Array.from({ length: 25 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:00`;
  return {
    value,
    label: value.replace(':', '.'),
  };
});

const uid = () => {
  if ('crypto' in window && 'randomUUID' in window.crypto) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const todayISO = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const currentTime = () => `${String(new Date().getHours()).padStart(2, '0')}:00`;

const addHours = (time: string, hours: number) => {
  const [rawHour, rawMinute] = time.split(':').map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 0;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  const nextHour = Math.min(24, hour + hours);
  return `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

const niceDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const monthKey = (date: string) => date.slice(0, 7);

const emptyStore = (): AppStore => ({
  items: DEFAULT_ITEMS,
  staff: DEFAULT_STAFF,
  sessions: [] as VipSession[],
  sync: DEFAULT_SYNC,
});

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
    totalCost: usedQty * line.hpp,
  };
}

function createLine(item: Item): VipSessionItem {
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

function makeForm(items: Item[], staff: Staff[]): SessionForm {
  const startTime = currentTime();
  return {
    date: todayISO(),
    startTime,
    endTime: addHours(startTime, 1),
    bookingName: '',
    room: 'VIP Room',
    staffName: staff.find((person) => person.active)?.name ?? '',
    notes: '',
    items: items.filter((item) => item.active).map(createLine),
  };
}

function normalizeStore(value: unknown): AppStore {
  const parsed = (value && typeof value === 'object' ? value : {}) as Partial<AppStore>;
  return {
    items: Array.isArray(parsed.items) && parsed.items.length ? parsed.items : DEFAULT_ITEMS,
    staff: Array.isArray(parsed.staff) && parsed.staff.length ? parsed.staff : DEFAULT_STAFF,
    sessions: Array.isArray(parsed.sessions)
      ? parsed.sessions.map((session) => ({
          ...session,
          endTime: session.endTime || addHours(session.startTime || '00:00', 1),
          items: Array.isArray(session.items) ? session.items.map(calculateLine) : [],
        }))
      : [],
    sync: {
      ...DEFAULT_SYNC,
      ...(parsed.sync && typeof parsed.sync === 'object' ? parsed.sync : {}),
    },
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  };
}

function withQuery(url: string, params: Record<string, string>) {
  const next = new URL(url);
  Object.entries(params).forEach(([key, value]) => next.searchParams.set(key, value));
  return next.toString();
}

function readSheetStore(endpoint: string): Promise<AppStore> {
  return new Promise((resolve, reject) => {
    const callbackName = `vipSheetCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };

    (window as unknown as Record<string, (response: { ok?: boolean; data?: unknown; error?: string }) => void>)[
      callbackName
    ] = (response) => {
      cleanup();
      if (!response?.ok) {
        reject(new Error(response?.error || 'Gagal membaca Google Sheet.'));
        return;
      }
      resolve(normalizeStore(response.data));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Tidak bisa menghubungi Apps Script URL.'));
    };
    script.src = withQuery(endpoint, {
      action: 'read',
      callback: callbackName,
      t: String(Date.now()),
    });
    document.body.appendChild(script);
  });
}

async function writeSheetStore(endpoint: string, store: AppStore) {
  await fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'write',
      data: storePayload(store),
    }),
  });
}

function App() {
  const [tab, setTab] = useState<Tab>('input');
  const [store, setStore] = useState(loadStore);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(() => makeForm(DEFAULT_ITEMS, DEFAULT_STAFF));
  const [syncStatus, setSyncStatus] = useState(
    store.sync.sheetEndpoint ? 'Google Sheet siap disambungkan.' : 'Mode lokal.',
  );
  const skipAutoSyncRef = useRef(false);
  const remoteReadyRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    const endpoint = store.sync.sheetEndpoint.trim();
    if (!endpoint) {
      remoteReadyRef.current = true;
      return;
    }

    let cancelled = false;
    setSyncStatus('Memuat database dari Google Sheet...');

    readSheetStore(endpoint)
      .then((remote) => {
        if (cancelled) return;
        remoteReadyRef.current = true;
        skipAutoSyncRef.current = true;
        setStore((current) => ({
          ...remote,
          sync: { ...current.sync, lastSyncedAt: new Date().toISOString() },
        }));
        setForm(makeForm(remote.items, remote.staff));
        setSyncStatus('Database Google Sheet sudah dimuat.');
      })
      .catch((error) => {
        if (cancelled) return;
        remoteReadyRef.current = false;
        setSyncStatus(error instanceof Error ? error.message : 'Gagal memuat Google Sheet. Mode lokal tetap aktif.');
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
    if (!store.sync.autoSync || !store.sync.sheetEndpoint.trim()) return;
    if (!remoteReadyRef.current) {
      setSyncStatus('Auto-sync menunggu database Google Sheet dimuat.');
      return;
    }

    setSyncStatus('Menunggu auto-sync...');
    const timer = window.setTimeout(async () => {
      try {
        await writeSheetStore(store.sync.sheetEndpoint.trim(), store);
        setSyncStatus(`Auto-sync tersimpan ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
      } catch (error) {
        setSyncStatus(error instanceof Error ? error.message : 'Auto-sync gagal.');
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    if (!editingId) {
      setForm((current) => ({
        ...current,
        staffName: current.staffName || store.staff.find((person) => person.active)?.name || '',
        items: current.items.length ? current.items : store.items.filter((item) => item.active).map(createLine),
      }));
    }
  }, [store.items, store.staff, editingId]);

  const totals = useMemo(() => getSessionTotals(form.items), [form.items]);
  const validationErrors = useMemo(() => validateForm(form), [form]);

  const saveSession = (status: SessionStatus) => {
    const errors = validateForm(form);
    if (errors.length) return;

    const now = new Date().toISOString();
    const cleanedItems = form.items.map(calculateLine);
    const payload: VipSession = {
      ...form,
      id: editingId ?? uid(),
      status,
      createdAt: editingId ? store.sessions.find((session) => session.id === editingId)?.createdAt ?? now : now,
      updatedAt: now,
      items: cleanedItems,
    };

    setStore((current) => ({
      ...current,
      sessions: editingId
        ? current.sessions.map((session) => (session.id === editingId ? payload : session))
        : [payload, ...current.sessions],
    }));

    setEditingId(null);
    setForm(makeForm(store.items, store.staff));
    setTab('log');
  };

  const editSession = (session: VipSession) => {
    setEditingId(session.id);
    setForm({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime || addHours(session.startTime, 1),
      bookingName: session.bookingName,
      room: session.room,
      staffName: session.staffName,
      notes: session.notes ?? '',
      items: session.items.map(calculateLine),
    });
    setTab('input');
  };

  const deleteSession = (sessionId: string) => {
    if (!window.confirm('Hapus log sesi ini?')) return;
    setStore((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== sessionId),
    }));
    if (editingId === sessionId) {
      setEditingId(null);
      setForm(makeForm(store.items, store.staff));
    }
  };

  const updateLine = (lineId: string, next: Partial<VipSessionItem>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((line) => calculateLine(line.id === lineId ? { ...line, ...next } : line)),
    }));
  };

  const addItemLine = () => {
    const activeItems = store.items.filter((item) => item.active);
    const unused = activeItems.find((item) => !form.items.some((line) => line.itemId === item.id)) ?? activeItems[0];
    if (!unused) return;
    setForm((current) => ({ ...current, items: [...current.items, createLine(unused)] }));
  };

  const toggleMajooInLog = (sessionId: string, lineId: string) => {
    setStore((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: new Date().toISOString(),
              items: session.items.map((line) =>
                line.id === lineId ? { ...line, majooInputDone: !line.majooInputDone } : line,
              ),
            }
          : session,
      ),
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(makeForm(store.items, store.staff));
  };

  const updateSync = (sync: SyncSettings) => {
    setStore((current) => ({ ...current, sync }));
  };

  const pushToSheet = async () => {
    const endpoint = store.sync.sheetEndpoint.trim();
    if (!endpoint) {
      setSyncStatus('Isi Apps Script URL dulu.');
      return;
    }
    setSyncStatus('Mengirim data lokal ke Google Sheet...');
    try {
      await writeSheetStore(endpoint, store);
      remoteReadyRef.current = true;
      skipAutoSyncRef.current = true;
      setStore((current) => ({
        ...current,
        sync: { ...current.sync, lastSyncedAt: new Date().toISOString() },
      }));
      setSyncStatus('Data lokal sudah dikirim ke Google Sheet.');
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Gagal kirim ke Google Sheet.');
    }
  };

  const pullFromSheet = async () => {
    const endpoint = store.sync.sheetEndpoint.trim();
    if (!endpoint) {
      setSyncStatus('Isi Apps Script URL dulu.');
      return;
    }
    setSyncStatus('Menarik data dari Google Sheet...');
    try {
      const remote = await readSheetStore(endpoint);
      remoteReadyRef.current = true;
      skipAutoSyncRef.current = true;
      setStore((current) => ({
        ...remote,
        sync: { ...current.sync, lastSyncedAt: new Date().toISOString() },
      }));
      setEditingId(null);
      setForm(makeForm(remote.items, remote.staff));
      setSyncStatus('Data Google Sheet sudah dimuat.');
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Gagal tarik dari Google Sheet.');
    }
  };

  return (
    <div className="appShell">
      <header className="topbar">
        <div>
          <div className="brand">NOMONO</div>
          <div className="brandSub">VIP Complimentary Log</div>
        </div>
        <StatusPill sessions={store.sessions} />
      </header>

      <main className="content">
        {tab === 'input' && (
          <InputScreen
            form={form}
            setForm={setForm}
            items={store.items}
            staff={store.staff}
            totals={totals}
            errors={validationErrors}
            editing={Boolean(editingId)}
            onSave={saveSession}
            onReset={resetForm}
            onAddItem={addItemLine}
            onUpdateLine={updateLine}
          />
        )}

        {tab === 'log' && (
          <LogScreen
            sessions={store.sessions}
            onEdit={editSession}
            onDelete={deleteSession}
            onToggleMajoo={toggleMajooInLog}
          />
        )}

        {tab === 'recap' && <RecapScreen sessions={store.sessions} />}

        {tab === 'master' && (
          <MasterScreen
            items={store.items}
            staff={store.staff}
            sync={store.sync}
            syncStatus={syncStatus}
            setItems={(items) => setStore((current) => ({ ...current, items }))}
            setStaff={(staff) => setStore((current) => ({ ...current, staff }))}
            setSync={updateSync}
            onPushToSheet={pushToSheet}
            onPullFromSheet={pullFromSheet}
          />
        )}
      </main>

      <nav className="bottomNav">
        <NavButton icon={<ClipboardList />} label="Input" active={tab === 'input'} onClick={() => setTab('input')} />
        <NavButton icon={<History />} label="Log" active={tab === 'log'} onClick={() => setTab('log')} />
        <NavButton icon={<BarChart3 />} label="Rekap" active={tab === 'recap'} onClick={() => setTab('recap')} />
        <NavButton icon={<Settings2 />} label="Master" active={tab === 'master'} onClick={() => setTab('master')} />
      </nav>
    </div>
  );
}

function InputScreen({
  form,
  setForm,
  items,
  staff,
  totals,
  errors,
  editing,
  onSave,
  onReset,
  onAddItem,
  onUpdateLine,
}: {
  form: SessionForm;
  setForm: React.Dispatch<React.SetStateAction<SessionForm>>;
  items: Item[];
  staff: Staff[];
  totals: ReturnType<typeof getSessionTotals>;
  errors: string[];
  editing: boolean;
  onSave: (status: SessionStatus) => void;
  onReset: () => void;
  onAddItem: () => void;
  onUpdateLine: (lineId: string, next: Partial<VipSessionItem>) => void;
}) {
  const activeItems = items.filter((item) => item.active);
  const activeStaff = staff.filter((person) => person.active);

  return (
    <section className="stack">
      <div className="screenTitle">
        <div>
          <h1>{editing ? 'Edit Sesi VIP' : 'Input Sesi VIP'}</h1>
          <p>Catat complimentary yang disiapkan dan sisa segel setelah sesi.</p>
        </div>
        {editing && (
          <button className="iconBtn" onClick={onReset} aria-label="Batal edit">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="panel sessionPanel">
        <Field label="Tanggal">
          <input value={form.date} type="date" onChange={(event) => setFormValue(setForm, 'date', event.target.value)} />
        </Field>
        <Field label="Mulai">
          <select
            value={form.startTime}
            onChange={(event) => setFormValue(setForm, 'startTime', event.target.value)}
          >
            {!BOOKING_TIME_OPTIONS.some((option) => option.value === form.startTime) && (
              <option value={form.startTime}>{form.startTime.replace(':', '.')}</option>
            )}
            {BOOKING_TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Selesai">
          <select
            value={form.endTime}
            onChange={(event) => setFormValue(setForm, 'endTime', event.target.value)}
          >
            {!BOOKING_TIME_OPTIONS.some((option) => option.value === form.endTime) && (
              <option value={form.endTime}>{form.endTime.replace(':', '.')}</option>
            )}
            {BOOKING_TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Booking">
          <input
            value={form.bookingName}
            placeholder="Nama tamu"
            onChange={(event) => setFormValue(setForm, 'bookingName', event.target.value)}
          />
        </Field>
        <Field label="Staff">
          <select value={form.staffName} onChange={(event) => setFormValue(setForm, 'staffName', event.target.value)}>
            {activeStaff.map((person) => (
              <option key={person.id} value={person.name}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Catatan">
          <textarea
            value={form.notes}
            rows={2}
            placeholder="Opsional"
            onChange={(event) => setFormValue(setForm, 'notes', event.target.value)}
          />
        </Field>
      </div>

      <div className="summaryStrip">
        <MiniStat label="Terpakai" value={totals.usedQty.toLocaleString('id-ID')} />
        <MiniStat label="Balik Stok" value={totals.returnQty.toLocaleString('id-ID')} />
      </div>

      <div className="sectionHeader">
        <h2>Items</h2>
        <button className="smallAction" onClick={onAddItem} disabled={!activeItems.length}>
          <Plus size={14} /> Item
        </button>
      </div>

      <div className="stack tight">
        {form.items.map((line, index) => {
          const selectedItem = items.find((item) => item.id === line.itemId);
          const invalid = line.sealedLeftQty > line.preparedQty;

          return (
            <article className={`itemCard ${invalid ? 'dangerCard' : ''}`} key={line.id}>
              <div className="itemTop">
                <div className="itemNumber">{index + 1}</div>
                <select
                  value={line.itemId}
                  onChange={(event) => {
                    const item = items.find((entry) => entry.id === event.target.value);
                    if (!item) return;
                    onUpdateLine(line.id, {
                      itemId: item.id,
                      itemName: item.name,
                      hpp: item.hpp,
                      preparedQty: item.defaultQty,
                    });
                  }}
                >
                  {activeItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  {selectedItem && !selectedItem.active && <option value={selectedItem.id}>{selectedItem.name}</option>}
                </select>
                <button
                  className="iconBtn ghost"
                  onClick={() =>
                    setForm((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== line.id) }))
                  }
                  aria-label="Hapus item"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="qtyGrid">
                <Field label="Disiapkan">
                  <input
                    inputMode="numeric"
                    value={line.preparedQty}
                    onChange={(event) => onUpdateLine(line.id, { preparedQty: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Sisa Segel">
                  <input
                    inputMode="numeric"
                    value={line.sealedLeftQty}
                    onChange={(event) => onUpdateLine(line.id, { sealedLeftQty: Number(event.target.value) })}
                  />
                </Field>
              </div>

              <div className="calcRow">
                <div>
                  <span>Terpakai</span>
                  <strong>{line.usedQty}</strong>
                </div>
                <label className="checkLine">
                  <input
                    type="checkbox"
                    checked={line.majooInputDone}
                    onChange={(event) => onUpdateLine(line.id, { majooInputDone: event.target.checked })}
                  />
                  Majoo
                </label>
              </div>

              {invalid && <p className="errorText">Sisa segel tidak boleh lebih besar dari qty disiapkan.</p>}
            </article>
          );
        })}
      </div>

      {errors.length > 0 && (
        <div className="errorBox">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <div className="stickyActions">
        <button className="primaryBtn" onClick={() => onSave('completed')} disabled={errors.length > 0}>
          <Check size={16} /> Complete
        </button>
      </div>
    </section>
  );
}

function LogScreen({
  sessions,
  onEdit,
  onDelete,
  onToggleMajoo,
}: {
  sessions: VipSession[];
  onEdit: (session: VipSession) => void;
  onDelete: (sessionId: string) => void;
  onToggleMajoo: (sessionId: string, lineId: string) => void;
}) {
  const [filter, setFilter] = useState<LogFilter>('today');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const filtered = useMemo(
    () => filterSessions(sessions, filter, startDate, endDate),
    [sessions, filter, startDate, endDate],
  );
  const exportRows = filtered.flatMap((session) =>
    session.items.map((item) => ({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime || '',
      bookingName: session.bookingName,
      room: session.room,
      staffName: session.staffName,
      itemName: item.itemName,
      preparedQty: item.preparedQty,
      sealedLeftQty: item.sealedLeftQty,
      usedQty: item.usedQty,
      returnToStockQty: item.returnToStockQty,
      hpp: item.hpp,
      totalCost: item.totalCost,
      majooInputDone: item.majooInputDone ? 'Yes' : 'No',
      notes: session.notes ?? '',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })),
  );

  return (
    <section className="stack">
      <div className="screenTitle">
        <div>
          <h1>Log Harian</h1>
          <p>{filtered.length} sesi sesuai filter.</p>
        </div>
        <button className="accentBtn" onClick={() => exportCsv(exportRows)} disabled={!exportRows.length}>
          <Download size={15} /> CSV
        </button>
      </div>

      <div className="filterBar">
        <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>
          Hari Ini
        </button>
        <button className={filter === 'month' ? 'active' : ''} onClick={() => setFilter('month')}>
          Bulan Ini
        </button>
        <button className={filter === 'custom' ? 'active' : ''} onClick={() => setFilter('custom')}>
          Custom
        </button>
        <button className={filter === 'notMajoo' ? 'active warn' : ''} onClick={() => setFilter('notMajoo')}>
          Belum Majoo
        </button>
      </div>

      {filter === 'custom' && (
        <div className="panel dateRange">
          <Field label="Dari">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Sampai">
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
      )}

      <div className="stack tight">
        {filtered.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onEdit={() => onEdit(session)}
            onDelete={() => onDelete(session.id)}
            onToggleMajoo={onToggleMajoo}
          />
        ))}
        {!filtered.length && <EmptyState title="Belum ada log" body="Data yang cocok dengan filter akan muncul di sini." />}
      </div>
    </section>
  );
}

function RecapScreen({ sessions }: { sessions: VipSession[] }) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey(todayISO()));
  const monthlySessions = useMemo(
    () => sessions.filter((session) => monthKey(session.date) === selectedMonth),
    [sessions, selectedMonth],
  );
  const recap = useMemo(() => buildRecap(monthlySessions), [monthlySessions]);

  return (
    <section className="stack">
      <div className="screenTitle">
        <div>
          <h1>Rekap</h1>
          <p>Ringkasan biaya complimentary bulanan.</p>
        </div>
        <input
          className="monthInput"
          type="month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        />
      </div>

      <div className="metricGrid">
        <Metric label="Sesi VIP" value={recap.sessionCount.toLocaleString('id-ID')} accent="green" />
        <Metric label="Total Biaya" value={rupiah(recap.totalCost)} accent="gold" />
        <Metric label="Qty Terpakai" value={recap.totalUsed.toLocaleString('id-ID')} accent="green" />
        <Metric label="Belum Majoo" value={recap.notMajoo.toLocaleString('id-ID')} accent="red" />
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
        {!recap.itemRows.length && <EmptyState title="Belum ada rekap" body="Simpan sesi VIP untuk melihat ringkasan." />}
      </div>
    </section>
  );
}

function MasterScreen({
  items,
  staff,
  sync,
  syncStatus,
  setItems,
  setStaff,
  setSync,
  onPushToSheet,
  onPullFromSheet,
}: {
  items: Item[];
  staff: Staff[];
  sync: SyncSettings;
  syncStatus: string;
  setItems: (items: Item[]) => void;
  setStaff: (staff: Staff[]) => void;
  setSync: (sync: SyncSettings) => void;
  onPushToSheet: () => void;
  onPullFromSheet: () => void;
}) {
  const [itemDraft, setItemDraft] = useState({ name: '', category: 'Minuman', hpp: 0, defaultQty: 1 });
  const [staffDraft, setStaffDraft] = useState('');

  const addItem = () => {
    if (!itemDraft.name.trim()) return;
    setItems([
      ...items,
      {
        id: uid(),
        name: itemDraft.name.trim(),
        category: itemDraft.category.trim() || 'Minuman',
        hpp: Math.max(0, Number(itemDraft.hpp) || 0),
        defaultQty: Math.max(0, Math.trunc(Number(itemDraft.defaultQty) || 0)),
        active: true,
      },
    ]);
    setItemDraft({ name: '', category: 'Minuman', hpp: 0, defaultQty: 1 });
  };

  const addStaff = () => {
    if (!staffDraft.trim()) return;
    setStaff([...staff, { id: uid(), name: staffDraft.trim(), active: true }]);
    setStaffDraft('');
  };

  return (
    <section className="stack">
      <div className="screenTitle">
        <div>
          <h1>Master Data</h1>
          <p>Edit item complimentary, HPP, default qty, dan staff.</p>
        </div>
      </div>

      <div className="sectionHeader">
        <h2>Google Sheet Sync</h2>
      </div>
      <div className="panel syncPanel">
        <Field label="Apps Script URL">
          <input
            value={sync.sheetEndpoint}
            placeholder="https://script.google.com/macros/s/..."
            onChange={(event) => setSync({ ...sync, sheetEndpoint: event.target.value.trim() })}
          />
        </Field>
        <div className="syncControls">
          <label className="syncToggle">
            <Toggle checked={sync.autoSync} onChange={() => setSync({ ...sync, autoSync: !sync.autoSync })} />
            <span>Auto-sync</span>
          </label>
          <div className="syncButtons">
            <button className="secondaryBtn" onClick={onPullFromSheet}>
              <Download size={16} /> Tarik
            </button>
            <button className="primaryBtn" onClick={onPushToSheet}>
              <Save size={16} /> Kirim
            </button>
          </div>
        </div>
        <p className="syncStatus">{syncStatus}</p>
        {sync.lastSyncedAt && (
          <p className="syncStatus muted">
            Sync terakhir: {new Date(sync.lastSyncedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>

      <div className="sectionHeader">
        <h2>Items</h2>
      </div>
      <div className="panel masterAdd">
        <Field label="Nama Item">
          <input
            value={itemDraft.name}
            placeholder="Contoh: Teh Botol"
            onChange={(event) => setItemDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field label="Kategori">
          <input
            value={itemDraft.category}
            onChange={(event) => setItemDraft((current) => ({ ...current, category: event.target.value }))}
          />
        </Field>
        <Field label="HPP">
          <input
            inputMode="numeric"
            value={itemDraft.hpp}
            onChange={(event) => setItemDraft((current) => ({ ...current, hpp: Number(event.target.value) }))}
          />
        </Field>
        <Field label="Default Qty">
          <input
            inputMode="numeric"
            value={itemDraft.defaultQty}
            onChange={(event) => setItemDraft((current) => ({ ...current, defaultQty: Number(event.target.value) }))}
          />
        </Field>
        <button className="primaryBtn full" onClick={addItem}>
          <Plus size={16} /> Tambah Item
        </button>
      </div>

      <div className="stack tight">
        {items.map((item) => (
          <article className="masterRow" key={item.id}>
            <div className="rowIcon">
              <Package size={17} />
            </div>
            <div className="masterFields">
              <input
                value={item.name}
                onChange={(event) => patchItem(items, setItems, item.id, { name: event.target.value })}
              />
              <div className="triple">
                <input
                  value={item.category}
                  onChange={(event) => patchItem(items, setItems, item.id, { category: event.target.value })}
                />
                <input
                  inputMode="numeric"
                  value={item.hpp}
                  onChange={(event) => patchItem(items, setItems, item.id, { hpp: Number(event.target.value) })}
                />
                <input
                  inputMode="numeric"
                  value={item.defaultQty}
                  onChange={(event) => patchItem(items, setItems, item.id, { defaultQty: Number(event.target.value) })}
                />
              </div>
            </div>
            <Toggle checked={item.active} onChange={() => patchItem(items, setItems, item.id, { active: !item.active })} />
          </article>
        ))}
      </div>

      <div className="sectionHeader">
        <h2>Staff</h2>
      </div>
      <div className="panel staffAdd">
        <Field label="Nama Staff">
          <input value={staffDraft} placeholder="Nama staff" onChange={(event) => setStaffDraft(event.target.value)} />
        </Field>
        <button className="primaryBtn full" onClick={addStaff}>
          <Plus size={16} /> Tambah Staff
        </button>
      </div>

      <div className="stack tight">
        {staff.map((person) => (
          <article className="masterRow compact" key={person.id}>
            <div className="rowIcon">
              <UserRound size={17} />
            </div>
            <input
              value={person.name}
              onChange={(event) => patchStaff(staff, setStaff, person.id, { name: event.target.value })}
            />
            <Toggle checked={person.active} onChange={() => patchStaff(staff, setStaff, person.id, { active: !person.active })} />
          </article>
        ))}
      </div>
    </section>
  );
}

function SessionCard({
  session,
  onEdit,
  onDelete,
  onToggleMajoo,
}: {
  session: VipSession;
  onEdit: () => void;
  onDelete: () => void;
  onToggleMajoo: (sessionId: string, lineId: string) => void;
}) {
  const totals = getSessionTotals(session.items);
  const notMajoo = session.items.filter((item) => !item.majooInputDone && item.usedQty > 0).length;

  return (
    <article className="logCard">
      <div className="logHead">
        <div>
          <div className="logDate">
            <CalendarDays size={14} />
            {niceDate(session.date)} · {session.startTime}-{session.endTime || '--:--'}
          </div>
          <h3>{session.bookingName}</h3>
          <p>
            {session.staffName} · {session.room}
          </p>
        </div>
        <div className="cardActions">
          <button className="iconBtn" onClick={onEdit} aria-label="Edit sesi">
            <Edit3 size={15} />
          </button>
          <button className="iconBtn danger" onClick={onDelete} aria-label="Hapus sesi">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="logTotals">
        <span>{totals.usedQty} item terpakai</span>
        <strong>{rupiah(totals.totalCost)}</strong>
        {notMajoo > 0 && <em>{notMajoo} belum Majoo</em>}
      </div>

      <div className="lineList">
        {session.items.map((line) => (
          <button className="lineRow" key={line.id} onClick={() => onToggleMajoo(session.id, line.id)}>
            <div>
              <strong>{line.itemName}</strong>
              <span>
                Siap {line.preparedQty} · Sisa {line.sealedLeftQty} · Pakai {line.usedQty}
              </span>
            </div>
            <div className={line.majooInputDone ? 'majooBadge done' : 'majooBadge'}>
              {line.majooInputDone ? 'Majoo OK' : 'Belum'}
            </div>
          </button>
        ))}
      </div>

      {session.notes && <p className="notes">{session.notes}</p>}
    </article>
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

function MiniStat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={strong ? 'gold' : ''}>{value}</strong>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: 'green' | 'gold' | 'red' }) {
  return (
    <div className={`metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

function StatusPill({ sessions }: { sessions: VipSession[] }) {
  const notDone = sessions.reduce(
    (sum, session) => sum + session.items.filter((item) => !item.majooInputDone && item.usedQty > 0).length,
    0,
  );
  return <div className={`statusPill ${notDone ? 'warn' : ''}`}>{notDone ? `${notDone} Majoo` : 'Clear'}</div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="emptyState">
      <ChevronRight size={22} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function getSessionTotals(items: VipSessionItem[]) {
  return items.reduce(
    (sum, item) => ({
      usedQty: sum.usedQty + item.usedQty,
      returnQty: sum.returnQty + item.returnToStockQty,
      totalCost: sum.totalCost + item.totalCost,
    }),
    { usedQty: 0, returnQty: 0, totalCost: 0 },
  );
}

function validateForm(form: SessionForm) {
  const errors: string[] = [];
  if (!form.date) errors.push('Tanggal wajib diisi.');
  if (!form.startTime) errors.push('Jam mulai wajib diisi.');
  if (!form.endTime) errors.push('Jam selesai wajib diisi.');
  if (form.startTime && form.endTime && form.endTime <= form.startTime) {
    errors.push('Jam selesai harus lebih besar dari jam mulai.');
  }
  if (!form.bookingName.trim()) errors.push('Nama booking wajib diisi.');
  if (!form.staffName.trim()) errors.push('Staff wajib dipilih.');
  if (!form.items.length) errors.push('Minimal satu item complimentary.');

  form.items.forEach((line) => {
    if (!Number.isInteger(line.preparedQty) || !Number.isInteger(line.sealedLeftQty)) {
      errors.push(`${line.itemName}: qty harus angka bulat.`);
    }
    if (line.preparedQty < 0 || line.sealedLeftQty < 0) {
      errors.push(`${line.itemName}: qty tidak boleh minus.`);
    }
    if (line.sealedLeftQty > line.preparedQty) {
      errors.push(`${line.itemName}: sisa segel melebihi qty disiapkan.`);
    }
  });

  return Array.from(new Set(errors));
}

function setFormValue<K extends keyof SessionForm>(
  setter: React.Dispatch<React.SetStateAction<SessionForm>>,
  key: K,
  value: SessionForm[K],
) {
  setter((current) => ({ ...current, [key]: value }));
}

function filterSessions(sessions: VipSession[], filter: LogFilter, startDate: string, endDate: string) {
  const today = todayISO();
  const currentMonth = monthKey(today);
  return [...sessions]
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
    .filter((session) => {
      if (filter === 'today') return session.date === today;
      if (filter === 'month') return monthKey(session.date) === currentMonth;
      if (filter === 'custom') return session.date >= startDate && session.date <= endDate;
      if (filter === 'notMajoo') return session.items.some((item) => !item.majooInputDone && item.usedQty > 0);
      return true;
    });
}

function buildRecap(sessions: VipSession[]) {
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

function patchItem(items: Item[], setItems: (items: Item[]) => void, itemId: string, patch: Partial<Item>) {
  setItems(
    items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...patch,
            hpp: patch.hpp === undefined ? item.hpp : Math.max(0, Number(patch.hpp) || 0),
            defaultQty:
              patch.defaultQty === undefined ? item.defaultQty : Math.max(0, Math.trunc(Number(patch.defaultQty) || 0)),
          }
        : item,
    ),
  );
}

function patchStaff(staff: Staff[], setStaff: (staff: Staff[]) => void, staffId: string, patch: Partial<Staff>) {
  setStaff(staff.map((person) => (person.id === staffId ? { ...person, ...patch } : person)));
}

function exportCsv(rows: Record<string, string | number>[]) {
  const headers = [
    'date',
    'startTime',
    'endTime',
    'bookingName',
    'room',
    'staffName',
    'itemName',
    'preparedQty',
    'sealedLeftQty',
    'usedQty',
    'returnToStockQty',
    'hpp',
    'totalCost',
    'majooInputDone',
    'notes',
    'createdAt',
    'updatedAt',
  ];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `vip-complimentary-log-${todayISO()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

export default App;
