CATALOG_LINK_SELECTORS = [
    "a[href^='/catalog/']",
    "a[href*='/catalog/']",
]

SUBCATEGORY_LINK_SELECTORS = [
    "a[href^='/catalog/']",
    "a[href*='/catalog/']",
]

REVIEW_LINK_SELECTORS = [
    # Individual user reviews (priority - these have -n suffix like -n12345)
    "a[href*='/content/'][href*='-n']",
    # Fallback to product teasers
    ".ProductTizer .extract a",
    ".reviewTitle a",
    "a.reviewTextSnippet",
    "a.review-title",
]


REVIEW_TITLE_SELECTORS = [
    "h2.reviewTitle",
    "h1[itemprop='name']",
    "h1",
]


REVIEW_CONTENT_SELECTORS = [
    "div.reviewText",
    "div[itemprop='reviewBody']",
    "div.description[itemprop='reviewBody']",
    "div.description",
    "div.review-text",
    "div.reviewBody",
    "div.review-body",
    "article",
]



REVIEW_RATING_SELECTORS = [
    "meta[itemprop='ratingValue']",
    "span[itemprop='ratingValue']",
    "span.rating",
]

REVIEW_RATING_COUNT_SELECTORS = [
    "meta[itemprop='reviewCount']",
    "span[itemprop='reviewCount']",
    "span.review-count",
]

REVIEW_LIKES_UP_SELECTORS = [
    "span.plus",
    "span.like-up",
    "span.positive",
]

REVIEW_LIKES_DOWN_SELECTORS = [
    "span.minus",
    "span.like-down",
    "span.negative",
]

REVIEW_PUBLISHED_SELECTORS = [
    "meta[itemprop='datePublished']",
    "time[itemprop='datePublished']",
    "time",
    "span.date",
]

BREADCRUMB_SELECTORS = [
    ".IrecUiBreadcrumbs a",
    ".breadcrumb-item a",
    ".breadcrumb a",
    "nav.breadcrumbs a",
    "nav.breadcrumb a",
    "ul.breadcrumbs a",
    "div.breadcrumbs a",
]


REVIEW_IMAGE_SELECTORS = [
    "a.photo.pswp_item",
    "a.pswp_item",
    "a.photo[href*='/sites/default/files/']",
    "a[href*='/imagecache/copyright1/']",
    "div[itemprop='reviewBody'] img",
    "div.reviewText img",
    "div.review-body img",
    ".description a[href*='.jpg']",
    ".description a[href*='.jpeg']",
    ".description a[href*='.png']",
    ".content img[src*='cdn-irec']",
]

PRODUCT_IMAGE_SELECTORS = [
    ".ProductTizer .photo img",
    "div.product-image img",
    "img[itemprop='image']",
    ".main-product-image img",
    "div.mainpic img",
    "div.mainpic a.photo img",
]


