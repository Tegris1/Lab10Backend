# Plan implementacji rozszerzeń Lab 10

Podstawa: `ProgBackEnd_Lab10.pdf`, rozdział 10 „Rozszerzenia”, strona 6. Plan obejmuje wszystkie pięć rozszerzeń oraz dodatkowy odbiór istniejących zamówień. PDF wymaga dla każdego rozszerzenia efektu, testu i opisu kosztu utrzymania; jedno rozszerzenie wystarcza do zaliczenia części dodatkowej, wszystkie pięć daje możliwość uzyskania maksimum punktów.

To plan przyszłych zmian. Nie oznacza utworzenia środowisk, uruchomienia publikacji, wykonania kopii ani zaliczenia testów.

## 0. Punkt wyjścia i warunki rozpoczęcia

- Aplikacja: Next.js, Node.js 24, Prisma 7, PostgreSQL 17, Better Auth/GitHub, Vercel.
- `.github/workflows/ci.yml` sprawdza lint, unit, integrację, build i test koszyka na osobnej lokalnej bazie PostgreSQL. Dodano publikację Production po pozytywnych testach dla pushu na `main`; odbiór chmurowy zależy od konfiguracji sekretów i rzeczywistych przebiegów.
- `vercel.json` wyłącza automatyczne publikacje z Gita. `scripts/check-deployment.ts` dodatkowo odrzuca Vercel Preview.
- `scripts/verify-basket-ui.ts` już sprawdza dodawanie, zmianę ilości, usuwanie i odmowę bez sesji. `scripts/lib/browser-session.ts` tworzy prawdziwą sesję Better Auth wyłącznie w kontrolowanej bazie lokalnej.
- Checkout już istnieje w `lib/orders/prisma-checkout.ts`; brak osobnego zestawu testów integracyjnych checkoutu w `tests/integration`.
- Przed odbiorem rozszerzeń potwierdzić katalog po seedzie, GitHub OAuth na stabilnej domenie i trwałość koszyka. Rozszerzenia nie zastępują tych wymagań podstawowych.
- `.env.vercel.test` jest plikiem konfiguracyjnym, nie dowodem odrębnego środowiska. Staging musi mieć faktycznie osobną bazę, aplikację OAuth i sekrety.

## 1. Odrębne środowisko testowe w tym samym projekcie Vercel

Uzgodniony wariant: Preview istniejącego projektu, osobna baza i konfiguracja `.env`, z małą zmianą walidacji dopuszczającą Preview. Nie powstaje nowy projekt Vercel. Ta sekcja zastępuje wcześniejszą propozycję drugiego projektu; opisuje przyszłe prace, nie wykonane wdrożenie.

**Efekt:** dwa równocześnie dostępne wdrożenia tego samego kodu, rozdzielone zakresem zmiennych Vercel, bazą, OAuth i sekretami.

| Element | Production | Staging |
| --- | --- | --- |
| Projekt Vercel | Obecny `lab10-backend` | Ten sam projekt |
| Gałąź | `main` | `lab10` |
| Zakres zmiennych | Production | Preview, wyłącznie gałąź `lab10` |
| Baza | Obecna produkcyjna | Nowa, osobna baza Prisma Postgres |
| `APP_ENV` | `production` | `staging` |
| OAuth i secret Better Auth | Produkcyjne | Osobna GitHub OAuth App i nowy secret |
| Adres | Stabilny adres Production | Stabilny adres gałęzi/alias Preview |
| Publikacja | Istniejące CI/CD po pushu na `main` | Ręczne polecenie CLI do Preview |

