import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, TYPES } from '@/lib/format';
import { listIssuesFiltered, listProjects, listUsers, type IssueSqlFilter } from '@/lib/db';
import type { Issue, IssueStatus, IssueType, Priority } from '@/lib/types';

/** Supported comparison fields for the Quetzal JQL subset. */
export type JqlField =
  | 'project'
  | 'status'
  | 'type'
  | 'assignee'
  | 'summary'
  | 'labels'
  | 'created'
  | 'updated'
  | 'due'
  | 'priority';

export type JqlScalar =
  | { kind: 'literal'; text: string }
  | { kind: 'currentUser' };

export type JqlValue = JqlScalar | { kind: 'list'; items: JqlScalar[] };

export type JqlCmpOp = '=' | '~' | '>=' | '<=' | 'IN';

export type JqlCmp = {
  kind: 'cmp';
  field: JqlField;
  op: JqlCmpOp;
  value: JqlValue;
};

export type JqlExpr =
  | JqlCmp
  | { kind: 'not'; expr: JqlExpr }
  | { kind: 'and'; left: JqlExpr; right: JqlExpr }
  | { kind: 'or'; left: JqlExpr; right: JqlExpr };

export type JqlOrder = { field: string; dir: 'ASC' | 'DESC' };

export type JqlAst = {
  where: JqlExpr | null;
  orderBy: JqlOrder[];
};

export type JqlParseOk = { ok: true; ast: JqlAst };
export type JqlParseErr = { ok: false; error: string };
export type JqlParseResult = JqlParseOk | JqlParseErr;

export type JqlContext = {
  currentUserId: number;
  /** Used only when the query omits project= (optional scope). */
  defaultProjectKey?: string;
};

export type JqlRunOk = { ok: true; issues: Issue[]; jql: string; ast: JqlAst };
export type JqlRunErr = { ok: false; error: string; jql: string };
export type JqlRunResult = JqlRunOk | JqlRunErr;

export type JqlSuggestion = {
  text: string;
  label: string;
  kind: 'field' | 'operator' | 'value' | 'keyword' | 'order';
};

const FIELDS = new Set<string>([
  'project',
  'status',
  'type',
  'assignee',
  'summary',
  'labels',
  'created',
  'updated',
  'due',
  'priority',
]);

const DATE_FIELDS = new Set<JqlField>(['created', 'updated', 'due']);

const ORDER_FIELDS = new Set([
  'key',
  'project',
  'status',
  'type',
  'summary',
  'priority',
  'assignee',
  'reporter',
  'created',
  'updated',
  'due',
  'points',
  'labels',
]);

const FIELD_LIST = [...FIELDS].sort();
const ORDER_LIST = [...ORDER_FIELDS].sort();

type JqlKw = 'AND' | 'OR' | 'NOT' | 'IN' | 'ORDER' | 'BY' | 'ASC' | 'DESC';

type Tok =
  | { t: 'ident'; v: string }
  | { t: 'string'; v: string }
  | { t: 'op'; v: '=' | '~' | '>=' | '<=' }
  | { t: 'kw'; v: JqlKw }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' }
  | { t: 'currentUser' };

