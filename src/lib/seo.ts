export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
}

export const pageSEO: Record<string, SEOData> = {
    home: {
    title: 'Poddle – The Decision Review Copilot',
    description: "The layer between thinking and commitment — adversarial AI agents review your decisions while they're still forming, not after.",
    keywords: 'decision review copilot, decision intelligence, adversarial AI agents, decision memory, assumption testing, forecasting, strategic analysis, cognitive bias detection',
  },
  pods: {
    title: 'Decision Rooms for High-Stakes Calls | Poddle',
    description: 'Run structured decision rooms with AI agents on tap. Pressure-test assumptions, forecast outcomes, and make calls you can defend.',
    keywords: 'decision rooms, high-stakes decisions, assumption testing, forecasting, strategic analysis, AI decision intelligence',
  },
  messages: {
    title: 'Direct Messages & Professional Communication | Poddle',
    description: 'Connect directly with professionals and students. Build your network through meaningful conversations and collaborative opportunities.',
    keywords: 'direct messaging, professional communication, networking, peer connections',
  },
  profile: {
    title: 'Professional Profile | Poddle',
    description: 'Showcase your skills, experience, and achievements on your professional profile. Connect with other students and professionals in your field.',
    keywords: 'professional profile, portfolio, skills showcase, career profile, networking profile',
  },
  reasoning: {
    title: 'AI Reasoning Graph — Problems, Ideas & Forecasts | Poddle',
    description: 'Explore AI-generated problems, breakthrough ideas, and strategic forecasts — each pressure-tested by multiple AI agents and open for expert challenge on Poddle.',
    keywords: 'AI reasoning, strategic forecasts, business problems, startup ideas, decision intelligence, Poddle',
  },
};

export function updatePageSEO(page: string, customData?: Partial<SEOData>) {
  const seoData = { ...pageSEO[page] || pageSEO.home, ...customData };

  document.title = seoData.title;

  updateMetaTag('name', 'description', seoData.description);

  if (seoData.keywords) {
    updateMetaTag('name', 'keywords', seoData.keywords);
  }

  updateMetaTag('property', 'og:title', seoData.title);
  updateMetaTag('property', 'og:description', seoData.description);

  updateMetaTag('name', 'twitter:title', seoData.title);
  updateMetaTag('name', 'twitter:description', seoData.description);

  if (seoData.canonical) {
    updateLinkTag('canonical', seoData.canonical);
  }

  if (seoData.ogImage) {
    updateMetaTag('property', 'og:image', seoData.ogImage);
    updateMetaTag('name', 'twitter:image', seoData.ogImage);
  }
}

function updateMetaTag(attribute: string, key: string, content: string) {
  let element = document.querySelector(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

export function addStructuredData(type: string, data: Record<string, unknown>) {
  const existingScript = document.querySelector(`script[data-schema="${type}"]`);
  if (existingScript) {
    existingScript.remove();
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-schema', type);
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    ...data,
  });

  document.head.appendChild(script);
}

export function setShareablePageMeta({
  title,
  description,
  url,
  image,
  type = 'article',
}: {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: 'article' | 'profile' | 'website';
}) {
  document.title = `${title} | Poddle`;

  updateMetaTag('name', 'description', description);

  updateMetaTag('property', 'og:title', `${title} | Poddle`);
  updateMetaTag('property', 'og:description', description);
  updateMetaTag('property', 'og:type', type);
  updateMetaTag('property', 'og:site_name', 'Poddle');

  if (url) {
    updateMetaTag('property', 'og:url', url);
    updateLinkTag('canonical', url);
  }

  const ogImage = image || 'https://poddleme.com/og-image.png';
  updateMetaTag('property', 'og:image', ogImage);
  updateMetaTag('property', 'og:image:width', '1200');
  updateMetaTag('property', 'og:image:height', '630');

  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', `${title} | Poddle`);
  updateMetaTag('name', 'twitter:description', description);
  updateMetaTag('name', 'twitter:image', ogImage);
  updateMetaTag('name', 'twitter:site', '@poddleapp');
}

export function addBreadcrumbStructuredData(breadcrumbs: Array<{ name: string; url: string }>) {
  const itemListElement = breadcrumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: crumb.url,
  }));

  addStructuredData('breadcrumb', {
    '@type': 'BreadcrumbList',
    itemListElement,
  });
}

