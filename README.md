# GörevPanosu

Küçük bir ekip için görev panosu. Hedeflenen üründe yönetici web üzerinden görevleri ve kişileri yönetir; çalışan mobil uygulamada kişi seçerek kendisine atanmış görevleri görür ve tamamlar. Bu başlangıç sürümü altyapıyı ve API sağlık durumunu gösteren ekranları içerir; görev ve kişi işlevleri sonraki geliştirmelerdir.

## Proje yapısı

ideafactra-fullstack-mobile sürüm 1 şablonu temel alınmıştır. Tek çözüm dosyası `GorevPanosu.sln` altında ortak API ve API testleri bulunur. Web ve mobil, kök `package.json` içinde tanımlanan ayrı npm çalışma alanlarıdır ve aynı API'ye bağlanır.

- `src/GorevPanosu.Api/`: .NET 8 Minimal API, EF Core ve Npgsql ile PostgreSQL erişimi.
- `tests/GorevPanosu.Api.Tests/`: xUnit v3 (`xunit.v3` 1.0.1, `OutputType=Exe`) ve bellek içi SQLite kullanan API test fabrikası.
- `web/`: React, TypeScript, Vite ve Vitest.
- `mobile/`: Expo, Expo Router, TypeScript ve jest-expo; ekranlar `src/app/` altındadır.
- `compose.yaml`: PostgreSQL, API ve web istemcisi ile Expo web çıktısı için yerel konteyner tanımları.

## Derleme

.NET 8 SDK, Node.js ve npm gereklidir. Aşağıdaki komutlar depo kökünden çalıştırılır. Çevrimdışı derleme ve test için NuGet ve npm bağımlılıklarının önceden kurulmuş veya yerel önbellekte hazır olması gerekir; paket edinimi ayrı bir hazırlık adımıdır.

```sh
dotnet build GorevPanosu.sln --configuration Release
npm run build --workspace web
npm run build --workspace mobile
```

Web derlemesi TypeScript denetimi ve Vite üretim çıktısını oluşturur. Mobil derlemesi TypeScript denetimi ve Expo web dışa aktarımını yapar. Her iki istemciyi birlikte derlemek için kökte `npm run build` kullanılabilir.

## Testler

Release derlemesinden sonra xUnit v3 test assembly'si doğrudan çalıştırılır:

```sh
dotnet tests/GorevPanosu.Api.Tests/bin/Release/net8.0/GorevPanosu.Api.Tests.dll
```

API test fabrikası API'yi süreç içinde ve SQLite veritabanını bellekte çalıştırır; bu testler Docker veya ağ erişimi gerektirmez. İsteğe bağlı PostgreSQL testi, `IDEA_TEST_POSTGRES` tanımlanmadığında atlanır. Bu değişken yalnızca silinip yeniden oluşturulabilecek bir test veritabanını göstermelidir; ilgili test veritabanını siler.

İstemci testleri kendi dizinlerinden çalıştırılır:

```sh
cd web
npm test
cd ../mobile
npm test
```

Vitest ve Jest komutları izleme moduna girmeden tamamlanır. Alternatif olarak depo kökünde `npm test`, iki istemcinin testlerini sırayla çalıştırır. Bağımlılıklar hazır olduğunda istemci testleri de ağ erişimi olmadan çalıştırılabilir.

## Erişim ve yayın kararları

Ürün için giriş sistemi yoktur. Mobilde kişi seçimi kimlik doğrulama sağlamaz; güvenilen ekip kullanımında bu risk bilinçli kabul edilmiştir ve giderilmiş sayılmaz.

Web yönetimine uygulama içinde ağ veya adres kısıtı uygulanmaz. Web erişim koruması uygulamanın çalıştığı önizleme ortamına bırakılmıştır; bu, uygulama düzeyinde bir erişim güvencesi değildir. Şablondaki JWT altyapısı bir ürün giriş akışının bulunduğu anlamına gelmez.

Barındırma ve mobil mağaza yayını kararları ertelenmiştir.