async function tokenize(input: string): Promise<{ ok: true; tokens: Tok[] } | { ok: false; error: string }> {
  const tokens: Tok[] = [];
  let i = 0;
  const s = input;

  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_\-]/.test(c);

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '(') {
      tokens.push({ t: 'lp' });
      i += 1;
      continue;
    }
    if (c === ')') {
      tokens.push({ t: 'rp' });
      i += 1;
      continue;
    }
    if (c === ',') {
      tokens.push({ t: 'comma' });
      i += 1;
      continue;
    }
    if (c === '>' && s[i + 1] === '=') {
      tokens.push({ t: 'op', v: '>=' });
      i += 2;
      continue;
    }
    if (c === '<' && s[i + 1] === '=') {
      tokens.push({ t: 'op', v: '<=' });
      i += 2;
      continue;
    }
    if (c === '=' || c === '~') {
      tokens.push({ t: 'op', v: c });
      i += 1;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      i += 1;
      let out = '';
      while (i < s.length && s[i] !== quote) {
        if (s[i] === '\\' && i + 1 < s.length) {
          out += s[i + 1];
          i += 2;
          continue;
        }
        out += s[i];
        i += 1;
      }
      if (i >= s.length) return { ok: false, error: `Unterminated string starting at "${quote}"` };
      i += 1;
      tokens.push({ t: 'string', v: out });
      continue;
    }
    if (isIdentStart(c)) {
      const start = i;
      i += 1;
      while (i < s.length && isIdent(s[i])) i += 1;
      const raw = s.slice(start, i);
      const lower = raw.toLowerCase();

      // `await currentUser()` → ONE currentUser token.
      // We mimic the JS-ish syntax users already type in the filter bar
      // (`assignee = await currentUser()`), swallowing the `await` keyword +
      // optional whitespace + `currentUser(` + optional whitespace + `)`.
      if (lower === 'await') {
        let j = i;
        while (j < s.length && /\s/.test(s[j])) j += 1;
        const cuStart = j;
        while (j < s.length && isIdent(s[j])) j += 1;
        if (s.slice(cuStart, j).toLowerCase() === 'currentuser') {
          while (j < s.length && /\s/.test(s[j])) j += 1;
          if (s[j] === '(') {
            j += 1;
            while (j < s.length && /\s/.test(s[j])) j += 1;
            if (s[j] !== ')') return { ok: false, error: 'Expected ) after await currentUser(' };
            j += 1;
            i = j;
            tokens.push({ t: 'currentUser' });
            continue;
          }
        }
        // Fall through: `await` with no `currentUser()` behind it is just
        // treated as a plain ident (defensive — shouldn't happen in practice).
      }

      // Bare `currentUser()` without `await`.
      if (lower === 'currentuser' && s[i] === '(') {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j += 1;
        if (s[j] !== ')') return { ok: false, error: 'Expected ) after currentUser(' };
        i = j + 1;
        tokens.push({ t: 'currentUser' });
        continue;
      }

      const upper = lower.toUpperCase();
      if (
        upper === 'AND' ||
        upper === 'OR' ||
        upper === 'NOT' ||
        upper === 'IN' ||
        upper === 'ORDER' ||
        upper === 'BY' ||
        upper === 'ASC' ||
        upper === 'DESC'
      ) {
        tokens.push({ t: 'kw', v: upper as JqlKw });
      } else {
        tokens.push({ t: 'ident', v: raw });
      }
      continue;
    }
    // Numbers, dates (2024-01-15), ISO datetimes (2024-01-15T12:00:00Z)
    if (/[0-9]/.test(c)) {
      const start = i;
      i += 1;
      while (i < s.length && /[0-9T:\.\+\-Z]/.test(s[i])) i += 1;
      tokens.push({ t: 'ident', v: s.slice(start, i) });
      continue;
    }
    return { ok: false, error: `Unexpected character "${c}" at position ${i + 1}` };
  }
  return { ok: true, tokens };
}

class Parser {
  private i = 0;
  constructor(private tokens: Tok[]) {}

