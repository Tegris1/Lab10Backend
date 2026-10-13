# Sklep z podzespołami komputerowymi

Projekt edukacyjny oparty na Next.js i App Routerze. Katalog zawiera 100 przykładowych produktów: CPU, GPU, RAM i dyski. Frontend pobiera dane przez API, filtruje je według kategorii i dostępności oraz pozwala sortować według nazwy lub ceny. Produkty tworzą pionową listę kart z opisem, ikoną, ceną w PLN i stanem magazynowym. Stylowanie wykorzystuje zwykły CSS, bez Tailwind.

Koszyk i historia zamówień mają tylko widoki zastępcze. Aplikacja nie realizuje zakupów.

## Środowisko i dokładne wersje

Wersje sprawdzone 13 października 2026 r. przez `node --version`, `npm --version`, `npm ls --depth=0` i porównanie z `package-lock.json`:

| Narzędzie / pakiet           | Wersja          |
| ---------------------------- | --------------- | --- |
|                              |
| Node.js                      | 24.2.0          |
| npm                          | 10.9.3          |
| Next.js                      | 16.3.8          |
| React / React DOM            | 19.2.8 / 19.2.8 |
| TypeScript                   | 5.9.3           |
| ESLint                       | 9.39.5          |
| eslint-config-next           | 16.3.8          |
| Vitest                       | 4.1.11          |
| Express / cors               | 5.2.1 / 2.8.6   |
| @types/node                  | 20.19.43        |     |
| @types/express / @types/cors | 5.0.6 / 2.8.19  |

## Instalacja i uruchomienie

Uruchamiaj polecenia z katalogu głównego repozytorium. Do odtworzenia sprawdzonego środowiska użyj Node.js 22.20.0 i npm 10.9.3.

```bash
npm ci
npm run dev
```

