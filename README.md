# bossite

Statický web v HTML, CSS a JavaScripte. Na lokálne spustenie stačí Python 3,
bez inštalácie ďalších balíkov.

## Lokálne spustenie

V koreňovom priečinku projektu spusti:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Otvor <http://localhost:8000/>. Fotogaléria je na
<http://localhost:8000/rolls/>. Server zastavíš pomocou `Ctrl+C`.
Po úprave súborov stačí obnoviť stránku v prehliadači.

Spracovanie nových fotografií opisuje [návod galérie](rolls/README.md).