  parse(): JqlParseResult {
    try {
      const where = this.peek() && !this.isOrderStart() ? this.parseOr() : null;
      const orderBy: JqlOrder[] = [];
      if (this.isOrderStart()) {
        this.expectKw('ORDER');
        this.expectKw('BY');
        orderBy.push(this.parseOrderItem());
        while (this.matchComma()) {
          orderBy.push(this.parseOrderItem());
        }
      }
      if (this.i < this.tokens.length) {
        return { ok: false, error: `Unexpected token near "${this.describe(this.tokens[this.i])}"` };
      }
      return { ok: true, ast: { where, orderBy } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Parse error' };
    }
  }

  private parseOr(): JqlExpr {
    let left = this.parseAnd();
    while (this.matchKw('OR')) {
      left = { kind: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): JqlExpr {
    let left = this.parseNot();
    while (this.matchKw('AND')) {
      left = { kind: 'and', left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): JqlExpr {
    if (this.matchKw('NOT')) {
      return { kind: 'not', expr: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): JqlExpr {
    if (this.matchLp()) {
      const inner = this.parseOr();
      if (!this.matchRp()) throw new Error('Expected )');
      return inner;
    }
    return this.parseCmp();
  }

  private parseCmp(): JqlCmp {
    const fieldTok = this.next();
    if (!fieldTok || fieldTok.t !== 'ident') throw new Error('Expected field name');
    const fieldName = fieldTok.v.toLowerCase();
    if (!FIELDS.has(fieldName)) {
      throw new Error(
        `Unsupported field "${fieldTok.v}" (use project, status, type, assignee, summary, labels, created, updated, due, priority)`,
      );
    }
    const field = fieldName as JqlField;

    if (this.matchKw('IN')) {
      if (field === 'summary') throw new Error('IN is not valid for summary (use ~)');
      if (!this.matchLp()) throw new Error('Expected ( after IN');
      const items: JqlScalar[] = [];
      items.push(this.parseScalar(field));
      while (this.matchComma()) {
        items.push(this.parseScalar(field));
      }
      if (!this.matchRp()) throw new Error('Expected ) after IN list');
      return { kind: 'cmp', field, op: 'IN', value: { kind: 'list', items } };
    }

    const opTok = this.next();
    if (!opTok || opTok.t !== 'op') throw new Error(`Expected =, ~, >=, <=, or IN after ${field}`);
    const op = opTok.v;

    if (op === '~' && field !== 'summary' && field !== 'labels') {
      throw new Error(`Operator ~ is only valid for summary and labels`);
    }
    if (op === '=' && field === 'summary') {
      throw new Error(`Use summary ~ 'text' (contains), not =`);
    }
    if ((op === '>=' || op === '<=') && !DATE_FIELDS.has(field) && field !== 'priority') {
      throw new Error(`Operator ${op} is only valid for created, updated, due, and priority`);
    }
    if (DATE_FIELDS.has(field) && op === '~') {
      throw new Error(`Operator ~ is not valid for ${field}`);
    }

    const value = this.parseScalar(field);
    return { kind: 'cmp', field, op, value };
  }

  private parseScalar(field: JqlField): JqlScalar {
    const tok = this.peek();
    if (!tok) throw new Error(`Expected value after ${field}`);
    if (tok.t === 'currentUser') {
      this.i += 1;
      if (field !== 'assignee') throw new Error('currentUser() is only valid for assignee');
      return { kind: 'currentUser' };
    }
    if (tok.t === 'string') {
      this.i += 1;
      return { kind: 'literal', text: tok.v };
    }
    if (tok.t === 'ident') {
      const parts: string[] = [];
      while (this.peek()?.t === 'ident') {
        const next = this.peek()!;
        parts.push((next as { t: 'ident'; v: string }).v);
        this.i += 1;
      }
      return { kind: 'literal', text: parts.join(' ') };
    }
    throw new Error(`Expected value after ${field}`);
  }

  private parseOrderItem(): JqlOrder {
    const fieldTok = this.next();
    if (!fieldTok || fieldTok.t !== 'ident') throw new Error('Expected ORDER BY field');
    const field = fieldTok.v.toLowerCase();
    if (!ORDER_FIELDS.has(field)) {
      throw new Error(`Unsupported ORDER BY field "${fieldTok.v}"`);
    }
    let dir: 'ASC' | 'DESC' = 'ASC';
    if (this.matchKw('ASC')) dir = 'ASC';
    else if (this.matchKw('DESC')) dir = 'DESC';
    return { field, dir };
  }

  private isOrderStart(): boolean {
    const a = this.tokens[this.i];
    const b = this.tokens[this.i + 1];
    return a?.t === 'kw' && a.v === 'ORDER' && b?.t === 'kw' && b.v === 'BY';
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i];
  }

  private next(): Tok | undefined {
    return this.tokens[this.i++];
  }

  private matchKw(v: 'AND' | 'OR' | 'NOT' | 'IN' | 'ORDER' | 'BY' | 'ASC' | 'DESC'): boolean {
    const tok = this.peek();
    if (tok?.t === 'kw' && tok.v === v) {
      this.i += 1;
      return true;
    }
    return false;
  }

  private expectKw(v: 'ORDER' | 'BY'): void {
    if (!this.matchKw(v)) throw new Error(`Expected ${v}`);
  }

  private matchLp(): boolean {
    if (this.peek()?.t === 'lp') {
      this.i += 1;
      return true;
    }
    return false;
  }

  private matchRp(): boolean {
    if (this.peek()?.t === 'rp') {
      this.i += 1;
      return true;
    }
    return false;
  }

  private matchComma(): boolean {
    if (this.peek()?.t === 'comma') {
      this.i += 1;
      return true;
    }
    return false;
  }

  private describe(tok: Tok): string {
    if (tok.t === 'ident' || tok.t === 'string' || tok.t === 'op' || tok.t === 'kw') return String(tok.v);
    if (tok.t === 'lp') return '(';
    if (tok.t === 'rp') return ')';
    if (tok.t === 'comma') return ',';
    if (tok.t === 'currentUser') return 'currentUser()';
    return '?';
  }
}

/** Parse a Quetzal JQL subset string into an AST. */
export async function parseJql(input: string): Promise<JqlParseResult> {
  const text = input.trim();
  if (!text) return { ok: true, ast: { where: null, orderBy: [] } };
  const lexed = await tokenize(text);
  if (!lexed.ok) return lexed as JqlParseErr;
  return new Parser(lexed.tokens).parse();
}

function normStatus(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, IssueStatus> = {
    todo: 'todo',
    to_do: 'todo',
    open: 'todo',
    in_progress: 'in_progress',
    progress: 'in_progress',
    inprogress: 'in_progress',
    in_review: 'in_review',
    review: 'in_review',
    inreview: 'in_review',
    done: 'done',
    closed: 'done',
    resolved: 'done',
  };
  for (const [key, label] of Object.entries(STATUS_LABEL)) {
    if (label.toLowerCase() === raw.trim().toLowerCase()) return key;
  }
  return aliases[cleaned] ?? null;
}

function normType(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, IssueType> = {
    sub_task: 'subtask',
    'sub-task': 'subtask',
  };
  const mapped = aliases[cleaned] ?? cleaned;
  for (const [key, label] of Object.entries(TYPE_LABEL)) {
    if (label.toLowerCase() === raw.trim().toLowerCase()) return key;
  }
  if (TYPES.includes(mapped as IssueType)) return mapped;
  return null;
}

function normPriority(raw: string): Priority | null {
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '');
  for (const [key, label] of Object.entries(PRIORITY_LABEL)) {
    if (label.toLowerCase() === raw.trim().toLowerCase()) return key as Priority;
    if (key === cleaned) return key as Priority;
  }
  const aliases: Record<string, Priority> = {
    p0: 'blocker',
    p1: 'highest',
    p2: 'high',
    p3: 'medium',
    p4: 'low',
    p5: 'lowest',
  };
  return aliases[cleaned] ?? null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:\.\+\-Z]+)?$/i;

function normalizeDateValue(raw: string): string {
  const text = raw.trim();
  if (!ISO_DATE.test(text)) {
    throw new Error(`Invalid date "${raw}" (use YYYY-MM-DD or ISO-8601)`);
  }
  return text;
}

function nextDay(dateOnly: string): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function resolveAssigneeId(value: JqlScalar, ctx: JqlContext): Promise<number | null | 'missing'> {
  if (value.kind === 'currentUser') return ctx.currentUserId;
  const text = value.text.trim();
  if (!text) return 'missing';
  if (/^(unassigned|empty|null)$/i.test(text)) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const users = await listUsers();
  const lower = text.toLowerCase();
  const exact = users.find((u) => u.name.toLowerCase() === lower || u.email.toLowerCase() === lower);
  if (exact) return exact.id;
  const partial = users.filter((u) => u.name.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0].id;
  return 'missing';
}

type SqlPiece = { sql: string; args: Array<string | number | null> };

const PRIORITY_RANK: Record<Priority, number> = {
  blocker: 0,
  highest: 1,
  high: 2,
  medium: 3,
  low: 4,
  lowest: 5,
};

function compileDateCmp(column: string, op: '=' | '>=' | '<=', raw: string): SqlPiece {
  const value = normalizeDateValue(raw);
  if (DATE_ONLY.test(value)) {
    if (op === '=') {
      return { sql: `date(${column}) = date(?)`, args: [value] };
    }
    if (op === '>=') {
      return { sql: `${column} >= ?`, args: [value] };
    }
    // <= date-only → inclusive through end of that calendar day
    return { sql: `${column} < ?`, args: [nextDay(value)] };
  }
  if (op === '=') return { sql: `${column} = ?`, args: [value] };
  if (op === '>=') return { sql: `${column} >= ?`, args: [value] };
  return { sql: `${column} <= ?`, args: [value] };
}

function compileDueCmp(op: '=' | '>=' | '<=', raw: string): SqlPiece {
  const value = normalizeDateValue(raw);
  const day = DATE_ONLY.test(value) ? value : value.slice(0, 10);
  if (op === '=') return { sql: `i.due_on = ?`, args: [day] };
  if (op === '>=') return { sql: `i.due_on IS NOT NULL AND i.due_on >= ?`, args: [day] };
  return { sql: `i.due_on IS NOT NULL AND i.due_on <= ?`, args: [day] };
}

async function compileAssigneeEq(value: JqlScalar, ctx: JqlContext): Promise<SqlPiece> {
  const id = await resolveAssigneeId(value, ctx);
  if (id === 'missing') {
    const label = value.kind === 'literal' ? value.text : 'currentUser()';
    throw new Error(`Unknown assignee "${label}"`);
  }
  if (id === null) return { sql: 'i.assignee_id IS NULL', args: [] };
  return { sql: 'i.assignee_id = ?', args: [id] };
}

async function compileCmp(cmp: JqlCmp, ctx: JqlContext): Promise<SqlPiece> {
  const { field, op, value } = cmp;

  if (op === 'IN') {
    if (value.kind !== 'list') throw new Error('IN expects a list');
    if (!value.items.length) throw new Error('IN list cannot be empty');
    if (field === 'project') {
      const keys = value.items.map((item) => {
        if (item.kind !== 'literal') throw new Error('project IN expects keys');
        return item.text.trim().toUpperCase();
      });
      return {
        sql: `p.key IN (${keys.map(() => '?').join(', ')})`,
        args: keys,
      };
    }
    if (field === 'status') {
      const statuses = value.items.map((item) => {
        if (item.kind !== 'literal') throw new Error('status IN expects literals');
        const status = normStatus(item.text);
        if (!status) throw new Error(`Unknown status "${item.text}"`);
        return status;
      });
      return {
        sql: `i.status IN (${statuses.map(() => '?').join(', ')})`,
        args: statuses,
      };
    }
    if (field === 'type') {
      const types = value.items.map((item) => {
        if (item.kind !== 'literal') throw new Error('type IN expects literals');
        const type = normType(item.text);
        if (!type) throw new Error(`Unknown type "${item.text}"`);
        return type;
      });
      return {
        sql: `i.type IN (${types.map(() => '?').join(', ')})`,
        args: types,
      };
    }
    if (field === 'priority') {
      const priorities = value.items.map((item) => {
        if (item.kind !== 'literal') throw new Error('priority IN expects literals');
        const priority = normPriority(item.text);
        if (!priority) throw new Error(`Unknown priority "${item.text}"`);
        return priority;
      });
      return {
        sql: `i.priority IN (${priorities.map(() => '?').join(', ')})`,
        args: priorities,
      };
    }
    if (field === 'assignee') {
      const pieces = await Promise.all(value.items.map((item) => compileAssigneeEq(item, ctx)));
      const nulls = pieces.filter((p) => p.sql.includes('IS NULL'));
      const ids = pieces.filter((p) => !p.sql.includes('IS NULL'));
      const parts: string[] = [];
      const args: Array<string | number | null> = [];
      if (ids.length) {
        parts.push(`i.assignee_id IN (${ids.map(() => '?').join(', ')})`);
        for (const p of ids) args.push(...p.args);
      }
      if (nulls.length) parts.push('i.assignee_id IS NULL');
      return { sql: `(${parts.join(' OR ')})`, args };
    }
    if (field === 'labels') {
      const parts: string[] = [];
      const args: Array<string | number | null> = [];
      for (const item of value.items) {
        if (item.kind !== 'literal') throw new Error('labels IN expects text');
        const label = item.text.trim().toLowerCase().replace(/\s+/g, '');
        parts.push(`(',' || lower(replace(i.labels, ' ', '')) || ',') LIKE ?`);
        args.push(`%,${label},%`);
      }
      return { sql: `(${parts.join(' OR ')})`, args };
    }
    throw new Error(`IN is not supported for ${field}`);
  }

  if (value.kind === 'list') throw new Error(`${op} does not accept a list`);

  if (field === 'project') {
    if (value.kind !== 'literal') throw new Error('project expects a key');
    return { sql: 'p.key = ?', args: [value.text.trim().toUpperCase()] };
  }
  if (field === 'status') {
    if (value.kind !== 'literal') throw new Error('status expects a literal');
    const status = normStatus(value.text);
    if (!status) throw new Error(`Unknown status "${value.text}"`);
    return { sql: 'i.status = ?', args: [status] };
  }
  if (field === 'type') {
    if (value.kind !== 'literal') throw new Error('type expects a literal');
    const type = normType(value.text);
    if (!type) throw new Error(`Unknown type "${value.text}"`);
    return { sql: 'i.type = ?', args: [type] };
  }
  if (field === 'priority') {
    if (value.kind !== 'literal') throw new Error('priority expects a literal');
    const priority = normPriority(value.text);
    if (!priority) throw new Error(`Unknown priority "${value.text}"`);
    if (op === '=' ) return { sql: 'i.priority = ?', args: [priority] };
    const rank = PRIORITY_RANK[priority];
    const cmp = op === '>=' ? '<=' : '>='; // higher priority = lower rank
    const allowed = PRIORITIES.filter((p) =>
      cmp === '<=' ? PRIORITY_RANK[p] <= rank : PRIORITY_RANK[p] >= rank,
    );
    return {
      sql: `i.priority IN (${allowed.map(() => '?').join(', ')})`,
      args: allowed,
    };
  }
  if (field === 'assignee') {
    return await compileAssigneeEq(value, ctx);
  }
  if (field === 'summary') {
    if (value.kind !== 'literal') throw new Error('summary expects text');
    return { sql: 'i.summary LIKE ?', args: [`%${value.text}%`] };
  }
  if (field === 'labels') {
    if (value.kind !== 'literal') throw new Error('labels expects text');
    const label = value.text.trim().toLowerCase();
    if (op === '~') {
      return { sql: 'lower(i.labels) LIKE ?', args: [`%${label}%`] };
    }
    return {
      sql: `(',' || lower(replace(i.labels, ' ', '')) || ',') LIKE ?`,
      args: [`%,${label.replace(/\s+/g, '')},%`],
    };
  }
  if (field === 'created') {
    if (value.kind !== 'literal') throw new Error('created expects a date');
    if (op !== '=' && op !== '>=' && op !== '<=') throw new Error(`Invalid op for created`);
    return compileDateCmp('i.created_at', op, value.text);
  }
  if (field === 'updated') {
    if (value.kind !== 'literal') throw new Error('updated expects a date');
    if (op !== '=' && op !== '>=' && op !== '<=') throw new Error(`Invalid op for updated`);
    return compileDateCmp('i.updated_at', op, value.text);
  }
  if (field === 'due') {
    if (value.kind !== 'literal') throw new Error('due expects a date');
    if (op !== '=' && op !== '>=' && op !== '<=') throw new Error(`Invalid op for due`);
    return compileDueCmp(op, value.text);
  }
  throw new Error(`Unsupported comparison for ${field}`);
}

async function compileExpr(expr: JqlExpr, ctx: JqlContext): Promise<SqlPiece> {
  if (expr.kind === 'cmp') return await compileCmp(expr, ctx);
  if (expr.kind === 'not') {
    const inner = await compileExpr(expr.expr, ctx);
    return { sql: `NOT (${inner.sql})`, args: inner.args };
  }
  const left = await compileExpr(expr.left, ctx);
  const right = await compileExpr(expr.right, ctx);
  const join = expr.kind === 'and' ? 'AND' : 'OR';
  return {
    sql: `(${left.sql} ${join} ${right.sql})`,
    args: [...left.args, ...right.args],
  };
}

function compileOrder(orderBy: JqlOrder[]): string {
  if (!orderBy.length) return 'p.key, i.num';
  const parts = orderBy.map((item) => {
    const dir = item.dir === 'DESC' ? 'DESC' : 'ASC';
    switch (item.field) {
      case 'key':
        return `p.key ${dir}, i.num ${dir}`;
      case 'project':
        return `p.key ${dir}`;
      case 'status':
        return `i.status ${dir}`;
      case 'type':
        return `i.type ${dir}`;
      case 'summary':
        return `i.summary ${dir}`;
      case 'priority':
        return `CASE i.priority
          WHEN 'blocker' THEN 0 WHEN 'highest' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'lowest' THEN 5 ELSE 9 END ${dir}`;
      case 'assignee':
        return `i.assignee_id ${dir}`;
      case 'reporter':
        return `i.reporter_id ${dir}`;
      case 'created':
        return `i.created_at ${dir}`;
      case 'updated':
        return `i.updated_at ${dir}`;
      case 'due':
        return `i.due_on ${dir}`;
      case 'points':
        return `i.points ${dir}`;
      case 'labels':
        return `i.labels ${dir}`;
      default:
        return `p.key ${dir}, i.num ${dir}`;
    }
  });
  return parts.join(', ');
}

function exprMentionsProject(expr: JqlExpr | null): boolean {
  if (!expr) return false;
  if (expr.kind === 'cmp') return expr.field === 'project';
  if (expr.kind === 'not') return exprMentionsProject(expr.expr);
  return exprMentionsProject(expr.left) || exprMentionsProject(expr.right);
}

/** Compile AST into a prepared SQL filter for listIssuesFiltered. */
export async function compileJql(ast: JqlAst, ctx: JqlContext): Promise<IssueSqlFilter> {
  const pieces: SqlPiece[] = [];
  if (ast.where) pieces.push(await compileExpr(ast.where, ctx));
  if (ctx.defaultProjectKey && !exprMentionsProject(ast.where)) {
    pieces.push({ sql: 'p.key = ?', args: [ctx.defaultProjectKey] });
  }
  const whereSql = pieces.length ? pieces.map((p) => p.sql).join(' AND ') : '1=1';
  const args = pieces.flatMap((p) => p.args);
  return {
    whereSql,
    args,
    orderSql: compileOrder(ast.orderBy),
  };
}

/** Parse + execute JQL against the issues table. */
export async function runJql(input: string, ctx: JqlContext): Promise<JqlRunResult> {
  const jql = input.trim();
  const parsed = await parseJql(jql);
  if (!parsed.ok) return { ok: false, error: parsed.error, jql };
  try {
    const filter = await compileJql(parsed.ast, ctx);
    const issues = await listIssuesFiltered(filter);
    return { ok: true, issues, jql, ast: parsed.ast };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to run QQL',
      jql,
    };
  }
}

function filterSuggestions(items: JqlSuggestion[], prefix: string, limit = 12): JqlSuggestion[] {
  const p = prefix.toLowerCase();
  const ranked = items
    .filter((item) => !p || item.text.toLowerCase().startsWith(p) || item.label.toLowerCase().includes(p))
    .sort((a, b) => {
      const aStarts = a.text.toLowerCase().startsWith(p) ? 0 : 1;
      const bStarts = b.text.toLowerCase().startsWith(p) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.text.localeCompare(b.text);
    });
  return ranked.slice(0, limit);
}

async function valueSuggestions(field: string, prefix: string): Promise<JqlSuggestion[]> {
  const f = field.toLowerCase();
  if (f === 'status') {
    return filterSuggestions(
      Object.entries(STATUS_LABEL).map(([key, label]) => ({
        text: `"${label}"`,
        label: `${label} (${key})`,
        kind: 'value' as const,
      })),
      prefix.replace(/^["']|["']$/g, ''),
    );
  }
  if (f === 'type') {
    return filterSuggestions(
      Object.entries(TYPE_LABEL).map(([key, label]) => ({
        text: key,
        label: `${label} (${key})`,
        kind: 'value' as const,
      })),
      prefix.replace(/^["']|["']$/g, ''),
    );
  }
  if (f === 'priority') {
    return filterSuggestions(
      Object.entries(PRIORITY_LABEL).map(([key, label]) => ({
        text: key,
        label: `${label} (${key})`,
        kind: 'value' as const,
      })),
      prefix.replace(/^["']|["']$/g, ''),
    );
  }
  if (f === 'project') {
    return filterSuggestions(
      (await listProjects()).map((p) => ({
        text: p.key,
        label: `${p.key} — ${p.name}`,
        kind: 'value' as const,
      })),
      prefix.replace(/^["']|["']$/g, ''),
    );
  }
  if (f === 'assignee') {
    const users = (await listUsers()).map((u) => ({
      text: `"${u.name}"`,
      label: `${u.name} <${u.email}>`,
      kind: 'value' as const,
    }));
    users.unshift(
      { text: 'currentUser()', label: 'currentUser()', kind: 'value' },
      { text: 'await currentUser()', label: 'await currentUser()', kind: 'value' },
      { text: 'unassigned', label: 'Unassigned', kind: 'value' },
    );
    return filterSuggestions(users, prefix.replace(/^["']|["']$/g, ''));
  }
  if (f === 'created' || f === 'updated' || f === 'due') {
    const today = new Date().toISOString().slice(0, 10);
    return filterSuggestions(
      [
        { text: today, label: `Today (${today})`, kind: 'value' },
        { text: `${today}T00:00:00Z`, label: `ISO start of today`, kind: 'value' },
      ],
      prefix,
    );
  }
  return [];
}

const FIELD_RE =
  'project|status|type|assignee|summary|labels|created|updated|due|priority';

/**
 * Autocomplete suggestions for the token at `cursor` in a JQL string.
 * Returns field names, operators, keywords, or value candidates.
 */
export async function suggestJql(input: string, cursor?: number): Promise<JqlSuggestion[]> {
  const text = input;
  const pos = Math.max(0, Math.min(cursor ?? text.length, text.length));
  const before = text.slice(0, pos);
  const endsWithSpace = /\s$/.test(before);
  const trimmedEnd = before.replace(/\s+$/, '');
  const tokenMatch = endsWithSpace
    ? null
    : /([A-Za-z_][\w\-]*|"[^"]*"|'[^']*'|\d[\wT:\.\+\-]*)$/.exec(trimmedEnd);
  const prefix = tokenMatch?.[1] ?? '';
  const beforeToken = tokenMatch
    ? trimmedEnd.slice(0, trimmedEnd.length - prefix.length).trimEnd()
    : trimmedEnd;
  const prefixBare = prefix.replace(/^["']|["']$/g, '');

  const fieldHints = filterSuggestions(
    FIELD_LIST.map((f) => ({ text: f, label: f, kind: 'field' as const })),
    prefixBare,
  );

  const orderHints = filterSuggestions(
    ORDER_LIST.map((f) => ({ text: f, label: f, kind: 'order' as const })),
    prefixBare,
  );

  // After ORDER BY …
  if (/\bORDER\s+BY\b/i.test(before)) {
    const afterBy = /ORDER\s+BY\s*(.*)$/i.exec(before);
    const tail = afterBy?.[1] ?? '';
    if (endsWithSpace && /\b[\w\-]+\s+$/i.test(before) && !/\b(ASC|DESC)\s+$/i.test(before)) {
      return filterSuggestions(
        [
          { text: 'ASC', label: 'ASC', kind: 'keyword' },
          { text: 'DESC', label: 'DESC', kind: 'keyword' },
          { text: ',', label: ',', kind: 'keyword' },
        ],
        prefixBare,
      );
    }
    if (/,\s*$/.test(tail) || /^\s*$/.test(tail) || (!endsWithSpace && /^[\w,\s\-]*$/.test(tail))) {
      const last = (tail.split(',').pop() ?? '').trim();
      if (!last || (!endsWithSpace && /^[\w\-]*$/.test(last))) {
        return orderHints;
      }
    }
  }

  // After a field name → operators (completed field + space, or still typing the op)
  const fieldAtEnd = new RegExp(`\\b(${FIELD_RE})$`, 'i').exec(trimmedEnd);
  if (fieldAtEnd && (endsWithSpace || beforeToken === '' || /\b(AND|OR|NOT|\()\s*$/i.test(beforeToken))) {
    // Still typing the field name (no trailing space) → field list
    if (!endsWithSpace && prefixBare) {
      return fieldHints;
    }
    const field = fieldAtEnd[1].toLowerCase();
    const ops: JqlSuggestion[] = [
      { text: '=', label: '=', kind: 'operator' },
      { text: 'IN', label: 'IN (…)', kind: 'operator' },
    ];
    if (field === 'summary' || field === 'labels') ops.push({ text: '~', label: '~', kind: 'operator' });
    if (field === 'created' || field === 'updated' || field === 'due' || field === 'priority') {
      ops.push({ text: '>=', label: '>=', kind: 'operator' }, { text: '<=', label: '<=', kind: 'operator' });
    }
    return filterSuggestions(ops, prefixBare);
  }

  // After operator → values
  const afterOp = new RegExp(
    `\\b(${FIELD_RE})\\s*(=|~|>=|<=|IN)\\s*(?:\\([^)]*)?$`,
    'i',
  ).exec(trimmedEnd);
  if (afterOp && (endsWithSpace || afterOp[0].endsWith('(') || prefixBare !== '' || /(=|~|>=|<=|IN)$/i.test(trimmedEnd))) {
    const field = afterOp[1].toLowerCase();
    // If no space yet after op and prefix looks like starting another field keyword — still values
    return await valueSuggestions(field, prefixBare);
  }

  // After AND / OR / NOT / ( / start → fields
  if (
    !trimmedEnd ||
    /\b(AND|OR|NOT)\s*$/i.test(trimmedEnd) ||
    /\(\s*$/.test(before) ||
    (endsWithSpace && /\b(AND|OR|NOT)\s*$/i.test(trimmedEnd))
  ) {
    const base = [
      ...fieldHints,
      ...filterSuggestions(
        [
          { text: 'NOT', label: 'NOT', kind: 'keyword' as const },
          { text: 'ORDER BY', label: 'ORDER BY', kind: 'keyword' as const },
        ],
        prefixBare,
      ),
    ];
    return base.slice(0, 12);
  }

  // After a complete clause → AND / OR / ORDER BY
  if (endsWithSpace && !/\b(AND|OR|NOT|ORDER|BY|IN|=|~|>=|<=)\s*$/i.test(trimmedEnd)) {
    return filterSuggestions(
      [
        { text: 'AND', label: 'AND', kind: 'keyword' },
        { text: 'OR', label: 'OR', kind: 'keyword' },
        { text: 'ORDER BY', label: 'ORDER BY', kind: 'keyword' },
      ],
      prefixBare,
    );
  }

  // Partial field / keyword at start of clause
  if (!endsWithSpace && prefixBare) {
    const keywords = filterSuggestions(
      [
        { text: 'NOT', label: 'NOT', kind: 'keyword' as const },
        { text: 'AND', label: 'AND', kind: 'keyword' as const },
        { text: 'OR', label: 'OR', kind: 'keyword' as const },
        { text: 'ORDER BY', label: 'ORDER BY', kind: 'keyword' as const },
      ],
      prefixBare,
    );
    return [...fieldHints, ...keywords].slice(0, 12);
  }

  return fieldHints;
}

export const JQL_EXAMPLES: { label: string; jql: string }[] = [
  { label: 'Tickets in OPS', jql: 'project = OPS AND type = bug' },
  { label: 'Assigned to me', jql: 'assignee = currentUser() AND status = "In Progress"' },
  { label: 'Summary ~ retry', jql: "project = OPS AND summary ~ 'retry'" },
  { label: 'Label payments', jql: 'labels = payments ORDER BY priority DESC' },
  { label: 'Todo or review', jql: 'status = todo OR status = "In Review" ORDER BY updated DESC' },
  { label: 'Open types IN', jql: 'status IN ("To do", "In Progress") ORDER BY due ASC, priority ASC' },
  { label: 'Due soon', jql: `due >= ${new Date().toISOString().slice(0, 10)} AND NOT status = done ORDER BY due ASC` },
  { label: 'Updated this year', jql: `updated >= ${new Date().getUTCFullYear()}-01-01 ORDER BY updated DESC` },
];
