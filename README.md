# Sklep z podzespołami komputerowymi — Lab 08

Next.js App Router i TypeScript z katalogiem PostgreSQL 17 obsługiwanym przez Prisma 7. Katalog, filtry, szczegóły, obrazy, metadane i API korzystają z bazy. `data/products.json` służy wyłącznie do importu i testów. Awaria bazy nie powoduje powrotu do JSON ani pustego wyniku.

Zaimplementowano część podstawową Lab 08 oraz rozszerzenie **Historia zamówień**. Pozostałe rozszerzenia — koszyk, analiza indeksów i współbieżna rezerwacja stanu — pozostają poza zakresem. Zachowano istniejące funkcje Lab 07: katalog catch-all, modal obrazu, skeletony i Tailwind. Koszyk jest nadal widokiem zastępczym; historia pokazuje cztery fikcyjne zamówienia z bazy.

## Środowisko

Weryfikacja: 27 października 2026, Windows, Docker Desktop z kontenerami Linux, Edge headless.

| Element | Wersja |
| --- | --- |
| Node.js / npm | 24.22.1 / 11.19.1 |
| Next.js | 16.3.8 |
| React / React DOM | 19.2.8 |
| TypeScript | 5.9.3 |
| prisma / @prisma/client / @prisma/adapter-pg | 7.10.1 / 7.10.1 / 7.10.1 |
| pg / dotenv / tsx | 8.23.1 / 18.0.9 / 4.23.15 |
| ESLint / Vitest | 9.39.5 / 4.1.11 |
| Tailwind / PostCSS | 4.3.3 / 8.5.31 |
| Docker Engine / Compose | 29.8.2 / 5.6.0 |
| PostgreSQL | 17.11 (Debian 17.11-1.pgdg13+2), amd64 |

Użyty obraz: `postgres@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe`. Compose wybiera `postgres:17`; tag może otrzymywać poprawki, dlatego zapisano rzeczywistą identyfikację. Zmiana głównej wersji przy istniejącym wolumenie wymaga migracji danych.

`.nvmrc` i `.node-version` wskazują 24.22.1; `engines` wymaga Node.js 24. Nowe pakiety mają dokładne wersje w package.json i lockfile. Odtwarzaj je przez `npm ci`, bez ponownego wybierania `@7` lub `latest`. Nie instaluj Prisma 8 RC.

