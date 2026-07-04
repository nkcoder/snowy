import { Eye, EyeOff } from 'lucide-react';
import type { ConnectionFormState } from '../lib/connectionForm';
import { T } from '../lib/tokens';
import { FieldInput, FormRow, SelectInput } from './ConnectionFormFields';

interface ConnectionGeneralTabProps {
  form: ConnectionFormState;
  set: <K extends keyof ConnectionFormState>(key: K, value: ConnectionFormState[K]) => void;
  showPass: boolean;
  onToggleShowPass: () => void;
  isEdit: boolean;
}

export function ConnectionGeneralTab({
  form,
  set,
  showPass,
  onToggleShowPass,
  isEdit,
}: ConnectionGeneralTabProps) {
  const derivedUrl = `postgres://${form.username}@${form.host}:${form.port}/${form.database}?sslmode=${form.sslMode}`;

  return (
    <div
      style={{
        flex: 1,
        paddingTop: 16,
        paddingBottom: 16,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Name + Environment */}
      <FormRow label="Name">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <FieldInput
              value={form.name}
              onChange={(v) => set('name', v)}
              placeholder="e.g. postgres@localhost"
              data-testid="field-name"
            />
          </div>
          <span style={{ fontSize: 11, color: T.textSec, flexShrink: 0 }}>Environment:</span>
          <div style={{ width: 130, flexShrink: 0 }}>
            <SelectInput
              value={form.env}
              onChange={(v) => set('env', v)}
              data-testid="field-env"
              options={[
                { value: 'local', label: 'Local' },
                { value: 'dev', label: 'Development' },
                { value: 'stg', label: 'Staging' },
                { value: 'prod', label: 'Production' },
              ]}
            />
          </div>
        </div>
      </FormRow>

      {/* Driver */}
      <FormRow label="Driver">
        <SelectInput
          value="postgresql"
          onChange={() => {}}
          options={[{ value: 'postgresql', label: 'PostgreSQL' }]}
        />
      </FormRow>

      {/* Host + Port */}
      <FormRow label="Host">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <FieldInput
              value={form.host}
              onChange={(v) => set('host', v)}
              mono
              placeholder="localhost"
              data-testid="field-host"
            />
          </div>
          <span style={{ fontSize: 11, color: T.textSec, flexShrink: 0 }}>Port:</span>
          <div style={{ width: 80, flexShrink: 0 }}>
            <FieldInput
              value={form.port}
              onChange={(v) => set('port', Number(v))}
              mono
              type="number"
              data-testid="field-port"
            />
          </div>
        </div>
      </FormRow>

      {/* Authentication */}
      <FormRow label="Authentication">
        <SelectInput
          value="password"
          onChange={() => {}}
          options={[{ value: 'password', label: 'User & Password' }]}
        />
      </FormRow>

      {/* User */}
      <FormRow label="User">
        <FieldInput
          value={form.username}
          onChange={(v) => set('username', v)}
          mono
          placeholder="postgres"
          data-testid="field-username"
        />
      </FormRow>

      {/* Password */}
      <FormRow label="Password">
        <div style={{ position: 'relative' }}>
          <input
            type={showPass ? 'text' : 'password'}
            value={form.password}
            data-testid="field-password"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => set('password', e.target.value)}
            placeholder={isEdit ? 'stored in macOS Keychain — type to change' : 'enter password'}
            style={{
              background: T.panelAlt,
              border: `0.5px solid ${T.border}`,
              borderRadius: 4,
              padding: '7px 30px 7px 10px',
              fontSize: 12,
              color: T.text,
              fontFamily: T.mono,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box' as const,
            }}
          />
          <button
            type="button"
            data-testid="toggle-password"
            onClick={onToggleShowPass}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: 7,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.textDim,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </FormRow>

      {/* Database */}
      <FormRow label="Database">
        <FieldInput
          value={form.database}
          onChange={(v) => set('database', v)}
          mono
          placeholder="postgres"
          data-testid="field-database"
        />
      </FormRow>

      {/* URL (read-only) */}
      <FormRow label="URL">
        <div>
          <div
            style={{
              padding: '7px 10px',
              background: T.panelAlt,
              border: `0.5px solid ${T.border}`,
              borderRadius: 4,
              fontFamily: T.mono,
              fontSize: 11.5,
              color: T.textSec,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {derivedUrl}
          </div>
          <div style={{ fontSize: 10.5, color: T.textDim, fontStyle: 'italic', marginTop: 3 }}>
            Overrides settings above
          </div>
        </div>
      </FormRow>
    </div>
  );
}