Adres aplikacji: [http://localhost:3000](http://localhost:3000). Katalog: [http://localhost:3000/pages/product-list](http://localhost:3000/pages/product-list).

Weryfikacja i uruchomienie produkcyjne:

```bash
npm run lint
npm run test
npm run build
npm run start
```

Domyślny port to 3000. Można wskazać inny:

## Struktura i trasy

```text
app/
  layout.tsx                      wspólny layout i nagłówek
  global.css                      style globalne
  page.tsx                        strona główna
  not-found.tsx                   widok nieznanego adresu
  api/products/route.ts           GET /api/products
  components/
    Header.tsx                    logo i nawigacja Link
    ProductList.tsx               pobieranie API i karty produktów
    ProductFilters.tsx            filtry kategorii i dostępności
    SortRadio.tsx                 wybór sortowania
    CategoryIcon.tsx              ikony SVG kategorii
    product-list.css              style katalogu
  pages/
    about/page.tsx
    basket/page.tsx
    order-history/page.tsx
    product-list/page.tsx          odczyt parametrów URL
    product-list/error.tsx         granica błędów segmentu
  types/products.ts               typy danych
lib/products/product-repo.tsx     serwerowy odczyt, walidacja i filtrowanie
data/products.json               przykładowy katalog
tests/                           testy repozytorium i API
scripts/product-generator.ts     generator przykładowych danych
public/                          zasoby statyczne
```

| Adres                  | Aktualna funkcja                  |
| ---------------------- | --------------------------------- |
| `/`                    | Prosty widok strony głównej       |
| `/pages/about`         | Prosty widok informacji o sklepie |
| `/pages/product-list`  | Katalog pobierany przez API       |
| `/pages/basket`        | Widok zastępczy koszyka           |
| `/pages/order-history` | Widok zastępczy historii zamówień |
| `/api/products`        | API produktów, tylko odczyt       |

Folder `app/pages` jest zwykłym segmentem App Routera, dlatego `pages` występuje w adresach. Nie jest to katalog `pages/` starszego Pages Routera. Pusty plik `app/pages/api/products.ts` nie definiuje endpointu; rzeczywista implementacja znajduje się w `app/api/products/route.ts`.

## 1. Struktura i routing

### 1. Czym różnią się `page.tsx` i `layout.tsx`?

`page.tsx` definiuje zawartość konkretnej strony i udostępnia trasę danego segmentu. `layout.tsx` otacza strony przez `children` i definiuje wspólne elementy. Główny layout zawiera także `<html>` i `<body>`. Tutaj dodaje nagłówek i style, a strona katalogu odczytuje parametry URL. [Dokumentacja stron i layoutów](https://nextjs.org/docs/app/getting-started/layouts-and-pages).

### 2. Czy do publicznej strony potrzeba osobnego layoutu?

Nie. Strona publiczna może korzystać z głównego `app/layout.tsx`, jak wszystkie strony tego projektu. Dodatkowy layout ma sens, jeśli część aplikacji potrzebuje innego wspólnego układu. Publiczny dostęp nie wymaga osobnego layoutu, a sam layout nie stanowi mechanizmu autoryzacji. [Dokumentacja layoutów](https://nextjs.org/docs/app/api-reference/file-conventions/layout).

### 3. Co w nawigacji przez `Link` pozostaje wspólne?

Przy przejściu między trasami współdzielącymi layout pozostaje on zamontowany i zachowuje stan swoich komponentów klienta. Tutaj wspólne są nagłówek, logo i nawigacja. Zmienia się zawartość strony.

## 2. Granica serwer–klient

Przepływ danych: przeglądarka → `GET /api/products` → `listProducts` → `data/products.json` → odpowiedź JSON → karty produktów.

### 4. Gdzie wykonuje się funkcja repozytorium?

`listProducts` wykonuje się na serwerze Node.js

### 5. Jakie dane trafiają do przeglądarki?

HTML, parametry katalogu i JavaScript komponentów klienta.

### 6. Dlaczego import całego JSON do komponentu klienta zmienia architekturę?

Import dołącza dane do kodu dostarczanego przeglądarce, zamiast pobierać je przez API. Zwiększa pakiet klienta, udostępnia cały plik niezależnie od filtrów i wymaga przebudowania aplikacji po zmianie danych. Filtrowanie może wtedy odbywać się w przeglądarce.

### 7. Czy `use client` wyklucza początkowe renderowanie HTML na serwerze?

Nie. Komponenty klienta mogą uczestniczyć w przygotowaniu początkowego HTML na serwerze.

### 9. Czy granica `error.tsx` przechwytuje błąd layoutu w tym samym segmencie?

Nie. Granica znajduje się wewnątrz layoutu danego segmentu: obejmuje stronę i potomków, ale nie ten layout.

W katalogu `error.tsx` obsługuje nieoczekiwane błędy renderowania segmentu. Błędy asynchronicznego `fetch` są przechwytywane lokalnie w `ProductList.tsx`: użytkownik widzi ogólny komunikat i przycisk ponowienia żądania.

### 10. Dlaczego widok „nie znaleziono” nie zawsze oznacza HTTP 404 w odpowiedzi strumieniowej?

Jeśli serwer rozpoczął strumieniowanie i wysłał nagłówki z HTTP `200`, nie może później zmienić statusu na `404`. Może jednak wyrenderować widok `not-found`.

## API, filtry i sortowanie

`GET /api/products` zwraca tablicę produktów w JSON.

| Parametr    | Dozwolone wartości                             | Gdy pominięty       |
| ----------- | ---------------------------------------------- | ------------------- |
| `type`      | `cpu`, `gpu`, `ram`, `disk`                    | Wszystkie kategorie |
| `available` | `true`, `false`                                | Wszystkie produkty  |
| `sort`      | `nameAsc`, `nameDesc`, `priceAsc`, `priceDesc` | `nameAsc`           |

`available=true` wybiera produkty z `amount > 0`; `false` nie ogranicza dostępności. Przykład: `/api/products?type=gpu&available=true&sort=priceAsc`. Cena jest całkowitą liczbą groszy; frontend dzieli ją przez 100 i formatuje jako PLN.

Nieznane parametry, niedozwolone lub puste wartości i powtórzone parametry dają HTTP `400` z JSON-em błędu. POST, PUT, PATCH i DELETE nie są zaimplementowane i dają `405`. [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).

Kontrolki zapisują filtry i sortowanie w URL. Odświeżenie odtwarza wybór, a „Clear filters” zachowuje sortowanie. Niepoprawne wartości URL strony są zastępowane ustawieniami domyślnymi; bezpośrednie API stosuje ścisłą walidację. Frontend obsługuje ładowanie, pusty wynik i ponowienie po błędzie, a nieaktualne żądania anuluje przez `AbortController`.

## Wyniki weryfikacji

Polecenia wykonano ponownie 13 października 2026 r. na aktualnym kodzie:

| Polecenie                      | Wynik                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `npm ci`                       | Kod wyjścia 0; zainstalowano 441 pakietów. Ostrzeżenie `deprecated` dla ESLint 9.39.5.                       |
| `npm run lint`                 | Kod wyjścia 0; bez błędów, 2 ostrzeżenia o nieużywanych importach `Geist` i `Geist_Mono` w `app/layout.tsx`. |
| `npm run test`                 | Kod wyjścia 0; 40 testów w 2 plikach przeszło.                                                               |
| `npm run build`                | Kod wyjścia 0; kompilacja, kontrola TypeScript i generowanie stron zakończone poprawnie.                     |
| `npm run start -- --port 3100` | Serwer produkcyjny uruchomił się poprawnie; wykonano poniższe sprawdzenia HTTP.                              |

Build oznaczył `/api/products` i `/pages/product-list` jako trasy dynamiczne, a pozostałe strony jako statyczne.

Po zmianie głównego layoutu powtórzono lint i build oraz sprawdzono ponownie strony, logo, HTTP `404` i API z połączonymi filtrami oraz sortowaniem. Potwierdzono również `lang="pl"` w produkcyjnym HTML. Wyniki w tabeli uwzględniają tę końcową weryfikację.

`tests/product-repo.test.ts` sprawdza sortowanie, filtry, pusty wynik, odczyt po ID, walidację, brak mutacji danych i błędy odczytu/JSON. `tests/products-api.test.ts` sprawdza parametry, przekazywanie filtrów, wyniki, HTTP `400` i bezpieczną odpowiedź `500`. Testy używają mocków i nie zmieniają katalogu danych. Alias `server-only` na pusty moduł obowiązuje tylko w konfiguracji Vitest.
