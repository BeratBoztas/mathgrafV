# MatGraf Pro — Katmanli Mimari (Python Flask + Moduler On Yuz)

Bu proje; her turlu matematik ifadesinin X-Y grafigini cizen, grafiksiz dort islem yapan, ayrica **Trigonometri**, **Turev (d/dx)** ve **Integral (∫)** sembol panellerine sahip tam kapsamli bir web uygulamasidir.

## Katmanli Klasor Mimarisi
- `app.py` : Flask uygulama baslaticisi (Factory pattern + CORS)
- `config.py` : Sunucu, port ve grafik sinir ayarlari
- `routes/math_routes.py` : Tum HTTP/JSON API uc noktalari (`/`, `/api/hesapla`, `/api/turev`, `/api/integral`, `/api/saglik`)
- `services/parser_service.py` : Turkce ifade donusturucu ve guvenli AST cozumleyici
- `services/calculus_service.py` : Sembolik + sayisal turev ve integral motoru (SymPy destekli)
- `services/graph_service.py` : Her turlu fonksiyon icin X-Y grafik nokta uretici
- `templates/index.html` : Sadece yapisal HTML iskeleti
- `static/css/style.css` : Tema, cam efektleri ve duzen stilleri
- `static/js/math_engine.js` : On yuz ifade motoru, turev/integral yardimcilari ve Python API istemcisi
- `static/js/graph_renderer.js` : Yuksek cozunurluklu X-Y Canvas grafik cizim motoru (belirli integral alan tarama destekli)
- `static/js/app.js` : Kullanici arayuzu kontrolcusu, sekmeli sembol tus takimi ve olay dinleyicileri
- `render.yaml` & `Procfile` : Herkesin internette erisebilmesi icin hazir bulut yayin dosyalari

## Bilgisayarinda Calistirma
```bash
pip install -r requirements.txt
python app.py
```
Ardindan tarayicida `http://127.0.0.1:5000` adresini ac.

## Herkesin Erisecegi Sekilde Internette Yayinlama (Ucretsiz)
1. Bu klasoru bir **GitHub** deposuna yukle.
2. **Render.com** adresine gir -> **New** -> **Blueprint** (veya **Web Service**) secip GitHub deponu bagla.
3. `render.yaml` dosyasi sayesinde kurulum (`pip install -r requirements.txt`) ve baslatma (`gunicorn app:app`) otomatik ayarlanir.
4. Yayin tamamlandiginda verilen `https://matgraf-pro.onrender.com` benzeri baglantiyi paylastiginda herkes telefonundan veya bilgisayarindan dogrudan girebilir.
