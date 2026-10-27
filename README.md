# Sklep z podzespołami komputerowymi — Lab 07

Projekt edukacyjny w Next.js z App Routerem i TypeScript. Rozwija sklep z Lab 06 o szczegóły produktu, filtry i sortowanie zapisane w URL, walidację adresu oraz aktywną nawigację. Katalog zawiera 100 produktów CPU, GPU, RAM i dysków. Dane są tylko do odczytu, ze wspólnego repozytorium serwerowego i `data/products.json`.

Zrealizowane rozszerzenia: prerenderowanie trzech produktów przez `generateStaticParams`, porównanie catch-all i optional catch-all w `/catalog`, modal obrazu przez Intercepting Routes oraz Tailwind CSS 4. Cache Components i React Compiler nie są włączone. Koszyk i historia zamówień mają widoki zastępcze; zakupy i trwałe zmiany danych nie są zaimplementowane.

## Środowisko i dokładne wersje

Wersje sprawdzono 20 października 2026 przez `node --version`, `npm --version`, `npm ls --depth=0` i porównanie z `package-lock.json`. Dodano wymagane pakiety Tailwind/PostCSS; wersje Next.js i React pozostają bez zmian.

| Narzędzie / pakiet                  | Wersja                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Node.js dostępny podczas sprawdzeń  | 22.20.0                                                 |
| Node.js wymagany instrukcją         | 24.x; dokładna wersja wykonawcza nie została sprawdzona |
| npm                                 | 10.9.3                                                  |
| Next.js                             | 16.3.8                                                  |
| React / React DOM                   | 19.2.8 / 19.2.8                                         |
| TypeScript                          | 5.9.3                                                   |
| ESLint / eslint-config-next         | 9.39.5 / 16.3.8                                         |
| Vitest                              | 4.1.11                                                  |
| Tailwind CSS / @tailwindcss/postcss | 4.3.3 / 4.3.3                                           |
| PostCSS                             | 8.5.31                                                  |
| Express / cors                      | 5.2.1 / 2.8.6                                           |
| @types/node                         | 20.19.43                                                |
| @types/react / @types/react-dom     | 19.3.0 / 19.3.0                                         |
| @types/express / @types/cors        | 5.0.6 / 2.8.19                                          |

Wyniki w tym README dotyczą Node.js 22.20.0. Nie potwierdzają działania na wymaganym Node.js 24. Lockfile określa wersje pakietów npm, a nie środowiska Node.js.

## Instalacja i uruchomienie

Uruchamiaj polecenia z katalogu głównego repozytorium. Na zajęciach użyj Node.js 24 zgodnie z ustaleniami grupy, zachowując zależności z lockfile.

```bash
node --version
npm --version
npm ci
npm run dev
```