// ─── Reasoning SEO ───────────────────────────────────────────────────────────

export type ReasoningEntityType = 'problem' | 'idea' | 'prediction';

export interface ReasoningEntitySEO {
  type: ReasoningEntityType;
  slug: string;
  content: string;
  domain: string;
  created_at: string;
  confidence?: number;
  relevance_score?: number;
  feasibility_score?: number;
  impact_score?: number;
  horizon_years?: number;
  evidence?: string[];
  implications?: string[];
  solution_steps?: Array<{ step: string; detail?: string }>;
  execution_steps?: Array<{ step: string; detail?: string }>;
}

const BASE_URL = 'https://poddleme.com';

export function categoryPath(type: ReasoningEntityType) {
  return type === 'prediction' ? 'forecasts' : type === 'idea' ? 'ideas' : 'problems';
}

export function categoryLabel(type: ReasoningEntityType) {
  return type === 'prediction' ? 'Forecasts' : type === 'idea' ? 'Ideas' : 'Problems';
}

function buildEntityDescription(entity: ReasoningEntitySEO): string {
  const typeLabel = entity.type === 'prediction' ? 'forecast' : entity.type;
  const snippet = entity.content.length > 120 ? entity.content.slice(0, 120).trimEnd() + '…' : entity.content;

  if (entity.type === 'prediction' && entity.implications?.length) {
    return `${snippet} — Key implication: ${entity.implications[0]}. Explore the AI agent breakdown on Poddle.`;
  }
  if (entity.type === 'problem' && entity.solution_steps?.length) {
    const n = entity.solution_steps.length;
    return `${snippet} — ${n} strategic solution step${n === 1 ? '' : 's'} mapped by AI agents. Deep-dive on Poddle.`;
  }
  if (entity.type === 'idea' && entity.execution_steps?.length) {
    return `${snippet} — ${entity.execution_steps.length}-step execution plan analyzed by AI. Explore on Poddle.`;
  }
  const domainLabel = entity.domain ? ` in ${entity.domain.replace(/_/g, ' ')}` : '';
  return `AI-analyzed ${typeLabel}${domainLabel}: ${snippet}. Join the strategic debate on Poddle.`;
}

export function updateEntitySEO(entity: ReasoningEntitySEO) {
  const cat = categoryPath(entity.type);
  const catName = categoryLabel(entity.type);
  const canonical = `${BASE_URL}/reasoning/${cat}/${entity.slug}`;
  const titleText = entity.content.length > 80 ? entity.content.slice(0, 80) + '…' : entity.content;
  const title = `${titleText} | Poddle ${catName}`;
  const description = buildEntityDescription(entity);
  const domainKw = entity.domain ? entity.domain.replace(/_/g, ' ') : 'strategy';
  const typeKw = entity.type === 'prediction'
    ? 'business forecast, strategic prediction'
    : entity.type === 'idea'
    ? 'business idea, innovation strategy'
    : 'business problem, strategic challenge';
  const keywords = `${domainKw}, AI analysis, ${typeKw}, Poddle reasoning`;

  document.title = title;
  updateMetaTag('name', 'description', description);
  updateMetaTag('name', 'keywords', keywords);
  updateMetaTag('name', 'robots', 'index, follow');
  updateMetaTag('property', 'og:title', title);
  updateMetaTag('property', 'og:description', description);
  updateMetaTag('property', 'og:url', canonical);
  updateMetaTag('property', 'og:type', 'article');
  updateMetaTag('property', 'og:site_name', 'Poddle');
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', title);
  updateMetaTag('name', 'twitter:description', description);
  updateMetaTag('name', 'twitter:site', '@poddleapp');
  updateLinkTag('canonical', canonical);
}

