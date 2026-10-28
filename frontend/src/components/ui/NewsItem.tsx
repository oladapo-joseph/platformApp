import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

import type { Article } from "@/api/types";
import { day, stamp } from "@/lib/dates";
import { valueLabel } from "@/lib/news";

import { Badge } from "./feedback";

/**
 * One headline (docs/06 §6): an external link marked ↗ and announced as opening a new tab,
 * its source and time in WAT, a two-line plain-text snippet, and ticker chips. Never the
 * full article.
 */
export function NewsItem({
  article,
  showDate = false,
  topicsFor,
  topicHref,
}: {
  article: Article;
  showDate?: boolean;
  /** On a stock page: show up to 2 topic chips linking to that stock's news on the topic (US-9.1) */
  topicsFor?: string;
  /** On the News page: topic chips that add the topic to the current filters (US-9.8) */
  topicHref?: (topic: string) => string;
}) {
  const href =
    topicHref ??
    (topicsFor
      ? (t: string) => `/app/news?symbol=${encodeURIComponent(topicsFor)}&topic=${encodeURIComponent(t)}`
      : null);
  const published = parseISO(article.published_at);
  const when = article.published_at_estimated
    ? `Found ${day(article.published_at)}`
    : showDate
      ? day(article.published_at)
      : formatDistanceToNowStrict(published, { addSuffix: true });
  return (
    <article className="flex flex-col gap-1.5 py-3">
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group inline-flex items-start gap-1 font-medium text-fg hover:text-brand"
      >
        <span className="line-clamp-2">{article.title || article.source}</span>
        <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted group-hover:text-brand" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {body(article) && <p className="line-clamp-2 text-sm text-fg-2">{body(article)}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
        {article.content_type === "opinion" && <Badge>Opinion</Badge>}
        <span>{article.source}</span>
        <span aria-hidden>·</span>
        <time dateTime={article.published_at} title={stamp(article.published_at)}>
          {when}
        </time>
        {href &&
          article.topics.slice(0, 2).map((t) => (
            <Link
              key={t}
              to={href(t)}
              className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-2 hover:border-line-input hover:text-fg"
            >
              {valueLabel("topic", t)}
            </Link>
          ))}
        {(topicsFor ? article.symbols.filter((x) => x !== topicsFor) : article.symbols).slice(0, 4).map((s) => (
          <Link
            key={s}
            to={`/app/stocks/${s}`}
            className="num rounded-sm bg-sunken px-1.5 py-0.5 text-xs font-medium text-fg-2 hover:text-brand"
          >
            {s}
          </Link>
        ))}
      </div>
    </article>
  );
}

/** Many sources open the article with its headline: don't show it twice. */
function body(a: Article): string {
  const title = a.title.trim().replace(/[.\s]+$/, "");
  const text = a.snippet.trim();
  return title && text.startsWith(title) ? text.slice(title.length).replace(/^[.:\s–-]+/, "") : text;
}
