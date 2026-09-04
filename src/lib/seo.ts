export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
}

export const pageSEO: Record<string, SEOData> = {
  home: {
    title: 'Poddle AI – The Governance Layer for Company Decisions',
    description: 'The Governance Layer for Company Decisions',
    keywords: 'decision governance, decision intelligence, adversarial AI agents, decision memory, assumption testing, forecasting, strategic analysis, cognitive bias detection',
  },
  profile: {
    title: 'Profile | Poddle',
    description: 'View decision history, workspace activity, and account details on Poddle.',
    keywords: 'profile, account, decision history, Poddle',
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
  updateMetaTag('name', 'twitter:site', '@poddleai');
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

export function injectNoIndex() {
  updateMetaTag('name', 'robots', 'noindex, nofollow');
}