Aplikacja: [localhost:3000](http://localhost:3000). Katalog: [localhost:3000/product-list](http://localhost:3000/product-list).

Weryfikacja i uruchomienie produkcyjne:

```bash
npm run lint
npm run test
npm run build
npm run start
```

Inny port: `npm run start -- --port 3100`. Przed uruchomieniem produkcyjnym wykonaj build.

## Struktura i trasy

```text
app/
  layout.tsx                       wspólny layout i nagłówek
  page.tsx                         strona główna
  not-found.tsx                    ogólny widok braku strony
  global.css                       style globalne
  api/products/route.ts            API produktów tylko do odczytu
  product-list/
    page.tsx                       interpretacja URL i odczyt repozytorium
    loading.tsx                    oczekiwanie na dane
    error.tsx                      bezpieczny widok awarii z ponowieniem
    [id]/
      page.tsx                     szczegóły, metadane i prerenderowanie
      loading.tsx                  skeleton szczegółów produktu
      not-found.tsx                brak produktu i link do katalogu
      image/page.tsx               pełna strona obrazu przy wejściu bezpośrednim
  @modal/
    (.)product-list/[id]/image/     przechwycona strona obrazu jako modal
    default.tsx                    pusty slot przy wejściu bezpośrednim
    page.tsx                       pusty slot po przejściu na stronę główną
    [...catchAll]/page.tsx          czyszczenie slotu podczas nawigacji klientowej
  catalog/
    [[...slug]]/page.tsx            opcjonalne segmenty: root, kategoria, produkt
    required/[...slug]/page.tsx     wymagane segmenty: kategoria, produkt
  components/
    Header.tsx                     serwerowy nagłówek
    NavLink.tsx                    aktywny link; komponent klienta
    ProductList.tsx                serwerowe karty produktów
    ProductNavigation.tsx          skeleton podczas nawigacji; komponent klienta
    ProductSkeleton.tsx            skeleton katalogu i szczegółów
    product-skeleton.module.css    responsywne placeholdery i animacja
    ProductFilters.tsx             kategoria, stan i reset; komponent klienta
    SortRadio.tsx                  sortowanie; komponent klienta
    CategoryIcon.tsx               ikony kategorii
    product-list.css               style katalogu
  pages/                           pozostałe segmenty App Routera
    about/page.tsx
    basket/page.tsx
    order-history/page.tsx
  types/products.ts                typy produktów i kryteriów
lib/products/
  catalog-query.ts                 interpretacja parametrów URL
  product-repo.tsx                 odczyt, walidacja, filtry i sortowanie
data/products.json                 przykładowy katalog
public/img/                        ilustracje kategorii
tests/                             testy jednostkowe
scripts/
  product-generator.ts             generator danych
  verify-browser.mjs               scenariusze produkcyjne w przeglądarce
  verify-failures.mjs              oddzielne awarie szczegółów i metadanych
  verify-extensions.mjs            catch-all, modal, klawiatura i mały ekran
postcss.config.mjs                 wtyczka @tailwindcss/postcss
```

| Adres                             | Funkcja                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `/`                               | Strona główna                                                    |
| `/product-list`                   | Katalog renderowany na serwerze                                  |
| `/product-list/<id>`              | Szczegóły produktu                                               |
| `/product-list/<id>/image`        | Obraz: modal po kliknięciu; pełna strona po wejściu bezpośrednim |
| `/catalog`                        | Wszystkie kategorie; optional catch-all bez segmentów            |
| `/catalog/<type>`                 | Kategoria w optional catch-all                                   |
| `/catalog/<type>/<id>`            | Produkt należący do wskazanej kategorii                          |
| `/catalog/required/<type>[/<id>]` | Porównawczy wariant wymagający segmentów                         |
| `/pages/about`                    | Informacje o sklepie                                             |
| `/pages/basket`                   | Widok zastępczy koszyka                                          |
| `/pages/order-history`            | Widok zastępczy historii zamówień                                |
| `/api/products`                   | API produktów, tylko GET                                         |

`app/pages` jest zwykłym segmentem App Routera, dlatego pozostałe strony zachowują prefiks `/pages`. Pusty `app/pages/api/products.ts` nie tworzy endpointu. Katalog i szczegóły znajdują się pod trasami wymaganymi w Lab 07.

## Kontrakt URL katalogu

| Parametr | Dozwolone wartości                 | Domyślnie |
| -------- | ---------------------------------- | --------- |
| `type`   | `all`, `cpu`, `gpu`, `ram`, `disk` | `all`     |
| `stock`  | `all`, `available`, `unavailable`  | `all`     |
| `sort`   | `name`, `newest`                   | `name`    |

Wszystkie kryteria działają łącznie. `available` oznacza `amount > 0`, a `unavailable` oznacza `amount === 0`. `all` nie ogranicza filtra. `newest` porównuje znaczniki czasu malejąco. `name` porównuje bajty UTF-8 klucza nazwy po normalizacji NFC, usunięciu skrajnych spacji i zamianie na małe litery. Oba porządki rozstrzygają remisy przez ID rosnąco. Dokładną definicję klucza nazwy trzeba jeszcze porównać z instrukcją Lab 06, której nie dołączono do przeglądu.

Przykładowe adresy:

- `/product-list?type=gpu&stock=available&sort=newest` — dostępne GPU od najnowszych.
- `/product-list?type=ram&stock=unavailable&sort=name` — niedostępne RAM według nazwy.
- `/product-list?type=cpu&stock=unavailable` — pusty wynik w obecnych danych; nie jest awarią.
- `/product-list?type=gpu&type=cpu&sort=newest` — wszystkie kategorie, najnowsze produkty i komunikat o błędnej kategorii.
- `/product-list/1` — istniejący produkt; `/product-list/9` — produkt ze stanem zero.

`catalog-query.ts` interpretuje adres przed zapytaniem repozytorium. Brakujące ustawienia przyjmują wartości domyślne bez komunikatu. Nieznana, pusta lub powtórzona wartość rozpoznanego parametru przywraca tylko jego wartość domyślną i wyświetla krótką informację. Pozostałe poprawne ustawienia zostają zachowane; nieznane nazwy parametrów są ignorowane. Repozytorium otrzymuje typowane kryteria, a nie surowy obiekt adresu.

Zmiana kontrolki zapisuje nowy URL przez `router.push`, zachowując inne ustawienia. Umożliwia odtworzenie widoku z linku oraz Wstecz/Dalej pomiędzy zatwierdzonymi zmianami. Nie używamy `replace`, ponieważ zastąpiłby poprzedni wpis historii. Clear filters przywraca `all`, `all`, `name` przez usunięcie tych ustawień z adresu. Reset działa także przy pustym wyniku.

## Szczegóły produktu i nawigacja

Katalog i szczegóły mają osobne `loading.tsx` z animowanymi skeletonami. Katalog pokazuje placeholdery nagłówka, kontrolek i kart; szczegóły — tytułu, obrazu, opisu i danych produktu. `ProductNavigation` otacza zawartość wyrenderowaną na serwerze i pokazuje właściwy skeleton podczas oczekiwania na przejście przez link produktu lub powrót do katalogu. Nie pobiera danych ani nie otrzymuje tablicy produktów. Zachowuje zwykłe linki i obsługę otwierania w nowej karcie. Nie dodaje sztucznego opóźnienia: gotowa strona z cache może pojawić się natychmiast. Skeletony mają `aria-busy`, komunikat dla czytników ekranu i wyłączają animację dla `prefers-reduced-motion`. Widoczność obu wariantów sprawdzono w przeglądarce przy spowolnionej sieci, także na szerokości 390 px.

Strona pokazuje nazwę, kod, kategorię, opis, cenę w PLN, stan magazynowy, datę i obraz. `price` oznacza grosze, więc cena jest dzielona przez 100. Data jest formatowana dla `pl-PL` w strefie `Europe/Warsaw`. Obrazy używają `next/image`, mają tekst alternatywny i wymiary oraz skalują się do szerokości ekranu. To jawnie opisane ilustracje kategorii, nie fotografie poszczególnych modeli.

Akceptowane ID to liczby `1–2147483647`, zapisane cyframi ASCII bez znaku i zer wiodących. Cała wartość tekstowa, `Number.isSafeInteger` i zakres są sprawdzane przed odczytem repozytorium. `abc`, `12abc`, `0`, `-1`, `01`, `2147483648`, liczby poza bezpiecznym zakresem i poprawne, lecz nieznane ID prowadzą do `notFound()`. Widok braku produktu zawiera link do katalogu. Stan zero nie oznacza braku produktu.

`generateMetadata` korzysta z tego samego repozytorium i ustawia nazwę produktu jako tytuł. Strona i metadane współdzielą funkcję opakowaną w React `cache`, która deduplikuje zgodne odczyty podczas renderowania. Nie zastępuje to trwałego źródła danych.

`NavLink` używa `usePathname`. Dokładne dopasowanie ma `aria-current="page"`, a link sekcji na stronie potomnej `aria-current="location"`. Granica segmentu utrzymuje aktywny katalog na `/product-list/1`, ale nie na `/product-list-extra`. Logo strony głównej jest aktywne tylko dla `/`. Aktywne linki mają stałe wyróżnienie, a nawigacja widoczny fokus klawiatury.

## Odpowiedzi architektoniczne

### Gdzie wykonują się odczyt i walidacja?

Strona serwerowa rozwiązuje `params` lub `searchParams` przez `await`, interpretuje adres i wywołuje repozytorium w Node.js. Repozytorium odczytuje i waliduje JSON, filtruje oraz sortuje dane. `ProductList` renderuje karty na serwerze; komponenty klienta obejmują interaktywne kontrolki, aktywny link, skeleton podczas nawigacji i ponowienie po awarii. Katalog nie wysyła żądania do własnego API.

### Czym różnią się błędny format, brak produktu i awaria?

Błędny format odrzucamy przed zapytaniem. Dla poprawnego ID repozytorium może zwrócić `null`, co oznacza brak produktu. Oba przypadki prowadzą do `notFound()`. Wyjątek odczytu lub walidacji danych pozostaje awarią; nie zamieniamy go na `null`. Next.js loguje przyczynę na serwerze, a użytkownik otrzymuje bezpieczny widok błędu właściwy dla danej fazy renderowania, bez szczegółów wyjątku.

### Dlaczego folder [id] nie oznacza zawsze renderowania przy żądaniu?

Folder określa dopasowanie segmentu, a nie moment generowania HTML. W tym projekcie `generateStaticParams` przygotowuje trzy strony podczas build. Pozostałe poprawne ID są obsługiwane na żądanie dzięki `dynamicParams=true`.

### Dlaczego walidujemy adres mimo ograniczonych kontrolek?

URL można wpisać ręcznie lub otrzymać w linku. `searchParams` strony jest zwykłym obiektem: wartości mają typ `string | string[] | undefined`. Powtórzenie klucza daje tablicę; parser uznaje takie ustawienie za błędne. Nie traktujemy tego obiektu jak `URLSearchParams`.

### Dlaczego ustawienia nie wystarczą w useState?

Stan wyłącznie w komponencie nie odtworzyłby widoku po skopiowaniu linku lub odświeżeniu. Źródłem ustawień jest URL. `useSearchParams` pozwala kontrolkom zachować inne parametry podczas zmiany adresu. Główny odczyt odbywa się na serwerze przez `await searchParams`; build sprawdza ten wariant poza trybem developerskim. Przy statycznym prerenderowaniu komponent z `useSearchParams` wymaga granicy Suspense; katalog tutaj korzysta z odczytu parametrów podczas żądania.

### Co zachowuje Link, a co zmienia pełne przeładowanie?

`Link` wykonuje nawigację klientową, zachowując wspólny layout, nagłówek i stan jego komponentów klienta. `page.tsx` definiuje zawartość trasy, a `layout.tsx` wspólny układ przez `children`. Pełne wejście tworzy nowy dokument. W przeglądarce potwierdzono żądanie dokumentu HTML przy wejściu bezpośrednim i pobranie danych React Server Components z nagłówkiem RSC przy przejściu przez `Link`. Wstecz przywraca poprzedni adres z filtrami; jawny link z produktu pozwala wrócić do katalogu także bez odpowiedniej historii.

### Czy use client wyklucza początkowy HTML z serwera?

Nie. Komponent klienta może uczestniczyć w początkowym renderowaniu HTML, a następnie zostać uwodniony w przeglądarce. Przeglądarka otrzymuje HTML, dane nawigacji RSC i kod komponentów klienta. Aktywny link wymaga tylko ścieżki, nie tablicy produktów. Import JSON do komponentu klienta dołączyłby dane do pakietu, dlatego odczyt pozostaje w repozytorium oznaczonym `server-only`.

### Czym różni się widok braku produktu od statusu HTTP?

Po rozpoczęciu streamingu wysłany status `200` nie może zostać zmieniony na `404`. Next.js może mimo tego wyświetlić `not-found`. Sprawdzamy osobno status i widoczną stronę. `error.tsx` obejmuje stronę oraz potomków segmentu, ale nie layout tego samego segmentu. Błędy metadanych i generowania mogą korzystać z innej bezpiecznej odpowiedzi frameworka.

## Rozszerzenie: prerenderowanie szczegółów

`generateStaticParams` wybiera trzy najniższe ID ze wspólnego repozytorium, nie mutując zwróconej tablicy. Przy obecnych danych to `/product-list/1`, `/product-list/2`, `/product-list/3`. Wybór jest deterministyczny. Przed rozszerzeniem build pokazywał dynamiczną trasę szczegółów; teraz pokazuje trzy strony oznaczone `●` (SSG).

W Next.js 16.3.8 ustawiono jawnie `dynamicParams=true`, aby pozostałe istniejące produkty nadal działały. `/product-list/4` jest generowany przy pierwszym żądaniu wraz z metadanymi. Przy `dynamicParams=false` produkt poza wybranym zbiorem nie miałby dostępnej strony. Nieznane ID nadal prowadzą do `notFound()`.

Ograniczenie: szczegóły mogą być serwowane z cache; zmiana JSON po build nie zapewnia natychmiastowej aktualizacji. Katalog nadal odczytuje dane przy żądaniu. Przed Lab 08 trzeba usunąć eksperyment i zapewnić odczyt aktualnych danych przy każdym żądaniu, np. przez `dynamic="force-dynamic"` po sprawdzeniu konfiguracji kolejnego laboratorium.

Łącznie z poniższymi funkcjami zrealizowano cztery z pięciu rozszerzeń. Do pełnego zestawu pozostaje deterministyczny panel trzech polecanych produktów przez Parallel Routes. Slot `@modal` korzysta z tras równoległych, ale sam nie zastępuje wymaganego panelu rekomendacji.

## Rozszerzenie: catch-all katalogu

`/catalog/[[...slug]]` obsługuje opcjonalną tablicę segmentów: `/catalog` pokazuje wszystkie produkty, `/catalog/cpu` kategorię, a `/catalog/cpu/4` produkt w kategorii. `/catalog/required/[...slug]` obsługuje wymagany wariant: np. `/catalog/required/cpu` i `/catalog/required/cpu/4`. Samo `/catalog/required` pokazuje brak strony. Oddzielny prefiks pozwala porównać obie konwencje bez konfliktu tras. Podstawowe `/product-list/[id]` pozostaje zachowane.

Parser dopuszcza zero segmentów tylko w wariancie opcjonalnym, następnie kategorię i najwyżej jeden identyfikator. Sprawdza kategorię, format i zakres ID przed odczytem. Odczytany produkt musi należeć do kategorii z adresu; `/catalog/cpu/1` jest odrzucane, ponieważ produkt 1 jest dyskiem. Nadmiar segmentów, nieznane kategorie i brak produktu prowadzą do widoku `not-found`. Awaria repozytorium pozostaje awarią.

`slug` jest tablicą części ścieżki w `params`; parametry zapytania znajdują się w osobnym `searchParams`. Dlatego `/catalog/cpu?type=gpu` nadal pokazuje CPU. Testy sprawdzają oba warianty, root, kategorie, zgodność produktu, błędne ID, liczbę segmentów i odświeżenie.

## Rozszerzenie: modal obrazu przez Intercepting Routes

Kliknięcie obrazu produktu prowadzi przez `Link` do `/product-list/<id>/image`, a `@modal/(.)product-list/[id]/image/page.tsx` przechwytuje nawigację i pokazuje obraz nad zachowaną stroną. Bezpośrednie wejście i odświeżenie tego samego URL renderują pełną stronę obrazu z linkiem powrotu. Oba widoki pobierają produkt z tego samego repozytorium.

`@modal` jest nazwanym slotem layoutu, nie segmentem URL. `(.)` wskazuje segment na tym samym poziomie routingu co slot; poziomy `(.)`, `(..)`, `(..)(..)` i `(...)` liczą segmenty tras, pomijając sloty. Root layout renderuje `children` i `modal`. Każdy docelowy URL obrazu ma rzeczywistą stronę `children`, więc dodatkowe `default.tsx` dla `children` nie jest tu potrzebne.

`default.tsx` daje pusty slot przy wejściu bezpośrednim. Osobne `@modal/page.tsx` i `@modal/[...catchAll]/page.tsx` czyszczą slot przy przejściu na root i inne strony; sam default nie czyściłby zachowanego modalu podczas każdej nawigacji klientowej.

Modal korzysta z natywnego `dialog`, przycisku zamknięcia, Escape i kliknięcia tła. Tab oraz Shift+Tab pozostają w dialogu, tło jest nieaktywne, a zamknięcie przywraca fokus do obrazu. Wstecz zamyka modal, Dalej ponownie go otwiera. Link wewnątrz modalu pozwala przejść do szczegółów i sprawdzić wyczyszczenie slotu. Test produkcyjny obejmuje te zachowania, bezpośredni URL, refresh i ekran 390 px.

## Rozszerzenie: Tailwind CSS 4

Zainstalowano dokładne wersje `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3` i `postcss@8.5.31`, zapisane w lockfile. `postcss.config.mjs` używa wtyczki `@tailwindcss/postcss`, a globalny arkusz importuje `tailwindcss`. Nie używamy konfiguracji Tailwind 3, `init -p` ani dyrektyw `@tailwind`.

Klasy utility stylują karty i linki katalogu, szczegóły produktu, widoki catch-all oraz modal: odstępy, typografię, responsywny układ, kolory i fokus. Istniejący CSS katalogu przeniesiono do warstwy `components`, aby utility mogły go rozszerzać. Skeletony zachowują CSS Modules. Zmiana stylowania nie zmienia kontraktu danych ani filtrów. Sprawdzenia obejmują rzeczywiste style, etykiety, widoczny fokus i brak poziomego przewijania na ekranie 390 px.

Style szczegółów wydzielono do `app/components/product-details.module.css`: moduł używa `@reference "tailwindcss"` i `@apply`, a `ProductDetails.tsx` odwołuje się do nazw takich jak `styles.panel` i `styles.facts`. Tailwind nadal generuje te same style, w tym breakpointy, hover, fokus i obsługę ograniczonego ruchu.

## API produktów

`GET /api/products` zwraca tablicę produktów. Zachowuje dotychczasowe opcje API i dodatkowo obsługuje ustawienia katalogu Lab 07.

| Parametr    | Dozwolone wartości                                               | Gdy pominięty                                |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `type`      | `all`, `cpu`, `gpu`, `ram`, `disk`                               | Wszystkie kategorie                          |
| `stock`     | `all`, `available`, `unavailable`                                | Wszystkie produkty                           |
| `sort`      | `name`, `newest`, `nameAsc`, `nameDesc`, `priceAsc`, `priceDesc` | `nameAsc` dla zgodności z dotychczasowym API |
| `available` | `true`, `false`; starszy parametr                                | Bez ograniczenia                             |

`available=true` wybiera stan większy od zera; `false` nie ogranicza dostępności. Nie można łączyć go ze `stock`. Przykład: `/api/products?type=gpu&stock=available&sort=newest`. Katalog używa repozytorium bezpośrednio, więc jego domyślne `sort=name` jest niezależne od historycznego ustawienia API.

API stosuje ścisłą walidację: nieznane nazwy, niedozwolone/puste wartości i powtórzone parametry dają `400`. To inne zachowanie niż tolerancyjna interpretacja URL strony. Awaria daje bezpieczny JSON `500` i log serwerowy. POST, PUT, PATCH i DELETE nie są zaimplementowane i dają `405`.

## Weryfikacja produkcyjna

Wyniki z 20 października 2026 na Node.js 22.20.0:

| Sprawdzenie               | Wynik                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run lint`            | Bez błędów i ostrzeżeń                                                                                         |
| `npm run test`            | 67 testów w 7 plikach przeszło                                                                                 |
| `npm run build`           | Kompilacja, TypeScript i generowanie stron zakończone poprawnie                                                |
| `npm run test:browser`    | Scenariusze produkcyjne w Edge przeszły                                                                        |
| `npm run test:failures`   | Awarie szczegółów i metadanych oraz odzyskanie działania przeszły                                              |
| `npm run test:extensions` | Weryfikacja catch-all, modalu i Tailwind w przeglądarce                                                        |
| `npm ci`                  | Nie powtarzano w tej sesji; historyczny zapis Lab 06 z 13 października podaje poprawną instalację 441 pakietów |

Testy jednostkowe obejmują poprawne i błędne parametry, brak/puste/powtórzone wartości, ID i zakres, sortowanie i remisy, dostępność, pusty wynik, brak mutacji, aktywne linki, wybór prerenderowanych ID i awarie repozytorium. Zestaw ograniczono ze 142 do 67 testów, usuwając powtarzane warianty API i wielokrotne sprawdzanie tych samych reguł ID. Walidacja ID ma osobne przypadki graniczne, a szczegóły i metadane zachowują sprawdzenia integracji, braku produktu i awarii. Pełne scenariusze przeglądarkowe pozostają bez zmian. Mocki nie zmieniają danych. Alias `server-only` na pusty moduł obowiązuje tylko w konfiguracji Vitest.

Testy przeglądarkowe wymagają wcześniejszego build oraz Edge, Chrome lub Chromium:

```bash
npm run build
npm run test:browser
npm run test:failures
npm run test:extensions
```

Skrypty korzystają z narzędzi Node.js i protokołu debugowania Chromium, bez dodatkowych zależności. `BROWSER_PATH` wskazuje niestandardowy plik przeglądarki. W ograniczonym środowisku tej sesji użyto `BROWSER_NO_SANDBOX=1`; zwykłe uruchomienie zachowuje domyślne zabezpieczenia. Lokalny serwer i osobny profil przeglądarki są usuwane po teście. Nie trzeba wcześniej uruchamiać `npm run start`.

Sprawdzone scenariusze: łączne filtry i sortowanie, skopiowany URL, odświeżenie, Wstecz/Dalej dla filtrów i produktu, aktywna sekcja, reset, pusty wynik dla niedostępnych CPU, fokus klawiatury, produkty dostępne i ze stanem zero, obrazy i tytuły, błędne/nieznane ID, komunikaty URL, porównanie HTML/RSC, manifest prerenderowania i istniejący produkt poza wybranym zbiorem.

Test awarii tworzy kopię `.verification-failures-*`, współdzieli zainstalowane zależności przez dowiązanie i wstrzykuje odrzucenie obietnicy wyłącznie w repozytorium kopii. Osobne klucze cache izolują szczegóły od metadanych. Kopia jest budowana z wyłączoną awarią; wymuszenie działa tylko w testowym uruchomieniu. Używany jest produkt spoza prerenderowanego zbioru, aby wywołać odczyt podczas żądania. Test sprawdza bezpieczny widok, log przyczyny, brak prywatnego komunikatu w HTML i UI oraz odzyskanie działania. Oryginalne źródła i dane pozostają niezmienione; kopia jest usuwana po teście.

##
