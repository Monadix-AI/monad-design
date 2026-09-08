import type { DesignGuidance, DesignReference } from '@monaddesign/client-contract';

import { isAdjustmentGoal } from '@monaddesign/client-contract';
import { Bookmark, Check, ChevronDown, FileText, Image, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';

export interface DesignLibraryController {
  entries: DesignReference[];
  selected: DesignReference[];
  favorites: string[];
  recent: string[];
  error: string | null;
  scope: DesignGuidance['scope'];
  focus: string;
  preserve: string;
  setScope: (value: DesignGuidance['scope']) => void;
  setFocus: (value: string) => void;
  setPreserve: (value: string) => void;
  toggle: (entry: DesignReference) => void;
  toggleFavorite: (id: string) => unknown;
  remove: (id: string) => void;
  importFile: (file: File, platform: DesignReference['platform']) => Promise<void>;
}

function ReferencePreview({ entry }: { entry: DesignReference }) {
  if (entry.image)
    return (
      <img
        alt={entry.title}
        className="design-reference-image"
        src={entry.image}
      />
    );
  if (entry.kind === 'skill')
    return (
      <div className="design-skill-preview">
        <FileText size={28} />
        <span>Design guidance</span>
        <small>{entry.platform === 'unknown' ? 'Platform not specified' : `${entry.platform} platform`}</small>
      </div>
    );
  return (
    <div
      aria-hidden="true"
      className={`design-style-preview design-style-${entry.id}`}
    >
      <span>Today</span>
      <strong>
        Make room
        <br />
        for good work.
      </strong>
      <div>
        <span>Morning focus</span>
        <span>09:00</span>
      </div>
      <span className="design-style-action">Start session</span>
    </div>
  );
}

export function DesignGuidanceReview({ guidance }: { guidance: DesignGuidance }) {
  return (
    <div className="design-guidance-review">
      <strong>Design references</strong>
      <small>
        {guidance.scope === 'selected_element' ? 'Selected element' : 'Current screen'}
        {guidance.focus ? ` · ${guidance.focus}` : ''}
      </small>
      {guidance.preserve && <small>Preserve: {guidance.preserve}</small>}
      {guidance.references.map((entry) => (
        <details key={entry.id}>
          <summary>
            {entry.title} <span>{entry.kind}</span>
          </summary>
          {entry.image && (
            <img
              alt={entry.title}
              className="design-reference-image"
              src={entry.image}
            />
          )}
          <small>
            {entry.source} · {entry.version.slice(0, 12)} · {entry.platform}
          </small>
          <p className="design-reference-instructions">{entry.instructions}</p>
        </details>
      ))}
    </div>
  );
}

export function DesignLibraryPicker({
  library,
  disabled,
  hasSelection,
  onDone
}: {
  library: DesignLibraryController;
  disabled: boolean;
  hasSelection: boolean;
  onDone: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [platform, setPlatform] = useState<DesignReference['platform']>('unknown');
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const entries = library.entries
    .filter((entry) => {
      const matchesFilter =
        filter === 'all' ||
        entry.kind === filter ||
        (filter === 'favorites' && library.favorites.includes(entry.id)) ||
        (filter === 'recent' && library.recent.includes(entry.id));
      return (
        matchesFilter &&
        `${entry.title} ${entry.source} ${entry.platform} ${entry.instructions}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    })
    .sort((a, b) => (filter === 'recent' ? library.recent.indexOf(a.id) - library.recent.indexOf(b.id) : 0));
  return (
    <div className="design-library-composer">
      <section
        aria-label="Design library"
        className="design-library-panel"
        data-canvas-ui
      >
        <div className="design-library-tools">
          <div className="design-library-search">
            <Search
              aria-hidden="true"
              size={14}
            />
            <Input
              aria-label="Search design library"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search references…"
              value={query}
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => setQuery('')}
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            aria-label="Filter design library"
            onChange={(event) => setFilter(event.target.value)}
            value={filter}
          >
            <option value="all">All types</option>
            <option value="style">Styles</option>
            <option value="skill">Skills</option>
            <option value="reference">Images</option>
            <option value="favorites">Favorites</option>
            <option value="recent">Recent</option>
          </select>
        </div>
        <details className="design-library-import-disclosure">
          <summary>
            <Upload size={14} /> Import reference
          </summary>
          <div className="design-library-import">
            <input
              accept=".md,image/png,image/jpeg"
              aria-label="Import design reference file"
              className="sr-only"
              disabled={importing}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                setImporting(true);
                try {
                  await library.importFile(file, platform);
                } finally {
                  setImporting(false);
                }
              }}
              ref={fileInput}
              tabIndex={-1}
              type="file"
            />
            <Button
              disabled={importing}
              onClick={() => fileInput.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Upload size={14} />
              {importing ? 'Importing…' : 'Import skill or image'}
            </Button>
            <select
              aria-label="Imported skill platform"
              onChange={(event) => setPlatform(event.target.value as DesignReference['platform'])}
              value={platform}
            >
              <option value="unknown">Skill platform: unspecified</option>
              <option value="native">Native</option>
              <option value="web">Web</option>
              <option value="any">Any platform</option>
            </select>
          </div>
          <small>
            Markdown up to 30 KB · PNG/JPEG up to 250 KB. Saved in this browser. Skill scripts and linked files are not
            imported.
          </small>
        </details>
        {library.error && (
          <p
            className="design-library-error"
            role="alert"
          >
            {library.error}
          </p>
        )}
        <div className="design-library-grid">
          {entries.map((entry) => {
            const selected = library.selected.some(({ id }) => id === entry.id);
            return (
              <article
                className="design-library-entry"
                data-selected={selected}
                key={entry.id}
              >
                <button
                  aria-label={`${selected ? 'Remove' : 'Use'} ${entry.title}`}
                  aria-pressed={selected}
                  className="design-library-select"
                  disabled={disabled || (!selected && library.selected.length >= 4)}
                  onClick={() => library.toggle(entry)}
                  title={
                    !selected && library.selected.length >= 4
                      ? 'Remove a reference to add another (maximum 4).'
                      : undefined
                  }
                  type="button"
                >
                  <ReferencePreview entry={entry} />
                  <span className="design-library-entry-title">
                    <strong>{entry.title}</strong>
                    {selected ? <Check size={16} /> : <Plus size={16} />}
                  </span>
                </button>
                <div className="design-library-entry-meta">
                  <span>
                    {entry.kind === 'style'
                      ? 'Style preview'
                      : entry.kind === 'reference'
                        ? 'Image'
                        : `Skill · ${entry.platform === 'unknown' ? 'Unspecified' : entry.platform}`}
                  </span>
                  <Button
                    aria-label={`${library.favorites.includes(entry.id) ? 'Unfavorite' : 'Favorite'} ${entry.title}`}
                    aria-pressed={library.favorites.includes(entry.id)}
                    onClick={() => library.toggleFavorite(entry.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Bookmark
                      fill={library.favorites.includes(entry.id) ? 'currentColor' : 'none'}
                      size={14}
                    />
                  </Button>
                </div>
                <details>
                  <summary>Guidance & source</summary>
                  <small>
                    {entry.source} · {entry.version.slice(0, 12)}
                  </small>
                  <p className="design-reference-instructions">{entry.instructions}</p>
                  {entry.platform === 'web' && <p>Web guidance: adapt visual principles to your native framework.</p>}
                  {entry.platform === 'unknown' && (
                    <p>Platform compatibility has not been verified. Review the guidance before using it.</p>
                  )}
                  {entry.kind !== 'style' && !isAdjustmentGoal(entry) && (
                    <Button
                      onClick={() => library.remove(entry.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 size={14} /> Remove from library
                    </Button>
                  )}
                </details>
              </article>
            );
          })}
          {!entries.length && (
            <div className="design-library-empty">
              <Image size={24} />
              <strong>{query ? 'No matching references' : 'Nothing here yet'}</strong>
              <p>
                {query
                  ? 'Try a different search or filter.'
                  : 'Import a skill or image, or favorite a style to find it here.'}
              </p>
              {(query || filter !== 'all') && (
                <Button
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                  size="sm"
                  variant="outline"
                >
                  Show all references
                </Button>
              )}
            </div>
          )}
        </div>
        <footer className="design-library-footer">
          {library.selected.length > 0 && (
            <>
              <div className="design-reference-chips">
                {library.selected.map((entry) => (
                  <Button
                    aria-label={`Remove ${entry.title} from request`}
                    disabled={disabled}
                    key={entry.id}
                    onClick={() => library.toggle(entry)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {entry.title}
                    <X
                      aria-label={`Remove ${entry.title}`}
                      size={12}
                    />
                  </Button>
                ))}
              </div>
              <details className="design-library-settings">
                <summary>
                  How to apply{' '}
                  <span>{library.scope === 'selected_element' ? 'Selected element' : 'Current screen'}</span>
                  <ChevronDown aria-hidden="true" />
                </summary>
                <label>
                  Apply to
                  <select
                    disabled={disabled}
                    onChange={(event) => library.setScope(event.target.value as DesignGuidance['scope'])}
                    value={library.scope}
                  >
                    <option
                      disabled={!hasSelection}
                      value="selected_element"
                    >
                      Selected element
                    </option>
                    <option value="screen">Current screen</option>
                  </select>
                </label>
                <label htmlFor={`${id}-focus`}>
                  Borrow
                  <Input
                    disabled={disabled}
                    id={`${id}-focus`}
                    maxLength={1000}
                    onChange={(event) => library.setFocus(event.target.value)}
                    placeholder="e.g. Typography and spacing"
                    value={library.focus}
                  />
                </label>
                <label htmlFor={`${id}-preserve`}>
                  Preserve
                  <Input
                    disabled={disabled}
                    id={`${id}-preserve`}
                    maxLength={1000}
                    onChange={(event) => library.setPreserve(event.target.value)}
                    placeholder="e.g. Layout and navigation"
                    value={library.preserve}
                  />
                </label>
              </details>
            </>
          )}

          <div className="design-library-done">
            <span role="status">
              {library.selected.length
                ? `${library.selected.length} / 4 attached${library.selected.length === 4 ? ' · Limit reached' : ''}`
                : 'Choose up to 4 references'}
            </span>
            <Button
              onClick={onDone}
              size="sm"
              type="button"
            >
              {library.selected.length ? 'Done' : 'Close'}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
