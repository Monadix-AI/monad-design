// biome-ignore-all lint/security/noDangerouslySetInnerHtml: Markdown is sanitized in an inert DOM before rendering.
import type { ProjectDesignDocument } from '@monaddesign/client-contract';

import { FileText, RefreshCw, X } from 'lucide-react';
import { marked } from 'marked';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

type DesignRecord = Record<string, unknown>;

interface TableOfContentsItem {
  id: string;
  level: number;
  title: string;
}

const parseFrontmatter = (content: string) => {
  if (!content.startsWith('---\n')) return { body: content, design: {} as DesignRecord };
  const end = content.indexOf('\n---', 4);
  if (end < 0) return { body: content, design: {} as DesignRecord };
  const design: DesignRecord = {};
  const stack = [{ indent: -1, value: design }];
  for (const line of content.slice(4, end).split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^(\s*)([\w-]+):(?:\s+(.*))?$/.exec(line);
    if (!match?.[2]) continue;
    const indent = match[1]?.length ?? 0;
    while (stack.length > 1 && (stack.at(-1)?.indent ?? -1) >= indent) stack.pop();
    const parent = stack.at(-1)?.value ?? design;
    const raw = match[3]?.trim();
    if (!raw) {
      const nested: DesignRecord = {};
      parent[match[2]] = nested;
      stack.push({ indent, value: nested });
      continue;
    }
    parent[match[2]] = raw.replace(/^("|')(.*)\1$/, '$2');
  }
  return { body: content.slice(end + 4).replace(/^\n/, ''), design };
};

const recordValue = (value: unknown): DesignRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as DesignRecord) : {};

const displayValue = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

const resolveDesignReference = (value: unknown, design: DesignRecord): unknown => {
  if (typeof value !== 'string') return value;
  const reference = /^\{(.+)\}$/.exec(value)?.[1];
  if (!reference) return value;
  return reference.split('.').reduce<unknown>((current, key) => recordValue(current)[key], design);
};

const previewStyle = (value: unknown, design: DesignRecord): CSSProperties => {
  const source = recordValue(value);
  const typography = recordValue(resolveDesignReference(source.typography, design));
  const resolved = (key: string) => displayValue(resolveDesignReference(source[key], design));
  return {
    background: resolved('backgroundColor') || undefined,
    borderRadius: resolved('rounded') || undefined,
    color: resolved('textColor') || undefined,
    fontFamily: displayValue(typography.fontFamily) || undefined,
    fontSize: displayValue(typography.fontSize) || undefined,
    fontWeight: displayValue(typography.fontWeight) || undefined,
    height: resolved('height') || undefined,
    letterSpacing: displayValue(typography.letterSpacing) || undefined,
    lineHeight: displayValue(typography.lineHeight) || undefined,
    padding: resolved('padding') || undefined
  };
};

function DesignPreview({ design }: { design: DesignRecord }) {
  const colors = recordValue(design.colors);
  const typography = recordValue(design.typography);
  const rounded = recordValue(design.rounded);
  const spacing = recordValue(design.spacing);
  const components = recordValue(design.components);
  const name = displayValue(design.name);
  const description = displayValue(design.description);

  return (
    <>
      {name || description ? (
        <section className="design-preview-identity">
          <span className="design-preview-monogram">{name.slice(0, 1) || 'D'}</span>
          <div>
            {name ? <h2>{name}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
        </section>
      ) : null}
      {Object.keys(colors).length ? (
        <section className="design-visual-group">
          <h2>Colors</h2>
          <div className="design-color-preview">
            {Object.entries(colors).map(([token, value]) => (
              <figure key={token}>
                <i style={{ background: displayValue(value) }} />
                <figcaption>
                  <strong>{token}</strong>
                  <code>{displayValue(value)}</code>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {Object.keys(typography).length ? (
        <section className="design-visual-group">
          <h2>Typography</h2>
          <div className="design-type-preview">
            {Object.entries(typography).map(([token, value]) => (
              <figure key={token}>
                <figcaption>{token}</figcaption>
                <p style={previewStyle({ typography: `{typography.${token}}` }, design)}>The app is the canvas.</p>
                <code>{displayValue(recordValue(value).fontFamily)}</code>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {Object.keys(rounded).length ? (
        <section className="design-visual-group">
          <h2>Shape</h2>
          <div className="design-shape-preview">
            {Object.entries(rounded).map(([token, value]) => (
              <figure key={token}>
                <i style={{ borderRadius: displayValue(value) }} />
                <figcaption>
                  <strong>{token}</strong>
                  <code>{displayValue(value)}</code>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {Object.keys(spacing).length ? (
        <section className="design-visual-group">
          <h2>Spacing</h2>
          <div className="design-spacing-preview">
            {Object.entries(spacing).map(([token, value]) => (
              <figure key={token}>
                <figcaption>{token}</figcaption>
                <i style={{ width: displayValue(value) }} />
                <code>{displayValue(value)}</code>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {Object.keys(components).length ? (
        <section className="design-visual-group">
          <h2>Components</h2>
          <div className="design-component-preview">
            {Object.entries(components).map(([token, value]) => (
              <figure key={token}>
                <figcaption>{token}</figcaption>
                <div className="design-component-stage">
                  <span style={previewStyle(value, design)}>
                    {token.includes('field') ? 'Design evidence' : 'Preview'}
                  </span>
                </div>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

const sanitizeHtml = (html: string) => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const element of document.body.querySelectorAll('script, style, iframe, object, embed, form')) element.remove();
  for (const element of document.body.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.startsWith('on') || attribute.name === 'style') element.removeAttribute(attribute.name);
    }
    if (element instanceof HTMLAnchorElement) {
      const href = element.getAttribute('href') ?? '';
      if (!/^(https?:|mailto:|#)/i.test(href)) element.removeAttribute('href');
      if (/^https?:/i.test(href)) {
        element.target = '_blank';
        element.rel = 'noreferrer';
      }
    }
  }
  const headings: TableOfContentsItem[] = [];
  const slugs = new Map<string, number>();
  for (const heading of document.body.querySelectorAll('h1, h2, h3')) {
    const title = heading.textContent?.trim();
    if (!title) continue;
    const base =
      title
        .toLocaleLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-|-$/g, '') || 'section';
    const occurrence = slugs.get(base) ?? 0;
    slugs.set(base, occurrence + 1);
    const id = occurrence ? `${base}-${occurrence + 1}` : base;
    heading.id = id;
    headings.push({ id, level: Number(heading.tagName.slice(1)), title });
  }
  return { headings, html: document.body.innerHTML };
};

export function DesignDocumentCard({
  collapse,
  loadDocument,
  projectId
}: {
  collapse: boolean;
  loadDocument: (projectId: string) => Promise<ProjectDesignDocument>;
  projectId: string;
}) {
  const [document, setDocument] = useState<ProjectDesignDocument | null>(null);
  const [lastSuccessful, setLastSuccessful] = useState<ProjectDesignDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const documentScroll = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (collapse) setExpanded(false);
  }, [collapse]);

  useEffect(() => {
    setDocument(null);
    setLastSuccessful(null);
    setError(null);
    setExpanded(false);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await loadDocument(projectId);
        if (cancelled) return;
        setDocument(next);
        if (next.exists) setLastSuccessful(next);
        setError(null);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) timer = setTimeout(load, 2_000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadDocument, projectId]);

  const rendered = useMemo(() => {
    const source = document?.exists ? document : lastSuccessful;
    if (!source) return null;
    const parsed = parseFrontmatter(source.content);
    return { ...parsed, ...sanitizeHtml(marked.parse(parsed.body, { gfm: true, breaks: false }) as string) };
  }, [document, lastSuccessful]);

  if (!expanded)
    return (
      <button
        aria-label="Open DESIGN.md preview"
        className="design-document-launcher"
        data-canvas-ui
        onClick={() => setExpanded(true)}
        title="Open DESIGN.md preview"
        type="button"
      >
        <FileText aria-hidden="true" />
        DESIGN.md
      </button>
    );

  return (
    <aside
      aria-label="DESIGN.md preview"
      className="design-document-card expanded"
      data-canvas-ui
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="design-document-header">
        <FileText aria-hidden="true" />
        <div>
          <strong>DESIGN.md</strong>
        </div>
        <button
          aria-label="Close DESIGN.md preview"
          onClick={() => setExpanded(false)}
          type="button"
        >
          <X />
        </button>
      </div>
      <div className="design-document-content">
        {!document && !error ? (
          <p className="design-document-state">
            <RefreshCw className="spinning" /> Loading design document…
          </p>
        ) : null}
        {document && !document.exists && !lastSuccessful ? (
          <div className="design-document-empty">
            <FileText aria-hidden="true" />
            <strong>No DESIGN.md</strong>
            <p>Add DESIGN.md to the project root to preview its design language here.</p>
            <code>{document.path}</code>
          </div>
        ) : null}
        {error && !lastSuccessful ? <p className="design-document-error">{error}</p> : null}
        {rendered ? (
          <div className="design-document-body">
            <nav
              aria-label="DESIGN.md table of contents"
              className="design-document-toc"
            >
              <strong>Contents</strong>
              {Object.keys(rendered.design).length ? (
                <button
                  className="level-1 preview"
                  onClick={() => documentScroll.current?.querySelector('#design-preview')?.scrollIntoView()}
                  type="button"
                >
                  Preview
                </button>
              ) : null}
              {rendered.headings.map((heading) => (
                <button
                  className={`level-${heading.level}`}
                  key={heading.id}
                  onClick={() => documentScroll.current?.querySelector(`#${CSS.escape(heading.id)}`)?.scrollIntoView()}
                  type="button"
                >
                  {heading.title}
                </button>
              ))}
            </nav>
            <div
              className="design-document-scroll"
              ref={documentScroll}
            >
              {Object.keys(rendered.design).length ? (
                <section
                  aria-labelledby="design-preview-title"
                  className="design-preview"
                  id="design-preview"
                >
                  <div className="design-preview-heading">
                    <h1 id="design-preview-title">Preview</h1>
                  </div>
                  <DesignPreview design={rendered.design} />
                </section>
              ) : null}
              {/* HTML is parsed in an inert document and stripped of executable elements, handlers, styles, and unsafe URLs. */}
              <article
                className="design-markdown"
                dangerouslySetInnerHTML={{ __html: rendered.html }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
