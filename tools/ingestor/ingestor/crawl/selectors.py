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

REVIEW_PROS_SELECTORS = [
    "div.plus",
    "div.upros",
    ".pros",
    ".positive",
]

REVIEW_CONS_SELECTORS = [
    "div.minus",
    "div.ucons",
    ".cons",
    ".negative",
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
    "a.photo",
    "img",
    "a[href*='/sites/default/files/']",
]

PRODUCT_IMAGE_SELECTORS = [
    "div.mainpic img",
    "div.mainpic a.photo img",
    ".ProductTizer .photo img",
    "div.product-image img",
    "img[itemprop='image']",
    ".main-product-image img",
]


