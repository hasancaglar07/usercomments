proje.md — iRecommend.ru Klonu (Pixel-Perfect HTML → Next.js) + API/Worker (VDS) + Supabase DB + B2 Images

0\) Proje Özeti



Bu proje, iRecommend.ru benzeri büyük ölçekli bir review sitesinin klonunu oluşturur. Tasarım tarafında hazır HTML ve screen.png referansları verilmiştir. Amaç:



C:\\Users\\ihsan\\Desktop\\review\\stitch\_homepage\\ altındaki her klasörde yer alan:



code.html



screen.png

dosyalarını referans alarak pixel-perfect şekilde Next.js’e dönüştürmek.



Ardından backend/API + ingestion worker (VDS) ile:



kategori, review, yorum, oy/like, profil gibi fonksiyonları çalışır hale getirmek.



sık içerik girişini (2–5 dakikada bir) worker ile yönetmek.



1\) Kaynak Dosyalar ve Çalışma Dizini

1.1 Çalışma klasörü



Ana çalışma dizini:

C:\\Users\\ihsan\\Desktop\\review



1.2 HTML kaynakları



HTML \& ekran görüntüsü klasörü:

C:\\Users\\ihsan\\Desktop\\review\\stitch\_homepage



Bu klasörün içinde sayfa klasörleri var:



add\_review\_page/



catalog\_page/



category\_page\_güzellik\_ve\_sağlık/ (adı farklı olabilir)



contact\_us\_page/



forgot\_password\_page/



homepage/



individual\_review\_page/



login\_page/



privacy\_policy\_page/



terms\_of\_use\_page/



user\_profile\_page/



Her birinin içinde:



code.html → sayfanın birebir HTML çıktısı



screen.png → pixel-perfect referans



Kural: code.html tasarımın “tek doğrusu” kabul edilir. screen.png doğrulama içindir.



2\) Nihai Mimari Kararı

2.1 Frontend



Next.js (App Router) + TypeScript



Tailwind CSS



shadcn/ui opsiyonel (ama görünüm birebir korunacak)



Deploy (başlangıç): Vercel

Büyürse: VDS + Cloudflare CDN (opsiyon)



2.2 Backend (VDS)



Node.js API (Express veya Fastify)



Redis (cache + queue)



Worker (cron/queue ile ingestion)



2.3 DB



Supabase Postgres + Supabase Auth



2.4 Görseller



Backblaze B2 (S3 uyumlu)



CDN: Cloudflare önerilir



3\) Öncelik Sırası



Pixel-perfect Next.js dönüşüm (tasarım birebir)



Ortak layout (Header/Footer) componentleştirme



Mock data ile sayfaları çalışır hale getirme



API + DB şeması



Ingestion worker + caching + performans



4\) Route Haritası (HTML klasörlerine göre)



Aşağıdaki eşleştirme zorunludur:



HTML klasörü	Next.js route

homepage	/

catalog\_page	/catalog

category\_page\_\*	/catalog/reviews/\[id]

individual\_review\_page	/content/\[slug]

user\_profile\_page	/users/\[username]

login\_page	/user/login

add\_review\_page	/node/add/review

forgot\_password\_page	/forgot-password

contact\_us\_page	/contact

privacy\_policy\_page	/privacy-policy

terms\_of\_use\_page	/terms-of-use



Notlar:



category\_page\_\* numeric ID ile çalışacak. İlk etapta \[id] parametresi ile mock gösterilir.



content/\[slug] ve users/\[username] de mock veri ile çalışır.



5\) Pixel-Perfect Dönüşüm Kuralları (Kritik)

5.1 Yasaklar



Spacing, font, renk, border, radius “daha iyi” olsun diye değiştirilmeyecek.



shadcn default theme ile görünümü bozmak yasak.



İlk fazda refactor/temizlik yok.



5.2 Zorunlular



code.html içindeki DOM sırası + class/id yapısı ilk aşamada korunur.



Asset path’leri Next.js public/ altına alınır ve kırık link kalmaz.



Header/Footer tüm sayfalarda ortak component yapılır (tasarım bozulmadan).



5.3 Doğrulama



Her sayfa, kendi screen.png referansı ile gözle doğrulanır:



Header hizası



Kart boyutları (~300px hissi)



Pagination görünümü



Sidebar width (desktop ~300px) ve mobil davranışı



Rating yıldızları rengi



Link hover stilleri



6\) Next.js Proje Yapısı (Kesin)

review/

&nbsp; apps/

&nbsp;   web/                      # Next.js

&nbsp;   api/                      # Node API (VDS)

&nbsp;   worker/                   # ingestion jobs (VDS)

&nbsp; packages/

&nbsp;   shared/                   # ortak types/validators

&nbsp; stitch\_homepage/            # hazır HTML + screen.png kaynakları (dokunma)



6.1 Web (Next.js) klasör yapısı

apps/web/

&nbsp; app/

&nbsp;   (site)/

&nbsp;     layout.tsx

&nbsp;     page.tsx

&nbsp;     catalog/page.tsx

&nbsp;     catalog/reviews/\[id]/page.tsx

&nbsp;     content/\[slug]/page.tsx

&nbsp;     users/\[username]/page.tsx

&nbsp;     user/login/page.tsx

&nbsp;     node/add/review/page.tsx