export function updateCategorySEO(type: ReasoningEntityType) {
  const cat = categoryPath(type);
  const canonical = `${BASE_URL}/reasoning/${cat}`;

  const titles: Record<ReasoningEntityType, string> = {
    prediction: 'AI Business Forecasts & Strategic Predictions | Poddle',
    idea:       'AI-Analyzed Business Ideas & Innovation Strategies | Poddle',
    problem:    'Critical Business Problems & Strategic Challenges | Poddle',
  };
  const descs: Record<ReasoningEntityType, string> = {
    prediction: 'Browse AI agent forecasts on business strategy, technology, and market shifts. Each prediction is pressure-tested by multiple AI agents and open for expert challenge.',
    idea:       'Explore AI-analyzed business ideas and innovation strategies with step-by-step execution plans. Pressure-tested by multiple AI agents on Poddle.',
    problem:    'Discover critical business problems and strategic challenges analyzed by AI agents. Each problem is mapped with solution steps and open for expert debate on Poddle.',
  };
  const keywords: Record<ReasoningEntityType, string> = {
    prediction: 'business forecasts, strategic predictions, AI analysis, market outlook, Poddle forecasts',
    idea:       'business ideas, innovation strategy, AI analysis, startup ideas, execution plans, Poddle ideas',
    problem:    'business problems, strategic challenges, AI analysis, problem-solving, Poddle problems',
  };

  const title = titles[type];
  const desc = descs[type];

  document.title = title;
  updateMetaTag('name', 'description', desc);
  updateMetaTag('name', 'keywords', keywords[type]);
  updateMetaTag('name', 'robots', 'index, follow');
  updateMetaTag('property', 'og:title', title);
  updateMetaTag('property', 'og:description', desc);
  updateMetaTag('property', 'og:url', canonical);
  updateMetaTag('property', 'og:type', 'website');
  updateMetaTag('property', 'og:site_name', 'Poddle');
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', title);
  updateMetaTag('name', 'twitter:description', desc);
  updateMetaTag('name', 'twitter:site', '@poddleapp');
  updateLinkTag('canonical', canonical);

  addStructuredData(`category-${cat}`, {
    '@type': 'CollectionPage',
    name: title,
    description: desc,
    url: canonical,
  });
}

export function addEntityStructuredData(entity: ReasoningEntitySEO) {
  const cat = categoryPath(entity.type);
  const url = `${BASE_URL}/reasoning/${cat}/${entity.slug}`;
  const description = buildEntityDescription(entity);
  const headline = entity.content.slice(0, 110);
  const authorOrg = { '@type': 'Organization', name: 'Poddle AI Agents' };
  const publisher = { '@type': 'Organization', name: 'Poddle', url: BASE_URL, logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.svg` } };

  if (entity.type === 'prediction') {
    addStructuredData(`entity-${entity.slug}`, {
      '@type': 'NewsArticle',
      headline,
      description,
      url,
      datePublished: entity.created_at,
      dateModified: entity.created_at,
      author: authorOrg,
      publisher,
      about: { '@type': 'Thing', name: entity.domain?.replace(/_/g, ' ') || 'Business Strategy' },
    });
  } else if (entity.type === 'problem') {
    const faqs = (entity.solution_steps || []).slice(0, 5).map(s => ({
      '@type': 'Question',
      name: s.step,
      acceptedAnswer: { '@type': 'Answer', text: s.detail || s.step },
    }));
    if (faqs.length > 0) {
      addStructuredData(`entity-faq-${entity.slug}`, { '@type': 'FAQPage', mainEntity: faqs });
    }
    addStructuredData(`entity-${entity.slug}`, {
      '@type': 'Article', headline, description, url,
      datePublished: entity.created_at, author: authorOrg, publisher,
    });
  } else {
    addStructuredData(`entity-${entity.slug}`, {
      '@type': 'Article', headline, description, url,
      datePublished: entity.created_at, author: authorOrg, publisher,
    });
  }

  addBreadcrumbStructuredData([
    { name: 'Home', url: BASE_URL },
    { name: 'Reasoning', url: `${BASE_URL}/reasoning` },
    { name: categoryLabel(entity.type), url: `${BASE_URL}/reasoning/${cat}` },
    { name: entity.content.slice(0, 60), url },
  ]);
}

export function setCategoryItemListSchema(
  type: ReasoningEntityType,
  items: Array<{ slug: string; content: string; created_at: string }>,
) {
  const cat = categoryPath(type);
  addStructuredData(`itemlist-${cat}`, {
    '@type': 'ItemList',
    name: `${categoryLabel(type)} on Poddle`,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.content.slice(0, 100),
      url: `${BASE_URL}/reasoning/${cat}/${item.slug}`,
    })),
  });
}

export function injectNoIndex() {
  updateMetaTag('name', 'robots', 'noindex, nofollow');
}
