import {
  FileRestoreJournal,
  type FileRestoreIO,
  type FileRestoreRecord,
} from '~/storage/sqlite/fileRestoreJournal';

let record: FileRestoreRecord | null;
let databases: Record<string, string>;
let mnemonic: string | null;
let onboarding: string | null;
let io: FileRestoreIO;
let journal: FileRestoreJournal;
const initial = {
  restoreId: 'restore-fixture',
  mode: 'replace' as const,
  previousMnemonic: 'old-fixture',
  mnemonic: 'new-fixture',
  onboarded: 'true',
};

beforeEach(() => {
  record = null;
  databases = { active: 'old database' };
  mnemonic = initial.previousMnemonic;
  onboarding = 'true';
  io = {
    read: async () => record && { ...record },
    write: jest.fn(async (value) => {
      record = { ...value };
    }),
    removeJournal: jest.fn(async () => {
      record = null;
    }),
    copy: jest.fn(async (source, target) => {
      if (!(source in databases)) throw new Error('Missing snapshot');
      databases[target] = databases[source];
    }),
    remove: jest.fn(async (name) => {
      delete databases[name];
    }),
    saveMnemonic: jest.fn(async (value) => {
      mnemonic = value;
    }),
    saveOnboarding: jest.fn(async (value) => {
      onboarding = value;
    }),
  };
  journal = new FileRestoreJournal(io);
});

async function prepare() {
  await journal.begin(initial);
  databases.staged = 'restored database';
  await journal.ready();
}

it('retains the original database and phrase through preparation, installation and explicit completion', async () => {
  await prepare();
  expect(databases.active).toBe('old database');
  expect(mnemonic).toBe('old-fixture');
  expect(await journal.recover()).toBe(false);
  expect(record?.phase).toBe('ready');
  await journal.install();
  expect(databases.active).toBe('restored database');
  expect(mnemonic).toBe('new-fixture');
  expect(databases.original).toBe('old database');
  expect(await journal.recover()).toBe(false);
  await journal.commit();
  expect(record).toBeNull();
  expect(databases).toEqual({ active: 'restored database' });
});

it('starts a same-identity merge from a snapshot of the complete existing database', async () => {
  await journal.begin({ ...initial, mode: 'merge', mnemonic: initial.previousMnemonic });
  expect(databases.staged).toBe('old database');
  expect(databases.original).toBe('old database');
});

it('cancels preparation without changing the active wallet', async () => {
  await prepare();
  await journal.rollback();
  expect(databases).toEqual({ active: 'old database' });
  expect(mnemonic).toBe('old-fixture');
});

it.each(['database', 'mnemonic', 'onboarding', 'installed-marker'])(
  'recovers an interruption after %s from the durable original',
  async (step) => {
    await prepare();
    if (step === 'database')
      jest.mocked(io.copy).mockImplementationOnce(async (_source, target) => {
        databases[target] = 'partial installation';
        throw new Error('power loss');
      });
    if (step === 'mnemonic')
      jest.mocked(io.saveMnemonic).mockImplementationOnce(async (value) => {
        mnemonic = value;
        throw new Error('power loss');
      });
    if (step === 'onboarding')
      jest.mocked(io.saveOnboarding).mockImplementationOnce(async (value) => {
        onboarding = value;
        throw new Error('power loss');
      });
    if (step === 'installed-marker') {
      const write = io.write;
      io.write = jest.fn(async (value) => {
        if (value.phase === 'installed') throw new Error('power loss');
        await write(value);
      });
    }
    await expect(journal.install()).rejects.toThrow();
    expect(record?.phase).toBe('installing');
    expect(await new FileRestoreJournal(io).recover()).toBe(true);
    expect(databases).toEqual({ active: 'old database' });
    expect(mnemonic).toBe('old-fixture');
    expect(onboarding).toBe('true');
  },
);

it('can repeat rollback if recovery itself is interrupted', async () => {
  await prepare();
  await journal.install();
  jest.mocked(io.saveMnemonic).mockRejectedValueOnce(new Error('power loss'));
  await expect(journal.rollback()).rejects.toThrow();
  expect(databases.original).toBe('old database');
  await new FileRestoreJournal(io).rollback();
  expect(mnemonic).toBe('old-fixture');
  expect(record).toBeNull();
});

it('never rolls a committed wallet back when old-backup cleanup fails', async () => {
  await prepare();
  await journal.install();
  jest.mocked(io.remove).mockRejectedValueOnce(new Error('storage busy'));
  await expect(journal.commit()).rejects.toThrow();
  expect(record?.phase).toBe('committed');
  await new FileRestoreJournal(io).recover();
  expect(databases.active).toBe('restored database');
  expect(mnemonic).toBe('new-fixture');
});

it('refuses to erase the active wallet if its rollback snapshot is missing', async () => {
  await prepare();
  await journal.install();
  delete databases.original;
  await expect(journal.rollback()).rejects.toThrow('Missing snapshot');
  expect(databases.active).toBe('restored database');
  expect(record).not.toBeNull();
});

it('restores first-run onboarding and clears the installed phrase after failed first-run restore', async () => {
  await journal.begin({ ...initial, mode: 'new', previousMnemonic: null, onboarded: null });
  databases.staged = 'new database';
  await journal.ready();
  await journal.install();
  await journal.rollback();
  expect(mnemonic).toBeNull();
  expect(onboarding).toBeNull();
});