1. **Przygotować nową bazę.** W Prisma Console utworzyć odrębną bazę, zapisać jej identyfikator oraz własną parę URL pooled/direct. Porównać identyfikatory z Production: wspólny host `db.prisma.io` i nazwa `postgres` nie potwierdzają rozdzielenia. Staging nie jest drugą nazwą ani nowym hasłem do tej samej bazy.
2. **Przygotować konfigurację importowaną do Vercel.** Utworzyć ignorowany przez Git `.env.vercel.staging` z `DATABASE_URL` nowej bazy, nowym `BETTER_AUTH_SECRET`, osobnymi `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `BETTER_AUTH_URL` staging i `APP_ENV=staging`. Skopiować tylko neutralne limity puli. Obecny `.env.vercel.test` wymaga zastąpienia wartości połączenia, jeśli nadal wskazuje Production. Nazwa pliku sama nie wybiera bazy ani środowiska.
3. **Ustawić zakres w istniejącym projekcie Vercel.** Zaimportować wartości wyłącznie jako Preview dla gałęzi `lab10`. Nie nadpisywać zmiennych Production ani nie przypisywać testowych sekretów wszystkim gałęziom/PR-om. Dla Production dopisać `APP_ENV=production`. Nie ustawiać ręcznie `VERCEL_ENV` ani nie zmieniać `NODE_ENV`: Preview nadal jest produkcyjnym buildem Next.js.
4. **Ustalić stały adres i OAuth.** Użyć rzeczywistego adresu gałęzi `lab10` pokazanego w Vercel, ewentualnie stałego aliasu Preview. Adres z losowym hashem wdrożenia nie jest callbackiem staging. W osobnej GitHub OAuth App ustawić homepage na ten origin, callback na `<origin>/api/auth/callback/github`, a `BETTER_AUTH_URL` na ten sam origin. Po pierwszym wdrożeniu potwierdzić przypisanie adresu do `lab10`; w razie korekty originu zaktualizować OAuth i wykonać nowe Preview.
5. **Wprowadzić tylko niezbędne zmiany walidacji.** W `scripts/check-deployment.ts` zastąpić bezwarunkową blokadę Preview dopuszczeniem wyłącznie konfiguracji `APP_ENV=staging`. Niekompletne Preview ma nadal kończyć build błędem. W `lib/auth/environment.ts` i `lib/db/environment.ts` objąć Preview wymaganiem HTTPS i zdalnego PostgreSQL, tak jak Production. Dodać testy braku markerów/sekretów, localhost, niewłaściwego originu oraz poprawnej konfiguracji staging. Zachować dokładne `trustedOrigins` bez wildcardów. Nie zmieniać repozytoriów, schematu Prisma ani interfejsu aplikacji.
6. **Zainicjalizować wyłącznie staging.** W osobnym terminalu ustawić jako `DATABASE_URL` direct URL nowej bazy, wykonać istniejące migracje i jednorazowy seed, po czym zamknąć ten kontekst. Direct URL pozostaje konfiguracją operatora; do Vercel trafia pooled URL. Nie używać zdalnej bazy staging jako `TEST_DATABASE_URL`: istniejące testy automatyczne zachowują lokalne bazy tymczasowe.
7. **Opublikować ręcznie Preview.** Pozostawić wyłączone automatyczne publikacje Gita i nie rozszerzać teraz workflow Production. W checkoutcie gałęzi `lab10`, powiązanym z istniejącym projektem, po testach wykonać:

   ```text
   vercel deploy --yes
   ```

   Ten wariant buduje aplikację na Vercel ze skonfigurowanymi tam zmiennymi Preview; nie wymaga kopiowania testowych sekretów do lokalnego prebuilt buildu. Przy tej operacji nie używać `--prod`, `vercel promote` ani produkcyjnych `release:check`/`release:verify`, które celowo sprawdzają target Production. Potwierdzić w panelu, że wdrożenie ma target Preview, jest powiązane z `lab10` i otrzymało właściwy stały adres. Dla CLI przypisanie domeny gałęzi zależy od metadanych Gita; jeżeli nie zostało wykonane automatycznie, przypisać wyłącznie alias Preview. Gdy działa Vercel Authentication, osoby testujące muszą mieć dostęp również do callbacku OAuth pod adresem Preview.

Przykładowe zmienne runtime (wyłącznie placeholdery):

```dotenv
APP_ENV=staging
DATABASE_URL=postgres://STAGING_USER:STAGING_PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=verify-full
BETTER_AUTH_URL=https://STALY-ADRES-PREVIEW
BETTER_AUTH_SECRET=NOWY_LOSOWY_SEKRET_MINIMUM_32_ZNAKI
GITHUB_CLIENT_ID=ID_OSOBNEJ_APLIKACJI_OAUTH
GITHUB_CLIENT_SECRET=SEKRET_OSOBNEJ_APLIKACJI_OAUTH
PG_POOL_MAX=3
```

**Test odbiorczy:** zapisać identyfikatory baz, SHA i adresy obu wdrożeń. Przed próbą odczytać stan kontrolnego koszyka i wybranego produktu Production. Zalogować się przez testowy OAuth w Preview, zmienić koszyk, a następnie potwierdzić zmianę w bazie staging i niezmienione dane Production. Odczyty porównawcze wykonać w krótkim oknie bez innych zapisów. Sprawdzić brak zalogowania do drugiego środowiska przy przejściu między adresami oraz zachowanie koszyka po ponownym logowaniu i nowym wdrożeniu Preview. Uzupełnić `ACCEPTANCE.md` dowodem izolacji; sam nowy plik `.env` nie zalicza rozszerzenia.

**Koszt utrzymania:** druga baza, osobne OAuth i sekrety, migracje obu baz, dodatkowe buildy/wywołania oraz współdzielone limity jednego projektu Vercel. Kwoty zależą od planu bazy i hostingu. Przełączanie produkcyjnego `DATABASE_URL` na testowy zamiast osobnego Preview nie realizuje tego planu, bo zmieniałoby działającą aplikację Production.

## 2. Test przeglądarkowy koszyka

**Efekt:** powtarzalny test rzeczywistego interfejsu i operacji serwera.

Implementacja:

1. Wydzielić `npm run test:e2e:cart` z istniejącego zestawu, wykorzystując `verify-basket-ui.ts`, `withBrowser` i `createBrowserSession`. Nie uruchamiać w tym zadaniu starych scenariuszy historii demonstracyjnej.
2. Każdy przebieg otrzymuje nową lokalną bazę utworzoną przez istniejący mechanizm `withIsolatedDatabase`. Zachować jego kontrolę tożsamości i ograniczenie do lokalnych baz testowych.
3. Sprawdzić sekwencję: dodanie produktu, zmiana ilości, aktualizacja sumy, usunięcie, pusty koszyk. Po każdym zapisie potwierdzić stan w bazie.
4. Przechwycić rzeczywiste żądania Server Actions i odtworzyć dodanie, zmianę ilości oraz usunięcie bez sesji. Każda operacja ma zwrócić odmowę i nie zmienić danych. Uzupełnić brakujące przypadki w obecnym skrypcie.
5. Sesję przygotowywać lokalnym helperem Better Auth; nie dodawać endpointu logowania testowego ani obejścia OAuth w aplikacji.
6. Uruchamiać test po produkcyjnym buildzie także w GitHub Actions. Zapewnić Chromium/Chrome i jawne `BROWSER_PATH`; raportować wynik i zrzuty ekranu bez cookies oraz tokenów.

**Test odbiorczy:** udany przebieg na czystej bazie oraz potwierdzenie odmowy wszystkich trzech mutacji bez sesji. Test musi wykryć kontrolowaną regresję autoryzacji w izolowanym przebiegu.

**Koszt utrzymania:** czas uruchomienia przeglądarki w CI, aktualizacje selektorów po zmianach UI i utrzymanie helpera zgodnego z Better Auth.

## 3. Automatyczne CI/CD

**Efekt:** publikacja konkretnego SHA następuje dopiero po pozytywnych testach.

Implementacja:

1. Rozszerzyć istniejący workflow o test koszyka oraz testy checkoutu. PR-y otrzymują tylko fikcyjne dane i tymczasową bazę CI.
2. Dodać zadanie publikacji zależne przez `needs` od pełnego zestawu sprawdzeń. Publikacja Production działa tylko dla zaufanego zdarzenia `push` do `main`, ze sprawdzanego SHA. Nie pobiera kodu PR z dostępem do sekretów produkcyjnych.
3. Sekrety publikacji Production trzymać w GitHub Environment `production`. Dane runtime rozdzielić w istniejącym projekcie Vercel na Production i Preview gałęzi `lab10`, zgodnie z punktem 1. Staging na tym etapie publikować ręcznie; nie dokładać nowego projektu ani nowego toru automatycznego wdrażania.
4. Użyć przypiętej wersji Vercel CLI: dla Production pobranie konfiguracji Production, `vercel build --prod`, następnie `vercel deploy --prebuilt --prod`. Ręczna publikacja staging używa Preview i poleceń bez `--prod`.
5. Po sprawdzeniach i buildzie, przed publikacją, wykonać `prisma migrate deploy` jako oddzielny krok z direct URL właściwego środowiska. Błąd migracji zatrzymuje wydanie. Seed pozostaje osobnym krokiem inicjalizacji.
6. Zachować wyłączenie niezależnego automatycznego deploya Vercel z Gita, aby nie omijał bramki CI. Uporządkować `concurrency`: działająca migracja/publikacja nie może być anulowana przez kolejny push.
7. Po publikacji wykonać smoke test katalogu/API pod stabilną domeną i zapisać SHA, identyfikator wdrożenia, URL oraz rezultat. Cofnięcie kodu nie cofa migracji; migracje muszą zachować zgodność z poprzednią działającą wersją.

**Test odbiorczy:** ręczne próby już dodanej bramki `fail_test: true/false` — nieudany rzeczywisty test pomija zależne zadanie publikacji, a poprawny przebieg otwiera tę samą bramkę. Ręczne próby nie publikują ani nie migrują i nie wymagają wdrożonego staging. Dokładna procedura i stan odbioru są w `DEPLOYMENT.md` i `ACCEPTANCE.md`.

**Koszt utrzymania:** minuty CI, aktualizacje CLI/actions, obsługa tokenów i zgodności migracji. Sam test CI nadal używa lokalnej usługi PostgreSQL i nie wymaga zdalnego staging.

## 4. Backup i restore

**Efekt:** kopia bazy daje się odtworzyć do nowej bazy i zachowuje katalog, relacje oraz koszyki.

Implementacja:

1. Dodać `db:backup`, `db:restore:test` i `db:verify-restore`. Użyć narzędzi PostgreSQL 17 lokalnie albo obrazu `postgres:17`; w obecnym środowisku dostępny jest Docker, natomiast narzędzia `pg_dump` i `pg_restore` nie są w PATH.
2. Backup wykonywać przez direct URL, w formacie custom (`pg_dump -Fc`) do wskazanego pliku. Przygotować dwie niezależne bazy testowe: źródłową z fikcyjnymi danymi i pustą docelową.
3. Zanim zacznie się restore, sprawdzić tożsamość źródła i celu, osobny identyfikator bazy u dostawcy oraz oczekiwany cel testowy. W Prisma Postgres wspólny host lub nazwa `postgres` nie wystarczają do identyfikacji bazy. Cel zgodny z Production lub źródłem musi zostać odrzucony.
4. Odtwarzać do pustego celu z `pg_restore --exit-on-error --no-owner --no-privileges`. Nie stosować `--clean` ani odtwarzania do Production. Uprawnienia runtime odtworzyć osobno, zgodnie z możliwościami dostawcy.
5. Sprawdzić dane według stabilnych kluczy i wartości, FK, indeksy, ograniczenia, kolacje i historię migracji. Porównać powiązania użytkownik–koszyk–pozycje–produkty oraz istniejące zamówienia. Nie wystarczy porównać samych liczników.
6. Uruchomić aplikację na kopii i zweryfikować odczyt katalogu oraz zapis testowego koszyka. Kopie przechowywać poza Gitem i publicznymi artefaktami CI; ustalić retencję i sposób ochrony plików.

**Test odbiorczy:** odtworzona baza zawiera te same rekordy i relacje, a kontrolowana zmiana koszyka w kopii nie zmienia źródła. Drugim przypadkiem jest odmowa restore przy błędnie wskazanym celu.

**Koszt utrzymania:** miejsce na kopie, zgodność wersji narzędzi, okresowe próbne odtworzenie i czas operatora. Test na fikcyjnych danych nie potwierdza działania kopii rzeczywistych danych Production; taki dodatkowy odbiór należy opisać osobno, jeśli będzie wykonywany.

## 5. Pomiar wydajności

**Efekt:** raport czasu odpowiedzi i wykorzystania puli pod znanym obciążeniem testowym.

Implementacja:

1. Dodać skrypt `perf:catalog` wykorzystujący Node.js oraz dane testowe, z parametrami liczby żądań, współbieżności i adresu. Dopuszczać wyłącznie lokalną aplikację lub jawnie wskazany staging.
2. Mierzyć `/api/products?sort=name`, aby nie mieszać wyniku z dodatkową zależnością od kolacji starszego sortowania. Każda odpowiedź musi mieć poprawny status i dane.
3. Proponowana macierz: współbieżność 1, 5, 10 i 20; po 200 żądań i trzy powtórzenia. Zapisać medianę, p95, p99, liczbę błędów, czas całkowity i przepustowość. Parametry dostosować przed uruchomieniem do limitów środowiska.
4. Osobno zmierzyć pierwsze żądanie po kontrolowanym restarcie lokalnego procesu i kolejne próby po rozgrzaniu. Wybudzenie zdalnej bazy, jeśli występuje, opisać jako osobny warunek. Pierwszego żądania do Vercel nie nazywać automatycznie potwierdzonym cold startem.
5. W `lib/db/prisma.ts` dodać opcjonalną diagnostykę puli dla środowiska pomiarowego: `totalCount`, `idleCount`, `waitingCount`, obliczane aktywne połączenia i maksima. Raportować z identyfikatorem procesu/instancji, bez publicznego endpointu diagnostycznego.
6. Zestawić próbki puli z czasem i identyfikatorem przebiegu. Pomiary aplikacji dotyczą pojedynczej instancji; przy wielu funkcjach Vercel uzupełnić je obserwacją limitów/połączeń w panelu dostawcy. Pula klienta `pg` i pooler dostawcy to osobne warstwy.
7. Zapisać surowe wyniki JSON i czytelny raport zawierający SHA, wersje, regiony, liczbę produktów, `PG_POOL_MAX`, timeouty, warunki uruchomienia i ograniczenia wniosków.

**Test odbiorczy:** kompletny raport dla wszystkich poziomów współbieżności, rozdzielenie pierwszego uruchomienia i kolejnych prób oraz próbki wykorzystania puli. Nie ustalać arbitralnego progu czasu jako rzekomego wymagania PDF-u.

**Koszt utrzymania:** zapytania do bazy, czas obliczeń i przechowywanie wyników. Pełny pomiar uruchamiać na żądanie, poza każdym zwykłym PR-em.

## 6. Dodatkowy odbiór istniejących zamówień

To wymaganie warunkowe z końca rozdziału 10, a nie szóste rozszerzenie.

- Dodać `tests/integration/checkout.test.ts` korzystający z dwóch użytkowników, oddzielnych koszyków i produktu ze stanem jednej sztuki.
- Uruchomić dwa równoległe zakupy. Dokładnie jeden kończy się zamówieniem; stan wynosi zero, nie pojawia się drugie zamówienie i koszyk przegranego nie zostaje usunięty.
- Ponowić zakup z tym samym `requestKey`, również równolegle. Wyniki wskazują ten sam `orderId`, stan nie zmniejsza się ponownie i nie powstaje duplikat.
- Po pierwszym zakupie dodać nowy produkt do koszyka i powtórzyć poprzedni klucz. Nowa zawartość koszyka ma pozostać bez zmian.
- Uzupełnić odbiór o rzeczywiste żądanie chronionej operacji z sesją i odmowę bez sesji. W razie wykrycia regresji poprawić istniejący writer zamiast tworzyć drugi mechanizm checkoutu.
- Płatności pozostają poza zakresem.

## Kolejność realizacji i dowody

1. Potwierdzenie części podstawowej i przygotowanie konfiguracji staging.
2. Wydzielenie testu koszyka oraz dodanie testów checkoutu.
3. Wpięcie kompletu testów i publikacji do CI/CD.
4. Skrypty backup/restore i próbne odtworzenie.
5. Diagnostyka puli oraz pomiary wydajności.
6. Aktualizacja `DEPLOYMENT.md` i `ACCEPTANCE.md`: dla każdego rozszerzenia wynik, data, SHA, komenda lub przebieg CI, dowód i koszt utrzymania. Uzupełnić README wymagany przy oddaniu lub jednoznacznie ustalić z prowadzącym odniesienie do tych dokumentów.

Każdy etap otrzymuje własne kryterium odbioru opisane powyżej. Nie oznaczać rozszerzenia jako ukończonego na podstawie samego istnienia skryptu lub konfiguracji.

## Dokumentacja techniczna

- [Vercel i GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) — publikacja z CI i osobne projekty.
- [Zmienne Vercel dla środowisk i gałęzi](https://vercel.com/docs/environment-variables/manage-across-environments) — osobna konfiguracja Preview `lab10` w istniejącym projekcie.
- [Adresy wdrożeń i gałęzi](https://vercel.com/docs/deployments/generated-urls) oraz [aliasy](https://vercel.com/docs/cli/alias) — stały adres do callbacku OAuth.
- [Backup Prisma Postgres](https://docs.prisma.io/docs/postgres/database/backups) — ręczny backup przez direct connection.
- [PostgreSQL 17: pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) i [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) — format kopii i opcje odtwarzania.
- [node-postgres: pula połączeń](https://node-postgres.com/apis/pool) — dostępne liczniki puli.