W tej sesji użyto oficjalnej przenośnej dystrybucji Node.js, ze sprawdzoną [sumą SHA-256](https://nodejs.org/dist/v24.22.1/SHASUMS256.txt), w ignorowanym `.tools/node-v24.22.1-win-x64`. Systemowy Node.js 22 nie został zastąpiony. Jeśli ten katalog istnieje, wybierz go w PowerShell:

```powershell
$nodeRuntime = Join-Path (Get-Location).Path '.tools\node-v24.22.1-win-x64'
$env:Path = "$nodeRuntime;$env:Path"
node --version
npm --version
```

Na innym komputerze użyj własnego menedżera Node.js. `.tools` nie jest częścią repozytorium.

## Pierwsze uruchomienie

Wymagane są Node.js 24 oraz działające Docker Engine i Compose. Polecenia wykonuj z katalogu repozytorium. Przygotuj `.env` z szablonu, jeśli jeszcze nie istnieje, i uzupełnij własne hasło oraz zgodne z nim URL. Nie zastępuj istniejących lokalnych ustawień.

```powershell
if (-not (Test-Path -LiteralPath '.env')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
# Uzupełnij lokalne .env przed dalszymi poleceniami.
npm ci
npm run db:generate
docker compose config --quiet
docker compose up -d --wait
npx --no-install prisma migrate deploy
npm run db:seed
npm run db:check
npm run db:check:prisma
npm run dev
```

Aplikacja: http://localhost:3000, katalog: http://localhost:3000/product-list. To sekwencja pierwszego przygotowania danych. Seed przywraca demonstracyjne ceny i stany; nie powtarzaj go przy zwykłym uruchomieniu. Kolejny start wymaga gotowej bazy i `npm run dev` lub produkcyjnego `npm run start` po buildzie.

W trybie development można też korzystać z http://192.168.56.1:3000. Ten adres jest wpisany do `allowedDevOrigins` w `next.config.ts`, aby Next.js dopuszczał połączenie WebSocket potrzebne do uruchomienia strony w przeglądarce. Jeśli adres komputera się zmieni, zaktualizuj ten wpis i uruchom ponownie `npm run dev`. Brak zgody dla adresu może pozostawić skeleton mimo zakończenia odpowiedzi serwera. Na tym samym komputerze można używać `localhost`.

| Zmienna | Znaczenie |
| --- | --- |
| `POSTGRES_DB` | Baza aplikacji, `shop_lab08`. |
| `POSTGRES_USER` | Użytkownik inicjalizowany w nowym wolumenie. |
| `POSTGRES_PASSWORD` | Lokalne hasło; szablon zawiera wartość zastępczą. |
| `POSTGRES_PORT` | Port hosta, domyślnie 5432; po zmianie popraw oba URL. |
| `DATABASE_URL` | Połączenie aplikacji/CLI na hoście: localhost i opublikowany port. |
| `TEST_DATABASE_URL` | Lokalny bazowy adres `shop_lab08_test`, różny od bazy aplikacji. Weryfikatory tworzą unikalne bazy pochodne. |

W hasłach URL koduj znaki specjalne, np. `@` jako `%40`; w POSTGRES_PASSWORD pozostaw rzeczywiste znaki. Sekrety nie mają prefiksu NEXT_PUBLIC_. `.env` jest ignorowany, a `.env.example` jest wyjątkiem do repozytorium. `docker compose config --quiet` waliduje bez wypisywania rozwiniętych haseł.

Compose publikuje port tylko na 127.0.0.1 i montuje nazwany wolumen postgres_data pod `/var/lib/postgresql/data`. Nazwa wolumenu ma prefiks projektu. Healthcheck pg_isready i `--wait` potwierdzają gotowość procesu, ale nie migracje, dane ani hasło. `db:check` dodatkowo sprawdza uwierzytelnienie, bazę, użytkownika i wersję 17.

```powershell
docker compose ps
docker compose logs --tail 20 postgres
docker compose stop postgres
docker compose start --wait postgres
```

Kontener uruchamia proces serwera; wolumen zachowuje pliki poza cyklem życia kontenera; baza jest logicznym katalogiem danych. Stop/start zachowuje dane. `docker compose down -v` usuwa wolumen i nie służy do restartu. Zmiana hasła w .env nie zmienia użytkownika już zapisanego w wolumenie: potrzebna jest zmiana w PostgreSQL i aktualizacja połączeń. Na hoście localhost oznacza ten komputer, a w kontenerze — ten kontener. Inny klient w sieci Compose używa `postgres:5432`.

## Model i migracje

Category.code jest stabilnym tekstowym kluczem głównym: cpu, gpu, ram, disk. Produkt ma jedną wymaganą kategorię przez categoryCode. Klucz obcy z onDelete: Restrict blokuje usunięcie zajętej kategorii; onUpdate: Cascade utrzymuje relację.

| Pole Product | Kontrakt |
| --- | --- |
| id | Int 1–2147483647, zachowany z JSON; bez autoincrement i sekwencji. |
| code | Unikalny tekst, dokładnie 10 wielkich liter ASCII lub cyfr. |
| name, description, image | Zachowana treść i lokalne URL obrazów; nazwa nie jest pusta. |
| price, amount | Int 0–2147483647; cena w groszach, stan w sztukach. |
| date | DateTime @db.Timestamptz(3), źródłowa chwila UTC z milisekundami. |
| nameSortKey | Text z COLLATE "C", wewnętrzny klucz niewysyłany do widoku/API. |

Migracja `20261027103703_catalog` zawiera tabele, klucze, indeksy, CHECK i kolację, w transakcji BEGIN/COMMIT. CHECK wymuszają dodatnie ID, nieujemną cenę/stan, format kodu, dopuszczalne kategorie i niepuste nazwy. Górne zakresy liczb wymusza PostgreSQL INTEGER.

Klucze główne i @unique zapewniają indeksy unikalne. `product_category_code_idx` wspiera filtr kategorii i sprawdzanie produktów kategorii; nie dodano drugiego indeksu na kod ani rozszerzenia z analizą indeksów.

Nową zmianę przygotuj lokalnie w tej kolejności:

```powershell
npm run db:validate
npx --no-install prisma migrate dev --create-only --name nazwa_zmiany
# Przejrzyj i uzupełnij nowy migration.sql przed zastosowaniem.
npx --no-install prisma migrate dev
npm run db:generate
npx --no-install prisma migrate status
```

Migrate dev tworzy zmiany w development i korzysta z bazy pomocniczej. Migrate deploy odtwarza zapisaną historię na innym środowisku. Nie edytuj zastosowanych migracji i nie używaj migrate reset jako zwykłej naprawy. Własne CHECK i kolacja są w SQL, ponieważ schemat Prisma nie wyraża ich w pełni. Odtwarzają się również przez migrate deploy.

## Prisma, seed i połączenia

`prisma.config.ts` jawnie ładuje .env i konfiguruje CLI, schemat, migracje, `tsx prisma/seed.ts` oraz env(DATABASE_URL). URL jest w konfiguracji CLI, nie w datasource schematu. Zmienna jest potrzebna także podczas generate, choć generowanie nie wymaga odczytu bazy.

Generator prisma-client zapisuje kod w lib/generated/prisma względem schematu. Generuj go po npm ci i zmianie modelu. Kod wygenerowany jest ignorowany przez Git i ESLint. PrismaPg jest adapterem wykonawczym klienta, a nie konfiguracją CLI.

`lib/db/prisma.ts` jest zabezpieczony przez server-only i współdzieli jednego klienta aplikacji. W development globalThis.shopPrisma zachowuje pulę po przeładowaniu modułów. Nie tworzymy i nie zamykamy klienta przy każdym żądaniu. Skrypty jawnie ładują środowisko, mają własnego klienta i $disconnect w finally; nie importują modułu aplikacji. Typy klienta nie walidują nieznanego wejścia ani nie zastępują CHECK.

Seed czyta JSON i waliduje cały plik przed zapisami: tablicę/rekordy, unikalne ID/kody, typy i zakresy, kategorię, teksty, rzeczywiste daty UTC z milisekundami, lokalne ścieżki bez traversal oraz istnienie obrazów w public. Wymaga 100 produktów i czterech kategorii. Wartości źródłowe zostają zachowane.

Jedna transakcja upsertuje kategorie po kodzie i produkty po ID. Przywraca wszystkie pola demonstracyjne, w tym cenę, stan, kategorię, nazwę i sort key; zachowuje dodatkowe rekordy. Konflikt kodu nie jest rozwiązywany przez usuwanie danych i wycofuje cały import. Walidacja wykrywa błędy przed operacjami; transakcja chroni przed błędami zapisu. Błąd daje niezerowy kod i zamknięcie połączeń.

Prisma 7 nie seeduje automatycznie przy migracji. Używaj `npm run db:seed` jawnie, bez historycznej flagi --skip-seed. Nie seeduj podczas sprawdzania trwałości zmian.

## Repozytorium i aktualne odczyty

`product-repo.tsx` jest serwerowym punktem dostępu do createProductRepository. Adapter przyjmuje klienta, aby skrypty i testy nie zależały od Next.js. `listProducts` i `findProductById` pozostają asynchroniczne. URL jest interpretowany przed repozytorium; where i orderBy wykonuje PostgreSQL, bez pobierania tabeli do filtrowania w pamięci.

Widok dostaje kategorię jako type, całkowite grosze i datę przez toISOString(), bez nameSortKey. Cena jest prezentowana w PLN po podzieleniu przez 100; data jest widoczna jako ISO UTC z milisekundami i zapisana w time/dateTime. Obrazy pozostają lokalnymi ilustracjami kategorii.

`getProductNameSortKey` wykonuje NFC, trim i lowercase. Seed i przyszłe zmiany nazwy muszą zapisać klucz w tej samej operacji. Sort=name używa nameSortKey ASC, id ASC; kolacja C odpowiada bajtom UTF-8. Newest używa date DESC, id ASC. Bez sortowania repozytorium zwraca ID rosnąco.

Starsze nameAsc/nameDesc zachowują polskie reguły poprzedniego środowiska localeCompare: parametryzowany SQL używa wbudowanej kolacji ICU pl-PL-x-icu obrazu PostgreSQL. To inny porządek niż znormalizowany klucz. Ceny są sortowane w SQL, z deterministycznym remisem po ID. Porównanie adapterów obejmuje rzeczywisty katalog, polskie znaki, Unicode, wielkość liter i remisy.

Brak wyników daje [], a nieistniejące poprawne ID daje null. ID spoza 1–2147483647 odrzucamy przed ORM. Błędny format URL, np. 01 lub 12abc, trafia do notFound przed zapytaniem. Stan zero nie oznacza braku produktu. Awaria odrzuca Promise; nie staje się null, pustą listą ani odczytem JSON. Przyczyna pozostaje w logach serwera.

Lista, szczegóły, generateMetadata, alternatywne katalogi i obrazy wywołują await connection() przed odczytem. Nie ma generateStaticParams, ograniczenia dynamicParams, React cache ani trwałego cache danych. Connection nie jest częścią repozytorium. API jest dynamiczne i zwraca Cache-Control: no-store. Folder [id] sam nie określa prerenderowania — build pokazuje dynamiczne produkty.

Zapis nie gwarantowałby nowego widoku przy starym cache strony. Produkcyjny test odwiedza produkt przed zmianą, następnie wraca przez Link po zmianie stanu/nazwy i sprawdza metadane. Zachowano Link/RSC, filtry w URL, Wstecz/Dalej, skeletony i aktywną nawigację.

## Trasy i URL

| Adres | Funkcja |
| --- | --- |
| `/product-list` | Katalog i filtry serwerowe. |
| `/product-list/<id>` | Szczegóły i metadane z bazy. |
| `/product-list/<id>/image` | Pełna strona lub modal po nawigacji klientowej. |
| `/catalog[/<type>[/<id>]]` | Zachowany optional catch-all. |
| `/catalog/required/<type>[/<id>]` | Zachowany wymagany catch-all. |
| `/api/products` | Publiczny GET, bez mutacji. |
| `/pages/order-history` | Aktualna, tylko do odczytu historia fikcyjnego konta demonstracyjnego. |
| `/pages/about`, `/pages/basket` | Informacje i widok zastępczy koszyka. |

Katalog przyjmuje type=all|cpu|gpu|ram|disk, stock=all|available|unavailable i sort=name|newest; domyślnie all/all/name. Filtry łączą się. Available oznacza amount > 0, unavailable amount = 0. Niepoprawna/pusta/powtórzona wartość parametru strony przywraca tylko jego ustawienie domyślne i pokazuje komunikat. Pozostałe ustawienia pozostają; nieznane nazwy są ignorowane. Reset usuwa filtry. URL odtwarza widok po skopiowaniu i odświeżeniu.

API ma ścisłą walidację: nieznane klucze i błędne/puste/powtórzone wartości dają 400. Zachowuje sort=nameAsc|nameDesc|priceAsc|priceDesc (domyślnie nameAsc) i available=true|false; false nie filtruje, true wymaga dodatniego stanu. Available nie łączy się ze stock. Awaria daje bezpieczny JSON 500, a POST/PUT/PATCH/DELETE dają 405.

NotFound określa widok braku produktu; po rozpoczęciu streamingu status HTTP może pozostać 200. Testy odróżniają widoczny widok od statusu. Awaria nie udaje 404. Błędy metadanych mogą używać bezpiecznego widoku frameworka; błąd odczytu strony trafia do error.tsx.

## Historia zamówień — rozszerzenie

Nowa migracja `20261027122533_order_history` dodaje User, Order, OrderItem i enum OrderStatus: PENDING, PAID, SHIPPED, CANCELLED. Nie zmienia zastosowanej migracji katalogu. User ma pola wymagane przez plan integracji Better Auth: tekstowe id, name, unikalny email, emailVerified, opcjonalne image oraz createdAt/updatedAt. Nie ma jeszcze logowania, sesji ani kont dostawców. Publiczna strona jest jawnie oznaczona jako demonstracja dla fikcyjnego Demo Customer.

Order ma unikalny numer, użytkownika, datę, status i totalGrosze. Pozycja zapisuje nameSnapshot, codeSnapshot, dodatnią quantity i unitPriceGrosze z chwili złożenia zamówienia. Historia odczytuje te kopie, a nie aktualne nazwy lub ceny katalogu. Zmiana ceny produktu z 445421 na 1 grosz nie zmienia wcześniejszej pozycji ani sumy zamówienia.

ProductId jest opcjonalne z onDelete: SetNull: usunięcie produktu zachowuje pozycję, jej ilość, cenę, nazwę i kod. Strona pokazuje wtedy „No longer in catalogue” i usuwa link do bieżącego produktu. Reseed nie przywraca powiązania ani nie przelicza historii. Usunięcie użytkownika posiadającego zamówienia jest blokowane przez Restrict; usunięcie samego zamówienia usuwa jego pozycje.

Ceny i sumy są BIGINT w całkowitych groszach. Mnożenie i sumowanie używają BigInt, z kontrolą przekroczenia 9223372036854775807 przed zapisem. Formatowanie PLN nie konwertuje kwot do Number. Repozytorium mapuje wartości na tekst w modelu widoku, więc można go bezpiecznie serializować do JSON. Sprawdza także zgodność zapisanej sumy z pozycjami i odrzuca niespójne dane zamiast wyświetlać błędny rachunek. CHECK w SQL wymuszają dodatnią ilość/numer linii oraz nieujemną cenę jednostkową i sumę; numer zamówienia i para orderId/lineNumber są unikalne.

`prisma/order-history-fixtures.ts` zawiera cztery stałe zamówienia z października 2026, sześć pozycji i historyczne kopie cen/nazw/kodów. `seedOrderHistory` zapisuje fikcyjne konto i zamówienia w jednej transakcji. Upsert po stabilnych ID ma pusty update: istniejące snapshoty, statusy i daty nie są nadpisywane, a dodatkowe zamówienia pozostają. Konflikt tożsamości przerywa transakcję. Kwoty demonstracyjne wynoszą 773075, 395484, 487279 i 957014 groszy.

Zwykłe `npm run db:seed` wykonuje najpierw transakcję katalogu, następnie osobną transakcję historii. Aby dodać lub ponowić wyłącznie historię bez przywracania cen i stanów katalogu:

```powershell
npx --no-install prisma migrate deploy
npm run db:generate
npm run db:seed-orders
```

Polecenie wymaga istniejącego katalogu dla nowych zamówień. Skrypt ma własnego klienta i zamyka go w finally. Przy pierwszym dodaniu rozszerzenia uruchomiono je dwa razy: cztery zamówienia i fikcyjny profil pozostały identyczne, a wszystkie produkty zachowały ceny, nazwy i stany.

Strona `/pages/order-history` korzysta z serwerowego repozytorium i await connection(), filtruje wyłącznie po stałym ID demonstracyjnym i sortuje od najnowszych. Nie przyjmuje użytkownika z URL. Ma stany ładowania, pustej historii i bezpiecznego błędu. W Lab 09 identyfikator zostanie zastąpiony tożsamością z sesji. Nie ma publicznego API tworzenia zamówień, checkout ani rezerwacji magazynu; wewnętrzna funkcja importu przyjmuje już przygotowane snapshoty.

Integracja sprawdza powtarzalność, zachowanie dodatkowego zamówienia, niezmienność historii po aktualizacji i usunięciu produktu, filtrowanie użytkownika, SQL CHECK/enum/unikalność, kwoty większe od Number.MAX_SAFE_INTEGER, wycofanie niepełnego zamówienia oraz odrzucanie niespójnej sumy. Test browser sprawdza widok, historyczne dane, linki i szerokość 390 px. Podglądy zapisuje lokalnie w ignorowanym `.tools/order-history-desktop.png` oraz `.tools/order-history-mobile.png`.

## Lokalna zmiana stanu

```powershell
npm run db:set-stock -- 1 0
```

Wymagane są pełne argumenty: ID 1–2147483647, amount 0–2147483647, bez ułamków i dodatkowych argumentów. Walidacja poprzedza zapis, a aktualizacja wymaga dokładnie jednego istniejącego produktu. Błędy i brak ID dają kod 1. Sukces wypisuje ID/stan i zamyka własne połączenia. Polecenie nie seeduje danych.

To lokalna demonstracja, bez publicznego formularza/API zapisu. Sesje, autoryzacja i operacje użytkownika należą do Lab 09. Nie zaimplementowano rezerwacji ani checkout.

## Weryfikacja

Po npm ci jawnie generuj klienta. Integracja wymaga gotowej lokalnej bazy i .env. Unit nie wymaga połączenia.

```powershell
npm run db:generate
npm run lint
npm run test
npm run test:integration
npm run build
npm run start
```

Test:integration sprawdza migracje, seed i repozytorium na osobnych bazach. Wymaga lokalnego TEST_DATABASE_URL z bazową nazwą shop_lab08_test, różną od aplikacji; tworzy własny kontrolowany prefiks i losowy sufiks, sprawdza current_database() i usuwa tylko tę bazę. Nie resetuje istniejącego katalogu. Potrzebuje lokalnego CREATE DATABASE dostępnego w Compose.

Repozytorium jest testowane na prawdziwej bazie, bez mocków fs/Prisma. Parsery, routing i singleton mają testy jednostkowe. Niezależny tests/helpers/json-product-reference.ts i zamrożone ID są wzorcem wcześniejszego adaptera, a nie fallbackiem. Nie regeneruj oczekiwań z nowego adaptera, aby ukryć rozbieżności.

Po buildzie uruchom scenariusze produkcyjne. Nie uruchamiaj wcześniej osobnego npm run start: skrypty zarządzają serwerem i tymczasowym profilem przeglądarki.

```powershell
npm run test:browser
npm run test:persistence
npm run test:failures
```

Potrzebne są Edge/Chrome/Chromium; BROWSER_PATH wskazuje inny plik. Każdy scenariusz ma osobną seedowaną bazę, usuwaną po zakończeniu. Katalog aplikacji pozostaje bez zmian. Test browser obejmuje również zachowane UI z Lab 07.

Testy persistence i failures zatrzymują i ponownie uruchamiają usługę postgres tego projektu. Wykonuj je kolejno, bez innych testów na tej usłudze. Wolumen pozostaje; gotowość jest przywracana także po błędzie scenariusza.

Wyniki z 27 października 2026:

| Sprawdzenie | Wynik |
| --- | --- |
| Czysta instalacja | npm ci z końcowego lockfile oraz jawne db:generate zakończone poprawnie; lint, unit, integracja i build uruchomione po odtworzeniu zależności. |
| Unit | 77 testów w 11 plikach. |
| Integracja | 13 testów repozytoriów produktów/historii i osobne rzeczywiste weryfikatory migracji/seeda. |
| Migracje | Pusta baza odtworzona z historii; CHECK, kolacja C, indeksy, zakresy i FK działają poza walidatorem. |
| Seed | Dwa uruchomienia: cztery kategorie, 100 identycznych produktów; pola i ID zachowane. Konflikt pod koniec wycofuje wcześniejsze zapisy; dodatkowe rekordy pozostają. |
| Zgodność | 60 kombinacji type/stock/sort na katalogu i danych brzegowych zgodnych z zamrożonymi ID; dodatkowo ICU i ceny. |
| Browser | Filtry, URL, reset, pusty wynik, szczegóły, obrazy, metadane, ID, Link/RSC, historia nawigacji, modal, klawiatura i 390 px. Historia zamówień zachowuje ceny i nazwy po zmianie oraz usunięciu bieżącego produktu; usunięta pozycja nie ma błędnego linku. |
| Trwałość | Produkt 1: 97 → 0. Lista, filtry i szczegóły przez URL/Link pokazują zmianę; po restarcie aplikacji i kontenera nadal 0, bez seeda/builda. Nazwa i metadane wcześniej odwiedzonego produktu są aktualne; historyczna kopia w zamówieniu pozostaje niezmieniona. |
| Awaria bazy | Zatrzymany kontener daje bezpieczne błędy katalogu, produktu i historii zamówień oraz API 500, bez pustego wyniku/404 i bez sekretów. Po gotowości odczyty odzyskują działanie w tym samym procesie aplikacji. |
| Lint / TypeScript / build | Bez błędów; produkty są dynamiczne. |

Ograniczenia sprawdzono bez walidatora: odrzucane są ujemna cena/stan, niedodatnie ID, przepełnienie Int, duplikaty kodu/ID, niedozwolone kategorie, puste nazwy i usunięcie zajętej kategorii. Zero i górna granica Int są obsługiwane; daty zachowują milisekundy. Awarię sprawdzają nieosiągalne połączenie i produkcyjne zatrzymanie kontenera.

Sekrety, pliki wolumenu, node_modules i wygenerowany klient pozostają poza repozytorium. Schemat, SQL migracji, seed, Compose, lockfile, szablon środowiska i testy są częścią źródeł do oddania.

## Źródła

Dostarczony ProgBackEnd_Lab08.pdf, strony 1–8; wzorzec zachowania: kod Lab 07, dane i zamrożone testy repozytorium.

- [Prisma 7: Config API](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Prisma 7 i Next.js](https://www.prisma.io/docs/guides/v7/frameworks/nextjs)
- [Własny SQL w migracjach](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations)
- [Jawny seed](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding)
- [Transakcje](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- [Filtrowanie i sortowanie](https://www.prisma.io/docs/orm/v7/prisma-client/queries/filtering-and-sorting)
- [Ograniczenia PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html)
- [Kolacje PostgreSQL 17](https://www.postgresql.org/docs/17/collation.html)
- [Oficjalny obraz PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md)
- [Gotowość Compose](https://docs.docker.com/compose/how-tos/startup-order/)
- [Next.js connection()](https://nextjs.org/docs/app/api-reference/functions/connection)