&nbsp;     forgot-password/page.tsx

&nbsp;     contact/page.tsx

&nbsp;     privacy-policy/page.tsx

&nbsp;     terms-of-use/page.tsx

&nbsp; components/

&nbsp;   layout/

&nbsp;     Header.tsx

&nbsp;     Footer.tsx

&nbsp;     Sidebar.tsx

&nbsp;   cards/

&nbsp;     ReviewCard.tsx

&nbsp; public/

&nbsp;   stitch\_assets/            # HTML’deki tüm img/css/js buraya

&nbsp; styles/

&nbsp;   globals.css



7\) Dönüşüm Adımları (Frontend)

Faz 1 — “HTML’i aynen çalıştır”



apps/web oluştur: create-next-app (TS + App Router).



Her route için bir page.tsx aç.



İlgili klasördeki code.html içeriğini:



<body> içindeki kısmı React component olarak render et



<head> kısmındaki CSS/font linklerini layout.tsx veya globals.css ile ekle



HTML’nin kullandığı tüm assetleri apps/web/public/stitch\_assets/ altına taşı.



HTML’deki src/href pathlerini /stitch\_assets/... şeklinde güncelle.



✅ Çıktı: Sayfalar açılıyor ve tasarım birebir.



Faz 2 — Layout componentleştirme



Header/Footer tekrar eden HTML bloklarını tek bir Header.tsx ve Footer.tsx içine al.



app/(site)/layout.tsx içinde ortak kullan.



Tasarım bozulmayacak.



Faz 3 — Tekrarlayan UI bileşenleri



ReviewCard, Pagination, SidebarItem gibi tekrar eden blokları component yap.



Class’lar korunur.



Faz 4 — shadcn opsiyonel ekleme



Modal (foto zoom), dropdown (sort), dialog gibi yerlerde



Görünüm %100 aynı kalacak şekilde override ile.



8\) Backend/API (VDS) — Tasarımın arkasındaki işlevler

8.1 API sorumlulukları



Reviews:



listeleme (kategori, alt kategori, popüler, son)



detay (slug)



ekleme



oy/like



Comments:



listeleme



ekleme



Categories:



liste



alt kategoriler



Users:



profil



kullanıcının review’leri



8.2 Endpoint taslağı



GET /api/categories



GET /api/categories/:id/subcategories



GET /api/reviews/popular?limit=



GET /api/reviews/latest?cursor=\&limit=



GET /api/reviews?categoryId=\&subCategoryId=\&sort=\&page=



GET /api/reviews/slug/:slug



POST /api/reviews (auth)



POST /api/reviews/:id/vote (auth veya ip-hash)



GET /api/reviews/:id/comments?cursor=



POST /api/reviews/:id/comments (auth)



GET /api/users/:username



GET /api/users/:username/reviews?page=



GET /api/search?q=\&categoryId=\&page=



9\) DB Şeması (Supabase Postgres)

9.1 Tablolar



categories(id int pk, name text, parent\_id int null, created\_at)



reviews(id uuid pk, slug unique, title, content\_html, rating\_avg numeric, rating\_count int, votes\_up int, votes\_down int, photo\_urls jsonb, category\_id int, sub\_category\_id int null, user\_id uuid, created\_at, updated\_at, source text, source\_url text unique)



comments(id uuid pk, review\_id uuid, user\_id uuid, text, created\_at)



review\_votes(id uuid pk, review\_id uuid, user\_id uuid null, ip\_hash text null, type text, created\_at, unique(review\_id,user\_id) veya unique(review\_id,ip\_hash))



profiles(user\_id uuid pk, username unique, bio, profile\_pic\_url, created\_at)



9.2 İndeksler



reviews(category\_id, created\_at desc)



reviews(category\_id, votes\_up desc)



reviews(slug)



comments(review\_id, created\_at desc)



10\) Görseller (Backblaze B2)



Foto URLs reviews.photo\_urls içinde saklanır.



Upload:



Kullanıcı tarafı: POST /api/uploads/presign → presigned URL al → direkt B2’ye yükle



Worker tarafı: indir → B2’ye yükle → DB’ye URL yaz



11\) Worker (VDS) — Otomatik içerik girişi



Her 2–5 dakikada bir:



yeni içerikleri bul



parse et



DB’ye yaz



görselleri B2’ye yükle



cache invalidate / revalidate tetikle (opsiyon)



Not: Uygunluk/ToS/robots kurallarına uyulmalı, rate limit şart.



12\) Environment Variables

Web (apps/web)



NEXT\_PUBLIC\_API\_BASE\_URL



NEXT\_PUBLIC\_SUPABASE\_URL



NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY



API (apps/api)



SUPABASE\_URL



SUPABASE\_SERVICE\_ROLE\_KEY



REDIS\_URL



B2\_KEY\_ID



B2\_APP\_KEY



B2\_BUCKET\_NAME



Worker (apps/worker)



API ile aynı + CRON\_SCHEDULE



13\) Kabul Kriterleri (DoD)



Tüm route’lar çalışıyor.



Her sayfa screen.png ile gözle karşılaştırıldığında birebir.



Header/Footer tek yerden yönetiliyor.



Responsive bozulmamış.



Kırık asset linki yok.



Mock data ile tüm sayfalar akıyor.



Sonraki faz için API/DB altyapısı hazır.

